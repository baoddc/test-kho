# Design Spec: Redesign About Page (Interactive Tech Hub & Glassmorphism Dashboard)

**Date:** 2026-07-29  
**Author:** Antigravity AI & I'M BAO  
**Target File:** `pages/about.html` & `assets/css/about.css`  

---

## 1. Goal & Requirements

Redesign `pages/about.html` into a state-of-the-art, interactive **Tech Hub & Glassmorphism Dashboard** for the DDC Coil & Materials Management System.

### Key Intent & Additions
- **Modern Visual Aesthetics:** Deep sleek dark mode (`#0b0f19`), animated glow orbs, cyan/emerald gradient accents, glassmorphism cards with subtle interactive hover effects.
- **Updated Tech & Features Content:** Highlight Supabase Data Engine (B+ Tree Cache, Server-Side Pagination), Voice Assistant Service, 5S/HSE Module, PWA Offline Service Worker, and RBAC Security.
- **Interactive Performance Hub:** Visual performance thresholds breakdown, glass table, and Supabase optimization note explaining client DOM vs server-side SQL pagination.
- **Developer Terminal Badge:** Sleek signature badge honoring author `I'M BAO - Vibe Code Developer`.

---

## 2. Page Structure & Components

### 2.1 Hero Section
- **Dynamic Gradient Header:** "Hệ Thống Quản Lý Kho Phôi Cuộn & Vật Tư"
- **Subtitle:** "Hệ thống quản lý kho Phôi Cuộn, Tole, Xà Gồ & Phế Liệu thông minh"
- **Live Status Badges (4 Pills):**
  - 🟢 `Supabase Engine`: Server-side Range Pagination
  - 🔵 `Voice Service`: Voice Assistant Ready
  - 🟣 `PWA & Offline`: Service Worker Active
  - 🟡 `Bảo Mật RBAC`: Access Control Enforced

### 2.2 Core Modules Grid (5 Cards)
Glassmorphism cards with FontAwesome icons & hover animations:
1. **Phôi Cuộn / Phôi Lá (PL):** Quản lý phiếu cân, quy cách & xuất nhập phôi.
2. **Xà Gồ (XG):** Quản lý xà gồ C/Z với quy trình khép kín.
3. **Tole:** Quản lý tồn kho tole cuộn và tole thành phẩm.
4. **Phế Liệu:** Quản lý thu hồi và cân phế liệu kho.
5. **Quy trình 5S & HSE:** Theo dõi và kiểm tra đánh giá an toàn 5S.

### 2.3 Technology & Architecture Spotlight (5 Cards)
1. **Supabase Data Engine:** Thuật toán B+ Tree Block Cache & Range Pagination (`.range(from, to)`), prefetch trang $N+1$ không độ trễ.
2. **Trợ Lý Giọng Nói (Voice Assistant):** Nhận diện lệnh thoại tiếng Việt hỗ trợ nhập xuất nhanh.
3. **Ủy Quyền Sự Kiện (Event Delegation):** Lắng nghe tại `document` gốc, nâng cao tốc độ phản hồi giao diện.
4. **Cô Lập CSS (CSS Isolation):** Lớp CSS độc quyền ngăn xung đột từ thư viện bên ngoài.
5. **Phân Quyền RBAC (Role Access):** Khóa tự động tính năng nhạy cảm cho tài khoản không đủ thẩm quyền (`bao.lt`).

### 2.4 Performance & Scalability Section
- **3 Performance Cards:**
  - *Ngưỡng Tối Ưu (< 5.000 dòng):* Tải < 2s, RAM ~50MB.
  - *Ngưỡng Ổn Định (5.000 - 20.000 dòng):* Tải 3-7s, RAM 100-300MB.
  - *Ngưỡng Cảnh Báo (> 20.000 dòng):* Khuyến cáo dùng Supabase Server-side Pagination.
- **Glass Metric Table:** Bảng thông số tốc độ tải, độ trễ tìm kiếm, RAM tiêu thụ.
- **Supabase Optimization Note Card:** Giải thích cơ chế server-side SQL pagination giúp vượt qua giới hạn DOM rendering của trình duyệt.

### 2.5 Developer Signature
Glassmorphism Dev Terminal badge:
`Built with passion by I'M BAO - Vibe Code Developer`

---

## 3. Styling & Animation Details (`assets/css/about.css`)

- **Color Palette:**
  - Background: `#0b0f19`
  - Cards: `rgba(255, 255, 255, 0.03)` with `backdrop-filter: blur(16px)`
  - Glow borders: `rgba(0, 217, 255, 0.2)`
  - Gradients: `linear-gradient(135deg, #00d9ff, #00ff88)`
- **Animations:**
  - Floating ambient background orbs (`@keyframes float`).
  - IntersectionObserver fade-up scroll animations (`.fade-up.visible`).
  - Interactive hover 3D tilt/transform (`translateY(-8px)`).

---

## 4. Verification Plan

1. Open `pages/about.html` in browser / local development server (`http://localhost:3000/pages/about.html`).
2. Verify all sections load properly with dark mode glassmorphism styles.
3. Check scroll animation effects (`fade-up`), responsive behavior on mobile/tablet screens.
4. Confirm clear visual contrast and links functioning properly.
