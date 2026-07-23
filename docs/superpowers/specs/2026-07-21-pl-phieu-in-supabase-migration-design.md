# Design Document: PL Phiếu In Supabase Migration & Form Printing Integration

## Overview
Migrate the `pl-phieu-in` feature from Google Sheets to Supabase with 10 structured fields as specified, and ensure form data is seamlessly transmitted and rendered in `form-in.html`.

## Supabase Schema Specification
Table name: `pl-phieu-in`

| Field Name | Type | Description |
|---|---|---|
| `id` | bigint / serial | Primary key |
| `Ngày` | text | Date of receipt (ISO format YYYY-MM-DD or display format) |
| `Số phiếu` | text | Ticket / Voucher number |
| `Bên nhận/ Xưởng/Đội` | text | Recipient / Workshop / Team |
| `Loại xuất` | text | Export category |
| `Mặt hàng` | text | Item name |
| `ĐVT` | text | Unit of measure |
| `Trọng lượng hàng` | numeric | Weight of item |
| `Số xe` | text | Vehicle number |
| `Mã công trình` | text | Project code |
| `Tên công trình` | text | Project name |

## UI & Logic Changes

### 1. `pages/pl/pl-phieu-in.html`
- Update table header to render columns matching the 10 Supabase fields.
- Update Modals ("Thêm dữ liệu", "Sửa dữ liệu", "Tạo phiếu in") to include input fields for `Mã công trình` and `Tên công trình`.

### 2. `assets/js/pl/pl-phieu-in.js`
- Replace Google Sheets fetching logic with direct Supabase calls (`supabase.from('pl-phieu-in').select('*')`).
- Update CRUD operations (Insert, Update, Delete) to map all 10 fields to/from Supabase.
- Update ticket search (`searchPhieuIn`) to group items by `Số phiếu` and search across `Số phiếu`, `Số xe`, `Bên nhận/ Xưởng/Đội`, `Mã công trình`, and `Tên công trình`.
- Update `printSelectedPhieu()` and form submit handlers to send complete ticket payload (`soPhieu`, `soXe`, `ngay`, `benNhan`, `loaiXuat`, `maCongTrinh`, `tenCongTrinh`, `hangHoa`) to `form-in.html` via `window.postMessage`.

### 3. `pages/pl/form-in.html`
- Update `populateFormIn(formData)` to bind `maCongTrinh` and `tenCongTrinh` to `#maCongTrinh` and `#tenCongTrinh` table cells.
- Ensure header info and product list (`hangHoa`) are populated correctly with formatted numbers and dates.

## Verification Plan
- Verify CRUD operations write to Supabase `pl-phieu-in` table correctly.
- Test printing a ticket from `pl-phieu-in.html` to confirm `form-in.html` displays all 10 fields accurately.
