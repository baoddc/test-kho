# Kế Hoạch Triển Khai: Phiếu Xuất Kho Nhiều Mặt Hàng Khác Nhau (XG-XUAT Multi-Item OCR)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Nâng cấp `xg-xuat` để hỗ trợ các phiếu xuất kho chứa nhiều mặt hàng (khác Mã hàng, Tên hàng, Lô) cả trong OCR Vision AI lẫn giao diện biểu mẫu thêm dữ liệu.

**Architecture:** Nâng cấp `ReceiptOcrService` trả về mảng `items`, tái cấu trúc `addDataModal` thành Header (thông tin chung) và Item Cards (mỗi mặt hàng chứa mã, tên, lô và danh sách cuộn riêng), hỗ trợ chọn cuộn theo từng mặt hàng và lưu toàn bộ cùng một lúc.

## Task Breakdown

### Task 1: Nâng cấp `ReceiptOcrService` hỗ trợ trích xuất nhiều mặt hàng (`items`)
- File: `assets/js/core/receipt-ocr-service.js`
- Bổ sung hướng dẫn prompt cho AI nhận diện tất cả các dòng trong bảng `Stt`, `Mã hàng`, `Tên hàng`, `Lô`, `Số lượng`.
- Trả về mảng `items: [{ stt, maVatTu, tenVatTu, batch }]`.

### Task 2: Cập nhật CSS cho Thẻ Mặt Hàng (`assets/css/xg/xg-xuat.css`)
- Style cho `.item-card`: Card phân tách từng mặt hàng, badge STT, viền bo tròn, nút thêm mặt hàng, subtotal kg của từng mục.

### Task 3: Cập nhật Giao diện Modal Thêm Dữ Liệu (`pages/xg/xg-xuat.html`)
- Chuyển `Mã vật tư`, `Tên vật tư`, `Batch` ra khỏi Thông tin chung.
- Tạo container `#itemsContainer` chứa danh sách các thẻ mặt hàng động.
- Nút `+ Thêm mặt hàng` (`#btnAddItemCard`).

### Task 4: Triển khai Logic Javascript (`assets/js/xg/xg-xuat.js`)
- Quản lý danh sách Item Cards (thêm, xóa thẻ mặt hàng).
- Mỗi thẻ mặt hàng có nút `+ Chọn cuộn từ kho` riêng kết nối với modal tồn kho lọc theo mã vật tư của thẻ đó.
- Hàm `populateFieldsFromOcr` tự động tạo $N$ thẻ mặt hàng tương ứng với $N$ dòng quét được từ ảnh.
- Thu thập và lưu toàn bộ bản ghi của tất cả các mặt hàng khi Submit form.

### Task 5: Đồng bộ & Kiểm thử
- Chạy `node scripts/sync-dist.js`.
- Kiểm thử end-to-end với ảnh mẫu 2 dòng và 1 dòng.
