# Hướng dẫn Quản lý Phiên bản (Versioning)

## Nguyên tắc cốt lõi

Hệ thống có **hai luồng phiên bản độc lập**:

| | Web (Vercel) | PC App (.exe) |
|---|---|---|
| **File version** | `version.json` | `dist-app/version.json` |
| **CURRENT_VERSION** | `assets/js/update-checker.js` | `dist-app/assets/js/update-checker.js` |
| **Khi cập nhật** | Mỗi khi release web | Chỉ khi BUILD file .exe mới |

> ⚠️ **KHÔNG bao giờ** thay đổi `dist-app/assets/js/update-checker.js` → `CURRENT_VERSION`  
> trong quá trình release web thông thường.

---

## Workflow 1: Release phiên bản Web mới

Khi có tính năng mới cho **web app** (người dùng trình duyệt), chỉ cập nhật:

```
✅ version.json                      ← Cập nhật version mới
✅ assets/js/update-checker.js       ← Cập nhật CURRENT_VERSION
✅ package.json                      ← Cập nhật version (tùy chọn)

❌ dist-app/assets/js/update-checker.js  ← KHÔNG chạm vào
❌ dist-app/version.json                 ← KHÔNG chạm vào
```

### Ví dụ: Release web v1.0.5

```json
// version.json (Vercel)
{ "version": "1.0.5" }

// assets/js/update-checker.js
const CURRENT_VERSION = '1.0.5';

// dist-app/assets/js/update-checker.js  ← GIỮ NGUYÊN
const CURRENT_VERSION = '1.0.3'; // ← Phiên bản .exe đã build lần cuối
```

**Kết quả:**
- Người dùng web → thấy v1.0.5 ✅  
- App PC cũ (v1.0.3) → Vercel báo v1.0.5 → **hiện thông báo cập nhật** ✅

---

## Workflow 2: Release phiên bản PC App (.exe) mới

Khi build file `.exe` mới để phân phối cho người dùng:

```
✅ version.json                          ← Cập nhật version mới
✅ dist-app/version.json                 ← Cập nhật version mới
✅ assets/js/update-checker.js           ← Cập nhật CURRENT_VERSION
✅ dist-app/assets/js/update-checker.js  ← Cập nhật CURRENT_VERSION ← BUILD .exe SAU ĐÓ
✅ package.json                          ← Cập nhật version
✅ dist-app/package.json                 ← Cập nhật version
```

Sau đó: **Build file .exe**, upload lên Dropbox/server, cập nhật link download.

---

## Lịch sử phiên bản PC App

| Phiên bản | Ngày build | Ghi chú |
|---|---|---|
| v1.0.2 | 2026-07-xx | Bản đầu tiên có link Dropbox |
| v1.0.3 | 2026-07-28 | Cập nhật tính năng, bản hiện tại đang phân phối |

> **Phiên bản .exe hiện đang phân phối: v1.0.3**  
> `dist-app/assets/js/update-checker.js` → `CURRENT_VERSION = '1.0.3'`
