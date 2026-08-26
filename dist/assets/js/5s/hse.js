/**
 * HSE MANAGEMENT SYSTEM - CORE JAVASCRIPT
 * Handles Data Fetching, Rendering, and UI Interactivity
 */

// --- Configuration ---
const CONFIG = {
    // Replace with your actual Google API Key and Spreadsheet ID
    API_KEY: 'AKfycbxZAj6Wcs3JBtw8RzxQySZ7Woq4n7q1ieI59ffau6ABBLsa1w8tXWZ4F6H8rLsowhBs',
    SPREADSHEET_ID: '1keZMSZqlHFIe7la0H2eR-PDmO2S2ChHo5vn3-H1uoh8', // Using existing ID from project as fallback
    APPS_SCRIPT_URL_HSE: 'https://script.google.com/macros/s/AKfycbxZAj6Wcs3JBtw8RzxQySZ7Woq4n7q1ieI59ffau6ABBLsa1w8tXWZ4F6H8rLsowhBs/exec', // <--- ĐIỀN LINK WEB APP (Mới deploy) TẠI ĐÂY
    PDF_FOLDER_ID: '1oiPaOOwPzeFuNCMH27l_PeNvMoghP97c', // <--- ĐIỀN ID THƯ MỤC LƯU PDF TẠI ĐÂY (VD: 1Ke...)
    SIMULATE_DATA: false // Set to false when API Key is provided
};

// --- Module Definitions ---
const HSE_MODULES = [
    {
        id: 'job-plan',
        title: 'Kế hoạch công việc',
        desc: 'Danh sách kế hoạch, người phụ trách và thời hạn hoàn thành.',
        icon: 'clipboard',
        colorClass: 'icon-green',
        sheetName: 'Kế hoạch công việc',
        sheetId: '0',
        keywords: ['kế hoạch', 'cv', 'deadline', 'trạng thái']
    },
    {
        id: 'wh-photos',
        title: 'Ảnh mẫu kho',
        desc: 'Gallery ảnh mẫu sắp xếp kho bãi tiêu chuẩn.',
        icon: 'image',
        colorClass: 'icon-blue',
        sheetName: 'Ảnh mẫu kho',
        sheetId: '426924190',
        keywords: ['ảnh', 'mẫu', 'kho', 'gallery']
    },
    {
        id: 'clean-schedule',
        title: 'Lịch vệ sinh',
        desc: 'Lịch phân công vệ sinh khu vực theo tuần/tháng.',
        icon: 'calendar',
        colorClass: 'icon-amber',
        sheetName: 'Lịch vệ sinh',
        sheetId: '726858482',
        keywords: ['lịch', 'vệ sinh', 'ca trực']
    },
    {
        id: 'clean-photos',
        title: 'Ảnh vệ sinh',
        desc: 'Báo cáo hình ảnh vệ sinh thực tế tại hiện trường.',
        icon: 'camera',
        colorClass: 'icon-blue',
        sheetName: 'Ảnh vệ sinh',
        sheetId: '160925326',
        keywords: ['ảnh', 'vệ sinh', 'thực tế']
    },
    {
        id: 'equipment-checklist',
        title: 'Checklist kiểm tra thiết bị',
        desc: 'Kiểm tra định kỳ tình trạng an toàn thiết bị.',
        icon: 'check-square',
        colorClass: 'icon-green',
        sheetName: 'Checklist kiểm tra thiết bị',
        sheetId: '20754979',
        keywords: ['checklist', 'kiểm tra', 'thiết bị']
    },
    {
        id: 'tools-inventory',
        title: 'Công cụ dụng cụ (CCDC)',
        desc: 'Quản lý danh mục, số lượng và tình trạng CCDC.',
        icon: 'tool',
        colorClass: 'icon-amber',
        sheetName: 'Công cụ dụng cụ (CCDC)',
        sheetId: '414597666',
        keywords: ['ccdc', 'công cụ', 'dụng cụ', 'tồn kho']
    },
    {
        id: 'disposal-standards',
        title: 'Tiêu chuẩn loại bỏ Công cụ dụng cụ',
        desc: 'Quy định và điều kiện để thanh lý/loại bỏ CCDC.',
        icon: 'trash-2',
        colorClass: 'icon-red',
        sheetName: 'Tiêu chuẩn loại bỏ Công cụ dụng cụ',
        sheetId: '1346553726',
        keywords: ['loại bỏ', 'thanh lý', 'tiêu chuẩn']
    },
    {
        id: 'scrap-categories',
        title: 'Danh mục phân loại phế liệu',
        desc: 'Phân loại các nhóm phế liệu và mã định danh.',
        icon: 'layers',
        colorClass: 'icon-amber',
        sheetName: 'Danh mục phân loại phế liệu',
        sheetId: '1085802127',
        keywords: ['phế liệu', 'danh mục', 'phân loại']
    },
    {
        id: 'scrap-regs',
        title: 'Quy định phân loại phế liệu',
        desc: 'Hướng dẫn chi tiết quy trình phân loại tại nguồn.',
        icon: 'file-text',
        colorClass: 'icon-blue',
        sheetName: 'Quy định phân loại phế liệu',
        sheetId: '1019224573',
        keywords: ['quy định', 'hướng dẫn', 'phế liệu']
    },
    {
        id: '5s-fix',
        title: 'Khắc phục 5S',
        desc: 'Theo dõi xử lý các điểm không phù hợp 5S.',
        icon: 'activity',
        colorClass: 'icon-red',
        sheetName: 'Khắc phục 5S',
        sheetId: '794649355',
        keywords: ['5s', 'khắc phục', 'lỗi']
    },
    {
        id: '5s-race',
        title: 'Thi đua 5S',
        desc: 'Báo cáo hình ảnh và bảng điểm thi đua 5S các khu vực.',
        icon: 'award',
        colorClass: 'icon-amber',
        sheetName: 'Thi đua 5S',
        sheetId: '1047465605',
        keywords: ['thi đua', 'điểm số', 'xếp hạng', 'ảnh', 'hình ảnh']
    }
];

// --- Mock Data Generator ---
const MockData = {
    'job-plan': [
        ['Tiêu đề', 'Mô tả', 'Người phụ trách', 'Hạn định', 'Trạng thái'],
        ['Vệ sinh khu A', 'Quét dọn và sắp xếp pallet', 'Nguyễn Văn A', '2024-04-05', 'Đang thực hiện'],
        ['Kiểm tra PCCC', 'Kiểm tra bình chữa cháy tầng 1', 'Trần Thị B', '2024-04-02', 'Hoàn thành'],
        ['Sơn lại vạch kẻ', 'Khu vực xuất hàng', 'Lê Văn C', '2024-03-25', 'Quá hạn']
    ],
    'wh-photos': [
        ['Tên ảnh', 'Ngày chụp', 'URL', 'Ghi chú'],
        ['Mẫu kệ hàng A', '2024-03-20', 'https://picsum.photos/400/300?random=1', 'Sắp xếp đúng quy chuẩn'],
        ['Lối đi an toàn', '2024-03-21', 'https://picsum.photos/400/300?random=2', 'Không vật cản'],
        ['Khu vực phế liệu', '2024-03-22', 'https://picsum.photos/400/300?random=3', 'Phân loại rõ ràng']
    ],
    '5s-race': [
        ['Khu vực', 'Điểm 5S', 'Xếp hạng', 'Xu hướng'],
        ['Kho Thành phẩm', '95', '1', '↑'],
        ['Kho Nguyên liệu', '88', '2', '↓'],
        ['Khu vực Sản xuất', '82', '3', '→']
    ]
    // Add more mock data as needed for other modules
};

// --- GSheets Service ---
class GSheetsService {
    static async fetchSheetData(sheetId, mockKey) {
        if (CONFIG.SIMULATE_DATA) {
            return new Promise(resolve => {
                setTimeout(() => resolve(MockData[mockKey] || [['No data'], ['Simulation data for ' + mockKey]]), 800);
            });
        }

        try {
            const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/export?format=csv&gid=${sheetId}`;
            const response = await fetch(url);
            const csvText = await response.text();
            return this.parseCSV(csvText);
        } catch (error) {
            console.error(`Error fetching sheet ${sheetId}:`, error);
            throw error;
        }
    }

    /**
     * Parse CSV text into 2D array
     * Handles quoted values and escaped quotes (standard Google Sheets CSV format)
     */
    static parseCSV(text) {
        const result = [];
        let row = [];
        let field = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];

            if (inQuotes) {
                if (char === '"' && nextChar === '"') {
                    field += '"';
                    i++;
                } else if (char === '"') {
                    inQuotes = false;
                } else {
                    field += char;
                }
            } else {
                if (char === '"') {
                    inQuotes = true;
                } else if (char === ',') {
                    row.push(field.trim());
                    field = '';
                } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
                    row.push(field.trim());
                    result.push(row);
                    row = [];
                    field = '';
                    if (char === '\r') i++;
                } else {
                    field += char;
                }
            }
        }

        // Push last row if exists
        if (field || row.length > 0) {
            row.push(field.trim());
            result.push(row);
        }

        return result.filter(r => r.length > 0 && r.some(c => c !== ''));
    }
}

// --- Icons (SVG) ---
const ICONS = {
    clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>',
    'check-square': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>',
    tool: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>',
    'trash-2': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 12 17 2 12"></polyline><polyline points="22 7 12 12 2 7"></polyline><path d="M12 2L2 7l10 5 10-5-10-5z"></path></svg>',
    'file-text': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>',
    activity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>',
    award: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>',
    'arrow-right': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>'
};

// --- Dashboard Manager ---
class DashboardManager {
    constructor() {
        this.grid = document.getElementById('moduleGrid');
        this.searchField = document.getElementById('globalSearch');
        this.overlay = document.getElementById('loadingOverlay');
        this.modal = document.getElementById('detailModal');
        this.modalBody = document.getElementById('modalBody');
        this.modalTitle = document.getElementById('modalTitle');

        this.modules = HSE_MODULES;
        this.init();
    }

    init() {
        this.renderModules(this.modules);
        this.setupEventListeners();
        this.checkAuth();
    }

    checkAuth() {
        const user = localStorage.getItem('currentUser');
        // Allow guest access; home.js handles the primary whitelist check

        const usernameEl = document.getElementById('currentUsername');
        if (usernameEl) {
            usernameEl.textContent = user || 'Khách';
        }

        const btnLogout = document.getElementById('btnLogout');
        if (btnLogout) {
            if (user) {
                btnLogout.textContent = 'Đăng xuất';
                btnLogout.onclick = () => {
                    localStorage.removeItem('currentUser');
                    window.location.replace('/pages/index.html');
                };
            } else {
                btnLogout.textContent = 'Đăng nhập';
                btnLogout.className = 'btn-logout bg-success';
                btnLogout.onclick = () => {
                    window.location.href = '/pages/index.html';
                };
            }
        }
    }

    checkPermission() {
        const user = localStorage.getItem('currentUser');
        if (user === 'bao.lt') return true;
        this.showPermissionDeniedModal();
        return false;
    }

    showPermissionDeniedModal() {
        const user = localStorage.getItem('currentUser');
        const message = user
            ? `Tài khoản <strong>${user}</strong> không có quyền thực hiện hành động này. Vui lòng đăng nhập với tài khoản quản trị.`
            : 'Bạn cần đăng nhập với tài khoản quản trị để thực hiện hành động này.';

        let modal = document.getElementById('permission-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'permission-modal';
            modal.className = 'modal-backdrop';
            modal.style.zIndex = '100000';
            modal.innerHTML = `
                <div class="modal-content glass-card" style="max-width: 400px; text-align: center; padding: 2.5rem;">
                    <div style="color: #ef4444; margin-bottom: 1.5rem; display: flex; justify-content: center;">
                        <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>
                    </div>
                    <h2 style="margin-bottom: 1rem; color: #fff;">Quyền truy cập bị từ chối</h2>
                    <p id="permission-modal-msg" style="color: rgba(255,255,255,0.6); line-height: 1.6; margin-bottom: 2rem;"></p>
                    <button class="btn-more" id="closePermissionModal" style="width: 100%; justify-content: center; background: #ef4444; color: #fff; border-radius: 8px; padding: 0.8rem;">Đã hiểu</button>
                </div>
            `;
            document.body.appendChild(modal);
            document.getElementById('closePermissionModal').onclick = () => {
                modal.classList.remove('active');
            };
        }

        document.getElementById('permission-modal-msg').innerHTML = message;
        modal.classList.add('active');
    }

    // renderDate function removed

    renderModules(modulesToRender) {
        // Clear previous cards except loading overlay
        const loading = this.overlay;
        this.grid.innerHTML = '';
        this.grid.appendChild(loading);

        this.overlay.style.display = 'none';

        if (modulesToRender.length === 0) {
            this.grid.innerHTML += `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">Không tìm thấy kết quả nào cho "${this.searchField.value}"</p>`;
            return;
        }

        modulesToRender.forEach(module => {
            const card = document.createElement('div');
            card.className = 'glass-card';
            card.style.cursor = 'pointer';
            card.onclick = () => app.openDetail(module.id);
            card.innerHTML = `
                <div class="card-top">
                    <div class="card-icon ${module.colorClass}">
                        ${ICONS[module.icon] || ICONS.clipboard}
                    </div>
                    <div class="card-header">
                        <h3>${module.title}</h3>
                        <p class="card-desc">${module.desc}</p>
                    </div>
                </div>
                <div class="card-footer">
                    <span class="status-badge badge-live">Live</span>
                    <button class="btn-more">
                        Xem chi tiết
                        ${ICONS['arrow-right']}
                    </button>
                </div>
            `;
            this.grid.appendChild(card);
        });
    }

    setupEventListeners() {
        // Global Search
        this.searchField.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = this.modules.filter(m =>
                m.title.toLowerCase().includes(query) ||
                m.desc.toLowerCase().includes(query) ||
                m.keywords.some(k => k.includes(query))
            );
            this.renderModules(filtered);
        });

        // Close Modal
        document.getElementById('closeModal').onclick = () => this.closeModal();
        window.onclick = (e) => { if (e.target === this.modal) this.closeModal(); };

        // ESC key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('active')) {
                this.closeModal();
            }
        });
    }

    async openDetail(moduleId) {
        const module = this.modules.find(m => m.id === moduleId);
        if (!module) return;

        this.currentModuleId = moduleId; // Store current module ID
        this.modalTitle.textContent = module.title;
        this.modalBody.innerHTML = '<div class="spinner" style="margin: 2rem auto;"></div>';
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        try {
            const data = await GSheetsService.fetchSheetData(module.sheetId, module.id);
            this.renderModalContent(moduleId, data);
        } catch (err) {
            this.modalBody.innerHTML = `<p class="error-msg" style="color: var(--danger);">Lỗi tải dữ liệu: ${err.message}</p>`;
        }
    }

    closeModal() {
        this.modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }

    renderModalContent(moduleId, data) {
        if (moduleId === 'wh-photos' || moduleId === 'clean-photos' || moduleId === '5s-race') {
            this.renderGallery(data, moduleId);
        } else if (moduleId === 'scrap-regs') {
            this.renderScrapRegs(data);
        } else if (moduleId === 'job-plan' || moduleId === 'clean-schedule') {
            this.renderModuleByMonthGroups(data, moduleId);
        } else {
            if (!data || data.length === 0) {
                this.modalBody.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">Không có dữ liệu hiển thị.</p>';
                return;
            }
            this.renderTable(data);
        }
    }

    renderModuleByMonthGroups(data, moduleId) {
        const headers = data[0];
        const rows = data.slice(1);
        const dateIdx = headers.findIndex(h => h.includes('Hạn định') || h.includes('Ngày') || h.includes('Thời gian'));

        if (dateIdx === -1) {
            this.renderTable(data);
            return;
        }

        const groups = {};
        rows.forEach(row => {
            const dateStr = row[dateIdx];
            if (!dateStr) return;

            let monthYear = 'Chưa xác định';
            const parts = dateStr.split(/[-/]/);
            if (parts.length === 3) {
                // Handle YYYY-MM-DD or DD/MM/YYYY
                if (parts[0].length === 4) { // YYYY-MM-DD
                    monthYear = `${parts[1]}/${parts[0]}`;
                } else { // DD/MM/YYYY
                    monthYear = `${parts[1]}/${parts[2]}`;
                }
            }

            if (!groups[monthYear]) groups[monthYear] = [];
            groups[monthYear].push(row);
        });

        const sortedMonths = Object.keys(groups).sort((a, b) => {
            const [mA, yA] = a.split('/').map(Number);
            const [mB, yB] = b.split('/').map(Number);
            return (yB * 12 + mB) - (yA * 12 + mA);
        });

        let html = `
            <div class="month-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 1rem; margin-top: 1rem;">
        `;

        sortedMonths.forEach(month => {
            html += `
                <div class="glass-card month-card" onclick="app.showMonthDetail('${month}', '${moduleId}')" style="cursor: pointer; padding: 1.5rem; text-align: center; transition: var(--transition);">
                    <div style="color: var(--primary); margin-bottom: 0.5rem;">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    </div>
                    <div style="font-weight: 700; font-size: 1.1rem;">Tháng ${month}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">${groups[month].length} dòng dữ liệu</div>
                </div>
            `;
        });

        html += `</div>`;
        this.modalBody.innerHTML = html;
        this.currentModuleFullData = data;
        this.currentModuleGroups = groups;
    }

    showMonthDetail(month, moduleId) {
        const headers = this.currentModuleFullData[0];
        const monthRows = this.currentModuleGroups[month];
        const displayData = [headers, ...monthRows];

        this.renderTable(displayData, true);

        // Add back button
        const backBtn = document.createElement('div');
        backBtn.innerHTML = `
            <button class="btn-more" style="margin-bottom: 1rem; padding: 0.5rem 1rem; background: rgba(255,255,255,0.05); border-radius: 6px;">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="transform: rotate(180deg);"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                Quay lại danh sách tháng
            </button>
        `;
        backBtn.onclick = () => this.renderModuleByMonthGroups(this.currentModuleFullData, moduleId);
        this.modalBody.insertBefore(backBtn, this.modalBody.firstChild);
    }

    renderTable(data) {
        const headers = data[0];
        const rows = data.slice(1);
        const moduleId = this.currentModuleId;

        let html = '<div class="table-responsive"><table class="hse-table"><thead><tr>';
        headers.forEach(h => {
            const isWide = h && (h.toLowerCase().includes('nội dung') || h.toLowerCase().includes('mô tả'));
            if (isWide) {
                html += `<th class="col-content-wide">${h}</th>`;
            } else {
                html += `<th>${h}</th>`;
            }
        });
        html += '</tr></thead><tbody>';

        rows.forEach((row, rowIndex) => {
            html += '<tr>';
            row.forEach((cell, idx) => {
                let cellHtml = cell || '';
                const header = headers[idx] || '';

                // Special formatting for status
                if (header === 'Trạng thái') {
                    const statusClass = cell === 'Hoàn thành' ? 'badge-live' : (cell === 'Quá hạn' ? 'badge-danger' : 'badge-warning');
                    cellHtml = `<span class="status-badge ${statusClass}">${cell}</span>`;
                }

                // Special formatting for Before/After images in 5S Fix module
                else if (moduleId === '5s-fix' && (header.toLowerCase().includes('trước') || header.toLowerCase().includes('sau'))) {
                    const spreadsheetRow = rowIndex + 2; // +1 for 0-indexed, +1 for header
                    const isUrl = cellHtml.startsWith('http');

                    if (isUrl) {
                        const originalUrl = cellHtml; // Preserve original URL
                        let thumbUrl = originalUrl;
                        if (thumbUrl.includes('drive.google.com/file/d/')) {
                            const match = thumbUrl.match(/\/d\/([-\w]{25,})/);
                            if (match && match[1]) thumbUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w200`;
                        }
                        cellHtml = `
                            <div class="cell-image-container">
                                <img src="${thumbUrl}" class="table-img-thumb" onclick="app.openImageLightbox('${originalUrl}')">
                                <button class="btn-cell-delete" onclick="app.deleteTableCellImage(${spreadsheetRow}, '${header}', '${originalUrl}')" title="Xóa ảnh">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                </button>
                                <button class="btn-cell-upload" onclick="app.triggerCellUpload(${spreadsheetRow}, '${header}')" title="Thay đổi ảnh">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                </button>
                            </div>
                        `;
                    } else {
                        cellHtml = `
                            <div class="cell-image-container empty">
                                <button class="btn-cell-upload large" onclick="app.triggerCellUpload(${spreadsheetRow}, '${header}')">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                    <span>Tải ảnh</span>
                                </button>
                            </div>
                        `;
                    }
                }

                let tdAttr = '';
                const isWide = header && (header.toLowerCase().includes('nội dung') || header.toLowerCase().includes('mô tả'));
                if (isWide) {
                    tdAttr = ' class="col-content-wide" style="text-align: left;"';
                }

                html += `<td${tdAttr}>${cellHtml}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table></div>';

        // Add hidden file input for cell uploads if not exists
        if (!document.getElementById('cellFileInput')) {
            html += `<input type="file" id="cellFileInput" style="display:none" accept="image/*" onchange="app.handleTableCellUpload(event)">`;
        }

        this.modalBody.innerHTML = html;

        // Inject dynamic styles for status if needed
        if (!document.getElementById('status-styles')) {
            const style = document.createElement('style');
            style.id = 'status-styles';
            style.textContent = `
                .badge-danger { background: rgba(239, 68, 68, 0.2); color: #f87171; }
                .badge-warning { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
            `;
            document.head.appendChild(style);
        }
    }

    generateGalleryItemHtml(row, moduleId) {
        let [name, date, originalUrl, note] = row;
        let thumbUrl = originalUrl;
        if (thumbUrl && thumbUrl.includes('drive.google.com/file/d/')) {
            const match = thumbUrl.match(/\/d\/([-\w]{25,})/);
            if (match && match[1]) {
                thumbUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
            }
        }

        return `
            <div class="gallery-item" style="position: relative;">
                <img src="${thumbUrl}" alt="${name}" class="img-thumb" onclick="app.openImageLightbox('${originalUrl}')">
                <button class="btn-delete-img" onclick="app.deleteImage(event, '${moduleId}', '${originalUrl}', this)" title="Xóa ảnh" style="position: absolute; top: 8px; right: 8px; background: rgba(239, 68, 68, 0.85); border: none; border-radius: 6px; padding: 6px; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); transition: var(--transition);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
                <div class="gallery-info" style="margin-top: 0.5rem;">
                    <p style="font-weight: 600; font-size: 0.9rem;">${name}</p>
                    <p style="color: var(--text-muted); font-size: 0.8rem;">${date}</p>
                    <p style="font-size: 0.8rem; margin-top: 0.25rem;">${note || ''}</p>
                </div>
            </div>
        `;
    }

    renderGallery(data, moduleId) {
        const rows = (data && data.length > 1) ? data.slice(1) : [];

        let uploadSectionHtml = `
            <div class="upload-section" style="display: flex; justify-content: flex-end; margin-bottom: 0.8rem;">
                <label for="uploadPhoto_${moduleId}" style="background: var(--primary); color: white; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; font-weight: 500; transition: var(--transition); margin: 0.8rem 0 0 0">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    Upload Hình Ảnh
                </label>
                <input type="file" id="uploadPhoto_${moduleId}" accept="image/*" style="display: none;" onchange="app.handleImageUpload(event, '${moduleId}')">
            </div>
        `;

        let html = uploadSectionHtml;

        if (moduleId === 'clean-photos' || moduleId === '5s-race') {
            const grouped = {};
            rows.forEach(row => {
                const dateVal = row[1] || 'Chưa có ngày';
                if (!grouped[dateVal]) grouped[dateVal] = [];
                grouped[dateVal].push(row);
            });

            const sortedDates = Object.keys(grouped).sort((a, b) => {
                const parseDate = (dStr) => {
                    if (dStr.includes('/')) {
                        const parts = dStr.split('/');
                        if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                    } else if (dStr.includes('-')) {
                        return new Date(dStr);
                    }
                    return new Date(0);
                };
                const dA = parseDate(a);
                const dB = parseDate(b);
                if (!isNaN(dA) && !isNaN(dB) && dA.getTime() !== dB.getTime()) return dB - dA;
                return b.localeCompare(a); // Fallback string comparison
            });

            sortedDates.forEach(dateVal => {
                html += `<div class="gallery-date-group" data-date="${dateVal}">
                    <h4 style="margin-top: 0rem; margin-bottom: 1rem; color: var(--text); padding-left: 0.5rem; border-left: 4px solid var(--primary); font-size: 1.1rem; text-align: left;">Ngày chụp: ${dateVal}</h4>
                    <div class="gallery-grid">`;
                grouped[dateVal].forEach(row => {
                    html += this.generateGalleryItemHtml(row, moduleId);
                });
                html += `</div></div>`;
            });
        } else {
            html += '<div class="gallery-grid">';
            rows.forEach(row => {
                html += this.generateGalleryItemHtml(row, moduleId);
            });
            html += '</div>';
        }

        this.modalBody.innerHTML = html;
    }

    async handleImageUpload(event, moduleId) {
        if (!this.checkPermission()) {
            event.target.value = '';
            return;
        }
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const dataUrl = e.target.result;
            const today = new Date().toLocaleDateString('vi-VN');

            // Extract base64 and mime type
            const base64Data = dataUrl.split(',')[1];
            const mimeType = file.type;

            const moduleDef = this.modules.find(m => m.id === moduleId);
            const sheetName = moduleDef ? moduleDef.sheetName : 'Ảnh mẫu kho';

            // Temporary block with spinner status
            const tempId = 'upload_' + Date.now();
            const newHtml = `
                <div class="gallery-item" id="${tempId}" style="animation: fadeIn 0.5s; position: relative;">
                    <img src="${dataUrl}" alt="${file.name}" class="img-thumb" style="opacity: 0.5;">
                    <div class="gallery-info" style="margin-top: 0.5rem;">
                        <p style="font-weight: 600; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${file.name}">${file.name}</p>
                        <p style="color: var(--warning); font-size: 0.8rem; font-weight: 600;">Đang tải lên hệ thống...</p>
                        <p style="font-size: 0.8rem; margin-top: 0.25rem;">(Vui lòng chờ)</p>
                    </div>
                </div>
            `;

            if (moduleId === 'clean-photos' || moduleId === '5s-race') {
                let currentGroup = this.modalBody.querySelector(`.gallery-date-group[data-date="${today}"] .gallery-grid`);
                if (!currentGroup) {
                    const newGroupHtml = `<div class="gallery-date-group" data-date="${today}">
                        <h4 style="margin-top: 0rem; margin-bottom: 1rem; color: var(--text); padding-left: 0.5rem; border-left: 4px solid var(--primary); font-size: 1.1rem; text-align: left;">Ngày chụp: ${today}</h4>
                        <div class="gallery-grid"></div>
                    </div>`;
                    const uploadSection = this.modalBody.querySelector('.upload-section');
                    if (uploadSection) {
                        uploadSection.insertAdjacentHTML('afterend', newGroupHtml);
                    } else {
                        this.modalBody.insertAdjacentHTML('afterbegin', newGroupHtml);
                    }
                    currentGroup = this.modalBody.querySelector(`.gallery-date-group[data-date="${today}"] .gallery-grid`);
                }
                if (currentGroup) {
                    currentGroup.insertAdjacentHTML('afterbegin', newHtml);
                }
            } else {
                const galleryGrid = this.modalBody.querySelector('.gallery-grid');
                if (galleryGrid) {
                    galleryGrid.insertAdjacentHTML('afterbegin', newHtml);
                }
            }

            if (!CONFIG.APPS_SCRIPT_URL_HSE) {
                alert('Thiếu APPS_SCRIPT_URL_HSE! Hãy xem Hướng dẫn và dán URL vào file hse.js để tính năng hoạt động.');
                const el = document.getElementById(tempId);
                el.querySelector('img').style.opacity = '1';
                el.querySelector('.gallery-info p:nth-child(2)').textContent = 'Mới tải lên (Chỉ nháp)';
                el.querySelector('.gallery-info p:nth-child(2)').style.color = 'var(--text-muted)';
                el.querySelector('.gallery-info p:nth-child(3)').textContent = 'Chưa lưu vì chưa có API';
                return;
            }

            try {
                const payload = {
                    action: 'uploadImageRow',
                    sheetName: sheetName,
                    fileName: file.name,
                    mimeType: mimeType,
                    fileData: base64Data,
                    date: today
                };

                const bodyParams = new URLSearchParams();
                bodyParams.set('contents', JSON.stringify(payload));

                const response = await fetch(CONFIG.APPS_SCRIPT_URL_HSE, {
                    method: 'POST',
                    body: bodyParams,
                    redirect: 'follow'
                });

                const result = await response.json();

                if (result.status === 'success') {
                    const el = document.getElementById(tempId);
                    el.querySelector('img').style.opacity = '1';
                    el.querySelector('img').onclick = () => window.open(result.fileUrl, '_blank');
                    el.querySelector('.gallery-info p:nth-child(2)').textContent = today;
                    el.querySelector('.gallery-info p:nth-child(2)').style.color = 'var(--text-muted)';
                    el.querySelector('.gallery-info p:nth-child(3)').textContent = '(Đã lưu thành công)';
                    el.querySelector('.gallery-info p:nth-child(3)').style.color = 'var(--primary)';
                } else {
                    throw new Error(result.message || 'Server error');
                }
            } catch (error) {
                console.error(error);
                alert('Có lỗi xảy ra khi lưu trữ: ' + error.message);
                const el = document.getElementById(tempId);
                el.querySelector('img').style.opacity = '1';
                el.querySelector('.gallery-info p:nth-child(2)').textContent = 'Lưu thất bại';
                el.querySelector('.gallery-info p:nth-child(2)').style.color = 'var(--danger)';
            }
        };
        reader.readAsDataURL(file);
    }

    async deleteImage(event, moduleId, imageUrl, btnElement) {
        event.stopPropagation();

        if (!this.checkPermission()) return;

        if (!confirm('Bạn có chắc chắn muốn xóa mục này không? (Hành động này sẽ xóa cả trên Drive và Sheet)')) return;

        const moduleDef = this.modules.find(m => m.id === moduleId);
        const sheetName = moduleDef ? moduleDef.sheetName : 'Ảnh mẫu kho';

        // Find the parent element (supports both gallery-item and reg-item)
        const cardEl = btnElement.closest('.gallery-item') || btnElement.closest('.reg-item');

        if (cardEl) {
            cardEl.style.opacity = '0.4';
            cardEl.style.pointerEvents = 'none';
        }

        try {
            const payload = {
                action: 'deleteImageRow',
                sheetName: sheetName,
                fileUrl: imageUrl
            };

            const bodyParams = new URLSearchParams();
            bodyParams.set('contents', JSON.stringify(payload));

            const response = await fetch(CONFIG.APPS_SCRIPT_URL_HSE, {
                method: 'POST',
                body: bodyParams,
                redirect: 'follow'
            });

            const result = await response.json();

            if (result.status === 'success') {
                if (cardEl) {
                    cardEl.style.transition = 'all 0.3s';
                    cardEl.style.transform = 'scale(0.8)';
                    cardEl.style.opacity = '0';
                    setTimeout(() => cardEl.remove(), 300);
                }
            } else {
                throw new Error(result.message || 'Lỗi server');
            }
        } catch (error) {
            console.error(error);
            alert('Lỗi khi xóa: ' + error.message);
            if (cardEl) {
                cardEl.style.opacity = '1';
                cardEl.style.pointerEvents = 'auto';
            }
        }
    }

    openImageLightbox(url) {
        let lightbox = document.getElementById('custom-lightbox');
        if (!lightbox) {
            lightbox = document.createElement('div');
            lightbox.id = 'custom-lightbox';
            // Style for Overlay
            lightbox.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; 
                background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(8px); 
                display: flex; align-items: center; justify-content: center; 
                z-index: 10000; opacity: 0; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
                cursor: zoom-out;
            `;

            // Close Button (X)
            const closeBtn = document.createElement('div');
            closeBtn.innerHTML = '&times;';
            closeBtn.style.cssText = `
                position: absolute; top: 20px; right: 30px; color: white; 
                font-size: 40px; font-weight: 300; cursor: pointer; 
                z-index: 10001; transition: transform 0.2s;
            `;
            closeBtn.onmouseover = () => closeBtn.style.transform = 'scale(1.2)';
            closeBtn.onmouseout = () => closeBtn.style.transform = 'scale(1)';
            lightbox.appendChild(closeBtn);

            // Image Container
            const imgContainer = document.createElement('div');
            imgContainer.style.cssText = 'position: relative; display: flex; flex-direction: column; align-items: center; gap: 1rem;';

            const img = document.createElement('img');
            img.id = 'lightbox-img';
            img.style.cssText = `
                max-width: 90vw; max-height: 85vh; object-fit: contain; 
                border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); 
                transform: scale(0.9); transition: transform 0.3s ease; border: 1px solid rgba(255,255,255,0.1);
            `;
            imgContainer.appendChild(img);

            // Download Button
            const downloadBtn = document.createElement('a');
            downloadBtn.id = 'lightbox-download';
            downloadBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px; vertical-align: middle;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Tải ảnh về';
            downloadBtn.style.cssText = `
                color: white; text-decoration: none; background: rgba(255,255,255,0.1); 
                padding: 8px 20px; border-radius: 20px; font-size: 0.9rem; 
                backdrop-filter: blur(4px); transition: 0.2s; border: 1px solid rgba(255,255,255,0.2);
            `;
            downloadBtn.onmouseover = () => downloadBtn.style.background = 'rgba(255,255,255,0.2)';
            downloadBtn.onmouseout = () => downloadBtn.style.background = 'rgba(255,255,255,0.1)';
            downloadBtn.target = "_blank";
            imgContainer.appendChild(downloadBtn);

            lightbox.appendChild(imgContainer);

            lightbox.onclick = (e) => {
                if (e.target !== downloadBtn && !downloadBtn.contains(e.target)) {
                    lightbox.style.opacity = '0';
                    img.style.transform = 'scale(0.9)';
                    setTimeout(() => { lightbox.style.display = 'none'; }, 300);
                }
            };

            document.body.appendChild(lightbox);
        }

        const imgEl = document.getElementById('lightbox-img');
        const downloadEl = document.getElementById('lightbox-download');

        let displayUrl = url;
        if (url.includes('drive.google.com/file/d/')) {
            const match = url.match(/\/d\/([-\w]{25,})/);
            if (match && match[1]) {
                displayUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1600`;
            }
        }

        imgEl.src = displayUrl;
        downloadEl.href = url;
        lightbox.style.display = 'flex';

        setTimeout(() => {
            lightbox.style.opacity = '1';
            imgEl.style.transform = 'scale(1)';
        }, 10);
    }

    openPdfLightbox(url) {
        let lightbox = document.getElementById('pdf-lightbox');
        if (!lightbox) {
            lightbox = document.createElement('div');
            lightbox.id = 'pdf-lightbox';
            lightbox.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; 
                background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(12px); 
                display: flex; align-items: center; justify-content: center; 
                z-index: 10000; opacity: 0; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            `;

            const container = document.createElement('div');
            container.style.cssText = `
                width: 90vw; height: 90vh; background: #1e293b; 
                border-radius: 16px; position: relative; overflow: hidden;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                border: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column;
            `;

            const header = document.createElement('div');
            header.style.cssText = `
                padding: 1rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.1);
                display: flex; justify-content: space-between; align-items: center;
                background: rgba(255,255,255,0.02);
            `;
            header.innerHTML = `
                <h3 style="margin: 0; font-size: 1.1rem; color: #f8fafc; font-weight: 600;">Xem tài liệu PDF</h3>
                <div style="display: flex; gap: 1rem;">
                    <a id="pdf-download-link" href="#" target="_blank" style="color: #94a3b8; text-decoration: none; font-size: 0.9rem; display: flex; align-items: center; gap: 0.5rem;">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Tải về
                    </a>
                    <button id="close-pdf-lightbox" style="background: none; border: none; color: #94a3b8; font-size: 1.5rem; cursor: pointer; line-height: 1;">&times;</button>
                </div>
            `;
            container.appendChild(header);

            const iframe = document.createElement('iframe');
            iframe.id = 'pdf-viewer-iframe';
            iframe.style.cssText = 'width: 100%; flex: 1; border: none; background: white;';
            container.appendChild(iframe);

            lightbox.appendChild(container);
            document.body.appendChild(lightbox);

            document.getElementById('close-pdf-lightbox').onclick = () => {
                lightbox.style.opacity = '0';
                setTimeout(() => { lightbox.style.display = 'none'; iframe.src = ''; }, 400);
            };

            lightbox.onclick = (e) => {
                if (e.target === lightbox) {
                    document.getElementById('close-pdf-lightbox').click();
                }
            };
        }

        const iframe = document.getElementById('pdf-viewer-iframe');
        const downloadLink = document.getElementById('pdf-download-link');

        let viewerUrl = url;
        if (url.includes('drive.google.com/file/d/')) {
            const match = url.match(/\/d\/([-\w]{25,})/);
            if (match && match[1]) {
                viewerUrl = `https://drive.google.com/file/d/${match[1]}/preview`;
            }
        } else {
            // For regular URLs, use Google Docs viewer
            viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
        }

        iframe.src = viewerUrl;
        downloadLink.href = url;
        lightbox.style.display = 'flex';
        setTimeout(() => lightbox.style.opacity = '1', 10);
    }

    renderScrapRegs(data) {
        const rows = (data && data.length > 1) ? data.slice(1) : [];

        let html = `
            <div class="scrap-regs-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <p style="color: var(--text-muted); font-size: 0.95rem; margin: 0;">Danh sách quy định phân loại phế liệu đã ban hành.</p>
                <button class="btn-more" onclick="app.triggerPdfUpload()" style="background: var(--primary); color: white; padding: 0.6rem 1.2rem; border-radius: 8px; border: none; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; transition: var(--transition);">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    Tải lên Quy định (PDF)
                </button>
            </div>
        `;

        if (rows.length === 0) {
            html += '<p style="text-align: center; color: var(--text-muted); padding: 3rem; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">Chưa có quy định nào được tải lên. Hãy sử dụng nút phía trên để bắt đầu.</p>';
        } else {
            html += `<div class="regs-list" style="display: grid; gap: 1rem;">`;
            rows.forEach((row, rowIndex) => {
                const [name, date, url, note] = row;
                const isPdf = url && (url.toLowerCase().includes('.pdf') || url.includes('drive.google.com'));

                html += `
                    <div class="glass-card reg-item" style="padding: 1.25rem; display: flex; justify-content: space-between; align-items: center; transition: var(--transition);">
                        <div class="reg-info">
                            <h4 style="margin: 0 0 0.25rem 0; font-size: 1.05rem; font-weight: 600;">${name || 'Chưa đặt tên'}</h4>
                            <div style="display: flex; gap: 1.5rem; color: var(--text-muted); font-size: 0.85rem;">
                                <span><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> ${date || '--/--/----'}</span>
                                ${note ? `<span><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> ${note}</span>` : ''}
                            </div>
                        </div>
                        <div class="reg-actions" style="display: flex; gap: 0.75rem;">
                            ${isPdf ? `
                                <button class="btn-more" onclick="app.openPdfLightbox('${url}')" style="padding: 0.5rem 1rem; font-size: 0.85rem; background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2);">
                                    Xem trực tiếp
                                </button>
                            ` : ''}
                            <button class="btn-delete-img" onclick="app.deleteImage(event, 'scrap-regs', '${url}', this)" title="Xóa" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); padding: 0.5rem; border-radius: 6px;">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                            </button>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }

        // Add hidden PDF input if not exists
        if (!document.getElementById('pdfFileInput')) {
            html += `<input type="file" id="pdfFileInput" style="display:none" accept=".pdf" onchange="app.handlePdfUpload(event)">`;
        }

        this.modalBody.innerHTML = html;

        // Add some styles for hover effects
        if (!document.getElementById('reg-item-styles')) {
            const style = document.createElement('style');
            style.id = 'reg-item-styles';
            style.textContent = `
                .reg-item:hover { background: rgba(255,255,255,0.03) !important; transform: translateY(-2px); }
            `;
            document.head.appendChild(style);
        }
    }

    triggerPdfUpload() {
        if (!this.checkPermission()) return;
        const input = document.getElementById('pdfFileInput');
        if (input) input.click();
    }

    async handlePdfUpload(event) {
        if (!this.checkPermission()) {
            event.target.value = '';
            return;
        }
        const file = event.target.files[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.pdf')) {
            alert('Vui lòng chọn file PDF.');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            const dataUrl = e.target.result;
            const base64Data = dataUrl.split(',')[1];
            const today = new Date().toLocaleDateString('vi-VN');

            // Show loading
            const loadingHtml = `
                <div class="upload-progress-overlay" style="position: absolute; inset: 0; background: rgba(0,0,0,0.7); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 100; border-radius: 12px; backdrop-filter: blur(4px);">
                    <div class="spinner"></div>
                    <p style="margin-top: 1rem; color: white; font-weight: 600;">Đang tải lên quy định PDF...</p>
                    <p style="color: rgba(255,255,255,0.6); font-size: 0.85rem;">Tài liệu: ${file.name}</p>
                </div>
            `;
            this.modalBody.style.position = 'relative';
            this.modalBody.insertAdjacentHTML('beforeend', loadingHtml);

            try {
                const payload = {
                    action: 'uploadImageRow',
                    sheetName: 'Quy định phân loại phế liệu',
                    fileName: file.name,
                    mimeType: 'application/pdf',
                    fileData: base64Data,
                    date: today,
                    folderId: CONFIG.PDF_FOLDER_ID,   // Common format
                    folderID: CONFIG.PDF_FOLDER_ID,   // Alternative format
                    folderType: 'pdf'                 // Hint format
                };

                const bodyParams = new URLSearchParams();
                bodyParams.set('contents', JSON.stringify(payload));

                const response = await fetch(CONFIG.APPS_SCRIPT_URL_HSE, {
                    method: 'POST',
                    body: bodyParams,
                    redirect: 'follow'
                });

                const result = await response.json();
                console.log('Upload result:', result);

                if (result.status === 'success') {
                    alert('Tải lên quy định PDF thành công!');
                    await this.openDetail('scrap-regs');
                } else {
                    throw new Error(result.message || 'Lỗi server');
                }
            } catch (err) {
                console.error('Upload error:', err);
                alert('Lỗi tải lên: ' + err.message);
                const overlay = this.modalBody.querySelector('.upload-progress-overlay');
                if (overlay) overlay.remove();
            } finally {
                event.target.value = '';
            }
        };
        reader.readAsDataURL(file);
    }

    // --- Table Cell Upload Handlers ---

    triggerCellUpload(row, column) {
        if (!this.checkPermission()) return;
        const input = document.getElementById('cellFileInput');
        if (input) {
            input.dataset.row = row;
            input.dataset.column = column;
            input.click();
        }
    }

    async handleTableCellUpload(event) {
        if (!this.checkPermission()) {
            event.target.value = '';
            return;
        }
        const input = event.target;
        const file = input.files[0];
        const row = input.dataset.row;
        const column = input.dataset.column;

        if (!file || !row || !column) return;

        // Show generic loading in the modal
        const originalContent = this.modalBody.innerHTML;
        const loadingHtml = `
            <div class="upload-progress-overlay" style="position: absolute; inset: 0; background: rgba(0,0,0,0.7); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 100; border-radius: 8px;">
                <div class="spinner"></div>
                <p style="margin-top: 1rem; color: white;">Đang tải lên và cập nhật dòng ${row}, cột ${column}...</p>
            </div>
        `;
        this.modalBody.style.position = 'relative';
        this.modalBody.insertAdjacentHTML('beforeend', loadingHtml);

        const reader = new FileReader();
        reader.onload = async (e) => {
            const dataUrl = e.target.result;
            const base64Data = dataUrl.split(',')[1];
            const mimeType = file.type;

            const moduleDef = this.modules.find(m => m.id === this.currentModuleId);
            const sheetName = moduleDef ? moduleDef.sheetName : 'Khắc phục 5S';

            try {
                const payload = {
                    action: 'updateImageCell',
                    sheetName: sheetName,
                    row: parseInt(row),
                    column: column,
                    fileName: file.name,
                    mimeType: mimeType,
                    fileData: base64Data
                };

                const bodyParams = new URLSearchParams();
                bodyParams.set('contents', JSON.stringify(payload));

                const response = await fetch(CONFIG.APPS_SCRIPT_URL_HSE, {
                    method: 'POST',
                    body: bodyParams,
                    redirect: 'follow'
                });

                const result = await response.json();

                if (result.status === 'success') {
                    // Success! Reload data to show updated image
                    alert('Cập nhật hình ảnh thành công!');
                    await this.openDetail(this.currentModuleId);
                } else {
                    throw new Error(result.message || 'Lỗi server');
                }
            } catch (err) {
                console.error(err);
                alert('Lỗi tải lên: ' + err.message);
                // Remove overlay
                const overlay = this.modalBody.querySelector('.upload-progress-overlay');
                if (overlay) overlay.remove();
            } finally {
                input.value = ''; // Reset input
            }
        };
        reader.readAsDataURL(file);
    }

    async deleteTableCellImage(row, column, url) {
        if (!this.checkPermission()) return;
        if (!confirm(`Bạn có chắc muốn xóa ảnh này ở dòng ${row}, cột ${column}?`)) return;

        // Show generic loading in the modal
        const loadingHtml = `
            <div class="upload-progress-overlay" style="position: absolute; inset: 0; background: rgba(0,0,0,0.7); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 100; border-radius: 8px;">
                <div class="spinner"></div>
                <p style="margin-top: 1rem; color: white;">Đang xóa ảnh dòng ${row}, cột ${column}...</p>
            </div>
        `;
        this.modalBody.style.position = 'relative';
        this.modalBody.insertAdjacentHTML('beforeend', loadingHtml);

        try {
            const moduleDef = this.modules.find(m => m.id === this.currentModuleId);
            const sheetName = moduleDef ? moduleDef.sheetName : 'Khắc phục 5S';

            const payload = {
                action: 'deleteImageCell',
                sheetName: sheetName,
                row: parseInt(row),
                column: column,
                fileUrl: url
            };

            const bodyParams = new URLSearchParams();
            bodyParams.set('contents', JSON.stringify(payload));

            const response = await fetch(CONFIG.APPS_SCRIPT_URL_HSE, {
                method: 'POST',
                body: bodyParams,
                redirect: 'follow'
            });

            const result = await response.json();

            if (result.status === 'success') {
                alert('Đã xóa hình ảnh thành công!');
                await this.openDetail(this.currentModuleId);
            } else {
                throw new Error(result.message || 'Lỗi server');
            }
        } catch (err) {
            console.error(err);
            alert('Lỗi khi xóa: ' + err.message);
            const overlay = this.modalBody.querySelector('.upload-progress-overlay');
            if (overlay) overlay.remove();
        }
    }
}

// Start Application
const app = new DashboardManager();
