# Thiết kế Kỹ thuật: Chuẩn hóa Dữ liệu ACID & Kiểm soát Xung đột Đồng thời (ACID Inventory Standardization & Concurrency Control)

## 1. Tổng quan & Mục tiêu (Overview & Goals)

Hệ thống quản lý kho Xà Gồ (XG) và Tôn (TOLE) bao gồm 6 phân hệ cốt lõi:
- **Phân hệ Xà Gồ:** `xg-nhap`, `xg-xuat`, `xg-ton` (kèm `xg-bieu-do`).
- **Phân hệ Tôn:** `tole-nhap`, `tole-xuat`, `tole-ton` (kèm `tole-bieu-do`).

### Mục tiêu chính:
1. **Chuẩn hóa theo 4 nguyên tắc ACID:**
   - **Atomicity (Tính nguyên tử):** Thao tác xuất/nhập nhiều cuộn (Batch) thực hiện trong 1 Transaction duy nhất; nếu 1 dòng xảy ra lỗi hoặc xung đột thì toàn bộ giao dịch được Rollback 100%.
   - **Consistency (Tính nhất quán):** Ngăn chặn hoàn toàn việc xuất trùng `Cuộn ID` (Double Export), ngăn chặn xuất cuộn chưa từng nhập hoặc số liệu âm. Tồn kho luôn đảm bảo: `Tồn = Tổng Nhập - Tổng Xuất`.
   - **Isolation (Tính cô lập & Chống Race Condition):** Xử lý triệt để bài toán 2 hoặc nhiều người dùng cùng thao tác chọn/xuất cùng 1 `Cuộn ID` tại cùng một thời điểm.
   - **Durability (Tính bền vững):** Dữ liệu được `COMMIT` trên PostgreSQL Supabase an toàn, đồng bộ tức thì sang Cache local (SWR) và các máy trạm khác.
2. **Kiểm soát Đồng thời 2 Tầng (2-Tier Concurrency Control):**
   - **Tầng 1 (Live UX Presence & Soft-Lock):** Khi User A đang chọn/soạn một cuộn trong popup xuất hàng, cuộn đó sẽ lập tức hiển thị **Badge vàng cảnh báo** (`⏳ [User A] đang chọn`) và **Làm mờ / Disable checkbox** trên màn hình của các User khác trong vòng 0.1s.
   - **Tầng 2 (PostgreSQL Hard Constraints & Atomic RPC Transaction):** Cơ sở dữ liệu sử dụng bảng khóa tạm có hạn giờ (TTL 5 phút), `UNIQUE INDEX` trên cột `Cuộn ID` của bảng xuất, và các hàm Stored Procedure (RPC) `xuat_xg_atomic` / `xuat_tole_atomic` để chốt chặn bảo vệ cuối cùng.

---

## 2. Kiến trúc Hệ thống (System Architecture)

```
                              ┌──────────────────────────────────────┐
                              │  User A: Mở Popup / Chọn Cuộn Xuất   │
                              └──────────────────┬───────────────────┘
                                                 │
                   ┌─────────────────────────────┴─────────────────────────────┐
                   │                                                           │
                   ▼ [TẦNG 1: 0 - 50ms]                                        ▼ [TẦNG 2: ACID RESERVATION]
      [Supabase Realtime Presence]                                   [PostgreSQL: inventory_locks]
    Phát tín hiệu: Cuộn C-001 đang giữ bởi A                       Ghi khóa tạm: C-001 (TTL 5 phút)
                   │                                                           │
                   ▼                                                           ▼
     ┌──────────────────────────────┐                            ┌──────────────────────────────┐
     │ Màn hình User B:             │                            │ Khi User A bấm "Xác nhận"    │
     │ - Trang Tồn: Badge vàng ⏳   │                            │ Gọi RPC: xuat_xg_atomic      │
     │ - Popup Xuất: Disable tick   │                            │ 1. Validate & Lock FOR UPDATE│
     └──────────────────────────────┘                            │ 2. Insert vào bảng xg-xuat   │
                                                                 │ 3. Xóa inventory_locks       │
                                                                 │ 4. Rollback nếu có lỗi       │
                                                                 └──────────────┬───────────────┘
                                                                                │
                                                                                ▼
                                                                  [Broadcast & Realtime Event]
                                                                  Trừ tồn 0ms trên tất cả Client
```

---

## 3. Thiết kế Cơ sở Dữ liệu (Database Schema & PostgreSQL Functions)

### 3.1. Bảng Khóa Tạm Thời Gian Thực (`inventory_locks`)
Bảng lưu vết trạng thái người dùng đang soạn thảo/giữ chỗ cuộn kho:

```sql
CREATE TABLE IF NOT EXISTS inventory_locks (
    id BIGSERIAL PRIMARY KEY,
    module_type VARCHAR(20) NOT NULL, -- 'xg' hoặc 'tole'
    cuon_id VARCHAR(100) NOT NULL,
    locked_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_module_cuon UNIQUE (module_type, cuon_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_locks_lookup ON inventory_locks (module_type, cuon_id, expires_at);
```

### 3.2. Ràng Buộc Cứng (Hard Constraints) Chống Xuất Trùng
Đảm bảo ở mức Database không bao giờ có thể ghi 2 dòng cùng `Cuộn ID` vào bảng Xuất:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_xg_xuat_cuon_id 
ON "xg-xuat" ("Cuộn ID") 
WHERE "Cuộn ID" IS NOT NULL AND "Cuộn ID" != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_tole_xuat_cuon_id 
ON "tole-xuat" ("Cuộn ID") 
WHERE "Cuộn ID" IS NOT NULL AND "Cuộn ID" != '';
```

### 3.3. Các Hàm RPC Quản lý Khóa Tạm (Soft-Lock RPCs)
- **`acquire_inventory_lock(p_module text, p_cuon_id text, p_user text, p_ttl_seconds int)`:**
  - Xóa các khóa cũ đã hết hạn (`expires_at < NOW()`).
  - Kiểm tra xem cuộn có đang bị người khác khóa và còn hạn hay không.
  - Nếu chưa bị ai khóa: Insert/Update khóa mới với thời hạn `NOW() + INTERVAL '5 minutes'`.
- **`release_inventory_lock(p_module text, p_cuon_ids text[], p_user text)`:**
  - Giải phóng khóa của danh sách cuộn khi user bỏ tick hoặc đóng popup.

### 3.4. Hàm Giao Dịch Xuất Kho Nguyên Tử (Atomic Export RPCs)
- **`xuat_xg_atomic(p_records jsonb, p_user text)`** và **`xuat_tole_atomic(p_records jsonb, p_user text)`**:
  - Nhận danh sách các cuộn xuất dưới dạng JSON.
  - Mở Transaction:
    1. Kiểm tra từng `Cuộn ID`: Phải tồn tại trong bảng Nhập tương ứng và chưa tồn tại trong bảng Xuất.
    2. Kiểm tra xem cuộn có bị người khác giữ khóa trong `inventory_locks` hay không.
    3. Thực hiện `INSERT` toàn bộ các bản ghi vào bảng Xuất.
    4. Xóa các bản ghi tương ứng trong `inventory_locks`.
  - Trả về danh sách các bản ghi vừa chèn thành công.
  - Nếu có bất kỳ vi phạm nào: `RAISE EXCEPTION` ➔ PostgreSQL tự động `ROLLBACK` toàn bộ.

---

## 4. Chi tiết Tích hợp Frontend (Client-side Implementation)

### 4.1. Module Xuất Kho (`xg-xuat.js` & `tole-xuat.js`)
1. **Khi Mở Modal "Chọn cuộn từ Tồn kho":**
   - Tải danh sách khóa còn hiệu lực từ `inventory_locks` và lắng nghe Realtime Presence.
   - Các cuộn đang bị người khác khóa:
     - Render trạng thái disabled trên checkbox.
     - Hiển thị Badge: `<span class="badge bg-warning text-dark"><i class="bi bi-lock-fill"></i> ${lockedBy} đang giữ</span>`.
2. **Khi Người dùng Tick / Bỏ Tick chọn cuộn:**
   - Tick chọn cuộn: Gọi `acquire_inventory_lock` + phát tín hiệu qua Realtime Channel `xg_presence_channel` / `tole_presence_channel`.
   - Bỏ tick hoặc Đóng modal: Gọi `release_inventory_lock` + phát tín hiệu giải phóng.
3. **Khi Submit Form Xuất Hàng:**
   - Gọi `supabase.rpc('xuat_xg_atomic', { p_records: recordsToInsert, p_user: currentUser })`.
   - **Xử lý Thành công:**
     - Cập nhật local data `_rawSupabaseData` & `tableData`.
     - Cập nhật local SWR cache.
     - Phát `XG_XUAT_INSERT` qua `BroadcastChannel` và Supabase Realtime.
     - Tự động trừ tồn kho ngay lập tức.
   - **Xử lý Thất bại (Conflict / Rollback):**
     - Bắt thông điệp lỗi chi tiết từ RPC.
     - Hiển thị Toast cảnh báo người dùng.
     - Tải lại dữ liệu tồn kho để đồng bộ trạng thái mới nhất.

### 4.2. Module Tồn Kho (`xg-ton.js` & `tole-ton.js`)
1. **Lắng nghe Realtime Presence & Locks:**
   - Khi nhận tín hiệu một cuộn đang được chọn soạn xuất:
     - Dòng tương ứng trong bảng Tồn kho chuyển sang màu nền cảnh báo (Amber background `#fff8e1` / Dark theme `#3d3214`).
     - Cột Trạng thái/Ghi chú hiển thị Badge: `⏳ Đang soạn xuất (${lockedBy})`.
   - Khi nhận tín hiệu khóa được giải phóng:
     - Trả lại màu nền và trạng thái bình thường.
2. **Lắng nghe Sự kiện Xuất / Xóa:**
   - Khi có `XG_XUAT_INSERT` / `TOLE_XUAT_INSERT`: Trừ cuộn khỏi `_rawSupabaseData` và re-render bảng tức thì (0ms) mà không mất trạng thái filter/scroll.
   - Khi có `XG_XUAT_DELETE` / `TOLE_XUAT_DELETE`: Bổ sung lại cuộn vào `_rawSupabaseData` (hoàn tồn kho) ngay lập tức.

### 4.3. Module Nhập Kho (`xg-nhap.js` & `tole-nhap.js`)
1. **Kiểm tra Trùng lặp Cuộn ID (Unique Constraint):**
   - Khi thêm mới cuộn hoặc import file Excel: Kiểm tra `Cuộn ID` không được trùng với các cuộn đã có trong bảng Nhập.
   - Thực hiện kiểm tra cả ở Client và qua Unique Index / RPC ở Database.
2. **Phát sự kiện Nhập:**
   - Khi thêm/sửa/xóa dòng nhập, phát tín hiệu `XG_NHAP_...` để bảng Tồn và Biểu đồ tự động cập nhật.

### 4.4. Module Biểu Đồ Dashboard (`xg-bieu-do.js` & `tole-bieu-do.js`)
- Lắng nghe các sự kiện đồng bộ để tự động tính toán lại KPI tồn kho, sản lượng nhập/xuất và cập nhật biểu đồ ApexCharts mượt mà.

---

## 5. Xử lý các Trường hợp Biên & Ngoại lệ (Edge Cases & Fallbacks)

| Tình huống | Cách xử lý |
| :--- | :--- |
| **Mất kết nối mạng đột ngột khi đang chọn cuộn** | Khóa tạm trên PostgreSQL có TTL 5 phút (`expires_at`), sau 5 phút database tự động hủy khóa mà không cần can thiệp thủ công. |
| **2 User cùng bấm chọn 1 cuộn tại cùng 1 mili-giây** | Hàm `acquire_inventory_lock` sử dụng câu lệnh `INSERT ... ON CONFLICT` với điều kiện `expires_at < NOW()`. Chỉ 1 user thành công, user thứ 2 nhận thông báo cuộn vừa được người khác chọn. |
| **User cố tình bypass client gọi trực tiếp API xuất** | Tầng Database với `UNIQUE INDEX` và hàm RPC `xuat_xg_atomic` sẽ từ chối giao dịch và tự động `ROLLBACK`. |
| **User sửa dòng xuất từ Cuộn A sang Cuộn B** | Giao dịch nguyên tử kiểm tra Cuộn B có tồn kho không; nếu hợp lệ thì ghi nhận Cuộn B và tự động giải phóng Cuộn A trở lại tồn kho. |

---

## 6. Kế hoạch Kiểm thử & Xác minh (Verification Plan)

### 6.1. Kiểm thử Concurrency & Khóa Tạm (Multi-window / Multi-device):
1. **Kiểm thử Live Badge & Disable Checkbox:**
   - Mở Cửa sổ 1: `xg-xuat.html`, bấm "Chọn cuộn từ Tồn kho", tick chọn cuộn `C-01`.
   - Mở Cửa sổ 2: `xg-ton.html` ➔ Quan sát thấy cuộn `C-01` chuyển màu vàng cam và hiện Badge `⏳ Đang soạn bởi...`.
   - Mở Cửa sổ 3: `xg-xuat.html`, bấm "Chọn cuộn từ Tồn kho" ➔ Thấy checkbox `C-01` bị disable kèm icon khóa.
2. **Kiểm thử Giải phóng Khóa:**
   - Ở Cửa sổ 1, bỏ tick chọn `C-01` hoặc đóng Modal ➔ Cửa sổ 2 và Cửa sổ 3 lập tức mở lại bình thường.

### 6.2. Kiểm thử Giao dịch Xuất Kho Nguyên Tử (ACID Transaction):
1. **Kiểm thử Xuất thành công:**
   - Xuất 1 đơn hàng gồm 3 cuộn.
   - Xác nhận cả 3 cuộn được lưu vào `xg-xuat`, biến mất khỏi `xg-ton` và `inventory_locks` được dọn sạch.
2. **Kiểm thử Rollback khi có lỗi/xung đột:**
   - Giả lập trường hợp 1 trong 3 cuộn đã bị xuất trước đó.
   - Xác nhận toàn bộ giao dịch bị hủy, không có bất kỳ cuộn nào trong 3 cuộn bị lưu dở dang vào bảng xuất.

### 6.3. Kiểm thử Phân hệ Tole:
- Lặp lại toàn bộ các bước kiểm thử trên đối với phân hệ Tôn (`tole-nhap`, `tole-xuat`, `tole-ton`, `tole-bieu-do`).
