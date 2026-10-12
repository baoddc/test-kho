# Thiết kế Kỹ thuật: Nút Đồng Bộ Google Sheets Nhấp 3 Lần Khi Mở Modal Thêm / Sửa Dữ Liệu

- **Ngày tạo**: 2026-10-12
- **Trạng thái**: Đã phê duyệt (Phương án 1 - Pulsing Glow & Scale 3 Lần)
- **Phạm vi áp dụng**: 
  - Giao diện (HTML): `pages/xg/xg-nhap.html`, `pages/xg/xg-xuat.html`, `pages/tole/tole-nhap.html`, `pages/tole/tole-xuat.html`
  - Giao diện (CSS): `assets/css/trang-chu/home.css` (được nhúng trên tất cả các trang)
  - Script xử lý: `assets/js/xg/xg-sap-lookup.js`, `assets/js/xg/xg-nhap.js`, `assets/js/xg/xg-xuat.js`, `assets/js/tole/tole-nhap.js`, `assets/js/tole/tole-xuat.js`
  - Build/Sync: `scripts/sync-dist.js` (đồng bộ tự động sang `dist/`, `public/`, `dist-app/`)

---

## 1. Bối cảnh & Yêu cầu Nghiệp Vụ

### 1.1. Thực trạng
- Khi mở modal **"Thêm dữ liệu"** hoặc **"Sửa dữ liệu"** tại 4 trang chính:
  1. Kho Xà gồ - Nhập (`xg-nhap.html`)
  2. Kho Xà gồ - Xuất (`xg-xuat.html`)
  3. Kho Tole - Nhập (`tole-nhap.html`)
  4. Kho Tole - Xuất (`tole-xuat.html`)
- Hệ thống đã có cơ chế tự động đồng bộ Google Sheets sang Supabase (`xg_sap_mb51`) khi mở modal, nhưng nút bấm chưa có tín hiệu thị giác rõ rệt, khiến người dùng không nhận biết được hệ thống đang tự động cập nhật.
- Ngoài ra, modal "Sửa dữ liệu" trên `xg-xuat.html` và `tole-xuat.html` hiện chưa có nút "Đồng bộ Google Sheets", tạo sự không đồng nhất với 2 màn hình nhập kho.

### 1.2. Yêu cầu chi tiết
1. **Hiệu ứng nhấp nháy thị giác (Pulsing 3 Lần)**:
   - Khi mở modal Thêm dữ liệu hoặc Sửa dữ liệu, nút **"Đồng bộ Google Sheets"** (`#btnSyncGgSheet` / `#btnEditSyncGgSheet`) sẽ tự động "nhấp" liên tục khoảng 3 lần (3 chu kỳ animation).
   - Mỗi chu kỳ nhấp (~0.6 giây, tổng ~1.8 giây):
     - Nút hơi phóng to `transform: scale(1.06)`.
     - Đổ bóng phát sáng viền `box-shadow: 0 0 0 8px rgba(13, 110, 253, 0.35)`.
     - Nền và chữ chuyển màu nổi bật để thể hiện trạng thái kích hoạt.
     - Icon mũi tên `<i class="bi bi-arrow-repeat"></i>` quay tròn liên tục theo nhịp nhấp.
   - Sau khi kết thúc đúng 3 nhịp, nút tự động gỡ bỏ class animation và trở về trạng thái bình thường.
2. **Kích hoạt đồng bộ nền**:
   - Tiến trình `syncFromGoogleSheets` chạy song song để cập nhật dữ liệu từ Google Sheets về Supabase.
   - Vẫn duy trì cơ chế Concurrency Guard chống gửi trùng lặp nếu người dùng mở/đóng modal liên tục.
   - Thông báo Toast nhẹ nhàng sau khi đồng bộ thành công hoặc nếu gặp lỗi mạng.
3. **Bổ sung nút cho Modal Sửa tại `xg-xuat.html` và `tole-xuat.html`**:
   - Thêm nút `#btnEditSyncGgSheet` vào header card Thông tin chung trong `#editDataModal` của 2 trang xuất, gắn logic click và auto-sync đồng bộ tương tự như modal Thêm.

---

## 2. Thiết kế Kiến trúc & Giải pháp Chi tiết

### 2.1. Thiết kế CSS Animation (`assets/css/trang-chu/home.css`)

Định nghĩa animation và class `.btn-sync-pulsing-3x`:

```css
@keyframes syncPulse3x {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(13, 110, 253, 0.7);
    background-color: #ffffff;
    color: #0d6efd;
  }
  30% {
    transform: scale(1.06);
    box-shadow: 0 0 0 8px rgba(13, 110, 253, 0.35);
    background-color: #0d6efd;
    color: #ffffff;
  }
  60% {
    transform: scale(1.02);
    box-shadow: 0 0 0 12px rgba(13, 110, 253, 0);
    background-color: #0d6efd;
    color: #ffffff;
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(13, 110, 253, 0);
    background-color: #ffffff;
    color: #0d6efd;
  }
}

@keyframes syncSpinIcon {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.btn-sync-pulsing-3x {
  animation: syncPulse3x 0.6s ease-in-out 3 !important;
  transition: all 0.2s ease;
  z-index: 10;
  position: relative;
}

.btn-sync-pulsing-3x i.bi-arrow-repeat {
  display: inline-block;
  animation: syncSpinIcon 0.6s linear infinite !important;
}
```

### 2.2. Cải tiến Module `xg-sap-lookup.js`

1. **Thêm hàm hỗ trợ kích hoạt hiệu ứng 3 nhịp**:
   ```javascript
   function triggerButtonPulse3x(btnEl) {
     if (!btnEl) return;
     btnEl.classList.remove('btn-sync-pulsing-3x');
     // Force reflow
     void btnEl.offsetWidth;
     btnEl.classList.add('btn-sync-pulsing-3x');
     
     const onAnimationEnd = () => {
       btnEl.classList.remove('btn-sync-pulsing-3x');
       btnEl.removeEventListener('animationend', onAnimationEnd);
     };
     btnEl.addEventListener('animationend', onAnimationEnd);
   }
   ```
2. **Cập nhật `syncFromGoogleSheets(btnEl, options = {})`**:
   - Khi `options.isAuto === true`:
     - Kích hoạt `triggerButtonPulse3x(btnEl)`.
     - Không thay đổi `innerHTML` của nút ngay lập tức thành spinner thô để giữ nguyên icon và nhãn xoay mượt mà trong 3 nhịp đầu.
     - Sau khi kết thúc animation 3 nhịp hoặc nếu tiến trình fetch vẫn đang chạy ngầm, nút có thể hiển thị trạng thái đang tải nhẹ nhàng.
3. Export `triggerButtonPulse3x` ra `window.XgSapLookup`.

### 2.3. Bổ sung Giao diện HTML

Tại `pages/xg/xg-xuat.html` và `pages/tole/tole-xuat.html`:
Trong `#editDataModal`, tại card `Thông tin chung`:
```html
<div class="card-header bg-primary text-white py-2 d-flex justify-content-between align-items-center">
  <h6 class="mb-0">Thông tin chung</h6>
  <button type="button" id="btnEditSyncGgSheet" class="btn btn-sm btn-light text-primary fw-bold" title="Đồng bộ dữ liệu mới nhất từ Google Sheets">
    <i class="bi bi-arrow-repeat me-1"></i> Đồng bộ Google Sheets
  </button>
</div>
```

### 2.4. Kích hoạt trong các file Logic nghiệp vụ

Áp dụng trong cả 4 trang (`xg-nhap.js`, `xg-xuat.js`, `tole-nhap.js`, `tole-xuat.js`):
1. **Modal Thêm (`openAddDataModal`)**:
   ```javascript
   const btnSyncGgSheet = document.getElementById('btnSyncGgSheet');
   if (btnSyncGgSheet) {
     btnSyncGgSheet.onclick = () => {
       if (window.XgSapLookup && window.XgSapLookup.syncFromGoogleSheets) {
         window.XgSapLookup.syncFromGoogleSheets(btnSyncGgSheet);
       }
     };
     if (window.XgSapLookup && window.XgSapLookup.syncFromGoogleSheets) {
       window.XgSapLookup.syncFromGoogleSheets(btnSyncGgSheet, { isAuto: true });
     }
   }
   ```
2. **Modal Sửa (`openEditDataModal`)**:
   ```javascript
   const btnEditSyncGgSheet = document.getElementById('btnEditSyncGgSheet');
   if (btnEditSyncGgSheet) {
     btnEditSyncGgSheet.onclick = () => {
       if (window.XgSapLookup && window.XgSapLookup.syncFromGoogleSheets) {
         window.XgSapLookup.syncFromGoogleSheets(btnEditSyncGgSheet);
       }
     };
     if (window.XgSapLookup && window.XgSapLookup.syncFromGoogleSheets) {
       window.XgSapLookup.syncFromGoogleSheets(btnEditSyncGgSheet, { isAuto: true });
     }
   }
   ```

### 2.5. Đồng bộ thư mục phân phối (`scripts/sync-dist.js`)

Chạy lệnh build/sync:
```powershell
node scripts/sync-dist.js
```
Sao chép các file đã sửa sang `dist/`, `public/`, `dist-app/`.

---

## 3. Kế hoạch Kiểm Thử & Tiêu Chí Nghiệm Thu

| STT | Kịch bản kiểm thử | Kết quả mong đợi |
| :---: | :--- | :--- |
| 1 | Mở modal Thêm tại `xg-nhap.html` | Nút "Đồng bộ Google Sheets" nhấp nháy 3 nhịp mượt mà, icon xoay tròn, tự động fetch Google Sheets ngầm và trả về bình thường. |
| 2 | Mở modal Sửa tại `xg-nhap.html` | Nút trên modal Sửa nhấp nháy 3 nhịp và đồng bộ ngầm thành công. |
| 3 | Mở modal Thêm tại `xg-xuat.html` | Nút nhấp nháy 3 nhịp và đồng bộ ngầm thành công. |
| 4 | Mở modal Sửa tại `xg-xuat.html` | Có nút `#btnEditSyncGgSheet`, nhấp nháy 3 nhịp và đồng bộ ngầm thành công. |
| 5 | Mở modal Thêm tại `tole-nhap.html` | Nút nhấp nháy 3 nhịp và đồng bộ ngầm thành công. |
| 6 | Mở modal Sửa tại `tole-nhap.html` | Nút nhấp nháy 3 nhịp và đồng bộ ngầm thành công. |
| 7 | Mở modal Thêm tại `tole-xuat.html` | Nút nhấp nháy 3 nhịp và đồng bộ ngầm thành công. |
| 8 | Mở modal Sửa tại `tole-xuat.html` | Có nút `#btnEditSyncGgSheet`, nhấp nháy 3 nhịp và đồng bộ ngầm thành công. |
| 9 | Bấm thủ công vào nút khi đang mở modal | Vẫn cho phép bấm lại, kích hoạt đồng bộ bình thường. |
| 10 | Kiểm tra chạy tự động test runner (nếu có) | Chạy bộ test Node.js không phát sinh lỗi cú pháp hay gãy luồng. |
