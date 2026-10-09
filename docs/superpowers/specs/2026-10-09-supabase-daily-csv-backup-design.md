# Thiết Kế Kỹ Thuật: Tự Động Sao Lưu Dữ Liệu Supabase Thành Các File CSV Hàng Ngày Lúc 17:00

## 1. Tổng Quan & Mục Tiêu

### 1.1. Bối cảnh
Hệ thống Quản lý Kho DDC (`test-kho` / `web-supabase`) lưu trữ toàn bộ dữ liệu nghiệp vụ xuất - nhập - tồn, kiểm kê, phế liệu và công việc trên cơ sở dữ liệu Supabase đám mây.

### 1.2. Mục tiêu
Thiết lập hệ thống sao lưu tự động (Daily Auto-Backup) trích xuất toàn bộ các bảng nghiệp vụ từ Supabase về máy tính cục bộ của người dùng:
1. **Định dạng file:** Mỗi bảng là một file `.csv` riêng biệt, được chuẩn hóa UTF-8 BOM (Byte Order Mark) để người dùng mở trực tiếp bằng Microsoft Excel trên Windows không bị lỗi phông chữ tiếng Việt.
2. **Cấu trúc lưu trữ:** Tổ chức theo thư mục ngày/giờ `backups/YYYY-MM-DD_17h00/` để lưu giữ toàn bộ lịch sử sao lưu nhiều ngày mà không bị ghi đè.
3. **Lập lịch tự động 17:00:** Tích hợp với **Windows Task Scheduler** để máy tính tự động kích hoạt tiến trình sao lưu lúc 17:00 hàng ngày, đồng thời có cơ chế chạy bù (catch-up) nếu lúc 17:00 máy tính đang tắt nguồn hoặc ở chế độ ngủ (Sleep).
4. **Công cụ 1-Click:** Cung cấp các file script `.bat` trực quan để người dùng có thể kích hoạt sao lưu thủ công bất kỳ lúc nào hoặc đăng ký/hủy lịch Windows Task Scheduler dễ dàng chỉ với một cú nhấp chuột.

---

## 2. Danh Sách Các Bảng Dữ Liệu Được Sao Lưu

Hệ thống sẽ tự động quét và sao lưu toàn bộ danh sách các bảng dữ liệu nghiệp vụ hiện hữu trên Supabase:

| STT | Tên bảng Supabase | Tên file xuất | Mô tả dữ liệu |
| :---: | :--- | :--- | :--- |
| 1 | `xg-nhap` | `xg-nhap.csv` | Dữ liệu nhập kho xà gồ |
| 2 | `xg-xuat` | `xg-xuat.csv` | Dữ liệu xuất kho xà gồ |
| 3 | `tole-nhap` | `tole-nhap.csv` | Dữ liệu nhập kho tole |
| 4 | `tole-xuat` | `tole-xuat.csv` | Dữ liệu xuất kho tole |
| 5 | `pl-can-thu` | `pl-can-thu.csv` | Dữ liệu phế liệu cân thu |
| 6 | `pl-chua-thu` | `pl-chua-thu.csv` | Dữ liệu phế liệu chưa thu |
| 7 | `pl-da-thu` | `pl-da-thu.csv` | Dữ liệu phế liệu đã thu |
| 8 | `pl-phieu-in` | `pl-phieu-in.csv` | Dữ liệu phiếu in phế liệu |
| 9 | `pl-mathang` | `pl-mathang.csv` | Danh mục mặt hàng phế liệu |
| 10 | `xg_sap_mb51` | `xg_sap_mb51.csv` | Dữ liệu đối soát SAP MB51 xà gồ |
| 11 | `kiem_ke_scans` | `kiem_ke_scans.csv` | Dữ liệu quét mã vạch kiểm kê tồn kho |
| 12 | `cong_viec` | `cong_viec.csv` | Danh sách công việc và lịch nhắc hẹn |
| 13 | `system_announcements` | `system_announcements.csv` | Thông báo hệ thống và tin nhắn nội bộ |

*Lưu ý: Bảng cấu hình danh sách có thể dễ dàng mở rộng thêm các bảng mới trong tương lai thông qua mảng cấu hình `BACKUP_TABLES` trong script.*

---

## 3. Cấu Trúc Lưu Trữ & Định Dạng CSV

### 3.1. Thư mục lưu trữ
```
web-supabase/
├── backups/                             <- Thư mục gốc chứa backup (thêm vào .gitignore)
│   ├── backup.log                       <- Nhật ký chạy backup (lịch sử tất cả các ngày)
│   ├── 2026-10-09_17h00/                <- Thư mục backup của ngày 2026-10-09
│   │   ├── xg-nhap.csv
│   │   ├── xg-xuat.csv
│   │   ├── tole-nhap.csv
│   │   ├── tole-xuat.csv
│   │   ├── pl-can-thu.csv
│   │   ├── ... (các bảng khác)
│   │   └── backup-summary.json          <- Báo cáo tổng kết: số dòng, dung lượng, thời gian chạy
│   └── 2026-10-10_17h00/
│       └── ...
```

### 3.2. Tiêu chuẩn định dạng CSV
- **UTF-8 BOM:** Tiền tố `\uFEFF` ở đầu file để bảo đảm Microsoft Excel hiển thị đúng 100% tiếng Việt có dấu khi click đúp mở file trực tiếp.
- **Tuân thủ chuẩn RFC 4180:**
  - Ký tự bao bọc: Dấu nháy kép `"` cho các trường chứa dấu phẩy `,`, dấu xuống dòng `\n`, `\r` hoặc dấu nháy kép `""`.
  - Định dạng giá trị `null` hoặc `undefined`: Xuất ra chuỗi rỗng `""`.
  - Định dạng mảng/đối tượng JSON lồng (nếu có): Được serialize chuẩn JSON trước khi đưa vào CSV cell.

### 3.3. Báo cáo tổng kết (`backup-summary.json`)
Mỗi thư mục backup sẽ sinh kèm một file JSON chứa siêu dữ liệu:
```json
{
  "backupDate": "2026-10-09T17:00:00.000+07:00",
  "status": "success",
  "durationSeconds": 3.42,
  "totalTables": 13,
  "successfulTables": 13,
  "failedTables": 0,
  "tables": {
    "xg-nhap": { "rows": 1393, "fileSizeBytes": 345120, "fileName": "xg-nhap.csv" },
    "xg-xuat": { "rows": 1161, "fileSizeBytes": 289450, "fileName": "xg-xuat.csv" }
  }
}
```

---

## 4. Kiến Trúc Kỹ Thuật & Luồng Xử Lý

### 4.1. Luồng hoạt động (Data Flow)
```
[Windows Task Scheduler (17:00) / Chạy Thủ Công .bat]
                         │
                         ▼
          [scripts/backup-supabase-to-csv.js]
                         │
        ┌────────────────┴────────────────┐
        ▼                                 ▼
[Đọc config URL/Key]              [Tạo thư mục backups/YYYY-MM-DD_17h00/]
(từ assets/js/core/supabase-config.js)
        │
        ▼
[Vòng lặp qua danh sách bảng]
        │
        ▼
[PostgREST REST API với Pagination]
(Lấy từng đợt 1000 dòng tới khi hết toàn bộ bảng)
        │
        ▼
[Chuyển đổi dữ liệu JSON sang CSV (kèm UTF-8 BOM)]
        │
        ▼
[Ghi file CSV vào thư mục]
        │
        ▼
[Tạo file backup-summary.json & Ghi nhật ký vào backup.log]
        │
        ▼
[Gửi Windows Toast Notification thông báo hoàn tất]
```

### 4.2. Cơ chế phân trang PostgREST (Auto-Pagination)
PostgREST của Supabase mặc định giới hạn 1.000 dòng cho mỗi truy vấn HTTP GET.
Script thực hiện phân tầng:
1. Gửi request đầu tiên với header `Range: 0-999` kèm `Prefer: count=exact`.
2. Trích xuất tổng số dòng thực tế từ header phản hồi `Content-Range: 0-999/1393`.
3. Nếu tổng số dòng lớn hơn 1.000, script tiếp tục tải tuần tự/song song các đợt tiếp theo (`1000-1999`, `2000-2999`,...) cho đến khi thu thập đủ 100% bản ghi.
4. Xử lý trường hợp bảng rỗng (0 dòng): Vẫn tạo file CSV chứa header dòng đầu tiên (hoặc file rỗng có BOM) để cấu trúc backup luôn nhất quán.

---

## 5. Tích Hợp Lập Lịch Windows Task Scheduler

### 5.1. Cấu hình Task Scheduler
- **Task Name:** `DDC_Supabase_Daily_Backup_17h`
- **Schedule:** Hàng ngày (Daily) lúc `17:00`.
- **Missed Task Run (Chạy bù):** Kích hoạt tùy chọn `<StartWhenAvailable>true</StartWhenAvailable>` (hoặc `/st 17:00` với cờ bù giờ) để nếu lúc 17:00 máy tính bị tắt nguồn, hệ thống sẽ tự động kích hoạt backup ngay khi máy khởi động lại.
- **Run whether user is logged on:** Chạy với tài khoản người dùng hiện tại, không yêu cầu nhập mật khẩu.
- **Silent Background Execution:** Sử dụng wrapper script (PowerShell `-WindowStyle Hidden` hoặc VBScript) để khi đến 17:00, tiến trình chạy hoàn toàn ngầm trong nền, không làm bật cửa sổ màu đen CMD che màn hình khi người dùng đang thao tác.

### 5.2. Các file tương tác người dùng
1. `cai-dat-lich-backup-17h.bat`:
   - Kiểm tra quyền Administrator.
   - Tự động gọi lệnh PowerShell đăng ký Scheduled Task với đầy đủ tùy chọn chạy nền, chạy bù và đường dẫn chuẩn xác đến `node` và script của dự án.
   - Xuất thông báo xác nhận cài đặt thành công.
2. `huy-lich-backup-17h.bat`:
   - Gỡ bỏ Scheduled Task `DDC_Supabase_Daily_Backup_17h` khỏi hệ thống Windows.
3. `Backup_Supabase_Ngay.bat`:
   - Đặt ở thư mục gốc của dự án.
   - Nhấp đúp để chạy backup tức thì. Cửa sổ hiển thị trực quan thông tin tải từng bảng, tiến độ và đường dẫn thư mục kết quả.

---

## 6. Khả Năng Chịu Lỗi & Ghi Nhật Ký (Fault Tolerance & Logging)

1. **Khả năng chịu lỗi giữa các bảng:**
   Nếu một bảng bất kỳ gặp sự cố kết nối hoặc lỗi phân quyền RLS, script sẽ bắt lỗi (catch), ghi nhận cảnh báo và lập tức chuyển sang backup các bảng còn lại. Không để lỗi của 1 bảng làm hủy toàn bộ phiên sao lưu.
2. **Cơ chế Retry mạng:**
   Mỗi yêu cầu mạng tới Supabase được thiết lập timeout 30 giây và tự động thử lại tối đa 3 lần nếu gặp sự cố gián đoạn kết nối tạm thời (`fetch failed`, `ETIMEDOUT`).
3. **Quản lý dung lượng lưu trữ:**
   Mỗi ngày một bản backup khoảng 2 - 5 MB (với quy mô hiện tại). Sau 1 năm chỉ chiếm khoảng ~1 GB ổ cứng. Script sẽ có tùy chọn giữ tối thiểu 30 ngày gần nhất (hoặc giữ mãi nếu dung lượng đĩa cho phép).
4. **File nhật ký `backups/backup.log`:**
   Mỗi lần chạy ghi lại:
   `[2026-10-09 17:00:02] INFO: Bat dau sao luu 13 bang...`
   `[2026-10-09 17:00:04] SUCCESS: Hoan tat 13/13 bang. Thu muc: backups/2026-10-09_17h00. Tong thoi gian: 2.8s`

---

## 7. Kế Hoạch Kiểm Thử & Nghiệm Thu (Verification Plan)

### 7.1. Kiểm thử trích xuất & chuyển đổi dữ liệu
1. Chạy script Node.js trích xuất thực tế tất cả các bảng từ Supabase `https://ahcethtonjwktjtmxzog.supabase.co`.
2. Kiểm tra tổng số dòng của từng file `.csv` so với số lượng thực tế trong cơ sở dữ liệu Supabase:
   - `xg-nhap`: Khớp chính xác ~1.393 dòng.
   - `xg-xuat`: Khớp chính xác ~1.161 dòng.
   - `tole-nhap`: Khớp chính xác ~818 dòng.
   - `tole-xuat`: Khớp chính xác ~634 dòng.
   - `pl-can-thu`: Khớp chính xác ~866 dòng.
   - `pl-phieu-in`: Khớp chính xác ~1.339 dòng.
   - Các bảng khác: Khớp đầy đủ 100%.

### 7.2. Kiểm thử hiển thị tiếng Việt trên Microsoft Excel
1. Kiểm tra 3 byte đầu tiên của file CSV là `EF BB BF` (UTF-8 BOM).
2. Mở file CSV bằng Microsoft Excel để xác nhận không lỗi font chữ tiếng Việt đối với các trường: "Tên công trình", "Quy cách", "Loại nhập", "Diễn giải", "Ghi chú".

### 7.3. Kiểm thử Windows Task Scheduler
1. Chạy `cai-dat-lich-backup-17h.bat` và kiểm tra lệnh `schtasks /query /tn "DDC_Supabase_Daily_Backup_17h"` hiển thị trạng thái `Ready` với Next Run Time là `17:00:00`.
2. Chạy thử nghiệm kích hoạt thủ công task qua Task Scheduler để xác nhận thư mục backup mới được tạo thành công trong chế độ ngầm.
