/**
 * Kiểm tra bảo mật Cloudflare R2 Worker (cloudflare-r2/worker.js) với bucket & Supabase giả lập.
 * Chạy: node tests/verify-r2-worker-auth.mjs
 */
import assert from 'node:assert/strict';
import worker from '../cloudflare-r2/worker.js';

const VALID_TOKEN = 'valid-user-access-token';
const ANON = 'sb_publishable_zxmsB9cyjDwi9ai9Vw-s1w_QlqKMG0S';

// Giả lập Supabase /auth/v1/user: chỉ VALID_TOKEN là phiên hợp lệ
globalThis.fetch = async (url, init = {}) => {
  const auth = (init.headers && init.headers.Authorization) || '';
  if (String(url).endsWith('/auth/v1/user') && auth === 'Bearer ' + VALID_TOKEN) {
    return new Response(JSON.stringify({ id: 'user-1' }), { status: 200 });
  }
  return new Response('{}', { status: 401 });
};

function makeBucket() {
  const store = new Map();
  return {
    store,
    async put(key, body, opts) { store.set(key, { opts }); },
    async delete(key) { store.delete(key); },
    async get(key) {
      const v = store.get(key);
      return v ? { body: 'x', httpEtag: 'e', httpMetadata: v.opts.httpMetadata } : null;
    }
  };
}

function uploadReq(headers, type = 'image/jpeg', name = 'a.jpg') {
  const fd = new FormData();
  fd.append('file', new File(['img'], name, { type }));
  fd.append('folder', 'kho-son');
  return new Request('https://w.example/upload', { method: 'POST', headers, body: fd });
}

const env = { HSE_BUCKET: makeBucket() };
let passed = 0;
async function check(name, fn) { await fn(); passed++; console.log('✅ ' + name); }

await check('Upload không token bị từ chối (401)', async () => {
  const r = await worker.fetch(uploadReq({}), env);
  assert.equal(r.status, 401);
  assert.equal(env.HSE_BUCKET.store.size, 0);
});

await check('Upload bằng publishable key bị từ chối (401)', async () => {
  const r = await worker.fetch(uploadReq({ Authorization: 'Bearer ' + ANON }), env);
  assert.equal(r.status, 401);
});

await check('Upload token giả bị từ chối (401)', async () => {
  const r = await worker.fetch(uploadReq({ Authorization: 'Bearer forged' }), env);
  assert.equal(r.status, 401);
});

await check('Upload với phiên hợp lệ thành công, key nằm trong hse/', async () => {
  const r = await worker.fetch(uploadReq({ Authorization: 'Bearer ' + VALID_TOKEN }), env);
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.ok(j.key.startsWith('hse/kho-son/'));
});

await check('Upload file HTML bị chặn (415) — chống stored XSS', async () => {
  const r = await worker.fetch(uploadReq({ Authorization: 'Bearer ' + VALID_TOKEN }, 'text/html', 'x.html'), env);
  assert.equal(r.status, 415);
});

await check('Xóa không token bị từ chối (401)', async () => {
  const req = new Request('https://w.example/delete', { method: 'POST', body: JSON.stringify({ key: 'hse/x' }) });
  assert.equal((await worker.fetch(req, env)).status, 401);
});

await check('Xóa ngoài vùng hse/ bị chặn (403)', async () => {
  const req = new Request('https://w.example/delete', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + VALID_TOKEN },
    body: JSON.stringify({ key: 'other/secret.jpg' })
  });
  assert.equal((await worker.fetch(req, env)).status, 403);
});

await check('Xem ảnh hse/ công khai, kèm nosniff + CSP sandbox', async () => {
  const key = [...env.HSE_BUCKET.store.keys()][0];
  const r = await worker.fetch(new Request('https://w.example/file/' + key), env);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.match(r.headers.get('Content-Security-Policy'), /sandbox/);
});

await check('CORS: cho phép baoddc.com, vercel.app, github.io, Electron (cổng ngẫu nhiên)', async () => {
  for (const origin of ['https://baoddc.com', 'https://web-supabase-five.vercel.app', 'https://baoddc.github.io', 'http://127.0.0.1:53817', 'https://localhost']) {
    const r = await worker.fetch(new Request('https://w.example/upload', { method: 'OPTIONS', headers: { Origin: origin } }), env);
    assert.equal(r.headers.get('Access-Control-Allow-Origin'), origin, origin);
  }
});

await check('CORS: từ chối origin lạ', async () => {
  for (const origin of ['https://evil.example', 'http://127.0.0.1.evil.example', 'https://baoddc.com.evil.example']) {
    const r = await worker.fetch(new Request('https://w.example/upload', { method: 'OPTIONS', headers: { Origin: origin } }), env);
    assert.equal(r.headers.get('Access-Control-Allow-Origin'), null, origin);
  }
});

console.log(`\n🎉 ${passed}/10 kiểm tra bảo mật R2 Worker đạt.`);
