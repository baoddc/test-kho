# Implementation Plan: Trang Quản lý Người dùng (User Management)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tạo trang `pages/quan-ly-user.html` cho phép người dùng `bao.lt` khởi tạo, chỉnh sửa, phân quyền (Thêm, Sửa, Xóa, Xem) và xóa các tài khoản khác trên Supabase.

**Architecture:** Frontend HTML/JS giao tiếp bảo mật với Supabase Database thông qua các hàm SQL RPC (`SECURITY DEFINER`) chống F12 xem mật khẩu. Sidebar sẽ tự động hiển thị liên kết "Quản lý người dùng" khi đăng nhập bằng tài khoản `bao.lt`.

**Tech Stack:** HTML5, CSS3 (Custom CSS vars + Bootstrap 5), JavaScript (ES6+), Supabase JS Client, Supabase PostgreSQL RPC.

## Global Constraints
- Tất cả đường dẫn tệp tin phải sử dụng đường dẫn tuyệt đối hoặc chính xác relative path.
- Không được trả về mật khẩu thô của người dùng trong hàm SELECT/RPC đọc dữ liệu.
- Tài khoản `bao.lt` không thể bị xóa từ trang quản lý.
- Tài khoản khác ngoài `bao.lt` cố tình truy cập `pages/quan-ly-user.html` sẽ bị chuyển hướng về `home.html`.

---

### Task 1: Tạo Script SQL RPC cho Supabase (`scripts/setup_users_management_rpc.sql`)

**Files:**
- Create: `scripts/setup_users_management_rpc.sql`

**Interfaces:**
- Produces: 
  - `admin_get_users()` -> returns `TABLE(id bigint, username text, email text, require_otp boolean, can_add boolean, can_edit boolean, can_delete boolean, can_view boolean, created_at timestamptz)`
  - `admin_save_user(p_id bigint, p_username text, p_password text, p_email text, p_require_otp boolean, p_can_add boolean, p_can_edit boolean, p_can_delete boolean, p_can_view boolean)` -> returns `TABLE(success boolean, message text)`
  - `admin_delete_user(p_user_id bigint)` -> returns `TABLE(success boolean, message text)`

- [ ] **Step 1: Tạo tệp SQL `scripts/setup_users_management_rpc.sql`**

```sql
-- =============================================================================
-- SUPABASE USER MANAGEMENT RPC FUNCTIONS
-- Hướng dẫn: Chạy script này trong SQL Editor của Supabase Dashboard
-- =============================================================================

-- 1. Hàm lấy danh sách tất cả người dùng (KHÔNG lấy password)
CREATE OR REPLACE FUNCTION public.admin_get_users()
RETURNS TABLE (
    id BIGINT,
    username TEXT,
    email TEXT,
    require_otp BOOLEAN,
    can_add BOOLEAN,
    can_edit BOOLEAN,
    can_delete BOOLEAN,
    can_view BOOLEAN,
    created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.username,
        u.email,
        u.require_otp,
        u.can_add,
        u.can_edit,
        u.can_delete,
        u.can_view,
        u.created_at
    FROM public.users u
    ORDER BY u.id ASC;
END;
$$;

-- 2. Hàm Thêm mới hoặc Cập nhật thông tin & phân quyền người dùng
CREATE OR REPLACE FUNCTION public.admin_save_user(
    p_id BIGINT DEFAULT NULL,
    p_username TEXT DEFAULT NULL,
    p_password TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_require_otp BOOLEAN DEFAULT FALSE,
    p_can_add BOOLEAN DEFAULT FALSE,
    p_can_edit BOOLEAN DEFAULT FALSE,
    p_can_delete BOOLEAN DEFAULT FALSE,
    p_can_view BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Thêm mới người dùng
    IF p_id IS NULL OR p_id = 0 THEN
        IF p_username IS NULL OR p_username = '' THEN
            RETURN QUERY SELECT FALSE, 'Tên đăng nhập không được để trống!';
            RETURN;
        END IF;

        IF p_password IS NULL OR p_password = '' THEN
            RETURN QUERY SELECT FALSE, 'Mật khẩu không được để trống khi tạo mới!';
            RETURN;
        END IF;

        IF EXISTS (SELECT 1 FROM public.users WHERE username = p_username) THEN
            RETURN QUERY SELECT FALSE, 'Tên đăng nhập đã tồn tại!';
            RETURN;
        END IF;

        INSERT INTO public.users (
            username, password, email, require_otp, can_add, can_edit, can_delete, can_view
        ) VALUES (
            p_username, p_password, p_email, p_require_otp, p_can_add, p_can_edit, p_can_delete, p_can_view
        );

        RETURN QUERY SELECT TRUE, 'Tạo người dùng mới thành công!';
        RETURN;
    ELSE
        -- Cập nhật người dùng đã có
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_id) THEN
            RETURN QUERY SELECT FALSE, 'Không tìm thấy người dùng cần cập nhật!';
            RETURN;
        END IF;

        -- Nếu truyền p_password thì đổi pass, ngược lại giữ nguyên
        IF p_password IS NOT NULL AND p_password <> '' THEN
            UPDATE public.users SET
                password = p_password,
                email = p_email,
                require_otp = p_require_otp,
                can_add = p_can_add,
                can_edit = p_can_edit,
                can_delete = p_can_delete,
                can_view = p_can_view
            WHERE id = p_id;
        ELSE
            UPDATE public.users SET
                email = p_email,
                require_otp = p_require_otp,
                can_add = p_can_add,
                can_edit = p_can_edit,
                can_delete = p_can_delete,
                can_view = p_can_view
            WHERE id = p_id;
        END IF;

        RETURN QUERY SELECT TRUE, 'Cập nhật thông tin người dùng thành công!';
        RETURN;
    END IF;
END;
$$;

-- 3. Hàm Xóa người dùng an toàn (Ngăn xóa tài khoản bao.lt)
CREATE OR REPLACE FUNCTION public.admin_delete_user(
    p_user_id BIGINT
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_username TEXT;
BEGIN
    SELECT username INTO v_username FROM public.users WHERE id = p_user_id;

    IF v_username IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Không tìm thấy người dùng cần xóa!';
        RETURN;
    END IF;

    IF v_username = 'bao.lt' THEN
        RETURN QUERY SELECT FALSE, 'Không thể xóa tài khoản Quản trị viên hệ thống (bao.lt)!';
        RETURN;
    END IF;

    DELETE FROM public.users WHERE id = p_user_id;

    RETURN QUERY SELECT TRUE, 'Đã xóa người dùng thành công!';
    RETURN;
END;
$$;
```

- [ ] **Step 2: Commit file SQL mới**

```bash
git add scripts/setup_users_management_rpc.sql
git commit -m "feat: add SQL RPC script for user management"
```

---

### Task 2: Tạo Trang HTML Quản lý Người dùng (`pages/quan-ly-user.html`)

**Files:**
- Create: `pages/quan-ly-user.html`

**Interfaces:**
- Consumes: CSS theme files, Supabase JS library, Bootstrap 5 JS/CSS, `assets/js/sidebar.js`.

- [ ] **Step 1: Tạo `pages/quan-ly-user.html` với cấu trúc HTML chuẩn**

```html
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quản lý Người dùng - DDC App</title>
    <!-- Favicon & Base CSS -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.net/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="/assets/css/mobile-responsive.css">
    <style>
        :root {
            --bg-dark: #0f172a;
            --card-dark: #1e293b;
            --border-dark: #334155;
            --text-light: #f8fafc;
            --text-muted: #94a3b8;
            --primary: #3b82f6;
            --success: #10b981;
            --danger: #ef4444;
            --warning: #f59e0b;
        }
        body {
            background-color: var(--bg-dark);
            color: var(--text-light);
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            min-height: 100vh;
        }
        .main-content {
            padding: 1.5rem;
            max-width: 1200px;
            margin: 0 auto;
        }
        .card-custom {
            background-color: var(--card-dark);
            border: 1px solid var(--border-dark);
            border-radius: 12px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
        }
        .table-custom {
            color: var(--text-light);
        }
        .table-custom th {
            background-color: #0f172a;
            color: var(--text-muted);
            border-bottom: 1px solid var(--border-dark);
            font-weight: 600;
            text-transform: uppercase;
            font-size: 0.8rem;
            letter-spacing: 0.5px;
            padding: 1rem;
        }
        .table-custom td {
            border-bottom: 1px solid var(--border-dark);
            vertical-align: middle;
            padding: 0.85rem 1rem;
        }
        .badge-perm {
            font-size: 0.75rem;
            padding: 0.3em 0.6em;
            border-radius: 6px;
            margin-right: 3px;
        }
        .modal-content-custom {
            background-color: var(--card-dark);
            color: var(--text-light);
            border: 1px solid var(--border-dark);
            border-radius: 14px;
        }
        .form-control-custom {
            background-color: #0f172a;
            border: 1px solid var(--border-dark);
            color: var(--text-light);
            border-radius: 8px;
        }
        .form-control-custom:focus {
            background-color: #0f172a;
            color: var(--text-light);
            border-color: var(--primary);
            box-shadow: 0 0 0 0.25rem rgba(59, 130, 246, 0.25);
        }
    </style>
</head>
<body>
    <div id="sidebarContainer"></div>

    <div class="main-content">
        <!-- Header Page -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
            <div>
                <h3 class="fw-bold mb-1"><i class="fa-solid fa-users-gear text-primary me-2"></i>Quản lý Người dùng & Phân quyền</h3>
                <p class="text-muted mb-0">Tạo, xóa và thiết lập quyền truy cập cho người dùng trong hệ thống (Dành cho Quản trị viên bao.lt)</p>
            </div>
            <button id="btnOpenAddUser" class="btn btn-primary px-3 py-2 fw-semibold">
                <i class="fa-solid fa-user-plus me-2"></i>Thêm người dùng mới
            </button>
        </div>

        <!-- Filter & Search Bar -->
        <div class="card-custom p-3 mb-4">
            <div class="row g-3 align-items-center">
                <div class="col-md-6 col-12">
                    <div class="input-group">
                        <span class="input-group-text bg-dark border-secondary text-muted"><i class="fa-solid fa-magnifying-glass"></i></span>
                        <input type="text" id="searchInput" class="form-control form-control-custom" placeholder="Tìm kiếm theo Tên đăng nhập hoặc Email...">
                    </div>
                </div>
                <div class="col-md-6 col-12 text-md-end text-muted small">
                    Tổng số người dùng: <span id="totalUserCount" class="badge bg-primary fs-6">0</span>
                </div>
            </div>
        </div>

        <!-- User List Table -->
        <div class="card-custom overflow-hidden">
            <div class="table-responsive">
                <table class="table table-custom mb-0">
                    <thead>
                        <tr>
                            <th style="width: 50px;">STT</th>
                            <th>Tên đăng nhập</th>
                            <th>Email</th>
                            <th>Xác thực OTP</th>
                            <th>Quyền hạn</th>
                            <th>Ngày tạo</th>
                            <th class="text-end" style="width: 130px;">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody id="userTableBody">
                        <tr>
                            <td colspan="7" class="text-center py-4 text-muted">
                                <i class="fa-solid fa-spinner fa-spin me-2"></i>Đang tải danh sách người dùng...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Modal Thêm / Chỉnh sửa Người dùng -->
    <div class="modal fade" id="userModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content modal-content-custom">
                <div class="modal-header border-bottom border-secondary">
                    <h5 class="modal-title fw-bold" id="userModalTitle"><i class="fa-solid fa-user-plus text-primary me-2"></i>Thêm Người dùng mới</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <form id="userForm">
                        <input type="hidden" id="editUserId" value="">
                        
                        <div class="mb-3">
                            <label for="inputUsername" class="form-label font-weight-semibold">Tên đăng nhập <span class="text-danger">*</span></label>
                            <input type="text" class="form-control form-control-custom" id="inputUsername" placeholder="Nhập username (vd: user1)" required>
                        </div>

                        <div class="mb-3">
                            <label for="inputPassword" class="form-label font-weight-semibold" id="labelPassword">Mật khẩu <span class="text-danger">*</span></label>
                            <input type="password" class="form-control form-control-custom" id="inputPassword" placeholder="Nhập mật khẩu">
                            <div class="form-text text-muted" id="passwordHelp"></div>
                        </div>

                        <div class="mb-3">
                            <label for="inputEmail" class="form-label">Email liên hệ</label>
                            <input type="email" class="form-control form-control-custom" id="inputEmail" placeholder="vd: name@example.com">
                        </div>

                        <div class="mb-3 form-check form-switch">
                            <input class="form-check-input" type="checkbox" role="switch" id="checkRequireOtp">
                            <label class="form-check-label" for="checkRequireOtp">Yêu cầu OTP khi đăng nhập (EmailJS)</label>
                        </div>

                        <hr class="border-secondary my-3">
                        <h6 class="fw-bold mb-2 text-primary"><i class="fa-solid fa-shield-halved me-2"></i>Phân quyền truy cập</h6>

                        <div class="row g-2">
                            <div class="col-6">
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="checkCanView" checked>
                                    <label class="form-check-label" for="checkCanView">👁️ Xem dữ liệu</label>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="checkCanAdd">
                                    <label class="form-check-label" for="checkCanAdd">➕ Thêm dữ liệu</label>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="checkCanEdit">
                                    <label class="form-check-label" for="checkCanEdit">✏️ Sửa dữ liệu</label>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="checkCanDelete">
                                    <label class="form-check-label" for="checkCanDelete">🗑️ Xóa dữ liệu</label>
                                </div>
                            </div>
                        </div>

                        <div id="formErrorMessage" class="alert alert-danger mt-3 d-none" role="alert"></div>
                    </form>
                </div>
                <div class="modal-footer border-top border-secondary">
                    <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Hủy</button>
                    <button type="button" id="btnSaveUser" class="btn btn-primary"><i class="fa-solid fa-floppy-disk me-1"></i>Lưu thông tin</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal Xác nhận Xóa -->
    <div class="modal fade" id="deleteConfirmModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-sm">
            <div class="modal-content modal-content-custom text-center p-3">
                <div class="text-danger mb-2">
                    <i class="fa-solid fa-triangle-exclamation fa-3x"></i>
                </div>
                <h5 class="fw-bold">Xác nhận xóa?</h5>
                <p class="text-muted small mb-3">Bạn có chắc chắn muốn xóa người dùng <strong id="deleteTargetUsername" class="text-light"></strong>? Thao tác này không thể hoàn tác.</p>
                <div class="d-flex gap-2 justify-content-center">
                    <button type="button" class="btn btn-outline-secondary px-3" data-bs-dismiss="modal">Hủy</button>
                    <button type="button" id="btnConfirmDelete" class="btn btn-danger px-3">Xóa luôn</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Scripts -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="/assets/js/supabase-config.js"></script>
    <script src="/assets/js/sidebar.js"></script>
    <script src="/assets/js/quan-ly-user.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit file HTML mới**

```bash
git add pages/quan-ly-user.html
git commit -m "feat: add quan-ly-user.html page layout"
```

---

### Task 3: Tạo File JavaScript `assets/js/quan-ly-user.js`

**Files:**
- Create: `assets/js/quan-ly-user.js`

**Interfaces:**
- Consumes: `window.supabase.rpc('admin_get_users')`, `window.supabase.rpc('admin_save_user')`, `window.supabase.rpc('admin_delete_user')`.

- [ ] **Step 1: Tạo `assets/js/quan-ly-user.js`**

```javascript
/* =============================================================================
   USER MANAGEMENT JAVASCRIPT
   Xử lý: Auth guard, load user list, tạo/sửa/xóa user, phân quyền
================================================================================ */

document.addEventListener('DOMContentLoaded', function () {
    // 1. Auth Guard - Kiểm tra xem user hiện tại có phải bao.lt không
    const currentUser = localStorage.getItem('currentUser');
    if (!currentUser || currentUser !== 'bao.lt') {
        alert('Rất tiếc! Chỉ tài khoản Quản trị viên (bao.lt) mới có quyền truy cập trang này.');
        window.location.href = 'home.html';
        return;
    }

    // Initialize Page
    initUserManagement();
});

let allUsersList = [];
let deleteTargetId = null;
let userModalInstance = null;
let deleteModalInstance = null;

function initUserManagement() {
    userModalInstance = new bootstrap.Modal(document.getElementById('userModal'));
    deleteModalInstance = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));

    // Bind Events
    document.getElementById('btnOpenAddUser').addEventListener('click', openAddUserModal);
    document.getElementById('btnSaveUser').addEventListener('click', handleSaveUser);
    document.getElementById('btnConfirmDelete').addEventListener('click', handleConfirmDelete);

    // Live search
    document.getElementById('searchInput').addEventListener('input', function (e) {
        renderUserTable(e.target.value);
    });

    // Load initial users
    loadUserList();
}

/**
 * Tải danh sách người dùng từ Supabase RPC
 */
async function loadUserList() {
    const tableBody = document.getElementById('userTableBody');
    tableBody.innerHTML = `
        <tr>
            <td colspan="7" class="text-center py-4 text-muted">
                <i class="fa-solid fa-spinner fa-spin me-2"></i>Đang tải danh sách người dùng...
            </td>
        </tr>
    `;

    if (!window.supabase || typeof window.supabase.rpc !== 'function') {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4 text-danger">
                    Không thể kết nối với Supabase. Vui lòng kiểm tra lại cấu hình!
                </td>
            </tr>
        `;
        return;
    }

    try {
        const { data, error } = await window.supabase.rpc('admin_get_users');

        if (error) {
            console.error('Lỗi khi gọi RPC admin_get_users:', error);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4 text-danger">
                        Lỗi khi lấy dữ liệu: ${error.message}. Bạn đã chạy script SQL RPC trên Supabase chưa?
                    </td>
                </tr>
            `;
            return;
        }

        allUsersList = data || [];
        document.getElementById('totalUserCount').textContent = allUsersList.length;
        renderUserTable();

    } catch (err) {
        console.error('Supabase exception:', err);
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4 text-danger">
                    Lỗi hệ thống không xác định khi kết nối cơ sở dữ liệu.
                </td>
            </tr>
        `;
    }
}

/**
 * Hiển thị dữ liệu lên Bảng
 */
function renderUserTable(filterText = '') {
    const tableBody = document.getElementById('userTableBody');
    const query = filterText.toLowerCase().trim();

    const filtered = allUsersList.filter(u => {
        const usernameMatch = u.username && u.username.toLowerCase().includes(query);
        const emailMatch = u.email && u.email.toLowerCase().includes(query);
        return usernameMatch || emailMatch;
    });

    if (filtered.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4 text-muted">
                    Không tìm thấy người dùng nào phù hợp.
                </td>
            </tr>
        `;
        return;
    }

    let html = '';
    filtered.forEach((u, index) => {
        const createdDate = u.created_at ? new Date(u.created_at).toLocaleDateString('vi-VN') : '---';
        const otpBadge = u.require_otp 
            ? `<span class="badge bg-warning text-dark"><i class="fa-solid fa-key me-1"></i>Có OTP</span>` 
            : `<span class="badge bg-secondary text-muted">Không</span>`;

        // Render Badges quyền
        let permBadges = '';
        if (u.can_view) permBadges += `<span class="badge bg-info text-dark badge-perm">Xem</span>`;
        if (u.can_add) permBadges += `<span class="badge bg-success badge-perm">Thêm</span>`;
        if (u.can_edit) permBadges += `<span class="badge bg-primary badge-perm">Sửa</span>`;
        if (u.can_delete) permBadges += `<span class="badge bg-danger badge-perm">Xóa</span>`;
        if (!permBadges) permBadges = `<span class="badge bg-dark text-muted badge-perm">Không có quyền</span>`;

        const isBaoLt = u.username === 'bao.lt';

        html += `
            <tr>
                <td class="fw-semibold text-muted">${index + 1}</td>
                <td>
                    <strong class="text-light">${escapeHtml(u.username)}</strong>
                    ${isBaoLt ? '<span class="badge bg-danger ms-1">Admin</span>' : ''}
                </td>
                <td class="text-muted">${u.email ? escapeHtml(u.email) : '<em>Chưa có</em>'}</td>
                <td>${otpBadge}</td>
                <td>${permBadges}</td>
                <td class="small text-muted">${createdDate}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="openEditUserModal(${u.id})" title="Chỉnh sửa">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    ${!isBaoLt ? `
                        <button class="btn btn-sm btn-outline-danger" onclick="openDeleteConfirmModal(${u.id}, '${escapeHtml(u.username)}')" title="Xóa">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    ` : `
                        <button class="btn btn-sm btn-outline-secondary" disabled title="Không thể xóa admin">
                            <i class="fa-solid fa-lock"></i>
                        </button>
                    `}
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;
}

/**
 * Mở Modal Thêm người dùng mới
 */
function openAddUserModal() {
    document.getElementById('userForm').reset();
    document.getElementById('editUserId').value = '';
    document.getElementById('userModalTitle').innerHTML = `<i class="fa-solid fa-user-plus text-primary me-2"></i>Thêm Người dùng mới`;
    
    const usernameInput = document.getElementById('inputUsername');
    usernameInput.disabled = false;
    
    document.getElementById('labelPassword').innerHTML = `Mật khẩu <span class="text-danger">*</span>`;
    document.getElementById('passwordHelp').textContent = 'Bắt buộc nhập mật khẩu khi tạo tài khoản mới.';
    document.getElementById('inputPassword').required = true;
    
    document.getElementById('checkCanView').checked = true;
    document.getElementById('formErrorMessage').classList.add('d-none');

    userModalInstance.show();
}

/**
 * Mở Modal Chỉnh sửa người dùng
 */
function openEditUserModal(userId) {
    const user = allUsersList.find(u => u.id === userId);
    if (!user) return;

    document.getElementById('editUserId').value = user.id;
    document.getElementById('userModalTitle').innerHTML = `<i class="fa-solid fa-user-pen text-primary me-2"></i>Chỉnh sửa Người dùng: <span class="text-warning">${escapeHtml(user.username)}</span>`;
    
    const usernameInput = document.getElementById('inputUsername');
    usernameInput.value = user.username;
    usernameInput.disabled = true;

    document.getElementById('inputPassword').value = '';
    document.getElementById('labelPassword').innerHTML = `Mật khẩu mới`;
    document.getElementById('passwordHelp').textContent = 'Để trống nếu giữ nguyên mật khẩu hiện tại.';
    document.getElementById('inputPassword').required = false;

    document.getElementById('inputEmail').value = user.email || '';
    document.getElementById('checkRequireOtp').checked = !!user.require_otp;
    document.getElementById('checkCanView').checked = !!user.can_view;
    document.getElementById('checkCanAdd').checked = !!user.can_add;
    document.getElementById('checkCanEdit').checked = !!user.can_edit;
    document.getElementById('checkCanDelete').checked = !!user.can_delete;

    document.getElementById('formErrorMessage').classList.add('d-none');
    userModalInstance.show();
}

/**
 * Xử lý Lưu người dùng (Thêm / Sửa)
 */
async function handleSaveUser() {
    const errElem = document.getElementById('formErrorMessage');
    errElem.classList.add('d-none');

    const editId = document.getElementById('editUserId').value;
    const username = document.getElementById('inputUsername').value.trim();
    const password = document.getElementById('inputPassword').value;
    const email = document.getElementById('inputEmail').value.trim();
    const requireOtp = document.getElementById('checkRequireOtp').checked;
    const canView = document.getElementById('checkCanView').checked;
    const canAdd = document.getElementById('checkCanAdd').checked;
    const canEdit = document.getElementById('checkCanEdit').checked;
    const canDelete = document.getElementById('checkCanDelete').checked;

    if (!editId && (!username || !password)) {
        errElem.textContent = 'Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu!';
        errElem.classList.remove('d-none');
        return;
    }

    const payload = {
        p_id: editId ? parseInt(editId, 10) : null,
        p_username: username,
        p_password: password || null,
        p_email: email || null,
        p_require_otp: requireOtp,
        p_can_add: canAdd,
        p_can_edit: canEdit,
        p_can_delete: canDelete,
        p_can_view: canView
    };

    try {
        const { data, error } = await window.supabase.rpc('admin_save_user', payload);

        if (error) {
            console.error('Lỗi admin_save_user:', error);
            errElem.textContent = 'Lỗi từ máy chủ: ' + error.message;
            errElem.classList.remove('d-none');
            return;
        }

        if (data && data.length > 0) {
            const res = data[0];
            if (res.success) {
                userModalInstance.hide();
                loadUserList(); // Tải lại danh sách
            } else {
                errElem.textContent = res.message || 'Thao tác không thành công!';
                errElem.classList.remove('d-none');
            }
        }
    } catch (err) {
        console.error('Exception admin_save_user:', err);
        errElem.textContent = 'Lỗi kết nối cơ sở dữ liệu!';
        errElem.classList.remove('d-none');
    }
}

/**
 * Mở Modal Xác nhận Xóa
 */
function openDeleteConfirmModal(userId, username) {
    deleteTargetId = userId;
    document.getElementById('deleteTargetUsername').textContent = username;
    deleteModalInstance.show();
}

/**
 * Xử lý Xóa người dùng
 */
async function handleConfirmDelete() {
    if (!deleteTargetId) return;

    try {
        const { data, error } = await window.supabase.rpc('admin_delete_user', {
            p_user_id: deleteTargetId
        });

        if (error) {
            alert('Lỗi khi xóa: ' + error.message);
            return;
        }

        if (data && data.length > 0 && data[0].success) {
            deleteModalInstance.hide();
            deleteTargetId = null;
            loadUserList();
        } else {
            alert(data[0]?.message || 'Xóa không thành công!');
        }
    } catch (err) {
        console.error('Exception delete user:', err);
        alert('Lỗi hệ thống khi xóa người dùng!');
    }
}

/**
 * Helper chống XSS
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
```

- [ ] **Step 2: Commit file JS mới**

```bash
git add assets/js/quan-ly-user.js
git commit -m "feat: add quan-ly-user.js logic for CRUD user management"
```

---

### Task 4: Cập nhật Sidebar Navigation (`assets/js/sidebar.js`)

**Files:**
- Modify: `assets/js/sidebar.js`

**Interfaces:**
- Check `localStorage.getItem('currentUser') === 'bao.lt'` to display or hide the "Quản lý người dùng" link.

- [ ] **Step 1: Sửa `assets/js/sidebar.js` để thêm menu Quản lý Người dùng**

Tìm kiếm nơi khởi tạo Sidebar items trong `assets/js/sidebar.js` và bổ sung thêm mục menu `quan-ly-user.html` cho tài khoản `bao.lt`.

- [ ] **Step 2: Commit thay đổi trong `assets/js/sidebar.js`**

```bash
git add assets/js/sidebar.js
git commit -m "feat: add User Management menu item to sidebar for admin bao.lt"
```

---

## Plan Self-Review & Verification Plan

### Manual Verification Steps:
1. Chạy SQL script `scripts/setup_users_management_rpc.sql` trong Supabase SQL Editor.
2. Đăng nhập ứng dụng với tài khoản `bao.lt`.
3. Kiểm tra Sidebar xuất hiện menu **"Quản lý người dùng"**.
4. Truy cập `pages/quan-ly-user.html`.
5. Tạo 1 user thử nghiệm mới (ví dụ: `testuser` / `pass123`).
6. Sửa quyền hạn của `testuser`.
7. Đăng nhập bằng `testuser` để kiểm tra phân quyền.
8. Đăng nhập lại `bao.lt` và xóa `testuser`.
