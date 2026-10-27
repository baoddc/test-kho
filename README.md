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
├── assets/            # Nguồn CSS, JS và hình ảnh ứng dụng
│   ├── css/           # CSS theo module (5s, pl, tole, xg, tem-nhan-kiem-ke, trang-chu, ...)
│   ├── js/            # Logic Javascript (core/, components/, theo module)
│   └── images/        # Logo & hình nền
├── pages/             # Các trang HTML phân theo module
│   ├── index.html     # Trang đăng nhập
│   ├── 5s/            # Quản lý 5S & HSE
│   ├── pl/            # Quản lý Phôi Lá (PL)
│   ├── tem-nhan-kiem-ke/  # Kiểm kê, in tem cuộn, vị trí tồn
│   ├── tole/          # Quản lý Tole
│   ├── trang-chu/     # Trang chủ, giới thiệu
│   └── xg/            # Quản lý Xà Gồ (XG)
├── supabase/          # Mọi thứ phía Supabase
│   ├── functions/     # Edge Functions (ocr-receipt, ocr-scorecard-5s)
│   └── sql/           # SQL chạy thủ công trong Supabase SQL Editor
│       ├── setup/       # Tạo bảng / RPC / RLS (setup_*.sql, create_*.sql)
│       ├── migrations/  # Thay đổi một lần trên DB đang chạy (fix_*, migrate_*, lock_*, ...)
│       └── schema/      # Định nghĩa bảng theo module (pl, tole)
├── scripts/           # Script tiện ích (build/sync, PWA icons, local server)
│   ├── backup/        # Sao lưu CSV: Backup_Supabase_Ngay.bat (chạy ngay), cai-dat-/huy-lich-backup-17h.bat,
│   │                  #   backup-supabase-to-csv.js, csv-exporter.js, register-/unregister-task.ps1, run-backup-silent.vbs
│   └── bat/           # Launcher 1-click: Đồng bộ dữ liệu MB51
├── backups/           # Output sao lưu theo ngày (YYYY-MM-DD_HHhMM/*.csv) + backup.log — đã .gitignore
├── tests/             # Test tự động & script kiểm thử
├── docs/              # Tài liệu: versioning.md, superpowers/ (plans, specs)
├── cloudflare-r2/     # Cloudflare Worker lưu ảnh HSE (R2)
├── voice-service/     # Dịch vụ nhận diện giọng nói (PowerShell / VBScript)
├── android/           # Dự án Capacitor Android
├── dist-app/          # Desktop App (Electron wrapper) — được sync-dist.js đồng bộ từ nguồn
├── public/, dist/     # Output build (Vercel phục vụ public/) — sinh bởi `npm run build`
├── seo/               # robots.txt, sitemap.xml, llms*.txt, file xác minh Google/Bing/IndexNow
│                      #   (build copy ra gốc site: /robots.txt, /sitemap.xml, ...)
├── index.html, home.html, offline.html, manifest.json, sw.js, version.json
│                      # File gốc của web/PWA, phải nằm ở thư mục gốc
├── vercel.json        # Cấu hình deployment cho Vercel
└── package.json       # Metadata & Dependencies
```

> **Lưu ý:** Sửa mã nguồn trong `assets/` và `pages/`, sau đó chạy `npm run build` để đồng bộ sang `public/`, `dist/`, `dist-app/`.
> File bí mật `scripts/service_account.json` (Google Service Account, đã được `.gitignore`) chỉ dùng cho `scripts/sync-mb51-to-supabase.py`.

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
