# Quản Lý Kho Phôi Cuộn - DDC (test-kho)

Hệ thống quản lý kho phôi cuộn cho Đại Dũng Corporation (DDC), tích hợp Supabase backend và giao diện web tĩnh responsive.

## 🚀 Tính năng chính

- **Quản lý Đăng nhập & Xác thực**: Tích hợp với hệ thống Supabase.
- **Quản lý Phôi Cuộn / Tole / Tấm**: Theo dõi thông tin mặt hàng, số lượng, quy cách.
- **Quy trình 5S & Báo cáo**: Quản lý và theo dõi tiến độ các hoạt động 5S tại kho.
- **Tích hợp Excel (XLSX)**: Hỗ trợ đọc và xuất dữ liệu phôi cuộn ra file Excel.
- **Service Voice / Điều khiển bằng giọng nói**: Hỗ trợ nhận diện giọng nói cho quy trình nhập/xuất kho.

## 📁 Cấu trúc thư mục

```text
├── assets/          # CSS, JS và hình ảnh ứng dụng
│   ├── css/
│   ├── img/
│   └── js/
├── backend/         # Dữ liệu JSON & cấu hình backend
├── docs/            # Tài liệu hướng dẫn & Supabase schema
├── pages/           # Các trang HTML chính của ứng dụng
│   ├── index.html   # Trang đăng nhập chính
│   ├── home.html    # Trang chủ
│   ├── about.html   # Trang giới thiệu
│   ├── 5s/          # Quản lý 5S
│   ├── pl/          # Quản lý Phôi cuộn (PL)
│   ├── tole/        # Quản lý Tole
│   └── xg/          # Quản lý Xà gồ (XG)
├── scripts/         # Các script tiện ích & migration
├── voice-service/   # Dịch vụ giọng nói (PowerShell / VBScript)
├── index.html       # File chuyển hướng root
├── vercel.json      # Cấu hình deployment cho Vercel
└── package.json     # Metadata & Dependencies
```

## 🛠️ Hướng dẫn chạy cục bộ (Local Development)

1. **Cài đặt các gói phụ thuộc (Dependencies)**:
   ```bash
   npm install
   ```

2. **Chạy ứng dụng với Local Server**:
   ```bash
   npx serve .
   ```
   Sau đó mở trình duyệt tại địa chỉ: `http://localhost:3000`

## 🌐 Triển khai lên Vercel (Deployment)

Dự án đã được cấu hình sẵn file `vercel.json` để tự động phục vụ các trang trong thư mục `pages/`.

Khi kết nối với Vercel:
- **Framework Preset**: Other / None
- **Root Directory**: `./`
- **Output Directory**: `./`

## 📄 Giấy phép

Dự án thuộc bản quyền của **Đại Dũng Corporation (DDC)**.
