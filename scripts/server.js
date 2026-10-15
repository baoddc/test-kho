const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const PUBLIC_DIR = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

// BẢO MẬT: Không bao giờ phục vụ file bí mật / dữ liệu nội bộ
const BLOCKED_PATTERNS = [
  /(^|[\\/])\./,                    // .git, .env, .agents, .vscode, ...
  /(^|[\\/])service_account[^\\/]*\.json$/i,
  /(^|[\\/])(backups|node_modules|scripts|supabase|voice-service|cloudflare-r2|android|tests|docs)([\\/]|$)/i,
  /\.(bat|ps1|vbs|py|sql|md|log|csv|toml)$/i
];

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  let reqPath;
  try {
    reqPath = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch (_) {
    return send(res, 400, '400 Bad Request');
  }

  if (reqPath.includes('\0')) return send(res, 400, '400 Bad Request');
  if (reqPath === '/') reqPath = '/index.html';

  // BẢO MẬT: Chặn Path Traversal (../../) — đường dẫn phải nằm trong PUBLIC_DIR
  const filePath = path.resolve(PUBLIC_DIR, '.' + path.posix.normalize('/' + reqPath));
  const relPath = path.relative(PUBLIC_DIR, filePath);
  if (relPath.startsWith('..') || path.isAbsolute(relPath)) {
    return send(res, 403, '403 Forbidden');
  }
  if (BLOCKED_PATTERNS.some((re) => re.test(relPath))) {
    return send(res, 404, '404 Not Found');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      return send(res, 404, '404 Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
