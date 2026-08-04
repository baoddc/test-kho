# Pure Supabase Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all hardcoded credentials from JS files and authenticate users exclusively via Supabase RPC (`check_login`), while strictly ensuring no passwords are saved in `localStorage`.

**Architecture:** Refactor `initLoginForm` and authentication logic in `dang_nhap.js` to eliminate the `validAccounts` array and fallback logic. Call Supabase RPC `check_login`, handle success/failure/connection errors, and ensure `localStorage` only stores `currentUser` and `userPermissions`.

**Tech Stack:** JavaScript (ES6+), Supabase Client JS SDK, LocalStorage.

## Global Constraints
- Remove `const validAccounts = [...]` from all JS files.
- Authenticate 100% via Supabase RPC `check_login`.
- `localStorage` must NEVER store user passwords or hashed credentials.
- Preserve existing OTP workflow for accounts requiring OTP (`require_otp = true`).

---

### Task 1: Refactor `assets/js/dang_nhap.js` for Pure Supabase Authentication

**Files:**
- Modify: [assets/js/dang_nhap.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/dang_nhap.js#L24-L106)

**Interfaces:**
- Consumes: `window.supabase.rpc('check_login', { p_username, p_password })`
- Produces: Authenticated user session (`localStorage.setItem('currentUser', username)`)

- [ ] **Step 1: Inspect `assets/js/dang_nhap.js` lines 24-106**

Inspect current `validAccounts` array and form submit listener in `assets/js/dang_nhap.js`.

- [ ] **Step 2: Remove `validAccounts` and update form submit listener**

Remove `const validAccounts` array. Refactor the `form.addEventListener('submit', ...)` handler in `initLoginForm` to:
1. Extract `username` and `password`.
2. Check if `window.supabase` is available and has `rpc`. If not, display `"Không thể kết nối đến máy chủ Supabase. Vui lòng kiểm tra kết nối."`
3. Call `window.supabase.rpc('check_login', { p_username: username, p_password: password })`.
4. If `data` is returned with length > 0, construct `account` object without password field:
   ```javascript
   const u = data[0];
   account = {
      username: u.username,
      email: u.email,
      requireOtp: u.require_otp,
      permissions: {
         canAdd: u.can_add,
         canEdit: u.can_edit,
         canDelete: u.can_delete,
         canView: u.can_view
      }
   };
   ```
5. If `account` is valid:
   - If `account.requireOtp`, set `currentPendingUser = account` and call `triggerOtpVerification(account)`.
   - Else, call `completeLogin(account.username, account)`.
6. If `data` is empty or error:
   - Display `errorMessage.textContent = 'Tên đăng nhập hoặc mật khẩu không chính xác!';`
   - Display `errorMessage.style.display = 'block';`

- [ ] **Step 3: Verify `completeLogin` does not store password in `localStorage`**

Confirm `completeLogin(username, accountObj)` only stores `currentUser` and `userPermissions`:
```javascript
function completeLogin(username, accountObj = null) {
   localStorage.setItem('currentUser', username);

   if (accountObj && accountObj.permissions) {
      localStorage.setItem('userPermissions', JSON.stringify(accountObj.permissions));
   }

   window.location.href = 'home.html';
}
```

- [ ] **Step 4: Verify syntax and behavior**

Run syntax check or inspect file to ensure no missing braces or syntax errors.

- [ ] **Step 5: Commit changes**

```bash
git add assets/js/dang_nhap.js
git commit -m "refactor: remove hardcoded accounts and enforce pure Supabase RPC auth"
```

---

### Task 2: Sync Pure Supabase Auth to `dist-app/assets/js/dang_nhap.js`

**Files:**
- Modify: [dist-app/assets/js/dang_nhap.js](file:///c:/Users/benhhc/Desktop/web-supabase/dist-app/assets/js/dang_nhap.js)

**Interfaces:**
- Consumes: `assets/js/dang_nhap.js`
- Produces: Updated `dist-app/assets/js/dang_nhap.js`

- [ ] **Step 1: Sync `dist-app/assets/js/dang_nhap.js`**

Copy/Sync the updated `assets/js/dang_nhap.js` to `dist-app/assets/js/dang_nhap.js` to ensure production/dist application uses pure Supabase auth.

- [ ] **Step 2: Code grep check**

Search workspace for any lingering occurrences of `validAccounts` or plain-text passwords in JS files:
```bash
grep -rn "validAccounts" assets/ dist-app/
```
Expected: No matches found.

- [ ] **Step 3: Commit changes**

```bash
git add dist-app/assets/js/dang_nhap.js
git commit -m "fix(dist): sync pure Supabase auth to dist-app"
```
