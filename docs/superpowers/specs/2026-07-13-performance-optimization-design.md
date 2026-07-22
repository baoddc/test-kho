# Thiết kế Tối ưu hiệu năng - Phân hệ Xà gồ (XG)

Tài liệu thiết kế chi tiết nhằm nâng cao hiệu năng hệ thống quản lý Kho Xà gồ (XG). Giải pháp tập trung tối ưu hóa các khía cạnh: tốc độ tải mạng (network load), hiệu suất tính toán Javascript và hiệu năng hiển thị giao diện (DOM rendering).

## Bối cảnh và Vấn đề hiện tại
Hệ thống hiện tại chạy trên môi trường Web thuần (HTML/JS) tương tác với Supabase (hoặc Google Sheet qua XLSX export). Khi số lượng dòng dữ liệu tăng lên, người dùng sẽ gặp hiện tượng đơ giật hoặc tải chậm do các nguyên nhân sau:

1. **Hiệu ứng Thác nước mạng (Network Waterfall):**
   - Trong [xg-ton-supabase.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-ton-supabase.js) và [xg-bieu-do.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-bieu-do.js), dữ liệu từ các bảng `xg-nhap`, `xg-xuat`, `xg-ton` được tải một cách tuần tự (sử dụng `await` nối tiếp). Tổng thời gian chờ bằng tổng thời gian của từng request cộng lại.
2. **Dư thừa băng thông mạng (Network Payload Redundancy):**
   - File [xg-ton-supabase.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-ton-supabase.js) tải toàn bộ cột (`select('*')`) từ bảng `xg-xuat` chỉ để lấy trường `Cuộn ID` đối chiếu.
   - File [xg-xuat-supabase.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-xuat-supabase.js) khi mở modal Chọn cuộn tồn kho (`openInventoryModal`) tải toàn bộ dữ liệu của bảng `xg-nhap` về Client để tự lọc theo `Mã vật tư`.
3. **Độ phức tạp tính toán O(N) khi render trang (O(N) search overhead):**
   - Các hàm render dữ liệu ra bảng sử dụng `tableData.indexOf(data[i])` để lấy vị trí dòng gốc của từng dòng trên trang hiển thị. Nếu bảng có hàng ngàn dòng, việc gọi `indexOf` liên tục cho mỗi dòng hiển thị sẽ tiêu tốn đáng kể CPU (`100 * N` phép so sánh).
4. **Vẽ lại giao diện liên tục (DOM Reflow/Repaint Overhead):**
   - Các hàm render bảng thực hiện `tbody.appendChild(row)` bên trong vòng lặp tạo dòng. Trình duyệt phải tính toán lại kích thước và vẽ lại màn hình liên tục 100 lần cho mỗi trang hiển thị.

---

## Chi tiết Giải pháp tối ưu đề xuất

### 1. Song song hóa tải dữ liệu (Concurrency with Promise.all)
Chuyển đổi tải dữ liệu từ tuần tự sang song song:

*   **Tại [xg-ton-supabase.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-ton-supabase.js):**
    ```javascript
    // TRƯỚC:
    let nhapAll = await fetchTableData('xg-nhap');
    let xuatAll = await fetchTableData('xg-xuat');

    // SAU:
    const [nhapAll, xuatAll] = await Promise.all([
      fetchTableData('xg-nhap'),
      fetchTableData('xg-xuat', 'Cuộn ID') // Chỉ lấy cột Cuộn ID
    ]);
    ```

*   **Tại [xg-bieu-do.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-bieu-do.js):**
    ```javascript
    // TRƯỚC:
    const rawNhap = await fetchAllFromTable(TABLE_NHAP);
    const rawXuat = await fetchAllFromTable(TABLE_XUAT);
    let rawTon = await fetchAllFromTable(TABLE_TON);

    // SAU:
    const [rawNhap, rawXuat, rawTonResult] = await Promise.all([
      fetchAllFromTable(TABLE_NHAP),
      fetchAllFromTable(TABLE_XUAT),
      fetchAllFromTable(TABLE_TON)
    ]);
    let rawTon = rawTonResult;
    ```

### 2. Tối ưu bộ lọc Database (Database-level filtering)
*   **Tại [xg-xuat-supabase.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-xuat-supabase.js):**
    Khi mở `openInventoryModal`, ta truyền trực tiếp filter `ilike` vào Supabase query:
    ```javascript
    let query = supabase.from('xg-nhap').select('*');
    if (maVatTu) {
      query = query.ilike('Mã vật tư', `%${maVatTu}%`);
    }
    ```

### 3. Tra cứu chỉ mục gốc O(1) (Row originalIndex Caching)
Đính kèm `originalIndex` vào chính phần tử mảng của dòng khi tải dữ liệu, thay vì tìm kiếm động bằng `indexOf`.

*   **Lúc khởi tạo dữ liệu:**
    ```javascript
    tableData = [COLUMN_HEADERS, ...allData.map((row, idx) => {
      const arr = rowToArray(row);
      arr.originalIndex = idx + 1; // 1-based index
      return arr;
    })];
    ```
*   **Lúc render bảng:**
    ```javascript
    // TRƯỚC: const originalIndex = tableData.indexOf(data[i]);
    // SAU:
    const originalIndex = data[i].originalIndex ?? tableData.indexOf(data[i]);
    ```
*   **Khi thêm dòng mới:**
    ```javascript
    const arr = rowToArray(row);
    arr.originalIndex = tableData.length;
    tableData.push(arr);
    ```
*   **Khi sửa dòng dữ liệu:**
    ```javascript
    const arr = rowToArray(updatedData[0]);
    arr.originalIndex = selectedRowIndex;
    tableData[selectedRowIndex] = arr;
    ```

### 4. Kết chùm DOM Rendering (DOM Fragment Batching)
Sử dụng `DocumentFragment` làm bộ đệm để dựng toàn bộ cây DOM của bảng trước khi chèn vào trang:

```javascript
// Tạo DocumentFragment đóng vai trò bộ nhớ đệm
const fragment = document.createDocumentFragment();

for (let i = 1; i < data.length; i++) {
  const row = document.createElement('tr');
  // ... dựng cấu trúc thẻ td ...
  fragment.appendChild(row); // Chỉ chèn vào fragment, không ảnh hưởng DOM hiện tại
}

// Chèn toàn bộ fragment vào tbody trong đúng 1 bước duy nhất
tbody.appendChild(fragment);
```
Áp dụng tối ưu này cho hàm `renderTableData` và `renderGroupedTable` trong tất cả các file JS:
- [xg-nhap-supabase.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-nhap-supabase.js)
- [xg-xuat-supabase.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-xuat-supabase.js)
- [xg-ton-supabase.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-ton-supabase.js)
- [xg-nhap.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-nhap.js)
- [xg-xuat.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-xuat.js)
- [xg-ton.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/xg/xg-ton.js)

---

## Kế hoạch kiểm thử & Xác thực (Verification Plan)

### Kiểm thử thủ công:
1. **Kiểm tra tính năng tải dữ liệu và phân trang:**
   - Mở các trang Nhập, Xuất, Tồn, kiểm tra xem bảng dữ liệu hiển thị đầy đủ, chính xác cấu trúc cột và dữ liệu.
   - Thử click các nút chuyển trang trước/sau, thay đổi số trang trong dropdown để xác nhận phân trang hoạt động bình thường.
2. **Kiểm tra tính năng Lọc & Tìm kiếm:**
   - Nhập từ khóa tìm kiếm vào ô tìm kiếm, thay đổi bộ lọc ngày, chọn các giá trị lọc trong dropdown cột "Loại nhập/xuất" và "Mã chứng từ".
   - Xác nhận bảng lọc đúng dòng và hiển thị kết quả chính xác.
3. **Kiểm tra tính năng Thêm/Sửa/Xóa:**
   - Thực hiện thêm cuộn dữ liệu mới, sửa một cuộn dữ liệu, xóa một hoặc nhiều cuộn dữ liệu.
   - Xác nhận dữ liệu cập nhật thành công lên Supabase (hoặc Local) và bảng tự động làm mới chính xác.
4. **Kiểm tra tính năng Chọn cuộn tồn kho:**
   - Trên trang Xuất, bấm "Thêm dữ liệu" -> nhập mã vật tư -> bấm "Thêm cuộn" -> Chọn cuộn từ Tồn kho.
   - Xác nhận danh sách cuộn tồn kho hiển thị đúng mã vật tư đã lọc, cho phép chọn và đưa ra ngoài bảng chính xác.
5. **Kiểm tra Biểu đồ:**
   - Mở trang Biểu đồ xà gồ, lọc theo ngày.
   - Xác nhận các biểu đồ Chart.js hiển thị chính xác số liệu, không bị lỗi tính toán.
6. **Kiểm tra xuất Excel:**
   - Bấm nút "Tải file Excel (.xlsx)" ở các trang Nhập, Xuất, Tồn.
   - Xác nhận file Excel được tải xuống có đầy đủ các cột và chứa dữ liệu chính xác.
