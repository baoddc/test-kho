# Thiết kế Kỹ thuật - Chuyển đổi Biểu đồ Xà gồ sang Supabase

Tài liệu này mô tả chi tiết thiết kế chuyển đổi trang Biểu đồ xà gồ (`xg-bieu-do`) từ việc lấy dữ liệu qua Google Sheets (.xlsx) sang kết nối trực tiếp Supabase DB để đồng bộ với hai trang `xg-nhap` và `xg-xuat`.

## Bối cảnh và Mục tiêu
Hiện nay các trang `xg-nhap.html` và `xg-xuat.html` đã chuyển sang kết nối trực tiếp với Supabase database (`xg-nhap`, `xg-xuat`, `xg-ton`). Tuy nhiên, trang `xg-bieu-do.html` vẫn đang lấy dữ liệu từ Google Sheets. Việc này gây ra tình trạng chậm trễ và lệch dữ liệu giữa biểu đồ và dữ liệu thực tế.

Mục tiêu là chuyển đổi `xg-bieu-do.js` để đọc trực tiếp dữ liệu từ các bảng Supabase, đồng thời giữ nguyên toàn bộ cấu trúc biểu đồ, giao diện và logic tính toán hiện tại.

## Thiết kế chi tiết

### 1. Thay đổi tại [xg-bieu-do.html](file:///c:/Users/benhhc/Desktop/web-supabase/pages/xg/xg-bieu-do.html)
Bổ sung các thư viện Supabase JS CDN và cấu hình kết nối `supabase-config.js` trước khi import `xg-bieu-do.js`:

```html
<!-- Supabase JS CDN -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>

<!-- SheetJS (xlsx) -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>

<!-- Custom JavaScript -->
<script src="/assets/js/sidebar.js"></script>
<script src="/assets/js/home.js"></script>

<!-- Supabase config (URL + anon key) -->
<script src="/assets/js/supabase-config.js"></script>

<!-- Main chart JS -->
<script src="/assets/js/xg/xg-bieu-do.js"></script>
```

### 2. Thay đổi tại [xg-bieu-do.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-bieu-do.js)

#### Định nghĩa Cấu trúc Bảng và Cột
Thêm các định nghĩa cột tương thích với database Supabase:

```javascript
const TABLE_NHAP = 'xg-nhap';
const TABLE_XUAT = 'xg-xuat';
const TABLE_TON = 'xg-ton';

const COLUMN_HEADERS_NHAP = [
  'id', 'Mã chứng từ', 'Ngày nhập', 'Phiếu nhập', 'Loại nhập',
  'Mã vật tư', 'Tên vật tư', 'Batch', 'Cuộn ID', 'Số lượng (Kg)',
  'Vị trí', 'Mã công trình', 'Tên công trình', 'Ghi chú'
];

const COLUMN_HEADERS_XUAT = [
  'id', 'Mã chứng từ', 'Ngày nhập', 'Phiếu nhập', 'Loại nhập',
  'Mã vật tư', 'Tên vật tư', 'Batch', 'Cuộn ID', 'Số lượng (Kg)',
  'Mã công trình', 'Tên công trình', 'Ghi chú'
];

const COLUMN_HEADERS_TON = [
  'id', 'Ngày nhập', 'Thời gian lưu kho', 'Vị trí', 'Mã vật tư',
  'Tên vật tư', 'Batch', 'Cuộn ID', 'Số lượng (Kg)', 'Mã công trình',
  'Tên công trình', 'Ghi chú'
];
```

#### Hàm helper đọc dữ liệu từ Supabase
Hỗ trợ đọc dữ liệu phân trang (range batch 1000) để đảm bảo không bị giới hạn số lượng dòng:

```javascript
async function fetchAllFromTable(tableName) {
  let allData = [];
  let from = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order('id', { ascending: true })
      .range(from, from + batchSize - 1);

    if (error) throw error;

    if (data && data.length > 0) {
      allData = allData.concat(data);
      if (data.length < batchSize) {
        hasMore = false;
      } else {
        from += batchSize;
      }
    } else {
      hasMore = false;
    }
  }
  return allData;
}
```

#### Cập nhật hàm `loadAllData()`
Thay đổi luồng tải dữ liệu:

```javascript
async function loadAllData() {
  try {
    document.getElementById('loading').style.display = '';
    document.getElementById('loading').textContent = 'Đang tải dữ liệu từ database...';

    const rawNhap = await fetchAllFromTable(TABLE_NHAP);
    const rawXuat = await fetchAllFromTable(TABLE_XUAT);
    const rawTon = await fetchAllFromTable(TABLE_TON);

    const rowToArray = (obj, headers) => headers.map(col => obj[col] ?? '');

    importData = [COLUMN_HEADERS_NHAP, ...rawNhap.map(r => rowToArray(r, COLUMN_HEADERS_NHAP))];
    exportData = [COLUMN_HEADERS_XUAT, ...rawXuat.map(r => rowToArray(r, COLUMN_HEADERS_XUAT))];
    tonData = [COLUMN_HEADERS_TON, ...rawTon.map(r => rowToArray(r, COLUMN_HEADERS_TON))];

    // Vì mỗi dòng trong Supabase đại diện cho 1 cuộn nên ta gán trực tiếp làm dữ liệu cuộn
    importRollsData = importData;
    exportRollsData = exportData;

    // Tính toán và hiển thị biểu đồ
    processDataAndCreateCharts();

    // Ẩn loading
    document.getElementById('loading').style.display = 'none';

  } catch (error) {
    document.getElementById('loading').innerHTML =
      `Lỗi kết nối database: ${error.message}<br>Kiểm tra kết nối hoặc cấu hình Supabase.`;
    console.error(error);
  }
}
```

## Kế hoạch kiểm thử (Verification Plan)
1. **Kiểm tra tải dữ liệu**: Khi mở trang biểu đồ xà gồ, chữ "Đang tải dữ liệu từ database..." hiển thị và sau đó biến mất.
2. **Khớp số liệu**: So sánh số liệu "ĐẦU KÌ", "TỔNG NHẬP", "TỔNG XUẤT", phân bổ và các biểu đồ xu hướng với số liệu thực tế hiển thị trên các bảng `xg-nhap`, `xg-xuat`.
3. **Bộ lọc theo ngày**: Thực hiện lọc từ ngày/đến ngày để đảm bảo các số liệu KPI và biểu đồ thay đổi chính xác.
4. **Vòng quay tồn kho**: Kiểm tra xem chỉ số "VÒNG QUAY TỒN KHO" và "SỐ NGÀY TỒN TRUNG BÌNH" có được tính toán chuẩn xác dựa trên dữ liệu cuộn từ Supabase không.
