const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

let mainWindow = null;
let server = null;

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
      let safePath = path.normalize(decodeURIComponent(req.url.split('?')[0]));
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
  const ONLINE_URL = 'https://baoddc.github.io/test-kho/index.html';

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

  // Fallback sang local server nếu load online thất bại (offline)
  mainWindow.webContents.on('did-fail-load', (event, errorCode) => {
    if (errorCode !== -3 && mainWindow && !mainWindow.webContents.getURL().includes('127.0.0.1')) {
      console.log('[Electron] Loading online URL failed. Falling back to local server.');
      mainWindow.loadURL(localUrl);
    }
  });

  // Thử nạp URL online (để luôn tự động cập nhật code mới nhất từ Web)
  mainWindow.loadURL(ONLINE_URL).catch(() => {
    mainWindow.loadURL(localUrl);
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
