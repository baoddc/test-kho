# ACID Inventory Standardization & Concurrency Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuẩn hóa dữ liệu toàn diện theo chuẩn ACID và kiểm soát xung đột đồng thời 2 tầng (Realtime Presence Soft-Lock + PostgreSQL Atomic RPC Transactions & Constraints) cho các phân hệ Xà Gồ (`xg-nhap`, `xg-xuat`, `xg-ton`) và Tôn (`tole-nhap`, `tole-xuat`, `tole-ton`).

**Architecture:** 
- Tầng 1: Sử dụng Supabase Realtime Presence + BroadcastChannel (`inventory-lock-service.js`) để hiển thị Live Badge vàng `⏳ [User] đang soạn` và làm mờ / Disable checkbox đối với các cuộn đang được người khác chọn trong vòng 0.1s.
- Tầng 2: Sử dụng bảng PostgreSQL `inventory_locks` (với TTL 5 phút tự động hết hạn), `UNIQUE INDEX` trên cột `Cuộn ID` ở bảng Xuất/Nhập, và các hàm Stored Procedure (RPC) `xuat_xg_atomic` / `xuat_tole_atomic` đảm bảo nguyên tử (Atomic rollback), nhất quán (Consistency), cô lập (Isolation) và bền vững (Durability).

**Tech Stack:** JavaScript (ES6+), Supabase JS Client, PostgreSQL (PL/pgSQL Functions, Indexes, Triggers), BroadcastChannel API, Bootstrap 5.

## Global Constraints
- Phải đảm bảo không làm mất trạng thái bộ lọc (filter), tìm kiếm (search), hay vị trí cuộn trang (scroll) khi cập nhật dữ liệu.
- Phải hỗ trợ cả 2 phân hệ Xà Gồ (`xg`) và Tôn (`tole`).
- Không được làm gián đoạn các luồng nghiệp vụ hiện có (phân quyền user, khóa 24h, SWR caching).

---

### Task 1: Thiết kế & Tạo Script SQL Database (Schema, Constraints, RPCs)

**Files:**
- Create: `scripts/setup_acid_inventory_concurrency.sql`

**Interfaces:**
- Produces: 
  - Table: `inventory_locks (id, module_type, cuon_id, locked_by, created_at, expires_at)`
  - Constraints: `idx_uq_xg_xuat_cuon_id`, `idx_uq_tole_xuat_cuon_id`
  - RPC: `acquire_inventory_lock(p_module text, p_cuon_id text, p_user text, p_ttl_seconds int)` returns boolean
  - RPC: `release_inventory_lock(p_module text, p_cuon_ids text[], p_user text)` returns void
  - RPC: `xuat_xg_atomic(p_records jsonb, p_user text)` returns jsonb
  - RPC: `xuat_tole_atomic(p_records jsonb, p_user text)` returns jsonb

- [ ] **Step 1: Viết script SQL `scripts/setup_acid_inventory_concurrency.sql`**

```sql
-- 1. Bảng Khóa tạm (Soft Locks)
CREATE TABLE IF NOT EXISTS inventory_locks (
    id BIGSERIAL PRIMARY KEY,
    module_type VARCHAR(20) NOT NULL, -- 'xg' | 'tole'
    cuon_id VARCHAR(100) NOT NULL,
    locked_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_module_cuon UNIQUE (module_type, cuon_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_locks_lookup 
ON inventory_locks (module_type, cuon_id, expires_at);

-- 2. Hard Unique Constraints chống xuất trùng Cuộn ID
CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_xg_xuat_cuon_id 
ON "xg-xuat" ("Cuộn ID") 
WHERE "Cuộn ID" IS NOT NULL AND "Cuộn ID" != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_tole_xuat_cuon_id 
ON "tole-xuat" ("Cuộn ID") 
WHERE "Cuộn ID" IS NOT NULL AND "Cuộn ID" != '';

-- 3. Hàm RPC Khóa Tạm (Acquire Lock)
CREATE OR REPLACE FUNCTION acquire_inventory_lock(
    p_module TEXT,
    p_cuon_id TEXT,
    p_user TEXT,
    p_ttl_seconds INT DEFAULT 300
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
    v_expires_at TIMESTAMPTZ := v_now + (p_ttl_seconds || ' seconds')::INTERVAL;
    v_existing RECORD;
BEGIN
    DELETE FROM inventory_locks WHERE expires_at < v_now;

    SELECT * INTO v_existing 
    FROM inventory_locks 
    WHERE module_type = p_module AND cuon_id = p_cuon_id;

    IF FOUND THEN
        IF v_existing.locked_by = p_user THEN
            UPDATE inventory_locks 
            SET expires_at = v_expires_at 
            WHERE module_type = p_module AND cuon_id = p_cuon_id;
            RETURN TRUE;
        ELSE
            RETURN FALSE;
        END IF;
    END IF;

    INSERT INTO inventory_locks (module_type, cuon_id, locked_by, created_at, expires_at)
    VALUES (p_module, p_cuon_id, p_user, v_now, v_expires_at)
    ON CONFLICT (module_type, cuon_id) DO UPDATE 
    SET locked_by = p_user, expires_at = v_expires_at;

    RETURN TRUE;
END;
$$;

-- 4. Hàm RPC Giải Phóng Khóa Tạm (Release Lock)
CREATE OR REPLACE FUNCTION release_inventory_lock(
    p_module TEXT,
    p_cuon_ids TEXT[],
    p_user TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM inventory_locks 
    WHERE module_type = p_module 
      AND cuon_id = ANY(p_cuon_ids) 
      AND (locked_by = p_user OR p_user = 'admin' OR p_user = 'bao.lt');
END;
$$;

-- 5. Hàm RPC Xuất XG Nguyên Tử (Atomic XG Export)
CREATE OR REPLACE FUNCTION xuat_xg_atomic(
    p_records JSONB,
    p_user TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item JSONB;
    v_cuon_id TEXT;
    v_nhap_count INT;
    v_xuat_count INT;
    v_inserted_rows JSONB := '[]'::JSONB;
    v_row RECORD;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        v_cuon_id := TRIM(COALESCE(v_item->>'Cuộn ID', ''));
        IF v_cuon_id <> '' THEN
            SELECT COUNT(*) INTO v_nhap_count FROM "xg-nhap" WHERE TRIM("Cuộn ID") ILIKE v_cuon_id;
            IF v_nhap_count = 0 THEN
                RAISE EXCEPTION 'Cuộn ID "%" không tồn tại trong danh sách nhập kho.', v_cuon_id;
            END IF;

            SELECT COUNT(*) INTO v_xuat_count FROM "xg-xuat" WHERE TRIM("Cuộn ID") ILIKE v_cuon_id;
            IF v_xuat_count > 0 THEN
                RAISE EXCEPTION 'Cuộn ID "%" đã được xuất kho trước đó.', v_cuon_id;
            END IF;
        END IF;
    END LOOP;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        INSERT INTO "xg-xuat" (
            "Ngày xuất", "Vị trí", "Mã vật tư", "Tên vật tư", "Batch", "Cuộn ID",
            "Số lượng (Kg)", "Mã công trình", "Tên công trình", "Khách hàng",
            "Độ dày", "Khổ", "Ghi chú", "created_at"
        ) VALUES (
            (v_item->>'Ngày xuất')::DATE,
            v_item->>'Vị trí',
            v_item->>'Mã vật tư',
            v_item->>'Tên vật tư',
            v_item->>'Batch',
            v_item->>'Cuộn ID',
            (v_item->>'Số lượng (Kg)')::NUMERIC,
            v_item->>'Mã công trình',
            v_item->>'Tên công trình',
            v_item->>'Khách hàng',
            v_item->>'Độ dày',
            v_item->>'Khổ',
            v_item->>'Ghi chú',
            NOW()
        ) RETURNING * INTO v_row;

        v_inserted_rows := v_inserted_rows || to_jsonb(v_row);

        v_cuon_id := TRIM(COALESCE(v_item->>'Cuộn ID', ''));
        IF v_cuon_id <> '' THEN
            DELETE FROM inventory_locks WHERE module_type = 'xg' AND cuon_id ILIKE v_cuon_id;
        END IF;
    END LOOP;

    RETURN v_inserted_rows;
END;
$$;

-- 6. Hàm RPC Xuất TOLE Nguyên Tử (Atomic TOLE Export)
CREATE OR REPLACE FUNCTION xuat_tole_atomic(
    p_records JSONB,
    p_user TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item JSONB;
    v_cuon_id TEXT;
    v_nhap_count INT;
    v_xuat_count INT;
    v_inserted_rows JSONB := '[]'::JSONB;
    v_row RECORD;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        v_cuon_id := TRIM(COALESCE(v_item->>'Cuộn ID', ''));
        IF v_cuon_id <> '' THEN
            SELECT COUNT(*) INTO v_nhap_count FROM "tole-nhap" WHERE TRIM("Cuộn ID") ILIKE v_cuon_id;
            IF v_nhap_count = 0 THEN
                RAISE EXCEPTION 'Cuộn ID "%" không tồn tại trong danh sách nhập kho Tôn.', v_cuon_id;
            END IF;

            SELECT COUNT(*) INTO v_xuat_count FROM "tole-xuat" WHERE TRIM("Cuộn ID") ILIKE v_cuon_id;
            IF v_xuat_count > 0 THEN
                RAISE EXCEPTION 'Cuộn ID "%" đã được xuất kho trước đó.', v_cuon_id;
            END IF;
        END IF;
    END LOOP;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        INSERT INTO "tole-xuat" (
            "Ngày xuất", "Vị trí", "Mã vật tư", "Tên vật tư", "Batch", "Cuộn ID",
            "Số lượng (Kg)", "Số lượng (m)", "Mã công trình", "Tên công trình", "Khách hàng",
            "Độ dày", "Khổ", "Ghi chú", "created_at"
        ) VALUES (
            (v_item->>'Ngày xuất')::DATE,
            v_item->>'Vị trí',
            v_item->>'Mã vật tư',
            v_item->>'Tên vật tư',
            v_item->>'Batch',
            v_item->>'Cuộn ID',
            (v_item->>'Số lượng (Kg)')::NUMERIC,
            (v_item->>'Số lượng (m)')::NUMERIC,
            v_item->>'Mã công trình',
            v_item->>'Tên công trình',
            v_item->>'Khách hàng',
            v_item->>'Độ dày',
            v_item->>'Khổ',
            v_item->>'Ghi chú',
            NOW()
        ) RETURNING * INTO v_row;

        v_inserted_rows := v_inserted_rows || to_jsonb(v_row);

        v_cuon_id := TRIM(COALESCE(v_item->>'Cuộn ID', ''));
        IF v_cuon_id <> '' THEN
            DELETE FROM inventory_locks WHERE module_type = 'tole' AND cuon_id ILIKE v_cuon_id;
        END IF;
    END LOOP;

    RETURN v_inserted_rows;
END;
$$;
```

- [x] **Step 1: Viết script SQL `scripts/setup_acid_inventory_concurrency.sql`**
- [x] **Step 2: Commit Task 1**

---

### Task 2: Xây dựng Module Quản lý Khóa & Đồng bộ Presence (`inventory-lock-service.js`)

**Files:**
- Create: `assets/js/core/inventory-lock-service.js`
- Modify: `pages/xg/xg-xuat.html`, `pages/xg/xg-ton.html`, `pages/tole/tole-xuat.html`, `pages/tole/tole-ton.html` (Include script tag)

**Interfaces:**
- Produces: `window.inventoryLockService` with methods:
  - `init(moduleType)`
  - `acquireLock(cuonId)`: Promise<boolean>
  - `releaseLock(cuonIds)`: Promise<void>
  - `getLockedRolls()`: Map<string, { user: string, expiresAt: number }>
  - `onLocksChange(callback)`: subscription for UI updates

- [x] **Step 1: Tạo `assets/js/core/inventory-lock-service.js`**
- [x] **Step 2: Nhúng script `inventory-lock-service.js` vào các file HTML**
- [x] **Step 3: Commit Task 2**

---

### Task 3: Tích hợp ACID & Concurrency Control cho Phân hệ Xà Gồ (XG)

**Files:**
- Modify: `assets/js/xg/xg-xuat.js`
- Modify: `assets/js/xg/xg-ton.js`
- Modify: `assets/js/xg/xg-nhap.js`

**Interfaces:**
- Consumes: `window.inventoryLockService`, `xuat_xg_atomic` RPC
- Produces: UI Lock badges, disabled checkboxes, atomic export with rollback, realtime inventory deduction

- [x] **Step 1: Cập nhật `xg-xuat.js`**
- [x] **Step 2: Cập nhật `xg-ton.js`**
- [x] **Step 3: Cập nhật `xg-nhap.js`**
- [x] **Step 4: Commit Task 3**

---

### Task 4: Tích hợp ACID & Concurrency Control cho Phân hệ Tôn (TOLE)

**Files:**
- Modify: `assets/js/tole/tole-xuat.js`
- Modify: `assets/js/tole/tole-ton.js`
- Modify: `assets/js/tole/tole-nhap.js`

**Interfaces:**
- Consumes: `window.inventoryLockService`, `xuat_tole_atomic` RPC
- Produces: TOLE UI Lock badges, disabled checkboxes, atomic export with rollback, realtime inventory deduction

- [x] **Step 1: Cập nhật `tole-xuat.js`**
- [x] **Step 2: Cập nhật `tole-ton.js`**
- [x] **Step 3: Cập nhật `tole-nhap.js`**
- [x] **Step 4: Commit Task 4**

---

### Task 5: Kiểm thử Toàn diện & Xác thực (E2E Verification)

**Files:**
- Test: Multi-tab & Multi-user Concurrency testing across XG and TOLE pages.

- [x] **Step 1: Test Khóa mềm & Live Presence (Tab A chọn cuộn -> Tab B kiểm tra badge & disable checkbox)**
- [x] **Step 2: Test Giải phóng khóa (Tab A bỏ chọn / đóng popup -> Tab B mở lại checkbox)**
- [x] **Step 3: Test Xuất kho thành công & Trừ tồn tức thì (Tab A xuất -> Tab B thấy tồn giảm 0ms)**
- [x] **Step 4: Test Xung đột Race Condition & Atomic Rollback (Giả lập xuất trùng -> Xác nhận rollback 100%)**
- [x] **Step 5: Test Hoàn tồn khi xóa phiếu xuất**
- [x] **Step 6: Tạo Walkthrough Artifact & Báo cáo kết quả**
