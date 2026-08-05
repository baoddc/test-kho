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

    // Toggle Select All overall
    const btnToggleAll = document.getElementById('btnToggleAllPages');
    if (btnToggleAll) {
        btnToggleAll.addEventListener('click', function () {
            const pageCheckboxes = document.querySelectorAll('.page-checkbox');
            const actionCheckboxes = document.querySelectorAll('.group-perm-action');
            const allChecked = Array.from(pageCheckboxes).every(cb => cb.checked);
            
            pageCheckboxes.forEach(cb => cb.checked = !allChecked);
            actionCheckboxes.forEach(cb => cb.checked = !allChecked);
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

            const actionCheckboxes = document.querySelectorAll(`.group-perm-${groupName}`);
            actionCheckboxes.forEach(cb => cb.checked = this.checked);
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

        // Render Badge số lượng trang HTML được xem & chi tiết nhóm
        let allowedPages = [];
        let groupsObj = null;

        if (Array.isArray(u.allowed_pages)) {
            allowedPages = u.allowed_pages;
        } else if (u.allowed_pages && typeof u.allowed_pages === 'object') {
            allowedPages = Array.isArray(u.allowed_pages.pages) ? u.allowed_pages.pages : [];
            groupsObj = u.allowed_pages.groups || null;
        }

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
    
    // Reset group action checkboxes
    document.querySelectorAll('.group-perm-action').forEach(cb => {
        cb.checked = (cb.id === 'perm_chung_view');
    });

    // Mặc định chọn Trang chủ cho user mới
    document.querySelectorAll('.page-checkbox').forEach(cb => {
        cb.checked = (cb.value === '/pages/home.html');
    });
    document.querySelectorAll('.group-select-all').forEach(g => g.checked = false);

    document.getElementById('formErrorMessage').classList.add('d-none');
    window._editingUserOriginalPermissions = null;
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

    // Parse allowed_pages (Array hoặc Object)
    let allowedPagesList = [];
    let groupsObj = null;

    if (Array.isArray(user.allowed_pages)) {
        allowedPagesList = user.allowed_pages;
    } else if (user.allowed_pages && typeof user.allowed_pages === 'object') {
        allowedPagesList = Array.isArray(user.allowed_pages.pages) ? user.allowed_pages.pages : [];
        groupsObj = user.allowed_pages.groups || null;
    }

    // Nếu chưa có cấu hình group riêng, lấy theo quyền tổng hợp cũ để so sánh chuẩn xác
    if (!groupsObj) {
        groupsObj = {};
        ['chung', '5s', 'xg', 'tole', 'pl', 'admin'].forEach(grp => {
            groupsObj[grp] = {
                canView: !!user.can_view,
                canAdd: !!user.can_add,
                canEdit: !!user.can_edit,
                canDelete: !!user.can_delete
            };
        });
    }

    // Lưu lại vị thế phân quyền ban đầu để tính diff sau khi lưu
    window._editingUserOriginalPermissions = {
        allowedPages: [...allowedPagesList],
        groups: JSON.parse(JSON.stringify(groupsObj))
    };

    const isAll = user.username === 'bao.lt' || allowedPagesList.includes('*');

    // Tick chọn các trang HTML mà user được phép truy cập
    document.querySelectorAll('.page-checkbox').forEach(cb => {
        if (isAll) {
            cb.checked = true;
        } else {
            cb.checked = allowedPagesList.includes(cb.value);
        }
    });

    // Tick chọn các quyền thao tác theo nhóm
    const groupNames = ['chung', '5s', 'xg', 'tole', 'pl', 'admin'];
    groupNames.forEach(grp => {
        ['view', 'add', 'edit', 'delete'].forEach(act => {
            const cb = document.getElementById(`perm_${grp}_${act}`);
            if (!cb) return;

            if (isAll) {
                cb.checked = true;
            } else if (groupsObj && groupsObj[grp]) {
                const actKey = 'can' + act.charAt(0).toUpperCase() + act.slice(1);
                cb.checked = !!groupsObj[grp][actKey];
            } else {
                // Fallback từ quyền tổng hợp cũ nếu chưa có cấu hình group
                if (act === 'view') cb.checked = !!user.can_view;
                else if (act === 'add') cb.checked = !!user.can_add;
                else if (act === 'edit') cb.checked = !!user.can_edit;
                else if (act === 'delete') cb.checked = !!user.can_delete;
            }
        });
    });

    // Cập nhật các ô chọn toàn bộ nhóm
    document.querySelectorAll('.group-select-all').forEach(groupCb => {
        const groupName = groupCb.getAttribute('data-group');
        const memberCbs = Array.from(document.querySelectorAll(`.group-page-${groupName}`));
        const actionCbs = Array.from(document.querySelectorAll(`.group-perm-${groupName}`));
        const allMember = memberCbs.every(c => c.checked);
        const allAction = actionCbs.every(c => c.checked);
        groupCb.checked = (memberCbs.length > 0 && allMember) && (actionCbs.length > 0 && allAction);
    });

    document.getElementById('formErrorMessage').classList.add('d-none');
    userModalInstance.show();
}

/**
 * Tính toán sự thay đổi phân quyền (Diff) giữa cũ và mới
 */
function computePermissionDiff(username, oldPerms, newAllowedPagesPayload) {
    if (!oldPerms) {
        return {
            hasChanges: true,
            title: '🎉 Tài khoản của bạn đã được khởi tạo',
            content: `Tài khoản ${username} đã được Admin khởi tạo và cấp quyền truy cập hệ thống. Vui lòng kiểm tra danh sách trang và chức năng được phân quyền.`,
            type: 'info'
        };
    }

    const pageLabels = {
        '/pages/home.html': 'Trang chủ',
        '/pages/about.html': 'Giới thiệu',
        '/pages/cong-viec.html': 'Công việc & Nhắc hẹn',
        '/pages/quan-ly-user.html': 'Quản lý User',
        '/pages/5s/5s-so-do-phoi-cuon.html': 'Sơ đồ kho Phôi cuộn',
        '/pages/5s/5s-so-do-phe-lieu.html': 'Sơ đồ kho Phế liệu',
        '/pages/5s/hse.html': 'HSE',
        '/pages/5s/quan-ly-5s.html': 'Quản lý 5S',
        '/pages/xg/xg-nhap.html': 'Nhập - XG',
        '/pages/xg/xg-nhap-supabase.html': 'Nhập - XG',
        '/pages/xg/xg-xuat.html': 'Xuất - XG',
        '/pages/xg/xg-xuat-supabase.html': 'Xuất - XG',
        '/pages/xg/xg-ton.html': 'Tồn - XG',
        '/pages/xg/xg-ton-supabase.html': 'Tồn - XG',
        '/pages/xg/xg-bieu-do.html': 'Biểu đồ - XG',
        '/pages/tole/tole-nhap.html': 'Nhập - Tole',
        '/pages/tole/tole-nhap-supabase.html': 'Nhập - Tole',
        '/pages/tole/tole-xuat.html': 'Xuất - Tole',
        '/pages/tole/tole-xuat-supabase.html': 'Xuất - Tole',
        '/pages/tole/tole-ton.html': 'Tồn - Tole',
        '/pages/tole/tole-ton-supabase.html': 'Tồn - Tole',
        '/pages/tole/tole-bieu-do.html': 'Biểu đồ - Tole',
        '/pages/pl/pl-can-thu.html': 'Cần thu - PL',
        '/pages/pl/pl-da-thu.html': 'Đã thu - PL',
        '/pages/pl/pl-chua-thu.html': 'Chưa thu - PL',
        '/pages/pl/pl-phieu-in.html': 'Xuất bán/Xuất trả - PL'
    };

    function formatPageName(p) {
        if (!p) return '';
        if (pageLabels[p]) return pageLabels[p];
        let clean = p.replace(/^\/pages\//, '').replace(/\.html$/, '');
        const parts = clean.split('/');
        let name = parts[parts.length - 1];
        name = name.replace(/^xg-/, '').replace(/^tole-/, '').replace(/^pl-/, '').replace(/-supabase$/, '');
        const section = parts[0].toUpperCase();
        return `${name.charAt(0).toUpperCase() + name.slice(1)} - ${section}`;
    }

    const oldPages = Array.isArray(oldPerms.allowedPages) ? oldPerms.allowedPages : [];
    const newPages = Array.isArray(newAllowedPagesPayload) ? newAllowedPagesPayload : (Array.isArray(newAllowedPagesPayload?.pages) ? newAllowedPagesPayload.pages : []);

    const addedPages = newPages.filter(p => !oldPages.includes(p));
    const removedPages = oldPages.filter(p => !newPages.includes(p));

    const addedTextList = addedPages.map(p => formatPageName(p));
    const removedTextList = removedPages.map(p => formatPageName(p));

    // Track group action changes if available
    const oldGroups = oldPerms.groups || {};
    const newGroups = newAllowedPagesPayload?.groups || {};
    const groupLabels = {
        chung: 'Chung (Home, Công việc)',
        '5s': 'Quản lý 5S',
        xg: 'Xưởng Phôi',
        tole: 'Xưởng Tole',
        pl: 'Phân loại Phôi',
        admin: 'Quản trị User'
    };
    const actionLabels = { canView: 'Xem', canAdd: 'Thêm', canEdit: 'Sửa', canDelete: 'Xóa' };

    ['chung', '5s', 'xg', 'tole', 'pl', 'admin'].forEach(grp => {
        const oldG = oldGroups[grp] || {};
        const newG = newGroups[grp] || {};
        ['canView', 'canAdd', 'canEdit', 'canDelete'].forEach(act => {
            if (!oldG[act] && newG[act]) {
                addedTextList.push(`Quyền ${actionLabels[act]} (${groupLabels[grp]})`);
            } else if (oldG[act] && !newG[act]) {
                removedTextList.push(`Quyền ${actionLabels[act]} (${groupLabels[grp]})`);
            }
        });
    });

    if (addedTextList.length === 0 && removedTextList.length === 0) {
        return { hasChanges: false };
    }

    let summaryParts = [];
    if (addedTextList.length > 0) {
        summaryParts.push(`➕ Cấp thêm:\n • ${addedTextList.join('\n • ')}`);
    }
    if (removedTextList.length > 0) {
        summaryParts.push(`➖ Thu hồi:\n • ${removedTextList.join('\n • ')}`);
    }

    const isWarning = removedTextList.length > 0 && addedTextList.length === 0;

    return {
        hasChanges: true,
        title: isWarning ? '⚠️ Thu hồi quyền truy cập' : '📢 Cập nhật quyền truy cập tài khoản',
        content: `Phân quyền tài khoản của bạn vừa được Quản trị viên cập nhật:\n${summaryParts.join('\n\n')}`,
        type: isWarning ? 'warning' : 'info'
    };
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

    if (!editId && (!username || !password)) {
        errElem.textContent = 'Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu!';
        errElem.classList.remove('d-none');
        return;
    }

    const isBaoLt = username === 'bao.lt';
    const allowedPagesList = [];

    if (isBaoLt) {
        allowedPagesList.push('*');
    } else {
        document.querySelectorAll('.page-checkbox:checked').forEach(cb => {
            allowedPagesList.push(cb.value);
        });
    }

    // Thu thập quyền thao tác theo từng nhóm
    const groupNames = ['chung', '5s', 'xg', 'tole', 'pl', 'admin'];
    const groupsObj = {};

    groupNames.forEach(grp => {
        groupsObj[grp] = {
            canView: isBaoLt || !!document.getElementById(`perm_${grp}_view`)?.checked,
            canAdd: isBaoLt || !!document.getElementById(`perm_${grp}_add`)?.checked,
            canEdit: isBaoLt || !!document.getElementById(`perm_${grp}_edit`)?.checked,
            canDelete: isBaoLt || !!document.getElementById(`perm_${grp}_delete`)?.checked
        };
    });

    // Tính toán quyền hệ thống (OR combination)
    const canView = isBaoLt || Object.values(groupsObj).some(g => g.canView);
    const canAdd = isBaoLt || Object.values(groupsObj).some(g => g.canAdd);
    const canEdit = isBaoLt || Object.values(groupsObj).some(g => g.canEdit);
    const canDelete = isBaoLt || Object.values(groupsObj).some(g => g.canDelete);

    const allowedPagesPayload = isBaoLt ? ['*'] : {
        pages: allowedPagesList,
        groups: groupsObj
    };

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
        p_allowed_pages: allowedPagesPayload
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

                // Đẩy thông báo phân quyền tới người dùng được điều chỉnh
                const diff = computePermissionDiff(username, window._editingUserOriginalPermissions, allowedPagesPayload);
                if (diff.hasChanges && window.supabase && typeof window.supabase.from === 'function') {
                    const notifPayload = {
                        title: diff.title,
                        content: diff.content,
                        type: diff.type,
                        target_user: username,
                        created_by: 'bao.lt',
                        is_active: true
                    };

                    window.supabase.from('system_announcements').insert([notifPayload]).then(({ error: notifErr }) => {
                        if (notifErr) {
                            console.warn('Lỗi gửi thông báo phân quyền (thử lại dạng fallback):', notifErr);
                            // Nếu DB trên Supabase chưa chạy script migration cột target_user -> Fallback chèn thông báo kèm tag username trong tiêu đề
                            if (notifErr.message && notifErr.message.includes('target_user')) {
                                const fallbackPayload = { ...notifPayload };
                                delete fallbackPayload.target_user;
                                fallbackPayload.title = `[Gửi ${username}] ` + fallbackPayload.title;
                                window.supabase.from('system_announcements').insert([fallbackPayload]);
                            }
                        }
                    }).catch(e => console.warn('Lỗi gửi thông báo phân quyền:', e));
                }
                window._editingUserOriginalPermissions = null;

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
