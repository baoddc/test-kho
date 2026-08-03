# Email OTP Login Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 2FA Email OTP login verification for account `bao.lt` on the login page with modern UI overlay and fallback notification support.

**Architecture:** Extend existing frontend login workflow in [dang_nhap.html](file:///c:/Users/benhhc/Desktop/web-supabase/pages/dang_nhap.html) & [dang_nhap.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/dang_nhap.js) to intercept login for accounts marked `requireOtp: true`, trigger Email sending & display an interactive OTP verification modal with a 60s countdown timer.

**Tech Stack:** Vanilla JavaScript, HTML5, CSS3 (Glassmorphism & Remix Icons), EmailJS / Demo Notification.

## Global Constraints
- Target Account: `bao.lt` (Email: `thaibao06061997@gmail.com`)
- Target Files: `pages/dang_nhap.html`, `assets/css/dang_nhap.css`, `assets/js/dang_nhap.js`
- Non-breaking for other accounts (`admin`, `user1`, `user2`).

---

### Task 1: Add OTP Modal HTML & CSS Styling

**Files:**
- Modify: `pages/dang_nhap.html:55-65`
- Modify: `assets/css/dang_nhap.css`

**Interfaces:**
- Produces: HTML element `#otpModal` with 6 input fields `.otp__field`, `#otpTimer`, `#resendOtpBtn`, `#otpError`.

- [ ] **Step 1: Add OTP Modal structure to `pages/dang_nhap.html`**

```html
<!-- OTP Verification Modal -->
<div id="otpModal" class="otp__modal">
   <div class="otp__card">
      <h2 class="otp__title">Xác thực OTP</h2>
      <p class="otp__subtitle">Mã xác nhận 6 chữ số đã được gửi tới email <br><strong id="otpTargetEmail"></strong></p>
      
      <div class="otp__inputs" id="otpInputGroup">
         <input type="text" maxlength="1" class="otp__field" data-index="0" inputmode="numeric" autocomplete="off" autofocus>
         <input type="text" maxlength="1" class="otp__field" data-index="1" inputmode="numeric" autocomplete="off">
         <input type="text" maxlength="1" class="otp__field" data-index="2" inputmode="numeric" autocomplete="off">
         <input type="text" maxlength="1" class="otp__field" data-index="3" inputmode="numeric" autocomplete="off">
         <input type="text" maxlength="1" class="otp__field" data-index="4" inputmode="numeric" autocomplete="off">
         <input type="text" maxlength="1" class="otp__field" data-index="5" inputmode="numeric" autocomplete="off">
      </div>

      <div class="otp__error" id="otpError"></div>

      <div class="otp__timer-box">
         <span>Gửi lại mã sau: <strong id="otpTimer">60</strong>s</span>
         <button type="button" id="resendOtpBtn" class="otp__resend-btn" disabled>Gửi lại mã</button>
      </div>

      <div class="otp__actions">
         <button type="button" id="cancelOtpBtn" class="otp__btn otp__btn--cancel">Hủy</button>
         <button type="button" id="verifyOtpBtn" class="otp__btn otp__btn--submit">Xác nhận</button>
      </div>
   </div>
</div>
```

- [ ] **Step 2: Add CSS rules for OTP modal in `assets/css/dang_nhap.css`**

Add overlay styling, glassmorphism modal, centered input digits, countdown timer, and alert toasts.

---

### Task 2: Implement OTP Generation & Modal Logic in JS

**Files:**
- Modify: `assets/js/dang_nhap.js`

**Interfaces:**
- Consumes: `#otpModal`, `#otpForm`, `#loginForm`.
- Produces: `initOtpVerification()`, `sendEmailOTP()`, `verifyOTP()`.

- [ ] **Step 1: Update `validAccounts` array with Email & OTP flag**

```javascript
const validAccounts = [
   { username: 'bao.lt', password: '6697@', email: 'thaibao06061997@gmail.com', requireOtp: true },
   { username: 'admin', password: 'admin123' },
   { username: 'user1', password: 'pass123' },
   { username: 'user2', password: 'pass456' }
];
```

- [ ] **Step 2: Intercept login submit and show OTP modal when `requireOtp` is true**
- [ ] **Step 3: Implement 6-digit auto-advance input navigation and paste support**
- [ ] **Step 4: Implement 60-second resend countdown timer & validation logic**
