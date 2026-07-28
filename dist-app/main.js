const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

let mainWindow = null;
let server = null;
let isQuitting = false;

// MIME types for local file server
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

// Create local HTTP server for Electron app
function createLocalServer() {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      const urlPath = req.url.split('?')[0];
      if (urlPath === '/version.json') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({
          version: app.getVersion(),
          releaseNotes: `Phiên bản PC app (${app.getVersion()})`,
          minExeVersion: '1.0.0'
        }));
      }

      let safePath = path.normalize(decodeURIComponent(urlPath));
      if (safePath === '/' || safePath === '\\') {
        safePath = '/index.html';
      }

      const filePath = path.join(__dirname, safePath);

      // Prevent directory traversal
      if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        return res.end('Access Denied');
      }

      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
          // Fallback to index.html if route not found
          const indexPath = path.join(__dirname, 'index.html');
          fs.readFile(indexPath, (errIndex, data) => {
            if (errIndex) {
              res.writeHead(404);
              return res.end('Not Found');
            }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(data);
          });
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
      });
    });

    // Listen on random available port on localhost
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      console.log(`[Electron Server] Running on http://127.0.0.1:${port}`);
      server = srv;
      resolve(port);
    });

    srv.on('error', reject);
  });
}

async function createWindow() {
  Menu.setApplicationMenu(null); // Hide default menu bar

  const port = await createLocalServer();
  const localUrl = `http://127.0.0.1:${port}/index.html`;
  const ONLINE_URL = 'https://web-supabase-five.vercel.app/pages/index.html';

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'Hệ thống Quản lý Kho Phôi Cuộn - DDC',
    icon: path.join(__dirname, 'assets', 'images', 'icon-512.png'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  // Xóa cache session để luôn nạp mới nhất
  mainWindow.webContents.session.clearCache().catch(() => {});

  // Hỗ trợ phím tắt Phóng to / Thu nhỏ / Về mặc định (Ctrl + +, Ctrl + -, Ctrl + 0)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.control || input.meta) {
      if (input.key === '=' || input.key === '+' || input.code === 'NumpadAdd') {
        const currentZoom = mainWindow.webContents.getZoomLevel();
        if (currentZoom < 5) mainWindow.webContents.setZoomLevel(currentZoom + 0.5);
        event.preventDefault();
      } else if (input.key === '-' || input.key === '_' || input.code === 'NumpadSubtract') {
        const currentZoom = mainWindow.webContents.getZoomLevel();
        if (currentZoom > -3) mainWindow.webContents.setZoomLevel(currentZoom - 0.5);
        event.preventDefault();
      } else if (input.key === '0' || input.code === 'Numpad0') {
        mainWindow.webContents.setZoomLevel(0);
        event.preventDefault();
      }
    }
  });

  // Hỗ trợ Phóng to / Thu nhỏ bằng Ctrl + Con lăn chuột (Ctrl + MouseWheel)
  mainWindow.webContents.on('zoom-changed', (event, zoomDirection) => {
    const currentZoom = mainWindow.webContents.getZoomLevel();
    if (zoomDirection === 'in') {
      if (currentZoom < 5) mainWindow.webContents.setZoomLevel(currentZoom + 0.3);
    } else if (zoomDirection === 'out') {
      if (currentZoom > -3) mainWindow.webContents.setZoomLevel(currentZoom - 0.3);
    }
  });

  // Đảm bảo Ctrl + Lăn chuột hoạt động mượt mà trên tất cả các trang
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      if (!window.__ctrlWheelZoomAttached) {
        window.__ctrlWheelZoomAttached = true;
        window.addEventListener('wheel', function(e) {
          if (e.ctrlKey) {
            e.preventDefault();
          }
        }, { passive: false });
      }
    `).catch(() => {});
  });

  // Nạp giao diện ứng dụng từ máy chủ nội cục (Local Standalone Executable App)
  mainWindow.loadURL(localUrl).catch((err) => {
    console.error('[Electron] Failed to load local URL:', err);
  });

  mainWindow.on('close', async (e) => {
    if (isQuitting) return;
    e.preventDefault();

    let isEditingOrAdding = false;
    try {
      isEditingOrAdding = await mainWindow.webContents.executeJavaScript(`
        (() => {
          const modals = Array.from(document.querySelectorAll('.modal, [id*="modal"], [class*="modal"], .popup-container, .dialog, dialog[open]'));
          return modals.some(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0;
          });
        })()
      `);
    } catch (err) {
      isEditingOrAdding = false;
    }

    let dialogOptions;
    if (isEditingOrAdding) {
      dialogOptions = {
        type: 'warning',
        buttons: ['Không', 'Có'],
        defaultId: 0,
        cancelId: 0,
        title: 'Cảnh báo dữ liệu chưa lưu',
        message: 'Bạn đang mở cửa sổ Thêm/Sửa dữ liệu.',
        detail: 'Bạn có chắc chắn muốn đóng ứng dụng không? Các thay đổi chưa lưu có thể bị mất.'
      };
    } else {
      dialogOptions = {
        type: 'question',
        buttons: ['Hủy', 'Đồng ý'],
        defaultId: 0,
        cancelId: 0,
        title: 'Xác nhận thoát',
        message: 'Bạn có chắc chắn muốn thoát ứng dụng Quản lý Kho Phôi Cuộn - DDC không?'
      };
    }

    const { response } = await dialog.showMessageBox(mainWindow, dialogOptions);
    if (response === 1) {
      isQuitting = true;
      app.quit();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (server) {
    server.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
