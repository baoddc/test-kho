# Thiết kế: Thay đổi con trỏ chuột khi di chuyển vào nút đóng tab

Mục tiêu: Đảm bảo con trỏ chuột quay trở lại dạng mặc định (mũi tên) khi di chuột vào nút "x" đóng tab thay vì hiển thị hình bàn tay nắm/kéo (`cursor: grab`).

## Chi tiết thay đổi

### assets/css/sidebar.css
Thêm `cursor: default;` cho `.tab-item-close`.

```css
.tab-item-close {
  font-size: 9px;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all var(--transition);
  opacity: 0.5;
  cursor: default; /* Thêm dòng này để đưa trỏ chuột về mặc định */
}
```

## Phương án kiểm thử thủ công
1. Mở trang web ứng dụng.
2. Mở một vài tab mới từ menu bên trái (ví dụ: "Nhập - XG", "Xuất - XG").
3. Di chuột lên tiêu đề tab (con trỏ sẽ hiển thị dạng `grab` để báo hiệu có thể kéo thả để sắp xếp).
4. Di chuột vào nút "x" đóng tab trên tab đó.
5. Xác nhận con trỏ chuột thay đổi thành mũi tên mặc định (`default`).
