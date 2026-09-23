# Đặc tả thiết kế: Thông báo hàng về kho từ XG-Nhập và Tole-Nhập

## 1. Mục tiêu và Bối cảnh
Người dùng khi nhập hàng ở các trang quản lý nhập cuộn xà gồ (`pages/xg/xg-nhap.html`) và tôn cuộn (`pages/tole/tole-nhap.html`) cần có chức năng thông báo hàng về kho tức thì lên hệ thống thông báo chung (`system_announcements`) của ứng dụng.

Thông báo được định dạng nhất quán:
- **Tiêu đề:** `Hàng về kho ngày DD/MM` (VD: `Hàng về kho ngày 29/08`).
- **Nội dung:** Tự động phân loại theo **Tên công trình** (nếu để trống thì hiển thị nhóm `[Tồn trơn]`), gom tổng khối lượng các cuộn cùng loại vật tư dạng `${Tên vật tư}: ${Tổng kg}kg`.
- Cho phép người dùng tick chọn linh hoạt các lần/cuộn nhập hàng trong ngày (hỗ trợ trường hợp trong ngày nhập nhiều đợt, hoặc muốn gom cả Xà gồ và Tole vào chung 1 thông báo ngày).

## 2. Giao diện Người dùng (UI/UX)

### 2.1. Nút bấm trên thanh công cụ
- Thêm nút **`📢 Thông báo hàng về`** vào thanh công cụ thao tác trên cả 2 trang:
  - `pages/xg/xg-nhap.html`
  - `pages/tole/tole-nhap.html`
- Nút có thuộc tính phân quyền `data-perm="add"` để đồng bộ với quyền nhập dữ liệu.

### 2.2. Modal "Thông báo hàng về kho" (`modalGoodsArrivalNotice`)
Bao gồm:
1. **Header:** `📢 Tạo / Cập nhật Thông báo Hàng về kho`
2. **Bộ lọc Ngày & Nạp dữ liệu:**
   - Trường chọn ngày (`input type="date"`), mặc định là ngày hôm nay.
   - Nút `🔄 Tải dữ liệu` để nạp dữ liệu nhập kho của ngày đã chọn.
3. **Bảng danh sách hàng nhập trong ngày:**
   - Truy vấn tổng hợp từ cả 2 bảng `xg-nhap` và `tole-nhap` theo ngày được chọn.
   - Các cột:
     - Ô Checkbox `[x]` từng dòng (có ô chọn tất cả / bỏ chọn tất cả).
     - Kho (`Xà gồ` hoặc `Tole`).
     - Phiếu nhập / Mã chứng từ.
     - Tên vật tư.
     - Cuộn ID.
     - Khối lượng (Kg).
     - Tên công trình (hiển thị tên công trình hoặc huy hiệu `Tồn trơn` nếu trống).
4. **Khung Xem trước thông báo (Live Preview):**
   - Tự động render ngay khi người dùng tick/bỏ tick bất kỳ dòng nào.
   - Thể hiện dạng Card thông báo tương thích giao diện modal chuông (`update-checker.js`):
     - Huy hiệu: `📢 Thông báo chung`
     - Tiêu đề: `Hàng về kho ngày DD/MM`
     - Nội dung văn bản định dạng chuẩn:
       ```text
       [Dự án Sky Tower]
       0.75X45VN: 7.712kg
       1.5X348VN: 26.770kg

       [Tồn trơn]
       1.5X50VN: 8.050kg
       2.4X95VN: 2.335kg
       ```
5. **Footer:**
   - Thông tin trạng thái: Cho biết ngày này đã từng có thông báo trên hệ thống chưa.
   - Nút `Đóng`.
   - Nút `🚀 Đăng / Cập nhật thông báo` (tiến hành lưu lên Supabase).

## 3. Kiến trúc và Luồng Dữ liệu (Data Flow)

### 3.1. Module dùng chung `goods-arrival-notice.js`
Để tránh lặp lại mã nguồn giữa `xg-nhap.html` và `tole-nhap.html`, xây dựng một module chung tại:
`assets/js/components/goods-arrival-notice.js`

Module này phụ trách:
- Khởi tạo Modal UI nếu chưa có trong DOM.
- Tải dữ liệu nhập hàng từ bảng `xg-nhap` và `tole-nhap` qua Supabase.
- Chuẩn hóa ngày nhập (`YYYY-MM-DD` hoặc `DD/MM/YYYY`).
- Thuật toán gom nhóm & tính tổng:
  ```javascript
  // 1. Phân nhóm theo Tên công trình (hoặc 'Tồn trơn')
  // 2. Trong mỗi nhóm, cộng dồn kg theo Tên vật tư
  // 3. Format kg: n.toLocaleString('vi-VN', { maximumFractionDigits: 3 }) + 'kg'
  ```
- Thao tác Supabase với bảng `system_announcements`:
  - Lấy thông báo theo tiêu đề `Hàng về kho ngày DD/MM`.
  - Nếu đã tồn tại: Cập nhật (`UPDATE`) nội dung và thời gian.
  - Nếu chưa có: Tạo mới (`INSERT`) với `type: 'info'`, `is_active: true`.
- Gọi hàm `fetchAnnouncements()` hoặc trigger Realtime để chuông thông báo cập nhật ngay lập tức.

### 3.2. Thuật toán gom nhóm chi tiết
```javascript
function generateAnnouncementContent(selectedRows) {
  // Map: ProjectName -> Map(MaterialName -> totalKg)
  const projectMap = new Map();

  selectedRows.forEach(row => {
    let proj = (row['Tên công trình'] || '').trim();
    if (!proj) proj = 'Tồn trơn';

    let mat = (row['Tên vật tư'] || row['Mã vật tư'] || 'Vật tư khác').trim();
    let kg = typeof row['Số lượng (Kg)'] === 'number' ? row['Số lượng (Kg)'] : parseFloat(row['Số lượng (Kg)']) || 0;

    if (!projectMap.has(proj)) {
      projectMap.set(proj, new Map());
    }
    const matMap = projectMap.get(proj);
    matMap.set(mat, (matMap.get(mat) || 0) + kg);
  });

  const sections = [];
  // Đưa các công trình lên trước, nhóm 'Tồn trơn' xuống sau (nếu có)
  const sortedProjects = Array.from(projectMap.keys()).sort((a, b) => {
    if (a === 'Tồn trơn') return 1;
    if (b === 'Tồn trơn') return -1;
    return a.localeCompare(b, 'vi');
  });

  for (const proj of sortedProjects) {
    const matMap = projectMap.get(proj);
    const lines = [`[${proj}]`];
    for (const [mat, totalKg] of matMap.entries()) {
      const kgStr = totalKg.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
      lines.push(`${mat}: ${kgStr}kg`);
    }
    sections.push(lines.join('\n'));
  }

  return sections.join('\n\n');
}
```

## 4. Tích hợp và Đồng bộ
1. Nhúng `assets/js/components/goods-arrival-notice.js` vào:
   - `pages/xg/xg-nhap.html`
   - `pages/tole/tole-nhap.html`
2. Gắn sự kiện click nút `btnGoodsNotice` để mở modal.
3. Chạy lệnh đồng bộ bản dựng `npm run build` (`node scripts/sync-dist.js`) để đảm bảo các thư mục `dist`, `dist-app`, và `public` nhận đầy đủ mã nguồn mới nhất.

## 5. Kế hoạch Kiểm thử (Verification Plan)
- Mở trang `pages/xg/xg-nhap.html` và `pages/tole/tole-nhap.html`, xác nhận nút `📢 Thông báo hàng về` xuất hiện đầy đủ.
- Bấm nút mở Modal, chọn ngày có dữ liệu (hoặc ngày hôm nay), kiểm tra dữ liệu tải lên từ cả 2 bảng `xg-nhap` và `tole-nhap`.
- Thử tích chọn các dòng:
  - Kiểm tra dòng có tên công trình được gom vào `[Tên công trình]`.
  - Kiểm tra dòng không có tên công trình tự động gom vào `[Tồn trơn]`.
  - Kiểm tra các dòng cùng vật tư được cộng dồn chính xác số kg và hiển thị dấu chấm hàng nghìn kèm đuôi `kg`.
- Bấm "Đăng / Cập nhật thông báo":
  - Kiểm tra bản ghi xuất hiện trong bảng `system_announcements`.
  - Kiểm tra chuông thông báo (modal thông báo hệ thống) hiển thị thẻ thông báo đúng giao diện như ảnh mẫu.
