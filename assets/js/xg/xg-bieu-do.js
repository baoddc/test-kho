/* =============================================================================
   DASHBOARD BIỂU ĐỒ XÀ GỒ
   JavaScript xử lý dữ liệu và hiển thị biểu đồ
================================================================================ */

/* =============================================================================
   CONSTANTS & CONFIGURATION
   Các hằng số cấu hình cho dashboard
================================================================================ */

/* =============================================================================
   GLOBAL VARIABLES
   Biến toàn cục quản lý dữ liệu
================================================================================ */


// Import totals by type
let importByType = {
  ncc: 0,        // Nhập nhà cung cấp
  xuong: 0,      // Nhập xưởng sản xuất
  giaCong: 0,    // Nhập gia công ngoài
  congTrinh: 0   // Nhập công trình
};

// Export totals by type
let exportByType = {
  xuong: 0,        // Xuất xưởng sản xuất
  dieuChuyen: 0,   // Xuất điều chuyển
  giaCong: 0,     // Xuất gia công ngoài
  congTrinh: 0    // Xuất công trình
};

// Chart instances
let barChart = null;
let pieChart = null;
let lineChart = null;
let workshopChart = null;
let importMaterialChart = null;
let exportMaterialChart = null;

/* =============================================================================
   UTILITY FUNCTIONS
   Các hàm tiện ích
================================================================================ */

// Utility: debounce
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    const later = () => { clearTimeout(timeout); func(...args); };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Format date to display
function formatMonthYear(date) {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}/${month}`;
}

// Format số với dấu phẩy ngăn cách
function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return num.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

/* =============================================================================
   AUTHENTICATION
   Kiểm tra và quản lý đăng nhập
================================================================================ */

window.addEventListener('load', () => {
  const currentUser = localStorage.getItem('currentUser');
  if (!currentUser) {
    window.location.href = '/pages/index.html';
    return;
  }

  // Hiển thị username
  const usernameEl = document.getElementById('currentUsername');
  if (usernameEl) usernameEl.textContent = currentUser;

  // Xử lý nút đăng xuất
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('currentUser');
      window.location.replace('/pages/index.html');
    });
  }

  // Logo click to go home
  const logo = document.querySelector('.logo');
  if (logo) {
    logo.style.cursor = 'pointer';
    logo.addEventListener('click', () => {
      window.location.href = '/';
    });
  }

  loadAllData();
  setupDashboardRealtime();
});

/* =============================================================================
   DATA LOADING
   Toàn bộ số liệu biểu đồ tính ở server (RPC dashboard_kho, có cache), trình duyệt
   không còn tải toàn bộ bảng nhập / xuất về.
================================================================================ */

const DASHBOARD_KHO = 'xg';

async function loadAllData() {
  const loadingEl = document.getElementById('loading');
  try {
    loadingEl.style.display = '';
    loadingEl.textContent = 'Đang tải dữ liệu từ database...';

    await refreshDashboard();

    loadingEl.style.display = 'none';
    setupDashboardRealtime();
  } catch (error) {
    loadingEl.innerHTML =
      `Lỗi kết nối database: ${error.message}<br>Kiểm tra kết nối hoặc cấu hình Supabase.`;
    console.error(error);
  }
}

let dashboardSeq = 0;

// Lấy số liệu theo khoảng ngày đang chọn rồi vẽ lại toàn bộ thẻ số liệu + biểu đồ
async function refreshDashboard() {
  const seq = ++dashboardSeq;
  const fromDateInput = document.getElementById('fromDate')?.value || null;
  const toDateInput = document.getElementById('toDate')?.value || null;
  const result = await SQ.dashboard(DASHBOARD_KHO, fromDateInput, toDateInput);
  if (seq !== dashboardSeq) return;
  renderDashboard(result || {});
}

/* =============================================================================
   REALTIME & BROADCAST DASHBOARD SYNC
================================================================================ */

const xgChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('xg_sync_channel') : null;
let realtimeChannel = null;

function setupDashboardRealtime() {
  if (xgChannel && !window._xgDashboardBroadcastInitialized) {
    window._xgDashboardBroadcastInitialized = true;
    xgChannel.onmessage = (event) => {
      const msg = event.data;
      if (!msg || !msg.type) return;
      debouncedReloadDashboard();
    };
  }

  if (window.supabase && !realtimeChannel) {
    try {
      realtimeChannel = window.supabase
        .channel('public:xg_realtime_bieudo')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'xg-xuat' }, () => {
          debouncedReloadDashboard();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'xg-nhap' }, () => {
          debouncedReloadDashboard();
        })
        .subscribe();
    } catch (err) {
      console.warn('[xg-bieu-do] Realtime error:', err);
    }
  }
}

const debouncedReloadDashboard = debounce(() => {
  reloadDashboardQuietly();
}, 500);

async function reloadDashboardQuietly() {
  try {
    await refreshDashboard();
  } catch (err) {
    console.error('Silent dashboard reload error:', err);
  }
}

/* =============================================================================
   DATA PROCESSING
   Dựng thẻ số liệu và biểu đồ từ kết quả dashboard_kho (cùng công thức với bản cũ)
================================================================================ */

function renderDashboard(res) {
  importByType = Object.assign({ ncc: 0, xuong: 0, giaCong: 0, congTrinh: 0 }, res.importByType);
  exportByType = Object.assign({ xuong: 0, dieuChuyen: 0, giaCong: 0, congTrinh: 0 }, res.exportByType);

  const months = res.months || [];
  const monthDate = (key) => {
    const [y, m] = String(key).split('-').map(Number);
    return new Date(y, m - 1, 1);
  };

  // Tồn kho cuối mỗi tháng: tính lùi từ tồn hiện tại theo nhập / xuất toàn thời gian
  // Stock(M-1) = Stock(M) - Import(M) + Export(M)
  const globalTrendBalances = {};
  const globalMonths = res.globalMonths || [];
  let balance = Number(res.totalCurrentStock) || 0;
  for (let i = globalMonths.length - 1; i >= 0; i--) {
    const g = globalMonths[i];
    globalTrendBalances[g.m] = balance;
    balance = balance - (Number(g.import) || 0) + (Number(g.export) || 0);
  }

  // Update summary cards
  const rollMetrics = res.rollMetrics || {};
  const turnover = Number(rollMetrics.turnover) || 0;
  const averageStorageDays = Number(rollMetrics.averageStorageDays) || 0;
  document.getElementById('totalImport').textContent = formatNumber(Number(res.totalImport) || 0);
  document.getElementById('totalExport').textContent = formatNumber(Number(res.totalExport) || 0);
  document.getElementById('inventoryBegin').textContent = formatNumber(Number(res.inventoryBegin) || 0);
  document.getElementById('inventoryTurnover').textContent = turnover > 0 ? formatNumber(turnover) : '—';
  document.getElementById('inventoryDSI').textContent = averageStorageDays > 0 ? formatNumber(averageStorageDays) : '—';

  const averageStockAge = Number(res.averageStockAge) || 0;
  const averageStockAgeElement = document.getElementById('averageStockAge');
  if (averageStockAgeElement) {
    averageStockAgeElement.textContent = averageStockAge > 0 ? formatNumber(averageStockAge) : '—';
  }

  // Update import type cards
  document.getElementById('importNCC').textContent = formatNumber(Number(importByType.ncc) || 0);
  document.getElementById('importXuong').textContent = formatNumber(Number(importByType.xuong) || 0);
  document.getElementById('importGiaCong').textContent = formatNumber(Number(importByType.giaCong) || 0);
  document.getElementById('importCongTrinh').textContent = formatNumber(Number(importByType.congTrinh) || 0);

  // Update export type cards
  document.getElementById('exportXuong').textContent = formatNumber(Number(exportByType.xuong) || 0);
  document.getElementById('exportDieuChuyen').textContent = formatNumber(Number(exportByType.dieuChuyen) || 0);
  document.getElementById('exportGiaCong').textContent = formatNumber(Number(exportByType.giaCong) || 0);
  document.getElementById('exportCongTrinh').textContent = formatNumber(Number(exportByType.congTrinh) || 0);

  // Prepare chart data
  const labels = months.map(m => formatMonthYear(monthDate(m.m)));
  const importValues = months.map(m => Number(m.import) || 0);
  const exportValues = months.map(m => Number(m.export) || 0);
  const inventoryTrendValues = months.map(m => globalTrendBalances[m.m] || 0);

  const toMaterialVolumes = (items) => {
    const volumes = {};
    (items || []).forEach(it => { volumes[it.key] = { qty: Number(it.qty) || 0, ten: it.ten || '' }; });
    return volumes;
  };
  const workshopVolumes = {};
  (res.workshops || []).forEach(w => { workshopVolumes[w.name] = Number(w.qty) || 0; });

  // Create charts
  createBarChart(labels, importValues, exportValues);

  // Pie chart with dynamic toggle
  const pieSelect = document.getElementById('pieChartSelect');
  if (pieSelect) {
    const newSelect = pieSelect.cloneNode(true);
    pieSelect.parentNode.replaceChild(newSelect, pieSelect);
    newSelect.value = newSelect.value || 'import';
    newSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      const titleEl = document.getElementById('pieChartTitle');
      if (titleEl) {
        titleEl.textContent = val === 'import' ? 'CƠ CẤU NHẬP KHO' : 'CƠ CẤU XUẤT KHO';
      }
      createPieChart(val);
    });
    createPieChart(newSelect.value);
  } else {
    createPieChart('import');
  }

  createLineChart(labels, inventoryTrendValues);
  createWorkshopChart(workshopVolumes);
  createImportMaterialChart(toMaterialVolumes(res.importMaterials));
  createExportMaterialChart(toMaterialVolumes(res.exportMaterials));
}

/* =============================================================================
   CHART CREATION
   Tạo các biểu đồ bằng Chart.js
================================================================================ */

// Bar Chart - Nhập vs Xuất theo tháng
function createBarChart(labels, importValues, exportValues) {
  const ctx = document.getElementById('barChart').getContext('2d');

  if (barChart) {
    barChart.destroy();
  }

  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Nhập',
          data: importValues,
          backgroundColor: 'rgba(52, 152, 219, 0.8)',
          borderColor: '#3498db',
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: 'Xuất',
          data: exportValues,
          backgroundColor: 'rgba(231, 76, 60, 0.8)',
          borderColor: '#e74c3c',
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: getChartThemeColors().tooltipBg,
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          callbacks: {
            label: function (context) {
              return context.dataset.label + ': ' + formatNumber(context.raw) + ' kg';
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: getChartThemeColors().gridColor,
            drawBorder: false,
          },
          ticks: {
            color: getChartThemeColors().textColor,
            font: {
              size: 11
            }
          }
        },
        y: {
          grid: {
            color: getChartThemeColors().gridColor,
            drawBorder: false,
          },
          ticks: {
            color: getChartThemeColors().textColor,
            font: {
              size: 11
            },
            callback: function (value) {
              return formatNumber(value);
            }
          },
          beginAtZero: true
        }
      }
    }
  });
}

// Doughnut Chart - Cơ cấu Nhập / Cơ cấu Xuất
function createPieChart(type = 'import') {
  const ctx = document.getElementById('pieChart').getContext('2d');

  if (pieChart) {
    pieChart.destroy();
  }

  let labels = [];
  let data = [];
  let bgColors = [];
  let borderColors = [];

  if (type === 'import') {
    labels = ['Nhà cung cấp', 'Xưởng SX', 'Gia công ngoài', 'Công trình'];
    data = [importByType.ncc, importByType.xuong, importByType.giaCong, importByType.congTrinh];
    bgColors = [
      'rgba(52, 152, 219, 0.85)',
      'rgba(46, 204, 113, 0.85)',
      'rgba(241, 196, 15, 0.85)',
      'rgba(155, 89, 182, 0.85)'
    ];
    borderColors = ['#3498db', '#2ecc71', '#f1c40f', '#9b59b6'];
  } else {
    labels = ['Xưởng SX', 'Điều chuyển', 'Gia công ngoài', 'Công trình'];
    data = [exportByType.xuong, exportByType.dieuChuyen, exportByType.giaCong, exportByType.congTrinh];
    bgColors = [
      'rgba(46, 204, 113, 0.85)',
      'rgba(230, 126, 34, 0.85)',
      'rgba(241, 196, 15, 0.85)',
      'rgba(155, 89, 182, 0.85)'
    ];
    borderColors = ['#2ecc71', '#e67e22', '#f1c40f', '#9b59b6'];
  }

  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '55%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: getChartThemeColors().textColor,
            padding: 12,
            font: {
              size: 11
            },
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          backgroundColor: getChartThemeColors().tooltipBg,
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: function (context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? ((context.raw / total) * 100).toFixed(1) : 0;
              return context.label + ': ' + formatNumber(context.raw) + ' kg (' + percentage + '%)';
            }
          }
        }
      }
    }
  });
}

// Line Chart - Biến động Tồn kho cuối kì theo tháng
function createLineChart(labels, inventoryTrendValues) {
  const ctx = document.getElementById('lineChart').getContext('2d');

  if (lineChart) {
    lineChart.destroy();
  }

  lineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Tồn kho cuối kì',
          data: inventoryTrendValues,
          borderColor: '#2ecc71',
          backgroundColor: 'rgba(46, 204, 113, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#2ecc71',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: getChartThemeColors().tooltipBg,
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          callbacks: {
            label: function (context) {
              return context.dataset.label + ': ' + formatNumber(context.raw) + ' kg';
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: getChartThemeColors().gridColor,
            drawBorder: false,
          },
          ticks: {
            color: getChartThemeColors().textColor,
            font: {
              size: 11
            }
          }
        },
        y: {
          grid: {
            color: getChartThemeColors().gridColor,
            drawBorder: false,
          },
          ticks: {
            color: getChartThemeColors().textColor,
            font: {
              size: 11
            },
            callback: function (value) {
              return formatNumber(value);
            }
          },
          beginAtZero: true
        }
      }
    }
  });
}

// Horizontal Bar Chart - Phân bổ Xuất kho theo Công trình
function createWorkshopChart(workshopVolumes) {
  const container = document.getElementById('workshopChartContainer');
  if (workshopChart) {
    workshopChart.destroy();
  }

  const sortedWorkshops = Object.keys(workshopVolumes)
    .sort((a, b) => workshopVolumes[b] - workshopVolumes[a]);

  if (container) {
    const newHeight = Math.max(350, sortedWorkshops.length * 35);
    container.style.height = newHeight + 'px';
  }

  const ctx = document.getElementById('workshopChart').getContext('2d');

  const labels = sortedWorkshops;
  const data = sortedWorkshops.map(w => workshopVolumes[w]);

  workshopChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Sản lượng xuất (kg)',
        data: data,
        backgroundColor: 'rgba(230, 126, 34, 0.8)',
        borderColor: '#e67e22',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: getChartThemeColors().tooltipBg,
          callbacks: {
            label: function (context) {
              return context.dataset.label + ': ' + formatNumber(context.raw) + ' kg';
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: getChartThemeColors().gridColor,
            drawBorder: false
          },
          ticks: {
            color: getChartThemeColors().textColor,
            font: { size: 10 }
          }
        },
        y: {
          grid: {
            display: false
          },
          ticks: {
            color: getChartThemeColors().textColor,
            font: { size: 10 }
          }
        }
      }
    }
  });
}

// Horizontal Bar Chart - Top 10 Vật tư nhập kho nhiều nhất
function createImportMaterialChart(materialVolumes) {
  const ctx = document.getElementById('importMaterialChart').getContext('2d');

  if (importMaterialChart) {
    importMaterialChart.destroy();
  }

  const getVolume = (val) => (typeof val === 'object' && val !== null ? (val.qty || 0) : Number(val || 0));

  const sortedMaterials = Object.keys(materialVolumes)
    .sort((a, b) => getVolume(materialVolumes[b]) - getVolume(materialVolumes[a]))
    .slice(0, 10);

  const labels = sortedMaterials;
  const data = sortedMaterials.map(m => getVolume(materialVolumes[m]));

  importMaterialChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Sản lượng nhập (kg)',
        data: data,
        backgroundColor: 'rgba(52, 152, 219, 0.8)',
        borderColor: '#3498db',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: getChartThemeColors().tooltipBg,
          callbacks: {
            title: function (items) {
              if (!items || items.length === 0) return '';
              const key = items[0].label;
              const itemInfo = typeof materialVolumes[key] === 'object' ? materialVolumes[key] : null;
              if (itemInfo && itemInfo.ten) {
                return `${key}\n${itemInfo.ten}`;
              }
              return key;
            },
            label: function (context) {
              return context.dataset.label + ': ' + formatNumber(context.raw) + ' kg';
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: getChartThemeColors().gridColor,
            drawBorder: false
          },
          ticks: {
            color: getChartThemeColors().textColor,
            font: { size: 10 }
          }
        },
        y: {
          grid: {
            display: false
          },
          ticks: {
            color: getChartThemeColors().textColor,
            font: { size: 10 }
          }
        }
      }
    }
  });
}

// Horizontal Bar Chart - Top 10 Vật tư xuất kho nhiều nhất
function createExportMaterialChart(materialVolumes) {
  const ctx = document.getElementById('exportMaterialChart').getContext('2d');

  if (exportMaterialChart) {
    exportMaterialChart.destroy();
  }

  const getVolume = (val) => (typeof val === 'object' && val !== null ? (val.qty || 0) : Number(val || 0));

  const sortedMaterials = Object.keys(materialVolumes)
    .sort((a, b) => getVolume(materialVolumes[b]) - getVolume(materialVolumes[a]))
    .slice(0, 10);

  const labels = sortedMaterials;
  const data = sortedMaterials.map(m => getVolume(materialVolumes[m]));

  exportMaterialChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Sản lượng xuất (kg)',
        data: data,
        backgroundColor: 'rgba(231, 76, 60, 0.8)',
        borderColor: '#e74c3c',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: getChartThemeColors().tooltipBg,
          callbacks: {
            title: function (items) {
              if (!items || items.length === 0) return '';
              const key = items[0].label;
              const itemInfo = typeof materialVolumes[key] === 'object' ? materialVolumes[key] : null;
              if (itemInfo && itemInfo.ten) {
                return `${key}\n${itemInfo.ten}`;
              }
              return key;
            },
            label: function (context) {
              return context.dataset.label + ': ' + formatNumber(context.raw) + ' kg';
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: getChartThemeColors().gridColor,
            drawBorder: false
          },
          ticks: {
            color: getChartThemeColors().textColor,
            font: { size: 10 }
          }
        },
        y: {
          grid: {
            display: false
          },
          ticks: {
            color: getChartThemeColors().textColor,
            font: { size: 10 }
          }
        }
      }
    }
  });
}

/* =============================================================================
   DATE FILTER FUNCTIONS
   Xử lý lọc dữ liệu theo ngày
================================================================================ */

// Apply filter: tính lại số liệu ở server theo khoảng ngày mới
function applyDateFilter() {
  refreshDashboard().catch(err => console.error('Dashboard filter error:', err));
}

// Reset filter
function resetDateFilter() {
  const fromEl = document.getElementById('fromDate');
  const toEl = document.getElementById('toDate');
  if (fromEl) fromEl.value = '';
  if (toEl) toEl.value = '';
  refreshDashboard().catch(err => console.error('Dashboard filter error:', err));
}

/* =============================================================================
   FILTER EVENTS & NAVIGATION
   Xử lý sự kiện bộ lọc và điều hướng
================================================================================ */

function initFilterAndNavigationEvents() {
  // Date filter event listeners
  const btnApplyFilter = document.getElementById('btnApplyFilter');
  const btnResetFilter = document.getElementById('btnResetFilter');

  if (btnApplyFilter) {
    btnApplyFilter.addEventListener('click', applyDateFilter);
  }

  if (btnResetFilter) {
    btnResetFilter.addEventListener('click', resetDateFilter);
  }

  const fromDateEl = document.getElementById('fromDate');
  const toDateEl = document.getElementById('toDate');
  if (fromDateEl) {
    fromDateEl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') applyDateFilter();
    });
  }
  if (toDateEl) {
    toDateEl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') applyDateFilter();
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFilterAndNavigationEvents);
} else {
  initFilterAndNavigationEvents();
}

// Helper to get theme-aware colors for Chart.js
function getChartThemeColors() {
  const isLight = document.documentElement.getAttribute('data-bs-theme') === 'light';
  return {
    textColor: isLight ? '#475569' : '#aaa',
    gridColor: isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)',
    tooltipBg: isLight ? 'rgba(15, 23, 42, 0.9)' : 'rgba(0, 0, 0, 0.8)'
  };
}

// Update active charts with theme styling dynamically
function updateChartsTheme() {
  const colors = getChartThemeColors();
  const charts = [barChart, pieChart, lineChart, workshopChart, importMaterialChart, exportMaterialChart];

  charts.forEach(chart => {
    if (!chart) return;
    
    if (chart.options.plugins) {
      if (chart.options.plugins.legend && chart.options.plugins.legend.labels) {
        chart.options.plugins.legend.labels.color = colors.textColor;
      }
      if (chart.options.plugins.tooltip) {
        chart.options.plugins.tooltip.backgroundColor = colors.tooltipBg;
      }
    }

    if (chart.options.scales) {
      if (chart.options.scales.x) {
        if (chart.options.scales.x.ticks) chart.options.scales.x.ticks.color = colors.textColor;
        if (chart.options.scales.x.grid) chart.options.scales.x.grid.color = colors.gridColor;
      }
      if (chart.options.scales.y) {
        if (chart.options.scales.y.ticks) chart.options.scales.y.ticks.color = colors.textColor;
        if (chart.options.scales.y.grid) chart.options.scales.y.grid.color = colors.gridColor;
      }
    }
    
    chart.update();
  });
}

// Observe theme updates to apply changes on toggle
const themeObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'attributes' && mutation.attributeName === 'data-bs-theme') {
      updateChartsTheme();
    }
  });
});
themeObserver.observe(document.documentElement, { attributes: true });



