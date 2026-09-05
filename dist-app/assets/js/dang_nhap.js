/* =============================================================================
   INITIALIZATION
   Khởi tạo ứng dụng khi trang được tải
================================================================================ */

function redirectToHome() {
   try {
      if (window.top && window.top !== window) {
         window.top.location.href = '/';
      } else {
         window.location.replace('/');
      }
   } catch (e) {
      window.location.href = '/';
   }
}

document.addEventListener('DOMContentLoaded', function () {
   // Kiểm tra xem đã đăng nhập rồi chưa
   const currentUser = localStorage.getItem('currentUser');
   if (currentUser) {
      redirectToHome();
      return;
   }

   // Khởi tạo form đăng nhập
   initLoginForm();
});


/* =============================================================================
   LOGIN FORM
   Xử lý form đăng nhập
================================================================================ */

// Biến lưu trạng thái OTP tạm thời
let currentPendingUser = null;
let currentGeneratedOtp = null;
let otpTimerInterval = null;
let otpTimeRemaining = 60;

function initLoginForm() {
   const form = document.getElementById('loginForm');
   const errorMessage = document.getElementById('errorMessage');

   form.addEventListener('submit', async function (e) {
      e.preventDefault(); // Ngăn submit mặc định

      const username = form.username.value.trim();
      const password = form.password.value;

      if (!username || !password) {
         errorMessage.textContent = 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!';
         errorMessage.style.display = 'block';
         return;
      }

      let account = null;

      let emailToLogin = username;
      if (!emailToLogin.includes('@')) {
         if (username.toLowerCase() === 'bao.lt') {
            emailToLogin = 'thaibao06061997@gmail.com';
         } else {
            emailToLogin = `${username}@ddc.com`;
         }
      }

      // Xác thực an toàn qua Supabase Auth chính thức (JWT Session)
      if (!window.supabase) {
         errorMessage.textContent = 'Không thể kết nối đến máy chủ Supabase. Vui lòng kiểm tra kết nối mạng!';
         errorMessage.style.display = 'block';
         return;
      }

      try {
         // 1. Thử đăng nhập chuẩn Supabase Auth
         const { data: authData, error: authError } = await window.supabase.auth.signInWithPassword({
            email: emailToLogin,
            password: password
         });

         if (!authError && authData?.user) {
            // Lấy hồ sơ phân quyền từ public.user_profiles
            const { data: profile } = await window.supabase
               .from('user_profiles')
               .select('*')
               .eq('id', authData.user.id)
               .maybeSingle();

            account = {
               username: profile?.username || username,
               email: authData.user.email,
               requireOtp: false,
               allowedPages: profile?.allowed_pages || ['*'],
               permissions: {
                  canAdd: !!profile?.can_add || !!profile?.is_admin,
                  canEdit: !!profile?.can_edit || !!profile?.is_admin,
                  canDelete: !!profile?.can_delete || !!profile?.is_admin,
                  canView: !!profile?.can_view
               },
               profile: profile
            };

            sessionStorage.setItem('supabase_user_profile', JSON.stringify(profile || account));
         } else {
            // 2. Fallback sang RPC check_login nếu tài khoản chưa được chuyển sang auth.users
            const { data, error } = await window.supabase.rpc('check_login', {
               p_username: username,
               p_password: password
            });

            if (error) {
               console.warn('RPC check_login warning:', error);
               errorMessage.textContent = 'Tên đăng nhập hoặc mật khẩu không chính xác!';
               errorMessage.style.display = 'block';
               return;
            }

            if (data && data.length > 0) {
               const u = data[0];
               account = {
                  username: u.username,
                  email: u.email,
                  requireOtp: u.require_otp,
                  allowedPages: u.allowed_pages || [],
                  permissions: {
                     canAdd: u.can_add,
                     canEdit: u.can_edit,
                     canDelete: u.can_delete,
                     canView: u.can_view
                  }
               };
            }
         }
      } catch (err) {
         console.error('Supabase connection exception:', err);
         errorMessage.textContent = 'Không thể kết nối đến máy chủ Supabase. Vui lòng kiểm tra lại!';
         errorMessage.style.display = 'block';
         return;
      }

      if (account) {
         errorMessage.style.display = 'none';

         if (account.requireOtp) {
            // Yêu cầu xác thực OTP (bao.lt)
            currentPendingUser = account;
            triggerOtpVerification(account);
         } else {
            // Đăng nhập trực tiếp
            completeLogin(account.username, account);
         }
      } else {
         // Sai thông tin đăng nhập
         errorMessage.textContent = 'Tên đăng nhập hoặc mật khẩu không chính xác!';
         errorMessage.style.display = 'block';
      }
   });

   // Khởi tạo các sự kiện cho Modal OTP
   initOtpModalEvents();
}

/**
 * Phát sinh mã OTP và mở Modal xác thực + Gửi qua EmailJS
 */
function triggerOtpVerification(account) {
   // Sinh mã 6 chữ số
   currentGeneratedOtp = Math.floor(100000 + Math.random() * 900000).toString();

   // Cập nhật thông tin email lên Modal
   const emailElem = document.getElementById('otpTargetEmail');
   if (emailElem) emailElem.textContent = account.email || 'Email đã đăng ký';

   // Gửi Email thật qua EmailJS
   sendOtpViaEmailJS(account.email, currentGeneratedOtp);

   // Mở Modal
   openOtpModal();
}

/**
 * Gửi email thật bằng EmailJS SDK
 */
function sendOtpViaEmailJS(targetEmail, otpCode) {
   const EMAILJS_PUBLIC_KEY = 'FRxyw7SHbtYj-eoN0';
   const EMAILJS_SERVICE_ID = 'service_a8ixh1d';
   const EMAILJS_TEMPLATE_ID = 'template_qt971tj';

   const templateParams = {
      to_email: targetEmail,
      email: targetEmail,
      to_name: 'bao.lt',
      otp_code: otpCode,
      passcode: otpCode,
      message: `Mã OTP xác thực đăng nhập của bạn là: ${otpCode}`
   };

   if (typeof emailjs !== 'undefined') {
      emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, EMAILJS_PUBLIC_KEY)
         .then((response) => {
            console.log('✅ EmailJS OTP sent successfully!', response.status, response.text);
         })
         .catch((error) => {
            console.error('❌ EmailJS Error:', error);
            // Hiển thị Toast dự phòng nếu EmailJS trả về lỗi
            showDemoOtpToast(otpCode);
         });
   } else {
      showDemoOtpToast(otpCode);
   }
}

/**
 * Hiển thị Toast Demo chứa mã OTP
 */
function showDemoOtpToast(otpCode) {
   const toast = document.getElementById('demoOtpToast');
   const codeElem = document.getElementById('demoOtpCode');
   if (toast && codeElem) {
      codeElem.textContent = otpCode;
      toast.classList.add('show');
      setTimeout(() => {
         toast.classList.remove('show');
      }, 8000);
   }
}

/**
 * Điều khiển mở/đóng Modal OTP
 */
function openOtpModal() {
   const modal = document.getElementById('otpModal');
   const fields = document.querySelectorAll('.otp__field');
   const errorElem = document.getElementById('otpError');

   if (errorElem) errorElem.textContent = '';

   // Clear các ô nhập
   fields.forEach(field => {
      field.value = '';
      field.classList.remove('is-invalid');
   });

   if (modal) modal.classList.add('active');

   // Focus ô đầu tiên
   if (fields.length > 0) {
      setTimeout(() => fields[0].focus(), 150);
   }

   // Bắt đầu đếm ngược timer
   startOtpCountdown();
}

function closeOtpModal() {
   const modal = document.getElementById('otpModal');
   if (modal) modal.classList.remove('active');
   if (otpTimerInterval) clearInterval(otpTimerInterval);
   currentPendingUser = null;
   currentGeneratedOtp = null;
}

/**
 * Đếm ngược 60s nút gửi lại OTP
 */
function startOtpCountdown() {
   if (otpTimerInterval) clearInterval(otpTimerInterval);

   otpTimeRemaining = 60;
   const timerElem = document.getElementById('otpTimer');
   const resendBtn = document.getElementById('resendOtpBtn');

   if (resendBtn) resendBtn.disabled = true;
   if (timerElem) timerElem.textContent = otpTimeRemaining;

   otpTimerInterval = setInterval(() => {
      otpTimeRemaining--;
      if (timerElem) timerElem.textContent = otpTimeRemaining;

      if (otpTimeRemaining <= 0) {
         clearInterval(otpTimerInterval);
         if (resendBtn) resendBtn.disabled = false;
      }
   }, 1000);
}

/**
 * Gắn sự kiện ô nhập OTP (chuyển ô tự động, paste code, xóa backspace)
 */
function initOtpModalEvents() {
   const fields = document.querySelectorAll('.otp__field');
   const cancelBtn = document.getElementById('cancelOtpBtn');
   const verifyBtn = document.getElementById('verifyOtpBtn');
   const resendBtn = document.getElementById('resendOtpBtn');

   fields.forEach((field, index) => {
      // Khi gõ chữ/số
      field.addEventListener('input', (e) => {
         const val = e.target.value;

         if (val.length >= 1) {
            // Giữ lại 1 ký tự số
            field.value = val.replace(/[^0-9]/g, '').slice(-1);
            if (field.value && index < fields.length - 1) {
               fields[index + 1].focus();
            }
         }

         // Nếu nhập đủ 6 ô thì tự kiểm tra
         checkAutoSubmitOtp();
      });

      // Bắt phím Backspace
      field.addEventListener('keydown', (e) => {
         if (e.key === 'Backspace' && !field.value && index > 0) {
            fields[index - 1].focus();
         }
      });

      // Bắt sự kiện Paste 6 số
      field.addEventListener('paste', (e) => {
         e.preventDefault();
         const pastedData = (e.clipboardData || window.clipboardData).getData('text').trim();
         const numbers = pastedData.replace(/[^0-9]/g, '').slice(0, 6);

         if (numbers) {
            numbers.split('').forEach((num, i) => {
               if (fields[i]) fields[i].value = num;
            });
            const nextIndex = Math.min(numbers.length, fields.length - 1);
            fields[nextIndex].focus();
            checkAutoSubmitOtp();
         }
      });
   });

   if (cancelBtn) cancelBtn.addEventListener('click', closeOtpModal);
   if (verifyBtn) verifyBtn.addEventListener('click', handleVerifyOtpSubmit);

   if (resendBtn) {
      resendBtn.addEventListener('click', () => {
         if (currentPendingUser) {
            triggerOtpVerification(currentPendingUser);
         }
      });
   }
}

/**
 * Tự động gửi khi gõ đủ 6 ký tự
 */
function checkAutoSubmitOtp() {
   const fields = document.querySelectorAll('.otp__field');
   let enteredOtp = '';
   fields.forEach(f => enteredOtp += f.value);

   if (enteredOtp.length === 6) {
      handleVerifyOtpSubmit();
   }
}

/**
 * Xử lý kiểm tra mã OTP
 */
function handleVerifyOtpSubmit() {
   const fields = document.querySelectorAll('.otp__field');
   const errorElem = document.getElementById('otpError');
   let enteredOtp = '';
   fields.forEach(f => enteredOtp += f.value);

   if (enteredOtp.length < 6) {
      if (errorElem) errorElem.textContent = 'Vui lòng nhập đủ 6 chữ số OTP!';
      return;
   }

   if (enteredOtp === currentGeneratedOtp) {
      // Đã xác thực OTP thành công!
      if (errorElem) errorElem.textContent = '';
      const username = currentPendingUser ? currentPendingUser.username : 'bao.lt';
      const pendingAccount = currentPendingUser;
      closeOtpModal();
      completeLogin(username, pendingAccount);
   } else {
      // Nhập sai OTP
      if (errorElem) errorElem.textContent = 'Mã OTP không chính xác, vui lòng thử lại!';
      fields.forEach(f => f.classList.add('is-invalid'));
      setTimeout(() => {
         fields.forEach(f => f.classList.remove('is-invalid'));
      }, 1000);
   }
}

function getPermChecksum(rawAllowed, sysPerms) {
   let pages = [];
   let groups = {};

   if (typeof rawAllowed === 'string') {
      try {
         rawAllowed = JSON.parse(rawAllowed);
      } catch (e) {}
   }

   if (Array.isArray(rawAllowed)) {
      pages = rawAllowed.slice().sort();
   } else if (rawAllowed && typeof rawAllowed === 'object') {
      pages = Array.isArray(rawAllowed.pages) ? rawAllowed.pages.slice().sort() : [];
      groups = rawAllowed.groups || {};
   }

   const sortedGroupsStr = Object.keys(groups).sort().map(k => {
      const g = groups[k] || {};
      return `${k}:${!!(g.canView || g.can_view)},${!!(g.canAdd || g.can_add)},${!!(g.canEdit || g.can_edit)},${!!(g.canDelete || g.can_delete)}`;
   }).join('|');

   const pagesStr = pages.join(',');
   const sysPermsStr = sysPerms ? `${!!(sysPerms.canView || sysPerms.can_view)},${!!(sysPerms.canAdd || sysPerms.can_add)},${!!(sysPerms.canEdit || sysPerms.can_edit)},${!!(sysPerms.canDelete || sysPerms.can_delete)}` : '';

   return `P:[${pagesStr}]|G:[${sortedGroupsStr}]|S:[${sysPermsStr}]`;
}

/**
 * Hoàn tất đăng nhập và chuyển hướng trang
 */
function completeLogin(username, accountObj = null) {
   localStorage.setItem('currentUser', username);

   if (accountObj) {
      if (accountObj.permissions) {
         localStorage.setItem('userPermissions', JSON.stringify(accountObj.permissions));
      }
      let rawAllowed = accountObj.allowedPages;
      if (typeof rawAllowed === 'string') {
         try {
            rawAllowed = JSON.parse(rawAllowed);
         } catch (e) {}
      }
      if (rawAllowed) {
         if (Array.isArray(rawAllowed)) {
            localStorage.setItem('userAllowedPages', JSON.stringify(rawAllowed));
            localStorage.removeItem('userGroupPermissions');
         } else if (typeof rawAllowed === 'object') {
            localStorage.setItem('userAllowedPages', JSON.stringify(rawAllowed.pages || []));
            if (rawAllowed.groups) {
               localStorage.setItem('userGroupPermissions', JSON.stringify(rawAllowed.groups));
            }
         }
      } else {
         localStorage.setItem('userAllowedPages', '[]');
         localStorage.removeItem('userGroupPermissions');
      }

      // Lưu permChecksum khởi tạo ban đầu để so sánh khi Admin thay đổi quyền
      const checksum = getPermChecksum(accountObj.allowedPages, accountObj.permissions);
      localStorage.setItem('userPermChecksum', checksum);
   }

   redirectToHome();
}

