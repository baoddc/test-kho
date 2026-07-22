# Tole Storage Age Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cập nhật công thức tính Số ngày lưu kho trung bình của Tồn kho trên trang Biểu đồ Tole khớp với trang Tồn kho Tole.

**Architecture:** Thay đổi cách tính toán `averageStockAge` trong file `tole-bieu-do.js` để lặp qua toàn bộ dữ liệu trong `tonData`, tính khoảng cách từ ngày nhập đến ngày hiện tại (today) sử dụng mốc giờ `00:00:00.000` và làm tròn xuống bằng `Math.floor`. Việc tính toán này độc lập với bộ lọc ngày được chọn trên giao diện.

**Tech Stack:** Vanilla JavaScript, HTML5

## Global Constraints
- Không sử dụng thư viện xử lý ngày tháng ngoài (chỉ dùng đối tượng Date mặc định của JS).
- Đảm bảo giữ nguyên các chức năng khác của trang biểu đồ.

---

### Task 1: Cập nhật công thức tính Số ngày lưu kho trung bình trong tole-bieu-do.js

**Files:**
- Modify: [tole-bieu-do.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/tole/tole-bieu-do.js) (dòng 961-970)

**Interfaces:**
- Consumes: `tonData` (mảng chứa dữ liệu tồn kho hiện tại)
- Produces: `averageStockAge` (Số ngày lưu kho trung bình của toàn bộ tồn kho hiện tại)

- [ ] **Step 1: Thay thế logic tính toán ngày lưu kho hiện tại**
  Sửa đổi trong file [tole-bieu-do.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/tole/tole-bieu-do.js) tại dòng 961-970.
  
  *Đoạn mã cũ:*
  ```javascript
      // Calculate stock age
      const dateIn = parseRowDate(row[tonDateColIndex]);
      if (dateIn && dateIn <= evaluationEndDate) {
        const days = (evaluationEndDate - dateIn) / (1000 * 60 * 60 * 24);
        if (days >= 0) {
          totalStockAgeDays += days;
          stockCount++;
        }
      }
  ```

  *Đoạn mã mới:*
  ```javascript
      // Calculate stock age (based on today, identical to tole-ton storage age calculation)
      const dateIn = parseRowDate(row[tonDateColIndex]);
      if (dateIn) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const importDate = new Date(dateIn);
        importDate.setHours(0, 0, 0, 0);

        const diffTime = today - importDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const storageDays = diffDays >= 0 ? diffDays : 0;

        totalStockAgeDays += storageDays;
        stockCount++;
      }
  ```

- [ ] **Step 2: Kiểm tra thủ công kết quả hiển thị trên giao diện**
  1. Mở file [tole-bieu-do.html](file:///c:/Users/benhhc/Desktop/web-supabase/pages/tole/tole-bieu-do.html) bằng trình duyệt.
  2. Xem giá trị ô "SỐ NGÀY LƯU KHO TB CỦA TỒN KHO".
  3. Mở file [tole-ton.html](file:///c:/Users/benhhc/Desktop/web-supabase/pages/tole/tole-ton.html) bằng trình duyệt.
  4. Lấy trung bình cộng của cột "Thời gian lưu kho" và đối chiếu xem hai giá trị có trùng khớp tuyệt đối hay không.

- [ ] **Step 3: Commit thay đổi**
  Run:
  ```bash
  git add assets/js/tole/tole-bieu-do.js
  git commit -m "fix: update tole average stock age calculation to match tole-ton"
  ```
