# Thiết Kế Cập Nhật Điểm Nổi Bật Dự Án Vào Trang About.html

## 1. Mục tiêu (Objective)
Cập nhật toàn diện trang Giới thiệu dự án (`pages/trang-chu/about.html`) và kiểu dáng (`assets/css/trang-chu/about.css`) nhằm phản ánh đầy đủ và sinh động các thành tựu, tính năng đột phá và công nghệ mới nhất của toàn bộ hệ sinh thái Quản lý Kho Phôi Cuộn & Vật Tư - Đại Dũng Corporation (DDC).

---

## 2. Chi Tiết Các Phần Cập Nhật

### 2.1 Hero Section & Live Status Indicators
- **Cập nhật Live Status Indicators**:
  - `Supabase Cloud`: B+ Tree Block Cache & Realtime Sync.
  - `Cloudflare R2 & CDN`: Lưu trữ hình ảnh hiện trường siêu tốc, triệt tiêu độ trễ tải ảnh.
  - `Digital Twin 2D`: Bản đồ kho số hóa thời gian thực & Heatmap tồn kho.
  - `SAP MB51 Reconcile`: Tự động đối soát & Auto-sync Google Sheets.
  - `Barcode & QR`: 360° Camera Scanner (Zoom, Flash, Haptic).
  - `AI Vision`: OCR Tự động hóa bóc tách phiếu cân đa dòng.
  - `RBAC Security`: data-perm & Tự động khóa dữ liệu 24h.
  - `ACID Transactions`: Bảo vệ toàn vẹn xuất nhập & Row-level lock.
  - `PWA & Desktop EXE`: Offline-First & Tự động kiểm tra cập nhật.

### 2.2 Các Phân Hệ Nghiệp Vụ Kho (Core Business Modules - 8 Phân Hệ)
Lưới 8 thẻ trực quan với hiệu ứng Glassmorphism:
1. **Xà Gồ C/Z (XG)**: Quản lý toàn diện Nhập - Xuất - Tồn; trực quan hóa dữ liệu qua biểu đồ Top 10 sản lượng, báo cáo biến động theo ngày/tháng, tích hợp bóc tách phiếu cân tự động bằng AI OCR.
2. **Tole Cuộn & Tấm**: Theo dõi chi tiết từng cuộn theo mã số, quy cách, nguồn gốc; tự động tính toán **Tuổi lưu kho (Storage Age)**, cảnh báo sớm tole tồn đọng lâu ngày để tối ưu vòng quay vốn.
3. **Bản Đồ Số Hóa Kho 2D (Digital Twin)** *(Mới)*: Sơ đồ tương tác trực quan 2D cho kho Phôi Cuộn & Kho Phế Liệu; liên kết dữ liệu live Supabase, heatmap tỷ lệ lấp đầy kệ, bộ lọc linh hoạt theo kỳ và tra cứu cuộn hàng theo vị trí kệ tức thì.
4. **Đối Soát SAP MB51 & Auto-Sync Google Sheets** *(Mới)*: Tự động gợi ý mã SAP khi nhập liệu, đối soát sai lệch giữa xuất/nhập thực tế với sổ sách kế toán SAP MB51; đồng bộ dữ liệu hai chiều tự động với Google Sheets qua Google Apps Script.
5. **Tem QR & Kiểm Kê Hiện Trường**: Quét mã vạch/QR cuộn bằng camera smartphone đối soát trực tiếp 1:1 với Excel tồn kho sổ sách, phát hiện ngay cuộn lệch/thiếu; in tem mã vạch/QR vị trí kệ hàng loạt (hỗ trợ xuất ZIP).
6. **Phế Liệu Sản Xuất (PL)**: Quản lý chu trình thu hồi 3 bước Cần thu - Chưa thu - Đã thu; lưu trữ phiếu cân xưởng thực tế, tự động lập và in phiếu xuất bán/xuất trả phế liệu chuẩn mẫu DDC.
7. **Quy Trình 5S & Quản Lý HSE**: Báo cáo checklist đánh giá 5S định kỳ tại từng phân xưởng; nhật ký sự cố an toàn lao động & vệ sinh môi trường (HSE) kèm upload ảnh hiện trường tốc độ cao qua Cloudflare R2 CDN.
8. **Công Việc & Nhắc Hẹn**: Lập kế hoạch theo ca/ngày, phân công phụ trách và theo dõi tiến độ; hệ thống cảnh báo nhắc hẹn deadline thông minh giúp ngăn ngừa thiếu sót và trễ hạn bàn giao.

### 2.3 Nền Tảng Công Nghệ (Tech Stack Grid)
Thêm các công nghệ hiện đại vào lưới hiển thị:
- `HTML5 / CSS3`
- `Vanilla JS (ES6+)`
- `Bootstrap 5`
- `Supabase (PostgreSQL)`
- `Cloudflare R2 & Worker API` *(Mới)*
- `Google Apps Script & SAP Bridge` *(Mới)*
- `AI Vision / OCR`
- `Barcode & QR 360°`
- `PWA / Offline-First`
- `Desktop EXE (Electron)`

### 2.4 Kiến Trúc & Đột Phá Kỹ Thuật (Spotlight Technical Breakthroughs - 10 Thẻ Chuyên Sâu)
1. **Supabase Data Engine**: B+ Tree Block Cache kết hợp Range Pagination (`.range(from, to)`) phản hồi dữ liệu tức thì (0ms) và prefetch trang tiếp theo ở nền, chịu tải hàng trăm nghìn bản ghi.
2. **ACID & Concurrency Control**: Xử lý giao dịch kho nguyên tử (Atomic) qua Supabase RPC / Stored Procedures với khóa dòng (Row-level Lock). Kiểm tra tồn kho thời gian thực, triệt tiêu nguy cơ âm kho và xung đột ghi đè đồng thời.
3. **Cloudflare R2 Object Storage & CDN** *(Mới)*: Lưu trữ ảnh hiện trường HSE và chứng từ siêu tốc qua Cloudflare Worker API; tải ảnh tức thì qua mạng lưới Global CDN, giải phóng hoàn toàn giới hạn quota và độ trễ của Google Drive.
4. **Bản Đồ Số Hóa Kho 2D Realtime (Digital Twin)** *(Mới)*: Mô phỏng không gian kho bãi 2D thời gian thực; trực quan hóa vị trí kệ, heatmap mật độ tồn và tự động đổi màu theo tỷ lệ lấp đầy dựa trên dữ liệu tồn kho Supabase.
5. **AI Vision OCR Tự Động Hóa**: Nhận diện và bóc tách dữ liệu từ ảnh chụp phiếu cân xưởng, phiếu xuất hàng; tự động trích xuất đa dòng (Multi-item OCR) và điền form hàng loạt, giảm hơn 90% thao tác thủ công.
6. **Thuật Toán Đối Soát SAP MB51 & Auto-Sync** *(Mới)*: Tự động so khớp dữ liệu xuất nhập thực tế với bảng kế toán SAP MB51 (`xg_sap_mb51`), phát hiện chênh lệch tức thì và hỗ trợ batch sync hai chiều với Google Sheets.
7. **Trình Quét Barcode/QR Công Nghiệp**: Quét mã vạch cuộn và QR vị trí kệ trực tiếp bằng camera di động: Tích hợp trợ lực Zoom, đèn Flash rọi sáng, rung phản hồi (Haptic) và thuật toán nhận diện đa hướng 360 độ siêu nhạy.
8. **Phân Quyền RBAC & `data-perm`**: Quản lý tập trung 7 nhóm nghiệp vụ với 4 quyền (Xem, Thêm, Sửa, Xóa). Bảo vệ trực tiếp tại nút bấm bằng thuộc tính HTML `data-perm`, thực thi tự động qua Core Permission Enforcer.
9. **Khóa Dữ Liệu Sau 24 Giờ**: Tự động khóa quyền Sửa/Xóa đối với các chứng từ kho đã tạo quá 24h nhằm bảo vệ tính toàn vẹn và chống gian lận dữ liệu lịch sử; hỗ trợ đặc quyền Bypass cho Super Admin chỉ định (bao.lt).
10. **PWA Mobile & Desktop EXE (Offline-First)**: Service Worker thông minh lưu cache tài nguyên tĩnh, cho phép tra cứu khi mất mạng; đóng gói EXE cho máy trạm nhà xưởng kèm cơ chế tự động kiểm tra và thông báo bản cập nhật mới.

### 2.5 Bảng Đo Lường Hiệu Suất & Khả Năng Mở Rộng
Bổ sung các chỉ số:
- Tốc độ tải ảnh chứng từ/hiện trường: Google Drive cũ (3 - 5s, rủi ro quota) vs Cloudflare R2 CDN mới (< 0.2s, băng thông không giới hạn).
- Tốc độ đối soát SAP & Kiểm kê kho: Phương pháp thủ công (vài giờ) vs Quét mã QR & Excel so khớp tự động (< 30s).

---

## 3. Kế Hoạch Kiểm Thử (Verification Plan)
- Kiểm tra tính toàn vẹn của mã HTML trong `about.html`, đảm bảo không bị vỡ bố cục, cú pháp semantic rõ ràng.
- Kiểm tra hiển thị CSS trên cả Dark Mode và Light Mode (`[data-bs-theme="light"]`).
- Đảm bảo các liên kết CSS, JS và font chữ hoạt động trơn tru.
