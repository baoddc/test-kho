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
    R2_WORKER_URL: 'https://hse-r2-api.thaibao06061997.workers.dev/', // <--- ĐIỀN URL CLOUDFLARE WORKER TẠI ĐÂY (VD: https://hse-r2-api.<subdomain>.workers.dev)
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
        category: 'plan',
        categoryName: 'Kế hoạch & Lịch',
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
        category: 'media',
        categoryName: 'Hình ảnh & 5S',
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
        category: 'plan',
        categoryName: 'Kế hoạch & Lịch',
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
        category: 'media',
        categoryName: 'Hình ảnh & 5S',
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
        category: 'plan',
        categoryName: 'Kế hoạch & Lịch',
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
        category: 'tools',
        categoryName: 'CCDC & Tiêu chuẩn',
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
        category: 'tools',
        categoryName: 'CCDC & Tiêu chuẩn',
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
        category: 'tools',
        categoryName: 'CCDC & Tiêu chuẩn',
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
        category: 'tools',
        categoryName: 'CCDC & Tiêu chuẩn',
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
        category: 'fix',
        categoryName: 'Khắc phục 5S',
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
        category: 'media',
        categoryName: 'Hình ảnh & 5S',
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
        this.hubView = document.getElementById('hubView');
        this.workspaceView = document.getElementById('workspaceView');
        this.workspaceTitle = document.getElementById('workspaceTitle');
        this.workspaceBreadcrumb = document.getElementById('workspaceBreadcrumb');
        this.workspaceActions = document.getElementById('workspaceActions');
        this.workspaceBody = document.getElementById('workspaceBody');
        this.btnBackHub = document.getElementById('btnBackHub');
        this.categoryTabs = document.getElementById('categoryTabs');

        this.grid = document.getElementById('moduleGrid');
        this.searchField = document.getElementById('globalSearch');
        this.overlay = document.getElementById('loadingOverlay');
        this.modal = document.getElementById('detailModal');
        this.modalBody = this.workspaceBody || document.getElementById('modalBody');
        this.modalTitle = document.getElementById('modalTitle');

        this.modules = HSE_MODULES;
        this.activeCategory = 'all';
        this.currentGalleryImages = [];
        this.currentImageIndex = -1;
        this.init();
    }

    init() {
        this.updateCategoryCounts();
        this.renderModules(this.modules);
        this.setupEventListeners();
        this.checkAuth();
    }

    updateCategoryCounts() {
        const counts = {
            all: this.modules.length,
            plan: this.modules.filter(m => m.category === 'plan').length,
            media: this.modules.filter(m => m.category === 'media').length,
            tools: this.modules.filter(m => m.category === 'tools').length,
            fix: this.modules.filter(m => m.category === 'fix').length
        };
        const elAll = document.getElementById('countAll');
        if (elAll) elAll.textContent = counts.all;
        const elPlan = document.getElementById('countPlan');
        if (elPlan) elPlan.textContent = counts.plan;
        const elMedia = document.getElementById('countMedia');
        if (elMedia) elMedia.textContent = counts.media;
        const elTools = document.getElementById('countTools');
        if (elTools) elTools.textContent = counts.tools;
        const elFix = document.getElementById('countFix');
        if (elFix) elFix.textContent = counts.fix;
    }

    switchView(viewName) {
        if (viewName === 'workspace') {
            if (this.hubView) this.hubView.style.display = 'none';
            if (this.workspaceView) {
                this.workspaceView.style.display = 'block';
                this.workspaceView.classList.add('active');
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            if (this.workspaceView) this.workspaceView.style.display = 'none';
            if (this.hubView) {
                this.hubView.style.display = 'block';
                this.hubView.classList.add('active');
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
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
        const loading = this.overlay;
        this.grid.innerHTML = '';
        if (loading) this.grid.appendChild(loading);
        if (this.overlay) this.overlay.style.display = 'none';

        if (modulesToRender.length === 0) {
            const query = this.searchField ? this.searchField.value : '';
            this.grid.innerHTML += `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">Không tìm thấy chức năng nào phù hợp${query ? ` với từ khóa "${query}"` : ''}</p>`;
            return;
        }

        modulesToRender.forEach(module => {
            const card = document.createElement('div');
            card.className = 'glass-card';
            card.style.cursor = 'pointer';
            card.onclick = () => this.openWorkspace(module.id);
            card.innerHTML = `
                <div class="card-top">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                        <div class="card-icon ${module.colorClass}">
                            ${ICONS[module.icon] || ICONS.clipboard}
                        </div>
                        <span class="card-category-tag">${module.categoryName || ''}</span>
                    </div>
                    <div class="card-header">
                        <h3>${module.title}</h3>
                        <p class="card-desc">${module.desc}</p>
                    </div>
                </div>
                <div class="card-footer">
                    <span class="status-badge badge-live">Hoạt động</span>
                    <button class="btn-more">
                        Mở làm việc
                        ${ICONS['arrow-right']}
                    </button>
                </div>
            `;
            this.grid.appendChild(card);
        });
    }

    setupEventListeners() {
        // Global Search
        if (this.searchField) {
            this.searchField.addEventListener('input', () => this.filterModules());
        }

        // Category Tabs
        if (this.categoryTabs) {
            const pills = this.categoryTabs.querySelectorAll('.tab-pill');
            pills.forEach(pill => {
                pill.addEventListener('click', () => {
                    pills.forEach(p => p.classList.remove('active'));
                    pill.classList.add('active');
                    this.activeCategory = pill.dataset.category || 'all';
                    this.filterModules();
                });
            });
        }

        // Back button to Hub
        if (this.btnBackHub) {
            this.btnBackHub.addEventListener('click', () => {
                this.switchView('hub');
            });
        }

        // Close Modal if detailModal exists
        const btnCloseModal = document.getElementById('closeModal');
        if (btnCloseModal) {
            btnCloseModal.onclick = () => this.closeModal();
        }
        window.onclick = (e) => {
            if (this.modal && e.target === this.modal) this.closeModal();
        };

        // Keyboard navigation (ESC to close, ArrowLeft/Right to switch images)
        document.addEventListener('keydown', (e) => {
            const customLightbox = document.getElementById('custom-lightbox');
            const isLightboxOpen = customLightbox && customLightbox.style.display === 'flex';

            if (isLightboxOpen) {
                if (e.key === 'ArrowLeft') {
                    this.lightboxNavigate(-1);
                    return;
                } else if (e.key === 'ArrowRight') {
                    this.lightboxNavigate(1);
                    return;
                } else if (e.key === 'Escape') {
                    this.closeImageLightbox();
                    return;
                }
            }

            const pdfLightbox = document.getElementById('pdf-lightbox');
            const isPdfLightboxOpen = pdfLightbox && pdfLightbox.style.display === 'flex';
            if (isPdfLightboxOpen && e.key === 'Escape') {
                const closePdfBtn = document.getElementById('close-pdf-lightbox');
                if (closePdfBtn) closePdfBtn.click();
                return;
            }

            if (e.key === 'Escape') {
                if (this.modal && this.modal.classList.contains('active')) {
                    this.closeModal();
                } else if (this.workspaceView && this.workspaceView.style.display !== 'none') {
                    this.switchView('hub');
                }
            }
        });
    }

    filterModules() {
        const query = (this.searchField ? this.searchField.value : '').toLowerCase().trim();
        const filtered = this.modules.filter(m => {
            const matchCategory = this.activeCategory === 'all' || m.category === this.activeCategory;
            const matchQuery = !query ||
                m.title.toLowerCase().includes(query) ||
                m.desc.toLowerCase().includes(query) ||
                (m.keywords && m.keywords.some(k => k.includes(query)));
            return matchCategory && matchQuery;
        });
        this.renderModules(filtered);
    }

    async openWorkspace(moduleId) {
        const module = this.modules.find(m => m.id === moduleId);
        if (!module) return;

        this.currentModuleId = moduleId;
        if (this.workspaceTitle) this.workspaceTitle.textContent = module.title;
        if (this.workspaceBreadcrumb) this.workspaceBreadcrumb.textContent = `HSE / ${module.categoryName || 'Chức năng'} / ${module.title}`;
        if (this.workspaceActions) this.workspaceActions.innerHTML = '';

        if (this.workspaceBody) {
            this.workspaceBody.innerHTML = '<div class="spinner" style="margin: 4rem auto;"></div>';
        }
        this.switchView('workspace');

        try {
            const data = await GSheetsService.fetchSheetData(module.sheetId, module.id);
            this.renderModalContent(moduleId, data);
        } catch (err) {
            if (this.workspaceBody) {
                this.workspaceBody.innerHTML = `<p class="error-msg" style="color: var(--danger); text-align: center; padding: 2rem;">Lỗi tải dữ liệu: ${err.message}</p>`;
            }
        }
    }

    openDetail(moduleId) {
        return this.openWorkspace(moduleId);
    }

    closeModal() {
        if (this.modal) this.modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }

    renderModalContent(moduleId, data) {
        if (moduleId === 'wh-photos' || moduleId === 'clean-photos') {
            this.renderGallery(data, moduleId);
        } else if (moduleId === '5s-race') {
            this.renderRaceLeaderboard(data);
        } else if (moduleId === 'tools-inventory') {
            this.renderToolsInventory(data);
        } else if (moduleId === 'disposal-standards') {
            this.renderDisposalStandards(data);
        } else if (moduleId === 'scrap-categories') {
            this.renderScrapCategories(data);
        } else if (moduleId === 'scrap-regs') {
            this.renderScrapRegs(data);
        } else if (moduleId === 'job-plan' || moduleId === 'clean-schedule') {
            this.renderModuleByMonthGroups(data, moduleId);
        } else if (moduleId === 'equipment-checklist') {
            this.renderEquipmentChecklist(data);
        } else {
            if (!data || data.length === 0) {
                this.modalBody.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 3rem;">Không có dữ liệu hiển thị.</p>';
                return;
            }
            this.renderTable(data);
        }
    }

    // ==========================================================================
    // SCRAP CATEGORIES METHODS (DANH MỤC PHẾ LIỆU MÃ MÀU)
    // ==========================================================================

    renderScrapCategories(data) {
        if (!data || data.length === 0) {
            this.modalBody.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 3rem;">Không có dữ liệu danh mục phế liệu.</p>';
            return;
        }

        const headers = data[0] || [];
        const rows = data.slice(1);

        const nameIdx = headers.findIndex(h => /tên|phế liệu|loại|chất thải/i.test(h || ''));
        const codeIdx = headers.findIndex(h => /mã|code|id/i.test(h || ''));
        const groupIdx = headers.findIndex(h => /nhóm|phân loại|màu/i.test(h || ''));
        const guideIdx = headers.findIndex(h => /hướng dẫn|thu gom|vị trí|lưu trữ|quy cách/i.test(h || ''));

        // Organize into 4 color buckets
        const groups = {
            yellow: {
                title: 'Phế Liệu Kim Loại & Sản Xuất',
                colorCode: 'Thùng Vàng 🟡',
                colorHex: '#f59e0b',
                cssClass: 'scrap-yellow',
                items: []
            },
            blue: {
                title: 'Chất Thải Tái Chế Thông Thường',
                colorCode: 'Thùng Xanh Dương 🔵',
                colorHex: '#3b82f6',
                cssClass: 'scrap-blue',
                items: []
            },
            red: {
                title: 'Chất Thải Nguy Hại (Hazardous)',
                colorCode: 'Thùng Đỏ Cảnh Báo 🔴',
                colorHex: '#ef4444',
                cssClass: 'scrap-red',
                items: []
            },
            gray: {
                title: 'Rác Thải Sinh Hoạt & Khác',
                colorCode: 'Thùng Xám / Đen ⚫',
                colorHex: '#94a3b8',
                cssClass: 'scrap-gray',
                items: []
            }
        };

        if (nameIdx !== -1) {
            rows.forEach((r, idx) => {
                const name = r[nameIdx];
                if (!name) return;
                const code = codeIdx !== -1 ? (r[codeIdx] || `PL-${String(idx + 1).padStart(2, '0')}`) : `PL-${String(idx + 1).padStart(2, '0')}`;
                const groupText = groupIdx !== -1 ? (r[groupIdx] || '') : '';
                const guide = guideIdx !== -1 ? (r[guideIdx] || '') : '';

                const combined = (name + ' ' + groupText).toLowerCase();
                if (/nguy hại|dầu|sơn|pin|ắc quy|hóa chất|mỡ|giẻ dính|độc/i.test(combined)) {
                    groups.red.items.push({ name, code, guide });
                } else if (/kim loại|sắt|thép|nhôm|đồng|que hàn|bavia|phôi|hàn|tôn/i.test(combined)) {
                    groups.yellow.items.push({ name, code, guide });
                } else if (/carton|giấy|nhựa|bao bì|gỗ|pallet|chai|tái chế/i.test(combined)) {
                    groups.blue.items.push({ name, code, guide });
                } else {
                    groups.gray.items.push({ name, code, guide });
                }
            });
        }

        // Baseline items if empty
        if (groups.yellow.items.length === 0) {
            groups.yellow.items = [
                { code: 'PL-KL-01', name: 'Đầu mẩu que hàn & xỉ hàn', guide: 'Thu gom vào xô sắt chuyên dụng' },
                { code: 'PL-KL-02', name: 'Thép hình vụn & phôi mạt cắt', guide: 'Gom về bãi tập kết phế liệu kim loại' },
                { code: 'PL-KL-03', name: 'Bavia tôn & đầu cọc sắt thừa', guide: 'Đóng thùng phuy có dán nhãn kim loại' }
            ];
        }
        if (groups.blue.items.length === 0) {
            groups.blue.items = [
                { code: 'PL-TC-01', name: 'Thùng giấy carton & bìa bọc hàng', guide: 'Gấp phẳng và buộc thành kiện' },
                { code: 'PL-TC-02', name: 'Pallet gỗ hỏng / thanh nẹp gỗ', guide: 'Xếp ngay ngắn tại kho chứa bao bì' },
                { code: 'PL-TC-03', name: 'Màng quấn pe & dây đai nhựa bọc hàng', guide: 'Thu gom vào túi bao tải dứa' }
            ];
        }
        if (groups.red.items.length === 0) {
            groups.red.items = [
                { code: 'CTNH-01', name: 'Giẻ lau & găng tay dính dầu nhớt', guide: 'Thùng kín chống rò rỉ, nắp đậy chặt' },
                { code: 'CTNH-02', name: 'Vỏ thùng sơn, dung môi, keo dán', guide: 'Để khu vực có mái che và gờ chống tràn' },
                { code: 'CTNH-03', name: 'Pin, ắc quy hỏng & bóng đèn huỳnh quang', guide: 'Lưu trữ thùng nhựa riêng biệt có nhãn CTNH' }
            ];
        }
        if (groups.gray.items.length === 0) {
            groups.gray.items = [
                { code: 'RTSH-01', name: 'Rác thải sinh hoạt văn phòng & hộp xốp', guide: 'Túi rác tự phân hủy, dọn cuối ngày' },
                { code: 'RTSH-02', name: 'Bụi quét nền & rác vô cơ không tái chế', guide: 'Đưa vào xe gom rác thải công cộng' }
            ];
        }

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
                <div>
                    <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-main); margin: 0 0 0.25rem 0;">Bảng Màu Nhận Diện & Phân Loại Phế Liệu Tại Nguồn</h3>
                    <p style="color: var(--text-muted); font-size: 0.85rem; margin: 0;">Quy chuẩn màu thùng chứa rác thải áp dụng đồng bộ toàn nhà xưởng & văn phòng DDC.</p>
                </div>
                <button class="btn-more" onclick="app.openWorkspace('scrap-regs')" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 0.55rem 1.1rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    <span>Xem Văn Bản Quy Định (PDF)</span>
                </button>
            </div>

            <!-- Scrap 4-color Matrix -->
            <div class="scrap-matrix-grid">
        `;

        Object.keys(groups).forEach(key => {
            const g = groups[key];
            html += `
                <div class="scrap-group-card ${g.cssClass}">
                    <div class="scrap-head">
                        <div class="scrap-dot" style="background: ${g.colorHex}; color: ${g.colorHex};"></div>
                        <div>
                            <div style="font-size: 0.78rem; font-weight: 700; color: ${g.colorHex}; text-transform: uppercase;">${g.colorCode}</div>
                            <h4 style="margin: 0; font-size: 1.05rem; font-weight: 700; color: var(--text-main);">${g.title}</h4>
                        </div>
                    </div>

                    <div class="scrap-list-wrap">
            `;

            g.items.forEach(it => {
                html += `
                    <div class="scrap-item-row">
                        <div>
                            <div style="font-weight: 600; color: var(--text-main);">${it.name}</div>
                            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">${it.guide}</div>
                        </div>
                        <span class="tool-code-badge" style="background: rgba(255,255,255,0.06); color: var(--text-muted); border-color: rgba(255,255,255,0.1);">${it.code}</span>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        this.modalBody.innerHTML = html;
    }


    // ==========================================================================
    // TOOLS & INVENTORY METHODS (CCDC)
    // ==========================================================================

    renderToolsInventory(data) {
        if (!data || data.length === 0) {
            this.modalBody.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 3rem;">Không có dữ liệu CCDC.</p>';
            return;
        }

        this.toolsRawData = data;
        const headers = data[0] || [];
        const rows = data.slice(1);

        const nameIdx = headers.findIndex(h => /tên|dụng cụ|thiết bị|công cụ/i.test(h || ''));
        const codeIdx = headers.findIndex(h => /mã|code|id/i.test(h || ''));
        const groupIdx = headers.findIndex(h => /nhóm|loại|chủng loại|danh mục/i.test(h || ''));
        const qtyIdx = headers.findIndex(h => /số lượng|sl|tồn/i.test(h || ''));
        const statusIdx = headers.findIndex(h => /tình trạng|trạng thái/i.test(h || ''));
        const locIdx = headers.findIndex(h => /vị trí|kho|kệ|khu vực/i.test(h || ''));

        // If no recognizable columns, fallback to default table
        if (nameIdx === -1) {
            this.renderTable(data);
            return;
        }

        const items = rows.map((r, idx) => {
            const name = r[nameIdx] || `Công cụ ${idx + 1}`;
            const code = codeIdx !== -1 ? (r[codeIdx] || `CCDC-${String(idx + 1).padStart(3, '0')}`) : `CCDC-${String(idx + 1).padStart(3, '0')}`;
            const group = groupIdx !== -1 ? (r[groupIdx] || 'Chung') : 'Chung';
            const qty = qtyIdx !== -1 ? (parseInt(r[qtyIdx]) || 1) : 1;
            const status = statusIdx !== -1 ? (r[statusIdx] || 'Tốt') : 'Tốt';
            const loc = locIdx !== -1 ? (r[locIdx] || 'Kho CCDC') : 'Kho CCDC';
            return { name, code, group, qty, status, loc, raw: r };
        });

        this.toolsItems = items;
        this.currentToolGroup = 'all';
        this.currentToolStatus = 'all';
        this.currentToolView = this.currentToolView || 'card';

        this.renderToolsView();
    }

    renderToolsView() {
        const allItems = this.toolsItems || [];
        const activeGroup = this.currentToolGroup || 'all';
        const activeStatus = this.currentToolStatus || 'all';
        const viewMode = this.currentToolView || 'card';

        // Extract distinct groups
        const groups = Array.from(new Set(allItems.map(it => it.group).filter(Boolean)));

        // Filter items
        let filtered = allItems.filter(it => {
            const matchGroup = activeGroup === 'all' || it.group === activeGroup;
            let matchStatus = true;
            if (activeStatus === 'good') matchStatus = /tốt|đạt|hoạt động|sẵn sàng/i.test(it.status);
            else if (activeStatus === 'repair') matchStatus = /bảo dưỡng|sửa|hỏng|lỗi/i.test(it.status);
            else if (activeStatus === 'scrap') matchStatus = /loại bỏ|thanh lý|hủy/i.test(it.status);
            return matchGroup && matchStatus;
        });

        // Compute KPIs
        const totalItems = allItems.length;
        const totalQty = allItems.reduce((acc, it) => acc + it.qty, 0);
        const goodCount = allItems.filter(it => /tốt|đạt|hoạt động|sẵn sàng/i.test(it.status)).length;
        const repairCount = allItems.filter(it => /bảo dưỡng|sửa|hỏng|lỗi/i.test(it.status)).length;
        const safeRate = totalItems > 0 ? Math.round((goodCount / totalItems) * 100) : 100;

        let html = `
            <!-- KPI Summary Cards -->
            <div class="chk-kpi-grid">
                <div class="chk-kpi-card">
                    <div class="chk-kpi-icon icon-blue">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
                    </div>
                    <div>
                        <div class="chk-kpi-val">${totalItems} <span style="font-size: 0.9rem; font-weight: 500; color: var(--text-muted);">loại (${totalQty} cái)</span></div>
                        <div class="chk-kpi-label">Tổng chủng loại CCDC</div>
                    </div>
                </div>
                <div class="chk-kpi-card">
                    <div class="chk-kpi-icon icon-green">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                    </div>
                    <div>
                        <div class="chk-kpi-val">${safeRate}%</div>
                        <div class="chk-kpi-label">Tỷ lệ sẵn sàng sử dụng</div>
                    </div>
                </div>
                <div class="chk-kpi-card">
                    <div class="chk-kpi-icon icon-amber">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    </div>
                    <div>
                        <div class="chk-kpi-val">${repairCount}</div>
                        <div class="chk-kpi-label">Cần bảo dưỡng / Sửa chữa</div>
                    </div>
                </div>
            </div>

            <!-- Toolbar: Filter & View Mode Toggle -->
            <div class="tools-toolbar">
                <div class="tools-filter-group">
                    <button class="tool-filter-btn ${activeGroup === 'all' ? 'active' : ''}" onclick="app.setToolFilter('all', '${activeStatus}')">Tất cả nhóm</button>
                    ${groups.map(g => `
                        <button class="tool-filter-btn ${activeGroup === g ? 'active' : ''}" onclick="app.setToolFilter('${g}', '${activeStatus}')">${g}</button>
                    `).join('')}
                </div>

                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div class="view-mode-toggle">
                        <button class="view-btn ${viewMode === 'card' ? 'active' : ''}" onclick="app.setToolViewMode('card')" title="Xem dạng thẻ">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                        </button>
                        <button class="view-btn ${viewMode === 'table' ? 'active' : ''}" onclick="app.setToolViewMode('table')" title="Xem dạng bảng">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Search bar -->
            <div class="workspace-search-wrap">
                <input type="text" id="toolsSearchInput" class="workspace-search-input" placeholder="🔍 Tìm kiếm tên công cụ, mã CCDC, vị trí...">
                <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500;">
                    Hiển thị: <strong style="color: var(--primary);" id="toolsCountDisplay">${filtered.length}</strong> CCDC
                </div>
            </div>
        `;

        if (viewMode === 'card') {
            html += `<div class="tools-card-grid" id="toolsContainer">`;
            filtered.forEach(it => {
                let badgeClass = 'badge-chk-pass';
                if (/bảo dưỡng|sửa/i.test(it.status)) badgeClass = 'status-badge badge-warning';
                else if (/hỏng|loại bỏ|thanh lý/i.test(it.status)) badgeClass = 'status-badge badge-danger';

                html += `
                    <div class="tool-item-card" data-name="${it.name.toLowerCase()}" data-code="${it.code.toLowerCase()}" data-loc="${it.loc.toLowerCase()}">
                        <div>
                            <div class="tool-card-head">
                                <span class="tool-code-badge">${it.code}</span>
                                <span class="${badgeClass}">${it.status}</span>
                            </div>
                            <h4 class="tool-card-title">${it.name}</h4>
                            <div style="font-size: 0.8rem; color: var(--primary); margin-top: 0.25rem; font-weight: 500;">Nhóm: ${it.group}</div>
                        </div>

                        <div style="margin-top: 1.25rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.06);">
                            <div class="tool-meta-row">
                                <span>Số lượng tồn kho:</span>
                                <strong style="color: var(--text-main); font-size: 0.95rem;">${it.qty}</strong>
                            </div>
                            <div class="tool-meta-row">
                                <span>Vị trí lưu trữ:</span>
                                <span style="color: var(--text-muted);">${it.loc}</span>
                            </div>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        } else {
            html += `
                <div class="table-responsive">
                    <table class="hse-table" id="toolsTable">
                        <thead>
                            <tr>
                                <th style="width: 130px;">Mã CCDC</th>
                                <th style="min-width: 200px;">Tên công cụ dụng cụ</th>
                                <th style="min-width: 140px;">Nhóm</th>
                                <th style="width: 100px; text-align: center;">Số lượng</th>
                                <th style="width: 130px; text-align: center;">Tình trạng</th>
                                <th style="min-width: 150px;">Vị trí lưu kho</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            filtered.forEach(it => {
                let badgeClass = 'badge-chk-pass';
                if (/bảo dưỡng|sửa/i.test(it.status)) badgeClass = 'status-badge badge-warning';
                else if (/hỏng|loại bỏ|thanh lý/i.test(it.status)) badgeClass = 'status-badge badge-danger';

                html += `
                    <tr>
                        <td style="font-weight: 700; color: #60a5fa;">${it.code}</td>
                        <td style="font-weight: 600;">${it.name}</td>
                        <td style="color: var(--text-muted);">${it.group}</td>
                        <td style="text-align: center; font-weight: 700; color: var(--text-main);">${it.qty}</td>
                        <td style="text-align: center;"><span class="${badgeClass}">${it.status}</span></td>
                        <td style="color: var(--text-muted);">${it.loc}</td>
                    </tr>
                `;
            });
            html += `
                        </tbody>
                    </table>
                </div>
            `;
        }

        this.modalBody.innerHTML = html;

        // Attach search
        const sInput = document.getElementById('toolsSearchInput');
        if (sInput) {
            sInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase().trim();
                if (viewMode === 'card') {
                    const cards = document.querySelectorAll('#toolsContainer .tool-item-card');
                    let count = 0;
                    cards.forEach(card => {
                        const match = card.dataset.name.includes(term) || card.dataset.code.includes(term) || card.dataset.loc.includes(term);
                        card.style.display = match ? '' : 'none';
                        if (match) count++;
                    });
                    const cDisplay = document.getElementById('toolsCountDisplay');
                    if (cDisplay) cDisplay.textContent = count;
                } else {
                    const trs = document.querySelectorAll('#toolsTable tbody tr');
                    let count = 0;
                    trs.forEach(tr => {
                        const match = tr.textContent.toLowerCase().includes(term);
                        tr.style.display = match ? '' : 'none';
                        if (match) count++;
                    });
                    const cDisplay = document.getElementById('toolsCountDisplay');
                    if (cDisplay) cDisplay.textContent = count;
                }
            });
        }
    }

    setToolFilter(group, status) {
        this.currentToolGroup = group;
        this.currentToolStatus = status;
        this.renderToolsView();
    }

    setToolViewMode(mode) {
        this.currentToolView = mode;
        this.renderToolsView();
    }

    // ==========================================================================
    // DISPOSAL STANDARDS METHODS (TIÊU CHUẨN LOẠI BỎ CCDC)
    // ==========================================================================

    renderDisposalStandards(data) {
        if (!data || data.length === 0) {
            this.modalBody.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 3rem;">Không có dữ liệu tiêu chuẩn loại bỏ.</p>';
            return;
        }

        const headers = data[0] || [];
        const rows = data.slice(1);

        const nameIdx = headers.findIndex(h => /tên|dụng cụ|thiết bị|công cụ|chủng loại/i.test(h || ''));
        const rejectIdx = headers.findIndex(h => /loại bỏ|hư hỏng|không đạt|dấu hiệu/i.test(h || ''));
        const warnIdx = headers.findIndex(h => /cảnh báo|kiểm tra|kiểm định/i.test(h || ''));
        const actionIdx = headers.findIndex(h => /hướng dẫn|xử lý|thanh lý|quy trình/i.test(h || ''));

        let items = [];
        if (nameIdx !== -1) {
            rows.forEach((r, idx) => {
                const name = r[nameIdx];
                if (!name) return;
                const rejectCriterion = rejectIdx !== -1 ? r[rejectIdx] : (r[1] || 'Có dấu hiệu nứt gãy, biến dạng vượt mức an toàn.');
                const warnCriterion = warnIdx !== -1 ? r[warnIdx] : (r[2] || 'Hao mòn bề mặt > 10%, cần đo kiểm định kỳ.');
                const processAction = actionIdx !== -1 ? r[actionIdx] : (r[3] || 'Ngưng sử dụng ngay, dán nhãn HỎNG và bàn giao về kho CCDC.');
                items.push({ name, rejectCriterion, warnCriterion, processAction });
            });
        }

        if (items.length === 0) {
            // Default standards baseline
            items = [
                {
                    name: 'Dây bẹ cẩu hàng (Polyester Slings)',
                    rejectCriterion: 'Rách viền biên > 10% chiều rộng, đứt sợi chỉ may chịu lực, cháy xém do nhiệt hoặc hóa chất ăn mòn.',
                    warnCriterion: 'Bám nhiều dầu mỡ mạt sắt, bạc màu nhãn tải trọng SWL.',
                    processAction: 'Cắt đứt đôi dây bẹ để tránh tái sử dụng nhầm lẫn, chuyển kho phế liệu.'
                },
                {
                    name: 'Dây xích cẩu & Khóa nối (Chains & Shackles)',
                    rejectCriterion: 'Mắt xích bị giãn dài > 5%, mòn quá 10% đường kính danh nghĩa, nứt chân ren móc cẩu hoặc cong vênh.',
                    warnCriterion: 'Gỉ sét bề mặt, chốt khóa lỏng ren nhẹ.',
                    processAction: 'Đánh dấu sơn đỏ, lập biên bản thanh lý thiết bị nâng hạ.'
                },
                {
                    name: 'Máy mài / Máy cắt cầm tay',
                    rejectCriterion: 'Vỏ máy nứt vỡ hở điện, mất ốp chắn bảo vệ đá mài (Safety Guard), công tắc kẹt không tự ngắt.',
                    warnCriterion: 'Dây nguồn bị sờn vỏ cao su ngoài, chổi than đánh lửa mạnh.',
                    processAction: 'Bàn giao tổ cơ điện sửa chữa hoặc tiêu hủy nếu cuộn dây bị cháy.'
                },
                {
                    name: 'Dây đai an toàn toàn thân (Full Body Harness)',
                    rejectCriterion: 'Dây đã từng chịu tải trọng rơi ngã, khóa móc kim loại bị nứt/biến dạng/không tự khóa lò xo.',
                    warnCriterion: 'Dây bị bẩn, quá hạn kiểm định 12 tháng.',
                    processAction: 'Cắt bỏ toàn bộ dây đai, tiêu hủy ngay lập tức.'
                }
            ];
        }

        let html = `
            <div style="margin-bottom: 1.5rem;">
                <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.25rem;">Sổ Tay Tiêu Chuẩn Loại Bỏ & Thanh Lý CCDC</h3>
                <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0;">Hướng dẫn nhận diện các dấu hiệu hư hỏng bắt buộc phải ngưng sử dụng và thu hồi để đảm bảo an toàn lao động tuyệt đối.</p>
            </div>

            <div class="workspace-search-wrap">
                <input type="text" id="disposalSearchInput" class="workspace-search-input" placeholder="🔍 Tra cứu tiêu chuẩn theo tên CCDC hoặc dấu hiệu...">
                <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500;">
                    Tổng cộng: <strong style="color: var(--primary);">${items.length}</strong> quy chuẩn thiết bị
                </div>
            </div>

            <div class="disposal-grid" id="disposalContainer">
        `;

        items.forEach(it => {
            html += `
                <div class="disposal-card" data-name="${it.name.toLowerCase()} ${it.rejectCriterion.toLowerCase()}">
                    <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.75rem;">
                        <span style="font-size: 1.4rem;">🛑</span>
                        <h4 style="margin: 0; font-size: 1.05rem; font-weight: 700; color: var(--text-main);">${it.name}</h4>
                    </div>

                    <div class="criterion-box criterion-danger">
                        <div style="font-weight: 700; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.35rem;">
                            <span>❌ DẤU HIỆU LOẠI BỎ NGAY (CẤM DÙNG):</span>
                        </div>
                        <div>${it.rejectCriterion}</div>
                    </div>

                    <div class="criterion-box criterion-warning">
                        <div style="font-weight: 700; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.35rem;">
                            <span>⚠️ DẤU HIỆU CẦN KIỂM ĐỊNH LẠI:</span>
                        </div>
                        <div>${it.warnCriterion}</div>
                    </div>

                    <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.06); font-size: 0.82rem; color: var(--text-muted);">
                        <strong style="color: var(--primary);">📋 Hướng dẫn xử lý:</strong> ${it.processAction}
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        this.modalBody.innerHTML = html;

        // Quick search
        const sInput = document.getElementById('disposalSearchInput');
        if (sInput) {
            sInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase().trim();
                const cards = document.querySelectorAll('#disposalContainer .disposal-card');
                cards.forEach(c => {
                    c.style.display = c.dataset.name.includes(term) ? '' : 'none';
                });
            });
        }
    }


    // ==========================================================================
    // 5S RACE & LEADERBOARD METHODS
    // ==========================================================================

    renderRaceLeaderboard(data) {
        if (!data || data.length === 0) {
            this.modalBody.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 3rem;">Không có dữ liệu thi đua 5S.</p>';
            return;
        }

        this.raceRawData = data;
        const headers = data[0] || [];
        const rows = data.slice(1);

        const scoreColIdx = headers.findIndex(h => (h || '').toLowerCase().includes('điểm') || (h || '').toLowerCase().includes('score'));
        const areaColIdx = headers.findIndex(h => (h || '').toLowerCase().includes('khu vực') || (h || '').toLowerCase().includes('phân xưởng') || (h || '').toLowerCase().includes('kho'));
        const trendColIdx = headers.findIndex(h => (h || '').toLowerCase().includes('xu hướng') || (h || '').toLowerCase().includes('trend'));
        const rankColIdx = headers.findIndex(h => (h || '').toLowerCase().includes('hạng') || (h || '').toLowerCase().includes('rank'));

        let raceItems = [];
        let imageRows = [];

        // Check for image rows
        rows.forEach(r => {
            const hasImg = r.some(c => typeof c === 'string' && c.startsWith('http') && (c.includes('drive.google.com') || c.match(/\.(jpeg|jpg|gif|png|webp)/i)));
            if (hasImg) imageRows.push(r);
        });

        if (scoreColIdx !== -1 && areaColIdx !== -1) {
            rows.forEach((r, idx) => {
                const area = r[areaColIdx];
                if (!area) return;
                const score = parseFloat(r[scoreColIdx]) || 0;
                const trend = trendColIdx !== -1 ? (r[trendColIdx] || '→') : '→';
                const rank = rankColIdx !== -1 ? (parseInt(r[rankColIdx]) || (idx + 1)) : (idx + 1);
                raceItems.push({ area, score, trend, rank, raw: r });
            });
        }

        if (raceItems.length === 0) {
            // Default baseline scores for DDC warehouse zones
            raceItems = [
                { area: 'Kho Thành Phẩm', score: 96, trend: '↑ 2', rank: 1 },
                { area: 'Văn Phòng Hiện Trường', score: 92, trend: '↑ 1', rank: 2 },
                { area: 'Kho Nguyên Liệu', score: 89, trend: '→', rank: 3 },
                { area: 'Xưởng Cơ Khí & CCDC', score: 84, trend: '↓ 1', rank: 4 },
                { area: 'Khu Phế Liệu & Rác Thải', score: 79, trend: '↑ 1', rank: 5 }
            ];
        }

        raceItems.sort((a, b) => b.score - a.score);
        raceItems.forEach((it, idx) => it.rank = idx + 1);

        this.raceItems = raceItems;
        this.raceImageRows = imageRows;

        this.renderRaceView('leaderboard');
    }

    renderRaceView(activeTab) {
        this.currentRaceTab = activeTab;
        const items = this.raceItems || [];
        const imgCount = (this.raceImageRows || []).length;

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
                <div class="race-tab-switch">
                    <button class="race-tab-btn ${activeTab === 'leaderboard' ? 'active' : ''}" onclick="app.renderRaceView('leaderboard')">
                        🏆 Bảng Xếp Hạng & Vinh Danh
                    </button>
                    <button class="race-tab-btn ${activeTab === 'gallery' ? 'active' : ''}" onclick="app.renderRaceView('gallery')">
                        📸 Ảnh Hiện Trường Chấm Điểm (${imgCount})
                    </button>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-muted);">
                    Đợt đánh giá: <strong style="color: var(--primary);">Tháng hiện tại</strong>
                </div>
            </div>
        `;

        if (activeTab === 'leaderboard') {
            // Podium for Top 3
            const top1 = items[0] || { area: 'Chưa có', score: 0, trend: '→' };
            const top2 = items[1] || { area: 'Chưa có', score: 0, trend: '→' };
            const top3 = items[2] || { area: 'Chưa có', score: 0, trend: '→' };

            html += `
                <div class="race-podium-grid">
                    <!-- Rank 2: Silver -->
                    <div class="race-podium-card podium-rank-2">
                        <span class="podium-crown">🥈</span>
                        <div class="podium-badge badge-silver">Á Quân - Hạng 2</div>
                        <div class="podium-area-name">${top2.area}</div>
                        <div class="podium-score">${top2.score}<span style="font-size: 1rem; font-weight: 500; color: var(--text-muted);">đ</span></div>
                        <span class="trend-badge ${top2.trend.includes('↑') ? 'trend-up' : (top2.trend.includes('↓') ? 'trend-down' : 'trend-same')}">
                            ${top2.trend}
                        </span>
                    </div>

                    <!-- Rank 1: Gold -->
                    <div class="race-podium-card podium-rank-1">
                        <span class="podium-crown">🥇</span>
                        <div class="podium-badge badge-gold">Quán Quân - Hạng 1</div>
                        <div class="podium-area-name">${top1.area}</div>
                        <div class="podium-score">${top1.score}<span style="font-size: 1rem; font-weight: 500; color: var(--text-muted);">đ</span></div>
                        <span class="trend-badge ${top1.trend.includes('↑') ? 'trend-up' : (top1.trend.includes('↓') ? 'trend-down' : 'trend-same')}">
                            ${top1.trend}
                        </span>
                    </div>

                    <!-- Rank 3: Bronze -->
                    <div class="race-podium-card podium-rank-3">
                        <span class="podium-crown">🥉</span>
                        <div class="podium-badge badge-bronze">Hạng 3</div>
                        <div class="podium-area-name">${top3.area}</div>
                        <div class="podium-score">${top3.score}<span style="font-size: 1rem; font-weight: 500; color: var(--text-muted);">đ</span></div>
                        <span class="trend-badge ${top3.trend.includes('↑') ? 'trend-up' : (top3.trend.includes('↓') ? 'trend-down' : 'trend-same')}">
                            ${top3.trend}
                        </span>
                    </div>
                </div>

                <!-- Full Leaderboard Table -->
                <div class="workspace-search-wrap" style="margin-top: 2rem;">
                    <input type="text" id="raceTableSearch" class="workspace-search-input" placeholder="🔍 Tìm khu vực, phân xưởng...">
                    <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500;">
                        Tổng cộng: <strong style="color: var(--primary);">${items.length}</strong> khu vực tham gia
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="hse-table" id="raceLeaderboardTable">
                        <thead>
                            <tr>
                                <th style="width: 80px; text-align: center;">Hạng</th>
                                <th style="min-width: 220px;">Khu vực / Phân xưởng</th>
                                <th style="width: 140px; text-align: center;">Điểm 5S</th>
                                <th style="min-width: 180px;">Tiến độ chuẩn</th>
                                <th style="width: 120px; text-align: center;">Xếp loại</th>
                                <th style="width: 100px; text-align: center;">Xu hướng</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            items.forEach(it => {
                let medal = it.rank;
                if (it.rank === 1) medal = '🥇 1';
                else if (it.rank === 2) medal = '🥈 2';
                else if (it.rank === 3) medal = '🥉 3';

                let barClass = 'bar-excellent';
                let ratingBadge = '<span class="badge-chk-pass">Xuất sắc</span>';
                if (it.score < 75) {
                    barClass = 'bar-warning';
                    ratingBadge = '<span class="badge-chk-fail">Cần sửa</span>';
                } else if (it.score < 90) {
                    barClass = 'bar-good';
                    ratingBadge = '<span class="status-badge badge-warning">Đạt chuẩn</span>';
                }

                let trendClass = 'trend-same';
                if (it.trend.includes('↑')) trendClass = 'trend-up';
                else if (it.trend.includes('↓')) trendClass = 'trend-down';

                html += `
                    <tr>
                        <td style="text-align: center; font-weight: 700; font-size: 1.05rem;">${medal}</td>
                        <td style="font-weight: 600; color: var(--text-main);">${it.area}</td>
                        <td style="text-align: center; font-weight: 800; font-size: 1.15rem; color: var(--primary);">${it.score}</td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <div class="race-score-bar-wrap">
                                    <div class="race-score-bar-fill ${barClass}" style="width: ${Math.min(100, it.score)}%;"></div>
                                </div>
                                <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted); min-width: 32px;">${it.score}%</span>
                            </div>
                        </td>
                        <td style="text-align: center;">${ratingBadge}</td>
                        <td style="text-align: center;">
                            <span class="trend-badge ${trendClass}">${it.trend}</span>
                        </td>
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            // Render gallery
            if (this.raceImageRows && this.raceImageRows.length > 0) {
                const galleryData = [['Tên ảnh', 'Ngày', 'URL', 'Ghi chú'], ...this.raceImageRows];
                this.renderGallery(galleryData, '5s-race');
                return;
            } else {
                html += `
                    <div style="text-align: center; padding: 3.5rem; background: rgba(255,255,255,0.02); border-radius: 14px; border: 1px dashed rgba(255,255,255,0.1);">
                        <p style="color: var(--text-muted); margin-bottom: 1.5rem;">Chưa có ảnh chấm điểm hiện trường nào được lưu. Hãy tải lên ảnh đầu tiên!</p>
                        <label for="uploadPhoto_5s-race" class="btn-more" style="background: var(--primary); color: white; padding: 0.6rem 1.25rem; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 600;">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="17 8 12 3 7 8"></polyline>
                                <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                            <span>Tải Ảnh Chấm Điểm 5S</span>
                        </label>
                        <input type="file" id="uploadPhoto_5s-race" accept="image/*" style="display: none;" onchange="app.handleImageUpload(event, '5s-race')">
                    </div>
                `;
            }
        }

        this.modalBody.innerHTML = html;

        // Quick search
        const sInput = document.getElementById('raceTableSearch');
        if (sInput) {
            sInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase().trim();
                const table = document.getElementById('raceLeaderboardTable');
                if (!table) return;
                const trs = table.querySelectorAll('tbody tr');
                trs.forEach(tr => {
                    tr.style.display = tr.textContent.toLowerCase().includes(term) ? '' : 'none';
                });
            });
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
                if (parts[0].length === 4) {
                    monthYear = `${parts[1]}/${parts[0]}`;
                } else {
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
            <div style="margin-bottom: 1.25rem;">
                <h3 style="font-size: 1.1rem; font-weight: 600; color: var(--text-main); margin-bottom: 0.25rem;">Chọn tháng làm việc</h3>
                <p style="color: var(--text-muted); font-size: 0.85rem; margin: 0;">Nhấp vào một tháng bên dưới để xem danh sách chi tiết các đầu việc.</p>
            </div>
            <div class="month-grid">
        `;

        sortedMonths.forEach(month => {
            html += `
                <div class="glass-card month-card" onclick="app.showMonthDetail('${month}', '${moduleId}')">
                    <div style="color: var(--primary); margin-bottom: 0.5rem;">
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    </div>
                    <div style="font-weight: 700; font-size: 1.15rem;">Tháng ${month}</div>
                    <div style="font-size: 0.82rem; color: var(--primary); margin-top: 0.35rem; font-weight: 500;">${groups[month].length} đầu mục công việc</div>
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

        this.renderTable(displayData);

        // Add back button
        const backBtn = document.createElement('div');
        backBtn.innerHTML = `
            <button class="btn-back-hub" style="margin-bottom: 1.25rem;">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
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

        // Collect all images in current table for lightbox navigation
        this.currentGalleryImages = [];
        rows.forEach(row => {
            row.forEach(cell => {
                if (typeof cell === 'string' && cell.startsWith('http') && (cell.includes('drive.google.com') || cell.match(/\.(jpeg|jpg|gif|png|webp)/i))) {
                    if (!this.currentGalleryImages.includes(cell)) {
                        this.currentGalleryImages.push(cell);
                    }
                }
            });
        });

        let html = `
            <div class="workspace-search-wrap">
                <input type="text" id="tableFilterInput" class="workspace-search-input" placeholder="🔍 Tìm nhanh trong bảng tính...">
                <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500;">Tổng cộng: <strong style="color: var(--primary);">${rows.length}</strong> dòng</div>
            </div>
            <div class="table-responsive"><table class="hse-table" id="hseDataTable"><thead><tr>
        `;
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

        // Attach quick table search filter
        const filterInput = document.getElementById('tableFilterInput');
        if (filterInput) {
            filterInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase().trim();
                const table = document.getElementById('hseDataTable');
                if (!table) return;
                const trs = table.querySelectorAll('tbody tr');
                trs.forEach(tr => {
                    const text = tr.textContent.toLowerCase();
                    tr.style.display = text.includes(term) ? '' : 'none';
                });
            });
        }

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

        // Collect all images in current gallery for lightbox navigation
        this.currentGalleryImages = rows.map(r => r[2]).filter(u => u && typeof u === 'string' && u.startsWith('http'));

        if (this.workspaceActions) {
            this.workspaceActions.innerHTML = `
                <label for="uploadPhoto_${moduleId}" class="btn-more" style="background: var(--primary); color: white; padding: 0.55rem 1.1rem; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; font-weight: 600; margin: 0;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    <span>Upload Hình Ảnh</span>
                </label>
            `;
        }

        let uploadSectionHtml = `
            <div class="upload-section" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
                <div style="font-size: 0.9rem; color: var(--text-muted);">Tổng cộng: <strong style="color: var(--primary);">${rows.length}</strong> hình ảnh</div>
                <label for="uploadPhoto_${moduleId}" style="background: var(--primary); color: white; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; font-weight: 500; transition: var(--transition);">
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

        if (!CONFIG.R2_WORKER_URL && !CONFIG.APPS_SCRIPT_URL_HSE) {
            alert('Chưa cấu hình API! Hãy xem hướng dẫn tại thư mục cloudflare-r2 và dán R2_WORKER_URL vào file hse.js.');
            event.target.value = '';
            return;
        }

        const today = new Date().toLocaleDateString('vi-VN');
        const previewUrl = URL.createObjectURL(file);
        const moduleDef = this.modules.find(m => m.id === moduleId);
        const sheetName = moduleDef ? moduleDef.sheetName : 'Ảnh mẫu kho';

        // Temporary block with spinner status
        const tempId = 'upload_' + Date.now();
        const newHtml = `
            <div class="gallery-item" id="${tempId}" style="animation: fadeIn 0.5s; position: relative;">
                <img src="${previewUrl}" alt="${file.name}" class="img-thumb" style="opacity: 0.5;">
                <div class="gallery-info" style="margin-top: 0.5rem;">
                    <p style="font-weight: 600; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${file.name}">${file.name}</p>
                    <p class="upload-status-text" style="color: var(--warning); font-size: 0.8rem; font-weight: 600;">Đang tải lên Cloudflare R2...</p>
                    <p class="upload-sub-text" style="font-size: 0.8rem; margin-top: 0.25rem;">(Vui lòng chờ)</p>
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

        const el = document.getElementById(tempId);

        try {
            let finalImageUrl = '';

            // 1. Ưu tiên tải trực tiếp lên Cloudflare R2 Worker
            if (CONFIG.R2_WORKER_URL) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('folder', moduleId);

                const workerUrl = CONFIG.R2_WORKER_URL.replace(/\/+$/, '') + '/upload';
                const r2Response = await fetch(workerUrl, {
                    method: 'POST',
                    body: formData
                });

                const r2Result = await r2Response.json();
                if (r2Result.status !== 'success' || !r2Result.fileUrl) {
                    throw new Error(r2Result.message || 'Lỗi khi tải ảnh lên Cloudflare R2');
                }
                finalImageUrl = r2Result.fileUrl;
            }

            // 2. Ghi nhận thông tin vào Google Sheets qua Apps Script
            if (el) {
                const statusP = el.querySelector('.upload-status-text');
                if (statusP) statusP.textContent = 'Đang lưu vào Google Sheet...';
            }

            if (CONFIG.APPS_SCRIPT_URL_HSE) {
                let payload;
                if (finalImageUrl) {
                    payload = {
                        action: 'recordImageRow',
                        sheetName: sheetName,
                        fileName: file.name,
                        fileUrl: finalImageUrl,
                        date: today
                    };
                } else {
                    // Fallback: Chế độ cũ nếu chưa có R2_WORKER_URL
                    const reader = new FileReader();
                    const base64Data = await new Promise((res, rej) => {
                        reader.onload = () => res(reader.result.split(',')[1]);
                        reader.onerror = rej;
                        reader.readAsDataURL(file);
                    });
                    payload = {
                        action: 'uploadImageRow',
                        sheetName: sheetName,
                        fileName: file.name,
                        mimeType: file.type,
                        fileData: base64Data,
                        date: today
                    };
                }

                const bodyParams = new URLSearchParams();
                bodyParams.set('contents', JSON.stringify(payload));

                const response = await fetch(CONFIG.APPS_SCRIPT_URL_HSE, {
                    method: 'POST',
                    body: bodyParams,
                    redirect: 'follow'
                });

                const result = await response.json();
                if (result.status !== 'success') {
                    throw new Error(result.message || 'Lỗi ghi nhận vào Google Sheet');
                }
                if (!finalImageUrl && result.fileUrl) {
                    finalImageUrl = result.fileUrl;
                }
            }

            // Hoàn tất thành công
            if (el) {
                const img = el.querySelector('img');
                img.style.opacity = '1';
                img.onclick = () => app.openImageLightbox(finalImageUrl);
                const p2 = el.querySelector('.gallery-info p:nth-child(2)');
                if (p2) {
                    p2.textContent = today;
                    p2.style.color = 'var(--text-muted)';
                }
                const p3 = el.querySelector('.gallery-info p:nth-child(3)');
                if (p3) {
                    p3.textContent = '(Đã lưu thành công)';
                    p3.style.color = 'var(--primary)';
                }
            }
        } catch (error) {
            console.error('Lỗi upload ảnh:', error);
            alert('Có lỗi xảy ra: ' + error.message);
            if (el) {
                const img = el.querySelector('img');
                if (img) img.style.opacity = '1';
                const p2 = el.querySelector('.gallery-info p:nth-child(2)');
                if (p2) {
                    p2.textContent = 'Lưu thất bại';
                    p2.style.color = 'var(--danger)';
                }
                const p3 = el.querySelector('.gallery-info p:nth-child(3)');
                if (p3) {
                    p3.textContent = `(${error.message || 'Lỗi mạng'})`;
                    p3.style.color = 'var(--danger)';
                }
            }
        } finally {
            event.target.value = '';
        }
    }

    async deleteImage(event, moduleId, imageUrl, btnElement) {
        event.stopPropagation();

        if (!this.checkPermission()) return;

        if (!confirm('Bạn có chắc chắn muốn xóa mục này không? (Hành động này sẽ xóa trên Cloudflare R2/Drive và Sheet)')) return;

        const moduleDef = this.modules.find(m => m.id === moduleId);
        const sheetName = moduleDef ? moduleDef.sheetName : 'Ảnh mẫu kho';

        // Find the parent element (supports both gallery-item and reg-item)
        const cardEl = btnElement.closest('.gallery-item') || btnElement.closest('.reg-item');

        if (cardEl) {
            cardEl.style.opacity = '0.4';
            cardEl.style.pointerEvents = 'none';
        }

        try {
            // 1. Nếu là ảnh R2, gọi Worker để xóa tệp trong bucket
            if (CONFIG.R2_WORKER_URL && !imageUrl.includes('drive.google.com')) {
                try {
                    const deleteUrl = CONFIG.R2_WORKER_URL.replace(/\/+$/, '') + '/delete';
                    await fetch(deleteUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fileUrl: imageUrl })
                    });
                } catch (r2Err) {
                    console.warn('Lỗi gọi API xóa trên Cloudflare R2:', r2Err);
                }
            }

            // 2. Gọi Apps Script để xóa dòng trên Google Sheet
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
        // Find or gather images in current view
        if (!this.currentGalleryImages || this.currentGalleryImages.length === 0 || !this.currentGalleryImages.includes(url)) {
            const domImgs = Array.from(document.querySelectorAll('.gallery-item img, .table-img-thumb'));
            const extracted = [];
            domImgs.forEach(img => {
                const onclickAttr = img.getAttribute('onclick') || '';
                const match = onclickAttr.match(/openImageLightbox\(['"]([^'"]+)['"]\)/);
                if (match && match[1]) {
                    if (!extracted.includes(match[1])) extracted.push(match[1]);
                }
            });
            if (extracted.length > 0) {
                this.currentGalleryImages = extracted;
            } else {
                this.currentGalleryImages = [url];
            }
        }

        this.currentImageIndex = this.currentGalleryImages.indexOf(url);
        if (this.currentImageIndex === -1) {
            this.currentGalleryImages.unshift(url);
            this.currentImageIndex = 0;
        }

        let lightbox = document.getElementById('custom-lightbox');
        if (!lightbox) {
            lightbox = document.createElement('div');
            lightbox.id = 'custom-lightbox';
            lightbox.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; 
                background: rgba(15, 23, 42, 0.92); backdrop-filter: blur(10px); 
                display: flex; align-items: center; justify-content: center; 
                z-index: 10000; opacity: 0; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
                cursor: zoom-out;
            `;

            // Close Button (X)
            const closeBtn = document.createElement('div');
            closeBtn.innerHTML = '&times;';
            closeBtn.title = 'Đóng (Esc)';
            closeBtn.style.cssText = `
                position: absolute; top: 20px; right: 30px; color: white; 
                font-size: 40px; font-weight: 300; cursor: pointer; 
                z-index: 10003; transition: transform 0.2s; line-height: 1;
            `;
            closeBtn.onmouseover = () => closeBtn.style.transform = 'scale(1.2)';
            closeBtn.onmouseout = () => closeBtn.style.transform = 'scale(1)';
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                this.closeImageLightbox();
            };
            lightbox.appendChild(closeBtn);

            // Counter Badge (Top Center)
            const counterBadge = document.createElement('div');
            counterBadge.id = 'lightbox-counter';
            counterBadge.className = 'lightbox-counter-badge';
            lightbox.appendChild(counterBadge);

            // Prev Button (<)
            const prevBtn = document.createElement('button');
            prevBtn.id = 'lightbox-prev';
            prevBtn.className = 'lightbox-nav-btn prev';
            prevBtn.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>';
            prevBtn.title = 'Ảnh trước (Mũi tên trái)';
            prevBtn.onclick = (e) => {
                e.stopPropagation();
                this.lightboxNavigate(-1);
            };
            lightbox.appendChild(prevBtn);

            // Next Button (>)
            const nextBtn = document.createElement('button');
            nextBtn.id = 'lightbox-next';
            nextBtn.className = 'lightbox-nav-btn next';
            nextBtn.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>';
            nextBtn.title = 'Ảnh kế tiếp (Mũi tên phải)';
            nextBtn.onclick = (e) => {
                e.stopPropagation();
                this.lightboxNavigate(1);
            };
            lightbox.appendChild(nextBtn);

            // Image Container
            const imgContainer = document.createElement('div');
            imgContainer.style.cssText = 'position: relative; display: flex; flex-direction: column; align-items: center; gap: 1rem; max-width: 90vw; max-height: 90vh;';

            const img = document.createElement('img');
            img.id = 'lightbox-img';
            img.style.cssText = `
                max-width: 88vw; max-height: 80vh; object-fit: contain; 
                border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6); 
                transform: scale(0.9); transition: transform 0.3s ease, opacity 0.25s ease; border: 1px solid rgba(255,255,255,0.15);
            `;
            imgContainer.appendChild(img);

            // Download Button
            const downloadBtn = document.createElement('a');
            downloadBtn.id = 'lightbox-download';
            downloadBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px; vertical-align: middle;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Tải ảnh gốc';
            downloadBtn.style.cssText = `
                color: white; text-decoration: none; background: rgba(255,255,255,0.1); 
                padding: 8px 22px; border-radius: 20px; font-size: 0.9rem; 
                backdrop-filter: blur(6px); transition: 0.2s; border: 1px solid rgba(255,255,255,0.25);
            `;
            downloadBtn.onmouseover = () => downloadBtn.style.background = 'rgba(255,255,255,0.22)';
            downloadBtn.onmouseout = () => downloadBtn.style.background = 'rgba(255,255,255,0.1)';
            downloadBtn.target = "_blank";
            imgContainer.appendChild(downloadBtn);

            lightbox.appendChild(imgContainer);

            lightbox.onclick = (e) => {
                if (e.target !== downloadBtn && !downloadBtn.contains(e.target) &&
                    e.target !== prevBtn && !prevBtn.contains(e.target) &&
                    e.target !== nextBtn && !nextBtn.contains(e.target)) {
                    this.closeImageLightbox();
                }
            };

            document.body.appendChild(lightbox);
        }

        this.updateLightboxImage(url);
        lightbox.style.display = 'flex';

        setTimeout(() => {
            lightbox.style.opacity = '1';
            const imgEl = document.getElementById('lightbox-img');
            if (imgEl) imgEl.style.transform = 'scale(1)';
        }, 10);
    }

    updateLightboxImage(url) {
        const imgEl = document.getElementById('lightbox-img');
        const downloadEl = document.getElementById('lightbox-download');
        const counterEl = document.getElementById('lightbox-counter');
        const prevBtn = document.getElementById('lightbox-prev');
        const nextBtn = document.getElementById('lightbox-next');

        if (!url) return;

        let displayUrl = url;
        if (url.includes('drive.google.com/file/d/')) {
            const match = url.match(/\/d\/([-\w]{25,})/);
            if (match && match[1]) {
                displayUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1600`;
            }
        }

        if (imgEl) {
            imgEl.style.opacity = '0.35';
            imgEl.src = displayUrl;
            imgEl.onload = () => { imgEl.style.opacity = '1'; };
            setTimeout(() => { if (imgEl) imgEl.style.opacity = '1'; }, 250);
        }

        if (downloadEl) downloadEl.href = url;

        const totalImages = this.currentGalleryImages ? this.currentGalleryImages.length : 0;
        if (counterEl) {
            if (totalImages > 1) {
                counterEl.textContent = `Ảnh ${this.currentImageIndex + 1} / ${totalImages}`;
                counterEl.style.display = 'block';
            } else {
                counterEl.style.display = 'none';
            }
        }

        const hasMultiple = totalImages > 1;
        if (prevBtn) prevBtn.style.display = hasMultiple ? 'flex' : 'none';
        if (nextBtn) nextBtn.style.display = hasMultiple ? 'flex' : 'none';
    }

    lightboxNavigate(direction) {
        if (!this.currentGalleryImages || this.currentGalleryImages.length <= 1) return;
        this.currentImageIndex = (this.currentImageIndex + direction + this.currentGalleryImages.length) % this.currentGalleryImages.length;
        const nextUrl = this.currentGalleryImages[this.currentImageIndex];
        this.updateLightboxImage(nextUrl);
    }

    closeImageLightbox() {
        const lightbox = document.getElementById('custom-lightbox');
        const img = document.getElementById('lightbox-img');
        if (lightbox) {
            lightbox.style.opacity = '0';
            if (img) img.style.transform = 'scale(0.9)';
            setTimeout(() => { lightbox.style.display = 'none'; }, 300);
        }
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

        if (this.workspaceActions) {
            this.workspaceActions.innerHTML = `
                <button class="btn-more" onclick="app.triggerPdfUpload()" style="background: var(--primary); color: white; padding: 0.55rem 1.1rem; border-radius: 8px; border: none; font-weight: 600; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    <span>Tải lên Quy định (PDF)</span>
                </button>
            `;
        }

        let html = `
            <div class="scrap-regs-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <p style="color: var(--text-muted); font-size: 0.95rem; margin: 0;">Danh sách quy định phân loại phế liệu đã ban hành (${rows.length} tài liệu).</p>
                <button class="btn-more" onclick="app.triggerPdfUpload()" style="background: var(--primary); color: white; padding: 0.5rem 1rem; border-radius: 8px; border: none; font-weight: 600; font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem; transition: var(--transition);">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
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
        const loadingHtml = `
            <div class="upload-progress-overlay" style="position: absolute; inset: 0; background: rgba(0,0,0,0.7); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 100; border-radius: 8px;">
                <div class="spinner"></div>
                <p id="tableUploadStatusText" style="margin-top: 1rem; color: white;">Đang tải ảnh lên Cloudflare R2 (dòng ${row}, cột ${column})...</p>
            </div>
        `;
        this.modalBody.style.position = 'relative';
        this.modalBody.insertAdjacentHTML('beforeend', loadingHtml);

        const statusEl = document.getElementById('tableUploadStatusText');
        const moduleDef = this.modules.find(m => m.id === this.currentModuleId);
        const sheetName = moduleDef ? moduleDef.sheetName : 'Khắc phục 5S';

        try {
            let finalImageUrl = '';

            // 1. Tải lên Cloudflare R2 nếu đã cấu hình R2_WORKER_URL
            if (CONFIG.R2_WORKER_URL) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('folder', '5s-fix');

                const workerUrl = CONFIG.R2_WORKER_URL.replace(/\/+$/, '') + '/upload';
                const r2Response = await fetch(workerUrl, {
                    method: 'POST',
                    body: formData
                });

                const r2Result = await r2Response.json();
                if (r2Result.status !== 'success' || !r2Result.fileUrl) {
                    throw new Error(r2Result.message || 'Lỗi khi tải ảnh lên Cloudflare R2');
                }
                finalImageUrl = r2Result.fileUrl;
            }

            if (statusEl) {
                statusEl.textContent = `Đang cập nhật vào Google Sheet (dòng ${row}, cột ${column})...`;
            }

            // 2. Ghi nhận link vào Google Sheet
            let payload;
            if (finalImageUrl) {
                payload = {
                    action: 'recordImageCell',
                    sheetName: sheetName,
                    row: parseInt(row),
                    column: column,
                    fileUrl: finalImageUrl
                };
            } else {
                // Fallback cũ nếu chưa có R2_WORKER_URL
                const reader = new FileReader();
                const base64Data = await new Promise((res, rej) => {
                    reader.onload = () => res(reader.result.split(',')[1]);
                    reader.onerror = rej;
                    reader.readAsDataURL(file);
                });
                payload = {
                    action: 'updateImageCell',
                    sheetName: sheetName,
                    row: parseInt(row),
                    column: column,
                    fileName: file.name,
                    mimeType: file.type,
                    fileData: base64Data
                };
            }

            const bodyParams = new URLSearchParams();
            bodyParams.set('contents', JSON.stringify(payload));

            const response = await fetch(CONFIG.APPS_SCRIPT_URL_HSE, {
                method: 'POST',
                body: bodyParams,
                redirect: 'follow'
            });

            const result = await response.json();

            if (result.status === 'success') {
                alert('Cập nhật hình ảnh thành công!');
                await this.openDetail(this.currentModuleId);
            } else {
                throw new Error(result.message || 'Lỗi server');
            }
        } catch (err) {
            console.error(err);
            alert('Lỗi tải lên: ' + err.message);
            const overlay = this.modalBody.querySelector('.upload-progress-overlay');
            if (overlay) overlay.remove();
        } finally {
            input.value = '';
        }
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
            // 1. Xóa trên R2 nếu là link R2
            if (CONFIG.R2_WORKER_URL && url && !url.includes('drive.google.com')) {
                try {
                    const deleteUrl = CONFIG.R2_WORKER_URL.replace(/\/+$/, '') + '/delete';
                    await fetch(deleteUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fileUrl: url })
                    });
                } catch (r2Err) {
                    console.warn('Lỗi gọi API xóa trên Cloudflare R2:', r2Err);
                }
            }

            // 2. Xóa ô trong Google Sheet
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

    // ==========================================================================
    // EQUIPMENT CHECKLIST BY MONTH METHODS
    // ==========================================================================

    renderEquipmentChecklist(data) {
        if (!data || data.length < 2) {
            this.modalBody.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 3rem;">Không có dữ liệu checklist thiết bị.</p>';
            return;
        }

        this.equipmentFullData = data;
        const headers = data[0];
        this.equipmentHeaders = headers;
        // Devices start from column index 2 (after Ngày, Người kiểm tra)
        this.equipmentDevices = headers.slice(2).filter(h => h && h.trim());

        const rows = data.slice(1);
        const groups = {};

        rows.forEach((row, idx) => {
            const dateStr = (row[0] || '').trim();
            if (!dateStr) return;
            const parts = dateStr.split(/[-/]/);
            let monthKey = 'Chưa xác định';
            if (parts.length === 3) {
                if (parts[0].length === 4) {
                    monthKey = `${parts[1].padStart(2, '0')}/${parts[0]}`;
                } else {
                    monthKey = `${parts[1].padStart(2, '0')}/${parts[2]}`;
                }
            }
            if (!groups[monthKey]) groups[monthKey] = [];
            groups[monthKey].push({ row, rowIndex: idx + 2 });
        });

        this.equipmentGroups = groups;
        const sortedMonths = Object.keys(groups).sort((a, b) => {
            const [mA, yA] = a.split('/').map(Number);
            const [mB, yB] = b.split('/').map(Number);
            return (yB * 12 + mB) - (yA * 12 + mA);
        });

        this.equipmentMonths = sortedMonths;

        // Choose current active month
        const now = new Date();
        const curMonthKey = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        if (!this.currentChecklistMonth || !groups[this.currentChecklistMonth]) {
            this.currentChecklistMonth = groups[curMonthKey] ? curMonthKey : (sortedMonths[0] || curMonthKey);
        }

        this.renderEquipmentWorkspace();
    }

    selectEquipmentMonth(monthKey) {
        this.currentChecklistMonth = monthKey;
        this.renderEquipmentWorkspace();
    }

    renderEquipmentWorkspace() {
        const monthKey = this.currentChecklistMonth;
        const monthItems = this.equipmentGroups[monthKey] || [];
        const devices = this.equipmentDevices;

        // Calculate stats
        const totalDays = monthItems.length;
        let passCount = 0;
        let failCount = 0;

        monthItems.forEach(item => {
            const row = item.row;
            for (let i = 2; i < row.length; i++) {
                const val = (row[i] || '').trim().toUpperCase();
                if (val === 'O') passCount++;
                else if (val === 'X') failCount++;
            }
        });

        const totalChecks = passCount + failCount;
        const safeRate = totalChecks > 0 ? Math.round((passCount / totalChecks) * 100) : 100;

        // Today format for HTML date picker (YYYY-MM-DD)
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const currentUser = localStorage.getItem('currentUser') || 'Nguyễn Văn Học';

        let html = `
            <!-- Month Selector Tabs -->
            <div class="chk-month-tabs">
        `;

        this.equipmentMonths.forEach(m => {
            const isActive = m === monthKey ? 'active' : '';
            const count = (this.equipmentGroups[m] || []).length;
            html += `
                <button type="button" class="chk-month-tab ${isActive}" onclick="app.selectEquipmentMonth('${m}')">
                    Tháng ${m} (${count} ngày)
                </button>
            `;
        });

        html += `
            </div>

            <!-- KPI Summary Cards -->
            <div class="chk-kpi-grid">
                <div class="chk-kpi-card">
                    <div class="chk-kpi-icon icon-blue">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    </div>
                    <div>
                        <div class="chk-kpi-val">${totalDays}</div>
                        <div class="chk-kpi-label">Số ngày đã kiểm tra (T${monthKey})</div>
                    </div>
                </div>
                <div class="chk-kpi-card">
                    <div class="chk-kpi-icon icon-green">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>
                    </div>
                    <div>
                        <div class="chk-kpi-val">${safeRate}%</div>
                        <div class="chk-kpi-label">Tỷ lệ đã kiểm tra</div>
                    </div>
                </div>
                <div class="chk-kpi-card">
                    <div class="chk-kpi-icon icon-red">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    </div>
                    <div>
                        <div class="chk-kpi-val">${failCount}</div>
                        <div class="chk-kpi-label">Chưa kiểm tra (X)</div>
                    </div>
                </div>
            </div>

            <!-- Daily Inspection Form Card -->
            <div class="chk-form-card" id="chkFormCard">
                <form id="equipmentChecklistForm" onsubmit="app.handleEquipmentChecklistSubmit(event)">
                    <div class="chk-form-header">
                        <div class="chk-form-title">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                            <span id="chkFormModeTitle">Phiếu Ghi Nhận Kiểm Tra Thiết Bị Hàng Ngày</span>
                        </div>
                        <button type="button" class="btn-edit-row" onclick="app.resetEquipmentForm()" style="display:none;" id="btnCancelEdit">
                            Hủy chỉnh sửa
                        </button>
                    </div>

                    <div class="chk-form-inputs">
                        <div class="chk-input-group">
                            <label for="chkDateInput">📅 Ngày kiểm tra</label>
                            <input type="date" id="chkDateInput" class="chk-input-control" value="${todayStr}" required>
                        </div>
                        <div class="chk-input-group">
                            <label for="chkInspectorInput">👤 Người kiểm tra</label>
                            <input type="text" id="chkInspectorInput" class="chk-input-control" value="${currentUser}" placeholder="Họ và tên..." required>
                        </div>
                    </div>

                    <div style="margin-bottom: 0.75rem; font-size: 0.85rem; font-weight: 600; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center;">
                        <span>⚙️ ĐÁNH GIÁ TÌNH TRẠNG THIẾT BỊ:</span>
                        <button type="button" class="btn-quick-pass" onclick="app.quickCheckAllPass()">⚡ Đánh dấu tất cả ĐÃ KIỂM TRA</button>
                    </div>

                    <div class="chk-device-list" id="chkDeviceList">
        `;

        devices.forEach(dev => {
            const devId = encodeURIComponent(dev);
            html += `
                <div class="chk-device-item">
                    <div class="chk-device-name">🔧 ${dev}</div>
                    <div class="chk-toggle-group" data-device="${dev}">
                        <input type="hidden" name="device_${devId}" id="deviceVal_${devId}" value="O">
                        <button type="button" class="chk-toggle-btn btn-pass active" id="btnPass_${devId}" onclick="app.setDeviceStatus('${devId}', 'O')">
                            ✓ Đã kiểm tra (O)
                        </button>
                        <button type="button" class="chk-toggle-btn btn-fail" id="btnFail_${devId}" onclick="app.setDeviceStatus('${devId}', 'X')">
                            ✕ Chưa kiểm tra (X)
                        </button>
                    </div>
                </div>
            `;
        });

        html += `
                    </div>

                    <div class="chk-form-actions">
                        <div style="font-size: 0.82rem; color: var(--text-muted);">
                            * Dữ liệu đồng bộ trực tiếp với Google Sheet "Checklist kiểm tra thiết bị".
                        </div>
                        <button type="submit" class="btn-chk-save" id="btnSaveChecklist">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                            <span>Lưu kết quả kiểm tra</span>
                        </button>
                    </div>
                </form>
            </div>

            <!-- Table of Month History -->
            <div class="workspace-search-wrap" style="margin-top: 2rem;">
                <input type="text" id="chkTableSearch" class="workspace-search-input" placeholder="🔍 Lọc tìm kiếm theo ngày, người kiểm tra...">
                <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500;">
                    Tháng ${monthKey}: <strong style="color: var(--primary);">${monthItems.length}</strong> ngày ghi nhận
                </div>
            </div>

            <div class="table-responsive">
                <table class="hse-table" id="equipmentChecklistTable">
                    <thead>
                        <tr>
                            <th style="min-width: 140px;">Ngày</th>
                            <th style="min-width: 160px;">Người kiểm tra</th>
        `;

        devices.forEach(dev => {
            html += `<th style="text-align: center; min-width: 120px;">${dev}</th>`;
        });

        html += `
                            <th style="text-align: center; min-width: 90px;">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        // Sort items by date ascending
        const sortedItems = [...monthItems].sort((a, b) => {
            const parseDate = (dStr) => {
                const p = (dStr || '').split(/[-/]/);
                if (p.length === 3) {
                    if (p[0].length === 4) return new Date(p[0], p[1] - 1, p[2]);
                    return new Date(p[2], p[1] - 1, p[0]);
                }
                return new Date(0);
            };
            return parseDate(a.row[0]) - parseDate(b.row[0]);
        });

        if (sortedItems.length === 0) {
            html += `<tr><td colspan="${devices.length + 3}" style="text-align: center; color: var(--text-muted); padding: 2rem;">Chưa có dữ liệu kiểm tra trong tháng này. Hãy nhập phiếu kiểm tra ở trên!</td></tr>`;
        } else {
            sortedItems.forEach(item => {
                const row = item.row;
                const rawDate = row[0] || '';
                const inspector = row[1] || '';

                // Calculate weekday
                let dateDisplay = rawDate;
                const parts = rawDate.split(/[-/]/);
                if (parts.length === 3) {
                    let dObj;
                    if (parts[0].length === 4) dObj = new Date(parts[0], parts[1] - 1, parts[2]);
                    else dObj = new Date(parts[2], parts[1] - 1, parts[0]);
                    if (!isNaN(dObj.getTime())) {
                        const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
                        dateDisplay = `${rawDate} <span style="color: var(--text-muted); font-size: 0.8rem;">(${dayNames[dObj.getDay()]})</span>`;
                    }
                }

                // Prepare device results for edit json
                const devObj = {};
                devices.forEach((dev, dIdx) => {
                    devObj[dev] = (row[dIdx + 2] || '').trim().toUpperCase();
                });
                const devDataAttr = encodeURIComponent(JSON.stringify(devObj));

                html += `
                    <tr>
                        <td style="font-weight: 600;">${dateDisplay}</td>
                        <td>${inspector}</td>
                `;

                devices.forEach((dev, dIdx) => {
                    const val = (row[dIdx + 2] || '').trim().toUpperCase();
                    let badgeHtml = '';
                    if (val === 'O') {
                        badgeHtml = `<span class="badge-chk-pass">✓ Đã kiểm tra</span>`;
                    } else if (val === 'X') {
                        badgeHtml = `<span class="badge-chk-fail">✕ Chưa kiểm tra</span>`;
                    } else {
                        badgeHtml = `<span class="badge-chk-na">-</span>`;
                    }
                    html += `<td style="text-align: center;">${badgeHtml}</td>`;
                });

                html += `
                        <td style="text-align: center;">
                            <button type="button" class="btn-edit-row" onclick="app.populateChecklistForEdit('${rawDate}', '${inspector}', '${devDataAttr}')" title="Sửa dữ liệu ngày này">
                                ✏️ Sửa
                            </button>
                        </td>
                    </tr>
                `;
            });
        }

        html += `
                    </tbody>
                </table>
            </div>
        `;

        this.modalBody.innerHTML = html;

        // Attach quick filter
        const searchInput = document.getElementById('chkTableSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase().trim();
                const table = document.getElementById('equipmentChecklistTable');
                if (!table) return;
                const trs = table.querySelectorAll('tbody tr');
                trs.forEach(tr => {
                    const text = tr.textContent.toLowerCase();
                    tr.style.display = text.includes(term) ? '' : 'none';
                });
            });
        }
    }

    setDeviceStatus(devId, status) {
        const input = document.getElementById(`deviceVal_${devId}`);
        const btnPass = document.getElementById(`btnPass_${devId}`);
        const btnFail = document.getElementById(`btnFail_${devId}`);

        if (input) input.value = status;
        if (btnPass && btnFail) {
            if (status === 'O') {
                btnPass.classList.add('active');
                btnFail.classList.remove('active');
            } else {
                btnPass.classList.remove('active');
                btnFail.classList.add('active');
            }
        }
    }

    quickCheckAllPass() {
        if (!this.equipmentDevices) return;
        this.equipmentDevices.forEach(dev => {
            const devId = encodeURIComponent(dev);
            this.setDeviceStatus(devId, 'O');
        });
    }

    populateChecklistForEdit(rawDate, inspector, encodedDevData) {
        const dateInput = document.getElementById('chkDateInput');
        const inspectorInput = document.getElementById('chkInspectorInput');
        const titleEl = document.getElementById('chkFormModeTitle');
        const btnCancel = document.getElementById('btnCancelEdit');

        if (rawDate && dateInput) {
            // Convert DD/MM/YYYY to YYYY-MM-DD
            const parts = rawDate.split(/[-/]/);
            if (parts.length === 3) {
                let y, m, d;
                if (parts[0].length === 4) { y = parts[0]; m = parts[1]; d = parts[2]; }
                else { y = parts[2]; m = parts[1]; d = parts[0]; }
                dateInput.value = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
        }

        if (inspector && inspectorInput) {
            inspectorInput.value = inspector;
        }

        if (encodedDevData) {
            try {
                const devObj = JSON.parse(decodeURIComponent(encodedDevData));
                this.equipmentDevices.forEach(dev => {
                    const devId = encodeURIComponent(dev);
                    const val = devObj[dev] || 'O';
                    this.setDeviceStatus(devId, val);
                });
            } catch (err) {
                console.warn('Error parsing dev data for edit:', err);
            }
        }

        if (titleEl) titleEl.textContent = `✏️ Chỉnh Sửa Kiểm Tra Ngày ${rawDate}`;
        if (btnCancel) btnCancel.style.display = 'inline-block';

        const formCard = document.getElementById('chkFormCard');
        if (formCard) {
            formCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            formCard.style.borderColor = 'var(--primary)';
        }
    }

    resetEquipmentForm() {
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const dateInput = document.getElementById('chkDateInput');
        const inspectorInput = document.getElementById('chkInspectorInput');
        const titleEl = document.getElementById('chkFormModeTitle');
        const btnCancel = document.getElementById('btnCancelEdit');

        if (dateInput) dateInput.value = todayStr;
        if (inspectorInput) inspectorInput.value = localStorage.getItem('currentUser') || 'Nguyễn Văn Học';
        if (titleEl) titleEl.textContent = 'Phiếu Ghi Nhận Kiểm Tra Thiết Bị Hàng Ngày';
        if (btnCancel) btnCancel.style.display = 'none';

        this.quickCheckAllPass();
    }

    async handleEquipmentChecklistSubmit(event) {
        event.preventDefault();
        const currentUser = localStorage.getItem('currentUser');
        if (!currentUser) {
            this.showPermissionDeniedModal();
            return;
        }

        const dateInput = document.getElementById('chkDateInput');
        const inspectorInput = document.getElementById('chkInspectorInput');
        const btnSave = document.getElementById('btnSaveChecklist');

        if (!dateInput || !inspectorInput) return;

        const dateVal = dateInput.value; // YYYY-MM-DD
        const inspector = inspectorInput.value.trim();

        if (!dateVal) {
            alert('Vui lòng chọn ngày kiểm tra');
            return;
        }
        if (!inspector) {
            alert('Vui lòng nhập người kiểm tra');
            return;
        }

        // Format to DD/MM/YYYY
        const [y, m, d] = dateVal.split('-');
        const dateFormatted = `${d}/${m}/${y}`;
        const monthKey = `${m}/${y}`;

        // Collect device results
        const deviceResults = {};
        this.equipmentDevices.forEach(dev => {
            const devId = encodeURIComponent(dev);
            const input = document.getElementById(`deviceVal_${devId}`);
            deviceResults[dev] = input ? input.value : 'O';
        });

        // Set button loading
        const origBtnText = btnSave.innerHTML;
        btnSave.disabled = true;
        btnSave.innerHTML = `<div class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></div> Đang lưu...`;

        try {
            const payload = {
                action: 'saveEquipmentChecklist',
                sheetName: 'Checklist kiểm tra thiết bị',
                sheetId: '20754979',
                gid: '20754979',
                date: dateFormatted,
                inspector: inspector,
                deviceResults: deviceResults
            };

            if (CONFIG.APPS_SCRIPT_URL_HSE) {
                const bodyParams = new URLSearchParams();
                bodyParams.set('contents', JSON.stringify(payload));

                const response = await fetch(CONFIG.APPS_SCRIPT_URL_HSE, {
                    method: 'POST',
                    body: bodyParams,
                    redirect: 'follow'
                });
                const result = await response.json();
                console.log('Save checklist response:', result);
                if (result.status !== 'success') {
                    throw new Error(result.message || 'Lỗi lưu dữ liệu');
                }
            }

            // Optimistic update local data
            const rowIndex = this.equipmentFullData.findIndex((r, idx) => idx > 0 && r[0] === dateFormatted);
            const newRow = [dateFormatted, inspector];
            this.equipmentDevices.forEach(dev => {
                newRow.push(deviceResults[dev] || '');
            });

            if (rowIndex > 0) {
                this.equipmentFullData[rowIndex] = newRow;
            } else {
                this.equipmentFullData.push(newRow);
            }

            // Re-render checklist with current month
            this.currentChecklistMonth = monthKey;
            this.renderEquipmentChecklist(this.equipmentFullData);

            alert(`✅ Đã lưu kết quả kiểm tra ngày ${dateFormatted} thành công!`);
        } catch (err) {
            console.error('Save checklist error:', err);
            alert('Lỗi khi lưu kết quả kiểm tra: ' + err.message);
        } finally {
            if (btnSave) {
                btnSave.disabled = false;
                btnSave.innerHTML = origBtnText;
            }
        }
    }
}

// Start Application
const app = new DashboardManager();
window.app = app;

