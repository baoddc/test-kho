# Thiết kế Kỹ thuật - Chuyển đổi Hệ thống Tole sang Supabase

Tài liệu này mô tả chi tiết thiết kế chuyển đổi các trang quản lý Tole (`tole-nhap`, `tole-xuat`, `tole-ton`, `tole-bieu-do`) từ Google Sheets sang kết nối cơ sở dữ liệu Supabase, đảm bảo tính nhất quán cấu trúc và logic tương tự như hệ thống Xà gồ (XG).

## Cấu trúc Bảng Database (Supabase SQL)

Dựa trên cấu trúc bảng được định nghĩa trong ảnh đính kèm của bạn, chúng ta sẽ định nghĩa 3 bảng trong Supabase:

### 1. Bảng Nhập Tole (`tole-nhap`)
Bảng lưu trữ thông tin chi tiết từng cuộn tole được nhập kho.

```sql
CREATE TABLE public."tole-nhap" (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "Mã chứng từ" text,
    "Ngày nhập" date,
    "Phiếu nhập" text,
    "Loại nhập" text,
    "Mã vật tư" text,
    "Tên vật tư" text,
    "Batch" text,
    "Cuộn ID" text,
    "Số lượng (Kg)" numeric,
    "Số lượng (m)" numeric,
    "Vị trí" text,
    "Mã công trình" text,
    "Tên công trình" text,
    "Ghi chú" text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

### 2. Bảng Xuất Tole (`tole-xuat`)
Bảng lưu trữ thông tin các cuộn tole xuất kho (sử dụng tên cột khớp chính xác với hình ảnh bạn cung cấp).

```sql
CREATE TABLE public."tole-xuat" (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "Mã chứng từ" text,
    "Ngày nhập" date,   -- Khớp tên cột 'Ngày nhập' từ ảnh
    "Phiếu nhập" text,  -- Khớp tên cột 'Phiếu nhập' từ ảnh
    "Loại nhập" text,   -- Khớp tên cột 'Loại nhập' từ ảnh
    "Mã vật tư" text,
    "Tên vật tư" text,
    "Batch" text,
    "Cuộn ID" text,
    "Số lượng (Kg)" numeric,
    "Số lượng (m)" numeric,
    "Mã công trình" text,
    "Tên công trình" text,
    "Ghi chú" text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

### 3. Bảng Tồn Tole (`tole-ton`)
Bảng lưu trữ dữ liệu tồn kho tĩnh.

```sql
CREATE TABLE public."tole-ton" (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "Ngày nhập" date,
    "Thời gian lưu kho" numeric,
    "Vị trí" text,
    "Mã vật tư" text,
    "Tên vật tư" text,
    "Batch" text,
    "Cuộn ID" text,
    "Khối lượng (kg)" numeric,
    "Mã công trình" text,
    "Tên công trình" text,
    "Khối lượng (m)" numeric,
    "Ghi chú" text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

---

## Chi tiết các File Thay đổi

### 1. HTML Files (`pages/tole/`)
Cần cập nhật các file:
* [tole-nhap.html](file:///c:/Users/benhhc/Desktop/web-supabase/pages/tole/tole-nhap.html)
* [tole-xuat.html](file:///c:/Users/benhhc/Desktop/web-supabase/pages/tole/tole-xuat.html)
* [tole-ton.html](file:///c:/Users/benhhc/Desktop/web-supabase/pages/tole/tole-ton.html)
* [tole-bieu-do.html](file:///c:/Users/benhhc/Desktop/web-supabase/pages/tole/tole-bieu-do.html)

**Thay đổi chính:**
* Nhúng thư viện Supabase JS CDN:
  ```html
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
  ```
* Nhúng cấu hình Supabase config:
  ```html
  <script src="/assets/js/supabase-config.js"></script>
  ```
* Thay đổi đường dẫn file JavaScript tương ứng sang các phiên bản `-supabase.js` (hoặc cập nhật trực tiếp như bieu-do).

---

### 2. JS Files (`assets/js/tole/`)

#### a. Tạo mới [tole-nhap-supabase.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/tole/tole-nhap-supabase.js)
* **Kiến trúc**: Dựa hoàn toàn trên `xg-nhap-supabase.js`.
* **Cột Header**:
  ```javascript
  const COLUMN_HEADERS = [
    'id', 'Mã chứng từ', 'Ngày nhập', 'Phiếu nhập', 'Loại nhập',
    'Mã vật tư', 'Tên vật tư', 'Batch', 'Cuộn ID', 'Số lượng (Kg)',
    'Số lượng (m)', 'Vị trí', 'Mã công trình', 'Tên công trình', 'Ghi chú'
  ];
  ```
* **Chức năng**:
  * Thêm/Sửa cuộn: Hỗ trợ xử lý 2 cột số lượng đầu vào: `Số lượng (Kg)` và `Số lượng (m)`.
  * CRUD trực tiếp lên Supabase table `tole-nhap`.

#### b. Tạo mới [tole-xuat-supabase.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/tole/tole-xuat-supabase.js)
* **Kiến trúc**: Dựa hoàn toàn trên `xg-xuat-supabase.js`.
* **Cột Header**:
  ```javascript
  const COLUMN_HEADERS = [
    'id', 'Mã chứng từ', 'Ngày nhập', 'Phiếu nhập', 'Loại nhập',
    'Mã vật tư', 'Tên vật tư', 'Batch', 'Cuộn ID', 'Số lượng (Kg)',
    'Số lượng (m)', 'Mã công trình', 'Tên công trình', 'Ghi chú'
  ];
  ```
* **Chọn cuộn tồn kho**:
  * Hàm `openInventoryModal` sẽ tải toàn bộ danh sách nhập từ `tole-nhap` và danh sách xuất từ `tole-xuat`.
  * Tính toán tồn động bằng cách lọc ra các `Cuộn ID` ở bảng nhập chưa xuất hiện trong bảng xuất.
  * Hiển thị bảng chọn cuộn với cột `Số lượng (Kg)` và `Số lượng (m)` tương ứng.

#### c. Tạo mới [tole-ton-supabase.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/tole/tole-ton-supabase.js)
* **Kiến trúc**: Dựa trên `xg-ton-supabase.js`.
* **Cột Header**:
  ```javascript
  const COLUMN_HEADERS = [
    'id', 'Ngày nhập', 'Thời gian lưu kho', 'Vị trí', 'Mã vật tư', 'Tên vật tư',
    'Batch', 'Cuộn ID', 'Khối lượng (kg)', 'Mã công trình', 'Tên công trình',
    'Khối lượng (m)', 'Ghi chú'
  ];
  ```

#### d. Cập nhật [tole-bieu-do.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/tole/tole-bieu-do.js)
* Thay thế việc `fetch(XLSX_URL_FULL)` bằng việc đọc trực tiếp dữ liệu phân trang từ 3 bảng `tole-nhap`, `tole-xuat`, `tole-ton` qua Supabase JS client.
* Map các trường dữ liệu Supabase về mảng 2 chiều để tương thích với các thuật toán vẽ biểu đồ hiện tại.

---

## Kế hoạch Kiểm thử (Verification Plan)
1. **Kiểm tra tải dữ liệu**: Khi vào các trang Tole, dữ liệu được tải mượt mà từ DB Supabase mà không bị lỗi.
2. **Thêm dữ liệu Nhập/Xuất**: Thực hiện thêm mới nhiều cuộn, kiểm tra xem các bản ghi có được lưu vào Supabase đúng cấu trúc cột và đúng số Kg/M không.
3. **Tính tồn kho động**: Khi mở modal chọn cuộn để xuất, danh sách cuộn phải hiển thị chính xác các cuộn đang tồn trong kho (nhập mà chưa xuất).
4. **Biểu đồ**: Biểu đồ tole hiển thị đúng số liệu nhập, xuất, tồn thực tế tức thời trên Database.
