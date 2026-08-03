# Design Specification: Email OTP 2FA Verification for `bao.lt` Login

## Summary
Add 2-Factor Authentication (2FA) via Email OTP for account `bao.lt` on the login page ([pages/dang_nhap.html](file:///c:/Users/benhhc/Desktop/web-supabase/pages/dang_nhap.html)). When user `bao.lt` inputs valid credentials, a 6-digit OTP is generated and sent to `thaibao06061997@gmail.com` via EmailJS (with a built-in demo fallback notification), opening a modern OTP verification modal before allowing redirection to `home.html`.

## Target User & Account
- **Username**: `bao.lt`
- **Target Email**: `thaibao06061997@gmail.com`
- **Other accounts**: Continue direct login without 2FA unless configured.

## UI / UX Architecture
1. **Login Page Modals & CSS**:
   - Add OTP Modal element to [pages/dang_nhap.html](file:///c:/Users/benhhc/Desktop/web-supabase/pages/dang_nhap.html).
   - Style modern 6-digit OTP input boxes, timer countdown (60s), resend button, and error state in [assets/css/dang_nhap.css](file:///c:/Users/benhhc/Desktop/web-supabase/assets/css/dang_nhap.css).
2. **Login Script Logic ([assets/js/dang_nhap.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/dang_nhap.js))**:
   - Update `validAccounts` to tag `bao.lt` with `email: 'thaibao06061997@gmail.com'`, `requireOtp: true`.
   - On valid password submit for `bao.lt`, generate 6-digit OTP code and set expiry (3 minutes).
   - Send Email via EmailJS API if configured, and display a Toast notification in demo mode showing the generated OTP code for easy testing.
   - Open OTP Modal.
   - Auto-advance focus between 6 input boxes.
   - On valid OTP submission, set `localStorage.setItem('currentUser', 'bao.lt')` and redirect to `home.html`.

## Security & Edge Cases
- **Expiration**: OTP expires in 3 minutes.
- **Resend Cooldown**: 60 seconds countdown timer before enabling resend button.
- **Invalid OTP**: Displays error message and highlights inputs in red without closing modal.
