# Exit Confirmation Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show an interactive exit confirmation dialog in the Electron .exe application, displaying Option A ("Xác nhận thoát") during normal state and Option B ("Cảnh báo dữ liệu chưa lưu") when an Add/Edit modal is currently open.

**Architecture:** Update `dist-app/main.js` window close handler to intercept `close` events, inspect the web page DOM using `executeJavaScript` to detect open modal dialogs, and display native Electron `dialog.showMessageBox` confirmation.

**Tech Stack:** Electron (`dialog`, `BrowserWindow`, `executeJavaScript`), Node.js.

## Global Constraints
- Target platform: Windows x64 Electron desktop app (`dist-app/main.js`).
- Preserve all existing keyboard shortcuts and zoom handlers in `dist-app/main.js`.
- Confirm exit button maps to index 1 (`Đồng ý` / `Có`), cancel exit button maps to index 0 (`Hủy` / `Không`).

---

### Task 1: Update Electron Main Process to Handle Exit Confirmation

**Files:**
- Modify: [dist-app/main.js](file:///c:/Users/benhhc/Desktop/web-supabase/dist-app/main.js)

**Interfaces:**
- Consumes: `dialog` module from Electron, `mainWindow.webContents.executeJavaScript`.
- Produces: Window close event handler with dynamic modal detection.

- [ ] **Step 1: Inspect `dist-app/main.js` and add `dialog` import and `isQuitting` variable**

```javascript
const { app, BrowserWindow, Menu, dialog } = require('electron');
let isQuitting = false;
```

- [ ] **Step 2: Add window `close` event listener inside `createWindow` function**

```javascript
mainWindow.on('close', async (e) => {
  if (isQuitting) return;
  e.preventDefault();

  let isEditingOrAdding = false;
  try {
    isEditingOrAdding = await mainWindow.webContents.executeJavaScript(`
      (() => {
        const modals = Array.from(document.querySelectorAll('.modal, [id*="modal"], [class*="modal"], .popup-container, .dialog, dialog[open]'));
        return modals.some(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0;
        });
      })()
    `);
  } catch (err) {
    isEditingOrAdding = false;
  }

  let dialogOptions;
  if (isEditingOrAdding) {
    dialogOptions = {
      type: 'warning',
      buttons: ['Không', 'Có'],
      defaultId: 0,
      cancelId: 0,
      title: 'Cảnh báo dữ liệu chưa lưu',
      message: 'Bạn đang mở cửa sổ Thêm/Sửa dữ liệu.',
      detail: 'Bạn có chắc chắn muốn đóng ứng dụng không? Các thay đổi chưa lưu có thể bị mất.'
    };
  } else {
    dialogOptions = {
      type: 'question',
      buttons: ['Hủy', 'Đồng ý'],
      defaultId: 0,
      cancelId: 0,
      title: 'Xác nhận thoát',
      message: 'Bạn có chắc chắn muốn thoát ứng dụng Quản lý Kho Phôi Cuộn - DDC không?'
    };
  }

  const { response } = await dialog.showMessageBox(mainWindow, dialogOptions);
  if (response === 1) {
    isQuitting = true;
    app.quit();
  }
});
```

- [ ] **Step 3: Verify node syntax and linting**

Run syntax check using `node -c dist-app/main.js` to ensure no syntax errors.

- [ ] **Step 4: Commit changes**

```bash
git add dist-app/main.js
git commit -m "feat: add exit confirmation dialog with active modal detection to Electron app"
```
