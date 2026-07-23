const INITIAL_AREAS = [
    {
        id: 'thung-son',
        name: 'Thùng sơn',
        fullName: 'Phế liệu Thùng sơn',
        description: 'Khu vực lưu trữ các loại thùng sơn cũ, vỏ thùng kim loại và nhựa.',
        color: '#f3a678',
        top: '0%',
        left: '0%',
        width: '99.9%',
        height: '6%',
        capacity: 0,
        maxCapacity: 3.5,
        unit: 'tấn',
        info: ['Diện tích: 82m²', 'Tình trạng: Đang sử dụng']
    },
    {
        id: 'go',
        name: 'Gỗ',
        fullName: 'Phế liệu Gỗ vụn',
        description: 'Khu vực tập kết gỗ vụn, pallet hỏng và các phế phẩm từ gỗ.',
        color: '#f3a678',
        top: '6.5%',
        left: '0%',
        width: '99.9%',
        height: '6%',
        capacity: 0,
        maxCapacity: 10,
        unit: 'tấn',
        info: ['Diện tích: 82m²', 'Tình trạng: Đang sử dụng']
    },
    {
        id: 'loai-1',
        name: 'Loại 1',
        fullName: 'Phế liệu Loại 1',
        description: 'Khu vực phế liệu cao cấp, có giá trị tái chế cao nhất.',
        color: '#f3a678',
        top: '13%',
        left: '0%',
        width: '99.9%',
        height: '45%',
        capacity: 0,
        maxCapacity: 350,
        unit: 'tấn',
        info: ['Diện tích: 522m²', 'Tình trạng: Đang sử dụng']
    },
    {
        id: 'day-dai',
        name: 'Dây đai',
        fullName: 'Phế liệu Dây đai',
        description: 'Khu vực chứa các loại dây đai nhựa, dây đai thép từ kiện hàng.',
        color: '#f3a678',
        top: '58.5%',
        left: '0%',
        width: '99.9%',
        height: '4%',
        capacity: 0,
        maxCapacity: 10,
        unit: 'tấn',
        info: ['Diện tích: 55m²', 'Tình trạng: Đang sử dụng']
    },
    {
        id: 'mat-khoan',
        name: 'Mạt khoan',
        fullName: 'Phế liệu Mạt khoan',
        description: 'Khu vực thu gom mạt sắt, vụn kim loại từ quá trình gia công khoan.',
        color: '#f3a678',
        top: '63%',
        left: '16%',
        width: '84%',
        height: '4%',
        capacity: 0,
        maxCapacity: 15,
        unit: 'tấn',
        info: ['Diện tích: 45m²', 'Tình trạng: Đang sử dụng']
    },
    {
        id: 'my-thuy',
        name: 'Mỹ Thủy',
        fullName: 'Phế liệu Cầu Mỹ Thủy',
        description: 'Khu vực phế liệu đặc thù từ dự án Cầu Mỹ Thủy.',
        color: '#f3a678',
        top: '67.5%',
        left: '16%',
        width: '84%',
        height: '12%',
        capacity: 0,
        maxCapacity: 100,
        unit: 'tấn',
        info: ['Diện tích: 135m²', 'Tình trạng: Đang sử dụng']
    },
    {
        id: 'inox',
        name: 'Inox',
        fullName: 'Khu vực Inox',
        description: 'Khu vực chứa phế liệu Inox, thép không gỉ.',
        color: '#f3a678',
        top: '80%',
        left: '33%',
        width: '13%',
        height: '4%',
        capacity: 0,
        maxCapacity: 2,
        unit: 'tấn',
        info: ['Diện tích: 5m²', 'Tình trạng: Đang sử dụng']
    },
    {
        id: 'tram-dien',
        name: 'Trạm điện AH1',
        fullName: 'Khu vực Trạm điện AH1',
        description: 'Khu vực kỹ thuật trạm điện, không để phế liệu lấn chiếm.',
        color: '#f3a678',
        top: '80%',
        left: '46.9%',
        width: '53%',
        height: '4%',
        info: []
    },
    {
        id: 'vo-xe',
        name: 'Vỏ xe',
        fullName: 'Phế liệu Vỏ xe',
        description: 'Khu vực tập kết lốp xe cũ, cao su phế phẩm.',
        color: '#f3a678',
        top: '84.5%',
        left: '33%',
        width: '67%',
        height: '4%',
        capacity: 0,
        maxCapacity: 50,
        unit: 'cái',
        info: ['Diện tích: 22m²', 'Tình trạng: Đang sử dụng']
    },
    {
        id: 'tap-ket',
        name: 'Tập kết',
        fullName: 'Khu vực tập kết thùng rỗng và sỉ',
        description: 'Khu vực đa năng dùng để tập kết tạm thời các loại thùng rỗng, thùng chứ sỉ cắt và sỉ đất.',
        color: '#f3a678',
        top: '63%',
        left: '0%',
        width: '15%',
        height: '25.5%',
        capacity: 0,
        maxCapacity: 50,
        unit: 'tấn',
        info: ['Diện tích: 80m²', 'Tình trạng: Đang sử dụng']
    }
];

let areas = [...INITIAL_AREAS];
let hoveredId = null;
let loading = true;
let lastUpdated = null;
let errorMsg = null;

const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1iGS7srFqOvP44NATaR26lOQEtCQIsjKFU9PG-TQ1otE/export?format=csv&gid=279727199';

function render() {
    const app = document.getElementById('app');
    if (!app) return;

    app.innerHTML = `
        <header class="mb-8 text-center relative">
            <h1 class="text-3xl md:text-4xl font-bold text-[#d92d20] uppercase tracking-wider mb-2">
                SƠ ĐỒ KHO PHẾ LIỆU
            </h1>
            <div class="h-1 w-24 bg-[#d92d20] mx-auto rounded-full mb-4"></div>
            
            <div class="flex items-center justify-center gap-4 text-xs text-gray-500">
                <div class="flex items-center gap-1">
                    <i data-lucide="clock" class="w-3.5 h-3.5"></i>
                    <span>Cập nhật lúc: ${lastUpdated || '--:--'}</span>
                </div>
                <button 
                    id="refresh-btn"
                    ${loading ? 'disabled' : ''}
                    class="flex items-center gap-1 hover:text-[#d92d20] transition-colors disabled:opacity-50 cursor-pointer"
                >
                    <i data-lucide="refresh-cw" class="w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}"></i>
                    <span>${loading ? 'Đang tải...' : 'Làm mới'}</span>
                </button>
            </div>

            ${errorMsg ? `
            <div class="mt-4 flex items-center justify-center gap-2 text-red-500 text-xs bg-red-50 py-2 px-4 rounded-full max-w-md mx-auto border border-red-100">
                <i data-lucide="alert-circle" class="w-3.5 h-3.5"></i>
                <span>${errorMsg}</span>
            </div>
            ` : ''}
        </header>

        <main class="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6 items-start">
            <!-- Left Side: Map Container -->
            <div class="w-full lg:flex-1 bg-white shadow-xl rounded-xl overflow-hidden border border-gray-200 p-4 relative">
                <div class="flex items-center justify-between mb-4 px-2">
                    <div class="flex items-center gap-2 text-gray-500">
                        <i data-lucide="warehouse" class="w-4.5 h-4.5"></i>
                        <span class="text-sm font-bold uppercase tracking-wider">Bản đồ kho trực tuyến</span>
                    </div>
                    <div class="flex gap-4">
                        <div class="flex items-center gap-1.5">
                            <div class="w-3 h-3 rounded-full bg-green-500"></div>
                            <span class="text-[10px] font-bold text-gray-400 uppercase">Trống</span>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <div class="w-3 h-3 rounded-full bg-orange-500"></div>
                            <span class="text-[10px] font-bold text-gray-400 uppercase">Sắp đầy</span>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <div class="w-3 h-3 rounded-full bg-red-500"></div>
                            <span class="text-[10px] font-bold text-gray-400 uppercase">Đầy</span>
                        </div>
                    </div>
                </div>

                <div class="relative aspect-[11/14] w-full">
                    <!-- Scale Indicators -->
                    <div class="absolute right-0 top-0 bottom-0 flex items-center justify-end pointer-events-none z-0">
                        <div class="absolute top-0 bottom-0 right-0 border-r border-gray-400">
                            <div class="absolute top-0 right-0 w-1.5 h-px bg-gray-400"></div>
                            <div class="absolute bottom-0 right-0 w-1.5 h-px bg-gray-400"></div>
                        </div>
                        <span class="text-[10px] text-gray-500 font-medium absolute right-[-14px] top-1/2 -translate-y-1/2 [writing-mode:vertical-rl] rotate-180 whitespace-nowrap">
                            96m (1:340)
                        </span>
                    </div>
                    
                    <div class="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-end pointer-events-none z-0">
                        <div class="absolute left-0 right-0 bottom-0 border-b border-gray-400">
                            <div class="absolute left-0 bottom-0 w-px h-1.5 bg-gray-400"></div>
                            <div class="absolute right-0 bottom-0 w-px h-1.5 bg-gray-400"></div>
                        </div>
                        <span class="text-[10px] text-gray-500 font-medium absolute bottom-[-16px] left-1/2 -translate-x-1/2 whitespace-nowrap">
                            11m (1:50)
                        </span>
                    </div>

                    <!-- Map Area -->
                    <div class="relative w-full h-full" id="map-container">
                        ${areas.map(area => {
        const hasCapacity = area.capacity !== undefined;
        const percentage = hasCapacity && area.maxCapacity ? Math.min((area.capacity || 0) / area.maxCapacity * 100, 100) : 0;
        const isShort = parseFloat(area.height) <= 10;

        return `
                                <div
                                    data-id="${area.id}"
                                    class="map-area absolute flex flex-col items-center justify-center text-center p-0.5 overflow-hidden ${area.id === 'tram-dien' ? 'cursor-default' : 'cursor-pointer'}"
                                    style="
                                        top: ${area.top};
                                        left: ${area.left};
                                        width: ${area.width};
                                        height: ${area.height};
                                        background-color: ${area.color};
                                        border: 1px solid rgba(255,255,255,0.8);
                                        z-index: 1;
                                        transform: scale(1);
                                    "
                                >
                                    <div class="flex flex-col items-center justify-center w-full h-full gap-0.5 md:gap-1">
                                        <div class="flex items-center justify-center ${isShort ? 'flex-row gap-1.5 md:gap-2' : 'flex-col gap-0.5 md:gap-1'}">
                                            <span class="font-bold text-gray-900 select-none leading-none drop-shadow-sm ${area.id === 'loai-1' ? 'text-xl md:text-3xl' : isShort ? 'text-[8px] sm:text-[10px] md:text-xs' : 'text-[10px] sm:text-xs md:text-sm'} ${area.id === 'tram-dien' ? 'text-gray-600 font-normal' : ''}">
                                                ${area.name}
                                            </span>
                                            ${hasCapacity && area.id !== 'tram-dien' ? `
                                            <span class="font-black text-gray-900 drop-shadow-md leading-none ${isShort ? 'text-[8px] sm:text-[10px] md:text-xs bg-white/40 px-1 py-0.5 rounded-sm' : 'text-[9px] sm:text-[11px] md:text-xs'}">
                                                ${(area.capacity || 0).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ${area.unit}
                                            </span>
                                            ` : ''}
                                        </div>
                                        
                                        ${hasCapacity && area.id !== 'tram-dien' ? `
                                        <div class="w-[90%] bg-white/60 rounded-full overflow-hidden shadow-inner ${isShort ? 'h-1 max-w-[50px] md:max-w-[80px]' : 'h-1.5 md:h-2 max-w-[120px]'}">
                                            <div 
                                                class="h-full transition-all duration-500 ${percentage > 90 ? 'bg-red-600' : percentage > 70 ? 'bg-orange-500' : 'bg-green-600'}"
                                                style="width: ${percentage}%"
                                            ></div>
                                        </div>
                                        ` : ''}
                                    </div>
                                </div>
                              `;
    }).join('')}
                    </div>
                </div>
            </div>

            <!-- Right Side: Status List & Details -->
            <div class="w-full lg:w-96 flex flex-col gap-4">
                <!-- Summary Stats Bar -->
                <div class="grid grid-cols-2 gap-3">
                    <div class="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                        <span class="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Tổng khu vực</span>
                        <span class="text-xl font-black text-gray-700">${areas.length - 1}</span>
                    </div>
                    <div class="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                        <span class="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Cảnh báo đầy</span>
                        <span class="text-xl font-black text-red-500">
                            ${areas.filter(a => a.capacity && a.maxCapacity && (a.capacity / a.maxCapacity) > 0.9).length}
                        </span>
                    </div>
                </div>

                <!-- Live Status List -->
                <div class="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden flex flex-col">
                    <div class="bg-gray-50 p-3 border-b border-gray-100 flex items-center justify-between">
                        <span class="text-xs font-bold text-gray-500 uppercase">Trạng thái chi tiết</span>
                        <i data-lucide="info" class="w-3.5 h-3.5 text-gray-400"></i>
                    </div>
                    <div class="max-h-[400px] overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        ${areas.filter(a => a.id !== 'tram-dien').map(area => {
        const percentage = area.capacity && area.maxCapacity ? (area.capacity / area.maxCapacity) * 100 : 0;

        return `
                                <div 
                                    data-id="${area.id}"
                                    class="status-item p-2 rounded-lg border transition-all cursor-pointer flex flex-col gap-1 bg-white border-gray-50 hover:bg-gray-50"
                                >
                                    <div class="flex justify-between items-center">
                                        <span class="text-xs font-bold text-gray-700">
                                            ${area.name}
                                        </span>
                                        <span class="text-[10px] font-bold text-gray-500">
                                            ${(area.capacity || 0).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}/${(area.maxCapacity || 0).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}${area.unit === 'tấn' ? 't' : 'c'}
                                        </span>
                                    </div>
                                    <div class="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                        <div 
                                            class="h-full transition-all duration-500 ${percentage > 90 ? 'bg-red-500' : percentage > 70 ? 'bg-orange-500' : 'bg-green-500'}"
                                            style="width: ${percentage}%"
                                        ></div>
                                    </div>
                                </div>
                            `;
    }).join('')}
                    </div>
                </div>

                <!-- Hover Details Card -->
                <div id="hover-details-card-container" class="transition-all duration-300 opacity-0 scale-95 pointer-events-none hidden">
                </div>
            </div>
        </main>

        <footer class="mt-12 text-center text-gray-400 text-xs">
            <p>© 2026 Warehouse Management System - Sơ đồ kho phế liệu chuẩn tỉ lệ</p>
        </footer>
    `;

    lucide.createIcons();
    attachEventListeners();
}

function updateUIForHoverState(id) {
    hoveredId = id;

    // 1. Update Map Areas
    const mapAreas = document.querySelectorAll('.map-area');
    mapAreas.forEach(el => {
        const areaId = el.getAttribute('data-id');
        if (areaId === 'tram-dien') return;

        const isHovered = (id === areaId);
        el.style.border = isHovered ? '2px solid #d92d20' : '1px solid rgba(255,255,255,0.8)';
        el.style.zIndex = isHovered ? '20' : '1';
        el.style.transform = isHovered ? 'scale(1.02)' : 'scale(1)';
        el.style.filter = (id && !isHovered) ? 'brightness(0.95) grayscale(0.1)' : 'none';
    });

    // 2. Update Status Items
    const statusItems = document.querySelectorAll('.status-item');
    statusItems.forEach(el => {
        const areaId = el.getAttribute('data-id');
        const isHovered = (id === areaId);

        if (isHovered) {
            el.className = 'status-item p-2 rounded-lg border transition-all cursor-pointer flex flex-col gap-1 bg-red-50 border-red-200 shadow-sm';
        } else {
            el.className = 'status-item p-2 rounded-lg border transition-all cursor-pointer flex flex-col gap-1 bg-white border-gray-50 hover:bg-gray-50';
        }
    });

    // 3. Update Hover Details Card
    const cardContainer = document.getElementById('hover-details-card-container');
    if (cardContainer) {
        if (id && id !== 'tram-dien') {
            const area = areas.find(a => a.id === id);
            if (area) {
                const percentage = area.capacity && area.maxCapacity ? Math.min((area.capacity || 0) / area.maxCapacity * 100, 100) : 0;
                cardContainer.innerHTML = `
                    <div class="bg-[#1a1a1a] text-white p-4 rounded-xl shadow-2xl border border-gray-800">
                        <div class="flex items-center gap-2 mb-2">
                            <i data-lucide="map-pin" class="w-4 h-4 text-red-500"></i>
                            <h3 class="text-sm font-bold uppercase">${area.name}</h3>
                        </div>
                        <p class="text-[10px] text-gray-400 mb-3 leading-tight italic">
                            ${area.description}
                        </p>
                        <div class="flex flex-wrap gap-1.5 mb-3">
                            ${area.info.map(item => `
                                <span class="text-[9px] bg-gray-800 px-2 py-0.5 rounded border border-gray-700">
                                    ${item}
                                </span>
                            `).join('')}
                        </div>
                        <div class="bg-white/5 p-2 rounded-lg">
                            <div class="flex justify-between text-[10px] mb-1">
                                <span class="text-gray-400">TRỐNG</span>
                                <span class="font-bold text-green-400">
                                    ${area.capacity !== undefined && area.maxCapacity !== undefined ? `${(area.maxCapacity - area.capacity).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ${area.unit}` : 'N/A'}
                                </span>
                            </div>
                            <div class="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                                <div 
                                    class="h-full bg-red-500" 
                                    style="width: ${percentage}%"
                                ></div>
                            </div>
                        </div>
                    </div>
                `;
                lucide.createIcons({
                    attrs: { class: 'lucide' },
                    nameAttr: 'data-lucide',
                    root: cardContainer
                });

                cardContainer.className = 'transition-all duration-300 opacity-100 scale-100';
            }
        } else {
            cardContainer.className = 'transition-all duration-300 opacity-0 scale-95 pointer-events-none hidden';
        }
    }
}

function attachEventListeners() {
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', fetchData);
    }

    const mapAreas = document.querySelectorAll('.map-area');
    mapAreas.forEach(el => {
        const id = el.getAttribute('data-id');
        if (id && id !== 'tram-dien') {
            el.addEventListener('mouseenter', () => {
                updateUIForHoverState(id);
            });
            el.addEventListener('mouseleave', () => {
                updateUIForHoverState(null);
            });
            el.addEventListener('click', () => {
                updateUIForHoverState(hoveredId === id ? null : id);
            });
        }
    });

    const statusItems = document.querySelectorAll('.status-item');
    statusItems.forEach(el => {
        const id = el.getAttribute('data-id');
        if (id) {
            el.addEventListener('mouseenter', () => {
                updateUIForHoverState(id);
            });
            el.addEventListener('mouseleave', () => {
                updateUIForHoverState(null);
            });
            el.addEventListener('click', () => {
                updateUIForHoverState(hoveredId === id ? null : id);
            });
        }
    });
}

async function fetchData() {
    loading = true;
    errorMsg = null;
    render();

    try {
        const response = await fetch(SPREADSHEET_URL);
        if (!response.ok) throw new Error('Không thể tải dữ liệu từ Google Sheets. Vui lòng kiểm tra quyền truy cập của link.');
        const csvText = await response.text();

        Papa.parse(csvText, {
            skipEmptyLines: true,
            complete: (results) => {
                const rows = results.data;

                if (rows.length === 0) {
                    errorMsg = 'Bảng tính trống hoặc không có dữ liệu hợp lệ.';
                    loading = false;
                    render();
                    return;
                }

                areas = INITIAL_AREAS.map(area => {
                    const matches = rows.filter(row => {
                        const cellC = (row[2] || '').trim().toLowerCase();
                        const cellB = (row[1] || '').trim().toLowerCase();
                        const areaName = area.name.toLowerCase();
                        const areaFullName = area.fullName.toLowerCase();

                        return (cellC && (cellC.includes(areaName) || areaFullName.includes(cellC))) ||
                            (cellB && (cellB.includes(areaName) || areaFullName.includes(cellB)));
                    });

                    if (matches.length > 0) {
                        const totalWeightKg = matches.reduce((sum, match) => {
                            let weightStr = (match[4] || '0').trim();

                            if (weightStr.includes(',') && !weightStr.includes('.')) {
                                weightStr = weightStr.replace(',', '.');
                            } else {
                                weightStr = weightStr.replace(/,/g, '');
                            }

                            const weight = parseFloat(weightStr);
                            return sum + (isNaN(weight) ? 0 : weight);
                        }, 0);

                        if (area.id === 'vo-xe') {
                            return { ...area, capacity: Number(totalWeightKg.toFixed(0)) };
                        } else {
                            const totalWeightTon = totalWeightKg / 1000;
                            return { ...area, capacity: Number(totalWeightTon.toFixed(3)) };
                        }
                    }
                    return area;
                });

                lastUpdated = new Date().toLocaleTimeString('vi-VN');
                loading = false;
                render();
            },
            error: (err) => {
                errorMsg = 'Lỗi khi phân tích dữ liệu CSV: ' + err.message;
                loading = false;
                render();
            }
        });
    } catch (err) {
        errorMsg = 'Lỗi khi kết nối: ' + err.message;
        loading = false;
        render();
    }
}

// Initial render
render();

// Fetch data
fetchData();

// Auto refresh every 5 minutes
setInterval(fetchData, 5 * 60 * 1000);