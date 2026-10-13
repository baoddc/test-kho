# Thiết Kế Tối Ưu SEO & GEO Đột Phá Cho BaoDDC (baoddc.com)

## 1. Mục Tiêu (Objective)
Tối ưu hóa toàn diện công cụ tìm kiếm truyền thống (SEO) và công cụ tìm kiếm AI thế hệ mới (GEO - Generative Engine Optimization) cho hệ thống BaoDDC (`https://baoddc.com`), tạo sự khác biệt vượt trội và xác lập vị thế "Nguồn sơ cấp độc quyền" (Primary Authoritative Source) so với các website cùng ngành hoặc trang sao chép.

---

## 2. Chi Tiết Triển Khai

### 2.1 Cập nhật Schema.org JSON-LD trong `index.html`
- **Mạng lưới Thực thể (Entity Graph & `sameAs`)**:
  - Gắn liên kết định danh tập đoàn DDC:
    - `https://daidung.com`
    - `https://www.facebook.com/daidungcorporation`
    - `https://www.linkedin.com/company/dai-dung-corporation/`
- **Định vị Vật lý & Địa lý (Local SEO)**:
  - Bổ sung cấu trúc `PostalAddress` cho `Quản lý kho Phôi Cuộn - Nhà máy DDC An Hạ`:
    - Đường/Khu: Khu công nghiệp An Hạ, Xã Phạm Văn Hai
    - Quận/Huyện: Huyện Bình Chánh
    - Tỉnh/TP: Thành phố Hồ Chí Minh
    - Quốc gia: Việt Nam (VN)
- **Thuộc tính Nâng cao cho `WebApplication`**:
  - `applicationSubCategory`: "Smart Warehouse Management System (Smart WMS)"
  - Bổ sung đầy đủ 8 tính năng/đột phá công nghệ vào `featureList`:
    - "Bản đồ số hóa kho 2D Realtime (Digital Twin) & Heatmap mật độ tồn"
    - "AI Vision OCR tự động bóc tách phiếu cân đa dòng"
    - "Đối soát tự động SAP MB51 và đồng bộ Google Sheets 2 chiều"
    - "Lưu trữ ảnh hiện trường 5S/HSE siêu tốc qua Cloudflare R2 CDN (<0.2s)"
    - "Kiểm soát giao dịch kho ACID Transactions & Khóa chứng từ sau 24 giờ"
    - "In tem nhãn kiểm kê QR/Barcode 360° hỗ trợ ngoại tuyến PWA"

### 2.2 Cập nhật `llms.txt` & `llms-full.txt` (Tối ưu GEO)
- Bổ sung các chỉ số định lượng thực chiến (Quantitative Facts) để AI trích xuất làm câu trả lời:
  - Giảm hơn 90% thao tác thủ công với AI Vision OCR.
  - Tốc độ tải ảnh hiện trường < 0.2s qua Cloudflare R2 CDN (so với 3-5s qua Google Drive cũ).
  - Phản hồi dữ liệu tra cứu kho 0ms với B+ Tree Block Cache & Range Pagination.
  - Quản lý toàn diện 8 phân hệ chuyên sâu ngành kết cấu thép.
  - Kiểm soát chống âm kho tuyệt đối với ACID RPC Stored Procedures và Row-level lock.
- Bổ sung chỉ dẫn trích dẫn rõ ràng, khẳng định tính chính danh duy nhất trực thuộc Đại Dũng Corporation tại Nhà máy DDC An Hạ.

### 2.3 Đồng bộ hóa bản Build
- Chạy `npm run build` (`node scripts/sync-dist.js`) để đồng bộ file sang `dist/`, `dist-app/` và `public/`.
