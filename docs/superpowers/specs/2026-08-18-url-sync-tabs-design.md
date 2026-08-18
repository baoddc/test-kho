# Đặc tả Thiết Kế: Đồng Bộ URL & Điều Hướng Đa Tab (HTML5 History API)

**Ngày lập:** 2026-08-18  
**Trạng thái:** Đã phê duyệt  
**Mục tiêu:** Khi người dùng mở hoặc chuyển đổi giữa các tab con được nhúng (`<iframe>`), thanh địa chỉ của trình duyệt sẽ hiển thị đúng đường dẫn (URL) của trang đang xem; hỗ trợ nút Back/Forward của trình duyệt và hỗ trợ tải lại (F5) / truy cập link trực tiếp (Deep Linking) mà vẫn giữ nguyên khung giao diện Shell đa tab.

---

## 1. Bối cảnh & Hiện trạng

- Ứng dụng quản lý kho DDC hoạt động theo mô hình **Multi-tab Iframe Shell**.
- Shell chính là `pages/home.html` (chứa Sidebar, Tab Bar và vùng chứa nội dung `tab-content-container`).
- Khi click menu, `sidebar.js` gọi hàm `openTab(url, title)` để nhúng trang con qua thẻ `<iframe>`.
- **Hạn chế cũ:**
  - Thanh địa chỉ (`window.location`) luôn giữ nguyên là `/pages/home.html` khi mở các tab con.
  - Người dùng không thể copy link tab con để chia sẻ hoặc lưu bookmark.
  - Bấm nút Back/Forward của trình duyệt không chuyển tab mà có thể gây reload hoặc thoát trang.
  - Khi tải lại trang (F5) trên một tab con hoặc truy cập link trực tiếp, người dùng bị mất ngữ cảnh đa tab của Trang chủ.

---

## 2. Kiến trúc & Giải pháp Kỹ thuật

### 2.1. Quản lý Lịch sử Duyệt & Cập nhật URL (`pushState` / `replaceState`)

1. **Khi chuyển đổi tab (`switchTab(tabId, updateHistory = true)`)**:
   - Xác định tab mục tiêu `targetTab`.
   - Cập nhật class `active` cho tab trong tab-bar, pane iframe tương ứng, và sidebar link.
   - Cập nhật tiêu đề trình duyệt:
     ```js
     const baseTitle = 'Kho Phôi cuộn - DDC';
     document.title = targetTab.title && targetTab.id !== 'tab-home' ? `${targetTab.title} | ${baseTitle}` : baseTitle;
     ```
   - Nếu `updateHistory === true`:
     - Nếu là `tab-home`: URL cập nhật về `/pages/home.html` (hoặc `/`).
     - Nếu là tab con: URL cập nhật về `targetTab.url`.
     - Sử dụng `window.history.pushState({ tabId: targetTab.id, url: targetTab.url, title: targetTab.title }, targetTab.title, targetTab.url);`

2. **Khi đóng tab (`closeTab(tabId)`)**:
   - Nếu tab bị đóng đang active, tự động switch sang tab liền trước và cập nhật lại URL của tab mới.
   - Nếu chỉ còn lại `tab-home`, URL trên thanh địa chỉ quay về `/pages/home.html`.

3. **Khi mở tab mới (`openTab(url, title, updateHistory = true)`)**:
   - Tạo iframe pane, tạo tab header, thêm vào danh sách `tabs`.
   - Kích hoạt tab đó thông qua `switchTab(tabId, updateHistory)`.

---

### 2.2. Xử lý Nút Back / Forward của Trình duyệt (`popstate`)

- Đăng ký sự kiện trên `window`:
  ```js
  window.addEventListener('popstate', (e) => {
    const state = e.state;
    if (state && state.tabId) {
      const existingTab = tabs.find(t => t.id === state.tabId);
      if (existingTab) {
        switchTab(existingTab.id, false);
      } else if (state.url) {
        // Tab đã bị đóng trước đó -> Mở lại
        openTab(state.url, state.title || 'Tab', false);
      }
    } else {
      // TH không có state -> Kiểm tra URL pathname hiện tại
      const currentPath = window.location.pathname;
      if (currentPath === '/' || currentPath.endsWith('home.html') || currentPath.endsWith('index.html')) {
        switchTab('tab-home', false);
      } else {
        const foundTab = tabs.find(t => t.url.split('?')[0] === currentPath);
        if (foundTab) {
          switchTab(foundTab.id, false);
        } else {
          openTab(currentPath + window.location.search, document.title, false);
        }
      }
    }
  });
  ```

---

### 2.3. Đồng bộ Ngược khi URL trong Iframe Thay đổi

- Khi trang con trong iframe chuyển hướng hoặc thay đổi tham số tìm kiếm (`location.search`):
  - Lắng nghe sự kiện `load` của thẻ `<iframe>`:
    ```js
    iframe.addEventListener('load', () => {
      try {
        const iframeUrl = iframe.contentWindow.location.pathname + iframe.contentWindow.location.search;
        if (iframeUrl && iframeUrl !== 'about:blank') {
          tabObj.url = iframeUrl;
          if (iframe.contentDocument && iframe.contentDocument.title) {
            tabObj.title = iframe.contentDocument.title.replace(' - DDC', '').trim();
            if (tabObj.tabEl) {
              const titleEl = tabObj.tabEl.querySelector('.tab-item-title');
              if (titleEl) titleEl.textContent = tabObj.title;
            }
          }
          if (activeTabId === tabObj.id) {
            updateSidebarActiveState(iframeUrl);
            window.history.replaceState({ tabId: tabObj.id, url: iframeUrl, title: tabObj.title }, tabObj.title, iframeUrl);
            document.title = `${tabObj.title} | Kho Phôi cuộn - DDC`;
          }
        }
      } catch (e) {
        console.warn('Cannot sync iframe url due to cross-origin or load timing', e);
      }
    });
    ```

---

### 2.4. Deep Linking & F5 Reload (Bảo toàn Shell)

- **Vấn đề**: Khi người dùng bookmark, copy link chia sẻ (ví dụ `https://domain.com/pages/xg/xg-nhap.html`), hoặc nhấn F5 trực tiếp khi đang ở tab con:
  - Nếu mở trực tiếp trang con ở tầng ngoài cùng (`window.self === window.top`), trang con không được bọc trong Shell đồng hồ Trang chủ.
- **Giải pháp**:
  - Khi một trang con (không phải `home.html`, `index.html`, `flower.html`, `offline.html`) được nạp ở tầng ngoài cùng (`window.self === window.top`):
    - Tự động chuyển hướng về Shell chính kèm tham số `openTab`:
      ```js
      const targetPage = window.location.pathname + window.location.search;
      window.location.replace(`/pages/home.html?openTab=${encodeURIComponent(targetPage)}`);
      ```
  - Khi `pages/home.html` khởi chạy:
    - `sidebar.js` kiểm tra tham số `openTab` trên `window.location.search`.
    - Nếu có `openTab`, tìm tiêu đề tương ứng từ danh mục `NAV_ITEMS` và tự động gọi `openTab(targetUrl, targetTitle, false)`.
    - Gọi `history.replaceState(...)` để đưa URL trên thanh địa chỉ quay trở lại đường dẫn sạch đẹp ban đầu (ví dụ `/pages/xg/xg-nhap.html`) mà không còn dính query param `?openTab=...`.

---

## 3. Danh sách File Cần Chỉnh Sửa

1. **`assets/js/components/sidebar.js`**:
   - Nâng cấp `openTab()`, `switchTab()`, `closeTab()` để tích hợp `history.pushState` / `history.replaceState`.
   - Thêm bộ lắng nghe sự kiện `popstate` cho cửa sổ chính.
   - Thêm cơ chế phát hiện và điều hướng Deep Linking / F5 Reload cho trang con và trang Shell `home.html`.
   - Cập nhật tiêu đề trang `document.title` động theo tab đang xem.
2. **`dist-app/assets/js/sidebar.js`** (nếu có bản build phân phối):
   - Đồng bộ cập nhật tương ứng.

---

## 4. Kế hoạch Kiểm Thử (Verification Plan)

1. **Kiểm tra Mở Tab Mới**: Mở menu *Xà gồ -> Nhập XG*, kiểm tra thanh địa chỉ đổi thành `/pages/xg/xg-nhap.html` và tiêu đề tab trình duyệt đổi tương ứng.
2. **Kiểm tra Chuyển Tab**: Chuyển qua lại giữa tab *Trang chủ* và tab *Nhập XG*, kiểm tra URL đổi mượt mà tương ứng.
3. **Kiểm tra Nút Back / Forward**: Bấm nút Back trên trình duyệt để quay lại Trang chủ, bấm Forward để tiến tới tab Nhập XG.
4. **Kiểm tra F5 Reload**: Đang ở tab *Nhập XG*, bấm F5 -> Trang nạp lại giao diện Shell đầy đủ với tab Trang chủ + tab Nhập XG đang active, thanh địa chỉ hiển thị `/pages/xg/xg-nhap.html`.
5. **Kiểm tra Đóng Tab**: Đóng tab con đang active -> Hệ thống tự active tab trước đó và cập nhật đúng URL.
