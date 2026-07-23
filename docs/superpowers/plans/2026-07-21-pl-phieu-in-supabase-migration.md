# PL Phiếu In Supabase Migration & Form Printing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `pl-phieu-in` page from Google Sheets to Supabase with 10 structured fields (`Ngày`, `Số phiếu`, `Bên nhận/Xưởng/Đội`, `Loại xuất`, `Mặt hàng`, `ĐVT`, `Trọng lượng hàng`, `Số xe`, `Mã công trình`, `Tên công trình`), and seamlessly populate and print `form-in.html`.

**Architecture:** Fetch, search, filter, and modify `pl-phieu-in` records directly from/to Supabase table `pl-phieu-in`. Transmit complete ticket payload containing header info and `hangHoa` items to `pages/pl/form-in.html` via `window.postMessage`.

**Tech Stack:** JavaScript (ES6+), Supabase JS SDK, HTML5, Bootstrap 5.

## Global Constraints
- Target table: `pl-phieu-in` in Supabase
- 10 fields: `Ngày`, `Số phiếu`, `Bên nhận/Xưởng/Đội`, `Loại xuất`, `Mặt hàng`, `ĐVT`, `Trọng lượng hàng`, `Số xe`, `Mã công trình`, `Tên công trình`
- Target print template: `pages/pl/form-in.html`

---

### Task 1: Update `pages/pl/form-in.html` to Populate `maCongTrinh` and `tenCongTrinh`

**Files:**
- Modify: `pages/pl/form-in.html:215-230`

**Interfaces:**
- Consumes: `formData` object from `postMessage` (`{ soPhieu, soXe, ngay, benNhan, loaiXuat, benGiao, maCongTrinh, tenCongTrinh, hangHoa }`)
- Produces: Populated HTML elements (`#maCongTrinh`, `#tenCongTrinh`)

- [ ] **Step 1: Update `populateFormIn()` function in `form-in.html`**

In `pages/pl/form-in.html`, update `populateFormIn` to check and set text content for `maCongTrinh` and `tenCongTrinh`:

```javascript
if (formData.maCongTrinh) {
    document.getElementById('maCongTrinh').textContent = formData.maCongTrinh;
}

if (formData.tenCongTrinh) {
    document.getElementById('tenCongTrinh').textContent = formData.tenCongTrinh;
}
```

- [ ] **Step 2: Save and commit**

```bash
git add pages/pl/form-in.html
git commit -m "feat(pl-phieu-in): populate maCongTrinh and tenCongTrinh in form-in.html"
```

---

### Task 2: Update `pages/pl/pl-phieu-in.html` Headers and Modal Forms

**Files:**
- Modify: `pages/pl/pl-phieu-in.html`

**Interfaces:**
- Consumes: Modal inputs for creating/editing data and creating printable ticket.
- Produces: HTML structure with fields for `Mã công trình` (`addMaCongTrinh`, `editMaCongTrinh`, `maCongTrinh`) and `Tên công trình` (`addTenCongTrinh`, `editTenCongTrinh`, `tenCongTrinh`).

- [ ] **Step 1: Update `addDataModal` and `editDataModal` fields in `pl-phieu-in.html`**

Ensure fields for `Mã công trình` and `Tên công trình` are present in `addDataMainFields` and `editDataMainFields` or as main form inputs, as well as in `phieuInModal`.

- [ ] **Step 2: Save and commit**

```bash
git add pages/pl/pl-phieu-in.html
git commit -m "feat(pl-phieu-in): add maCongTrinh and tenCongTrinh fields to pl-phieu-in.html modals"
```

---

### Task 3: Update `assets/js/pl/pl-phieu-in.js` Supabase Data Access, Search, and Print Flow

**Files:**
- Modify: `assets/js/pl/pl-phieu-in.js`

**Interfaces:**
- Consumes: Supabase `pl-phieu-in` table records.
- Produces: Data table rendering, CRUD operations, ticket search, and `postMessage` payload to `form-in.html`.

- [ ] **Step 1: Update `loadGoogleSheet` / `loadSupabaseData` to query `pl-phieu-in` from Supabase**

Ensure `loadGoogleSheet` (renamed/aliased for compatibility or direct call) fetches `pl-phieu-in` records with all 10 columns (`Số phiếu`, `Số xe`, `Ngày`, `Bên nhận/Xưởng/Đội`, `Loại xuất`, `Mặt hàng`, `ĐVT`, `Trọng lượng hàng`, `Mã công trình`, `Tên công trình`).

- [ ] **Step 2: Update Insert & Update functions in `pl-phieu-in.js`**

Map all 10 fields when inserting rows via `supabase.from('pl-phieu-in').insert(...)` and updating existing rows.

- [ ] **Step 3: Update Ticket Search and Selection Logic**

Update `searchPhieuIn` and `selectPhieuFromSearch` to extract and group all 10 fields (including `maCongTrinh` and `tenCongTrinh`).

- [ ] **Step 4: Update `printSelectedPhieu` and Form Submit Handler**

Ensure the `formData` sent to `form-in.html` contains:
```javascript
const formData = {
    soPhieu: selectedPhieuFromSearch.soPhieu,
    soXe: selectedPhieuFromSearch.soXe,
    ngay: selectedPhieuFromSearch.ngay,
    benNhan: selectedPhieuFromSearch.benNhan,
    loaiXuat: selectedPhieuFromSearch.loaiXuat,
    benGiao: selectedPhieuFromSearch.benGiao || '',
    maCongTrinh: selectedPhieuFromSearch.maCongTrinh || '',
    tenCongTrinh: selectedPhieuFromSearch.tenCongTrinh || '',
    hangHoa: selectedPhieuFromSearch.hangHoa
};
```

- [ ] **Step 5: Commit changes**

```bash
git add assets/js/pl/pl-phieu-in.js
git commit -m "feat(pl-phieu-in): integrate Supabase data fetching, search, and form-in printing"
```

---

### Task 4: Verification and Final Polish

**Files:**
- Check: `pages/pl/pl-phieu-in.html`, `assets/js/pl/pl-phieu-in.js`, `pages/pl/form-in.html`

- [ ] **Step 1: Test page rendering and Supabase data loading**
- [ ] **Step 2: Test modal forms (Add, Edit, Delete, Create ticket)**
- [ ] **Step 3: Test printing to `form-in.html` and verify all 10 fields are displayed properly**
- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "chore(pl-phieu-in): complete Supabase migration and form-in integration"
```
