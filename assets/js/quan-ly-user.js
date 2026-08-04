/* =============================================================================
   USER MANAGEMENT JAVASCRIPT
   Xử lý: Auth guard, load user list, tạo/sửa/xóa user, phân quyền
================================================================================ */

document.addEventListener('DOMContentLoaded', function () {
    // 1. Auth Guard - Kiểm tra xem user hiện tại có phải bao.lt không
    const currentUser = localStorage.getItem('currentUser');
    if (!currentUser || currentUser !== 'bao.lt') {
        const mainContent = document.querySelector('.main-content');
        if (mainContent) mainContent.style.display = 'none';
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

    // Toggle Select All overall
    const btnToggleAll = document.getElementById('btnToggleAllPages');
    if (btnToggleAll) {
        btnToggleAll.addEventListener('click', function () {
            const pageCheckboxes = document.querySelectorAll('.page-checkbox');
            const allChecked = Array.from(pageCheckboxes).every(cb => cb.checked);
            pageCheckboxes.forEach(cb => cb.checked = !allChecked);
            document.querySelectorAll('.group-select-all').forEach(g => g.checked = !allChecked);
            btnToggleAll.textContent = !allChecked ? 'Bỏ chọn tất cả' : 'Chọn tất cả';
        });
    }

    // Toggle Select All per group
    document.querySelectorAll('.group-select-all').forEach(groupCb => {
        groupCb.addEventListener('change', function () {
            const groupName = this.getAttribute('data-group');
            const memberCheckboxes = document.querySelectorAll(`.group-page-${groupName}`);
            memberCheckboxes.forEach(cb => cb.checked = this.checked);
        });
    });

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

        // Render Badge số lượng trang HTML được xem
        const allowedPages = Array.isArray(u.allowed_pages) ? u.allowed_pages : [];
        const isBaoLt = u.username === 'bao.lt';
        const isAllPages = isBaoLt || allowedPages.includes('*');
        const pageBadge = isAllPages 
            ? `<span class="badge bg-success mt-1 d-inline-block"><i class="fa-solid fa-layer-group me-1"></i>Tất cả trang</span>`
            : `<span class="badge bg-secondary mt-1 d-inline-block"><i class="fa-solid fa-file-code me-1"></i>${allowedPages.length} trang HTML</span>`;

        html += `
            <tr>
                <td class="fw-semibold text-muted">${index + 1}</td>
                <td>
                    <strong class="text-light">${escapeHtml(u.username)}</strong>
                    ${isBaoLt ? '<span class="badge bg-danger ms-1">Admin</span>' : ''}
                </td>
                <td class="text-muted">${u.email ? escapeHtml(u.email) : '<em>Chưa có</em>'}</td>
                <td>${otpBadge}</td>
                <td>
                    <div>${permBadges}</div>
                    <div>${pageBadge}</div>
                </td>
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
    
    // Mặc định chọn Trang chủ cho user mới
    document.querySelectorAll('.page-checkbox').forEach(cb => {
        cb.checked = (cb.value === '/pages/home.html');
    });
    document.querySelectorAll('.group-select-all').forEach(g => g.checked = false);

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

    // Tick chọn các trang HTML mà user được phép truy cập
    const allowedPages = Array.isArray(user.allowed_pages) ? user.allowed_pages : [];
    const isAll = user.username === 'bao.lt' || allowedPages.includes('*');

    document.querySelectorAll('.page-checkbox').forEach(cb => {
        if (isAll) {
            cb.checked = true;
        } else {
            cb.checked = allowedPages.includes(cb.value);
        }
    });

    // Cập nhật các ô chọn toàn bộ nhóm
    document.querySelectorAll('.group-select-all').forEach(groupCb => {
        const groupName = groupCb.getAttribute('data-group');
        const memberCbs = Array.from(document.querySelectorAll(`.group-page-${groupName}`));
        groupCb.checked = memberCbs.length > 0 && memberCbs.every(c => c.checked);
    });

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

    // Thu thập danh sách các trang HTML được tick chọn
    const allowedPages = [];
    const isBaoLt = username === 'bao.lt';
    if (isBaoLt) {
        allowedPages.push('*');
    } else {
        document.querySelectorAll('.page-checkbox:checked').forEach(cb => {
            allowedPages.push(cb.value);
        });
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
        p_can_view: canView,
        p_allowed_pages: allowedPages
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
