# Web Supabase - Hệ Thống Quản Lý Kho & Bán Hàng

Hệ thống quản lý kho, nhập xuất tồn cho các sản phẩm Tôn, Xà Gồ (XG), Phụ Kiện (PL), 5S và Vật liệu xây dựng, tích hợp cơ sở dữ liệu Supabase và dịch vụ giọng nói.

## 🚀 Tính Năng Chính

- **Quản lý Nhập / Xuất / Tồn kho**: Theo dõi chi tiết lượng nhập, xuất, tồn kho hàng hóa (Tôn, Xà Gồ, Phụ Kiện).
- **Tích hợp Supabase**: Đồng bộ dữ liệu thời gian thực với Supabase Cloud database.
- **Biểu đồ & Báo cáo**: Hiển thị trực quan dữ liệu tồn kho và xu hướng bán hàng.
- **Dịch vụ Giọng nói (Voice Service)**: Hỗ trợ điều khiển/nhập liệu bằng giọng nói.
- **Giao diện Web Thân thiện**: Dễ dàng thao tác trên trình duyệt.

## 📁 Cấu Trúc Thư Mục

```text
├── assets/             # Chứa CSS, JavaScript, hình ảnh
│   ├── css/            # Các file stylesheet
│   └── js/             # Script xử lý frontend & cấu hình Supabase
├── backend/            # Dữ liệu & dịch vụ backend
├── pages/              # Giao diện các trang HTML (Home, Tôn, Xà Gồ, 5S, Báo cáo)
├── scripts/            # Các kịch bản Node.js (Server, Migration, Fixes)
├── voice-service/      # Dịch vụ nhận diện & xử lý giọng nói
├── package.json        # Thông tin dự án & dependencies
└── README.md           # Tài liệu hướng dẫn
```

## 🛠️ Cài Đặt & Khởi Chạy

### 1. Yêu cầu hệ thống
- Node.js (phiên bản 14 trở lên)

### 2. Cài đặt phụ thuộc
```bash
npm install
```

### 3. Khởi chạy Server cục bộ
```bash
npm start
```
Sau đó truy cập trình duyệt tại: `http://localhost:3000`

## ⚙️ Cấu Hình Supabase

Thông tin kết nối Supabase được cấu hình tại: `assets/js/supabase-config.js`
Thay đổi `SUPABASE_URL` và `SUPABASE_ANON_KEY` tương ứng với project Supabase của bạn.

## 📄 Giấy Phép

Dự án được phân phối dưới giấy phép [MIT](LICENSE).
