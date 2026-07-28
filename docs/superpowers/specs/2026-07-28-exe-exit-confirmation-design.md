# Exit Confirmation Dialog Design Specification for Electron (.exe) App

## Goal
Show an interactive confirmation dialog when the user attempts to close the desktop executable (.exe) app via window close button (`X`), system exit command, or keyboard shortcut (`Alt + F4`). 

The confirmation behavior adapts based on the active state of the web UI:
- **Normal State**: Display **Option A** dialog confirming general exit.
- **Active Add/Edit Modal State**: Display **Option B** dialog warning about potential unsaved changes.

---

## Behavior Details

### 1. Active State Detection
When the close event is triggered on `mainWindow`, the Electron main process temporarily prevents window destruction (`e.preventDefault()`) and evaluates JavaScript in the active web renderer context using `executeJavaScript`.

It queries the DOM for active modal elements:
```javascript
const isEditingOrAdding = await mainWindow.webContents.executeJavaScript(`
  (() => {
    const modals = Array.from(document.querySelectorAll('.modal, [id*="modal"], [class*="modal"], .popup-container, .dialog, dialog[open]'));
    return modals.some(el => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0;
    });
  })()
`).catch(() => false);
```

### 2. Dialog Configuration

#### Option A: Normal State (No Add/Edit popup open)
- **Type**: `question`
- **Title**: `Xác nhận thoát`
- **Message**: `Bạn có chắc chắn muốn thoát ứng dụng Quản lý Kho Phôi Cuộn - DDC không?`
- **Buttons**: `['Hủy', 'Đồng ý']`
- **Default / Cancel ID**: `0` (`Hủy`)
- **Confirm ID**: `1` (`Đồng ý`)

#### Option B: Active Add/Edit Modal State (Unsaved data warning)
- **Type**: `warning`
- **Title**: `Cảnh báo dữ liệu chưa lưu`
- **Message**: `Bạn đang mở cửa sổ Thêm/Sửa dữ liệu.`
- **Detail**: `Bạn có chắc chắn muốn đóng ứng dụng không? Các thay đổi chưa lưu có thể bị mất.`
- **Buttons**: `['Không', 'Có']`
- **Default / Cancel ID**: `0` (`Không`)
- **Confirm ID**: `1` (`Có`)

---

## Code Changes Target

- **[dist-app/main.js](file:///c:/Users/benhhc/Desktop/web-supabase/dist-app/main.js)**:
  - Add `dialog` import from `electron`.
  - Maintain a state variable `isQuitting = false`.
  - Attach `mainWindow.on('close', async (e) => { ... })` handler before window creation finishes.
  - Call `app.quit()` when confirmed.

---

## Verification Plan

### Manual Verification
1. Run application in dev Electron mode or build `.exe` using `node scripts/build-exe.js`.
2. Test closing main window when no modals are open: Verify **Option A** popup ("Xác nhận thoát") appears.
3. Open an "Add Data" or "Edit Data" modal on any page (e.g. XG, Tole), then press `X` or `Alt+F4`: Verify **Option B** warning popup ("Cảnh báo dữ liệu chưa lưu") appears.
4. Click Cancel ("Hủy" / "Không"): App stays open.
5. Click Confirm ("Đồng ý" / "Có"): App exits cleanly.
