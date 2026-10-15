/**
 * Kiểm tra bảo mật Edge Function ocr-receipt (chạy trong Node, giả lập Deno + Supabase Auth + Gemini).
 * Chạy: node tests/verify-ocr-edge-auth.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let src = fs.readFileSync(path.join(root, 'supabase/functions/ocr-receipt/index.ts'), 'utf8');
src = src.replace(/^import \{ serve \} from .*$/m, 'const serve = (h) => { globalThis.__ocrHandler = h; };');

// Bỏ kiểu TypeScript bằng esbuild (không cần Deno)
const js = execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['-y', 'esbuild@0.23.1', '--loader=ts', '--format=esm'],
  { input: src, encoding: 'utf8', shell: process.platform === 'win32' });

const ANON = 'legacy-anon-jwt';
const VALID = 'valid-user-access-token';
const ENV = { SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_ANON_KEY: ANON, GEMINI_API_KEY: 'gk' };
globalThis.Deno = { env: { get: (k) => ENV[k] } };

let geminiCalls = 0;
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  if (url.endsWith('/auth/v1/user')) {
    const ok = init.headers?.Authorization === 'Bearer ' + VALID && init.headers?.apikey === ANON;
    return new Response(ok ? JSON.stringify({ id: 'u1' }) : '{}', { status: ok ? 200 : 401 });
  }
  if (url.startsWith('https://generativelanguage.googleapis.com/')) {
    geminiCalls++;
    const text = JSON.stringify({ ngayXuat: '31/08/2026', phieuXuat: '4900137996', items: [{ stt: 1, maVatTu: '10001189', tenVatTu: 'Thép', batch: '2X349VN' }] });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
  }
  throw new Error('unexpected fetch ' + url);
};

await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const handler = globalThis.__ocrHandler;
assert.equal(typeof handler, 'function');

const body = JSON.stringify({ base64Data: 'aGVsbG8=', mimeType: 'image/jpeg' });
const post = (headers) => handler(new Request('https://x/ocr-receipt', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body }));

let passed = 0;
async function check(name, fn) { await fn(); passed++; console.log('✅ ' + name); }

await check('Không token => 401, không gọi Gemini', async () => {
  assert.equal((await post({ Origin: 'https://baoddc.com' })).status, 401);
  assert.equal(geminiCalls, 0);
});
await check('Token = anon key công khai => 401', async () => {
  assert.equal((await post({ Authorization: 'Bearer ' + ANON })).status, 401);
});
await check('Token giả => 401', async () => {
  assert.equal((await post({ Authorization: 'Bearer forged' })).status, 401);
  assert.equal(geminiCalls, 0);
});
await check('Phiên đăng nhập hợp lệ => 200 và trả dữ liệu OCR', async () => {
  const r = await post({ Origin: 'https://baoddc.com', Authorization: 'Bearer ' + VALID });
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.equal(j.success, true);
  assert.equal(j.data.phieuXuat, '4900137996');
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://baoddc.com');
});
await check('Origin lạ => 403 dù có token', async () => {
  assert.equal((await post({ Origin: 'https://evil.example', Authorization: 'Bearer ' + VALID })).status, 403);
});
await check('Electron (127.0.0.1 cổng ngẫu nhiên) được phép', async () => {
  const r = await post({ Origin: 'http://127.0.0.1:53817', Authorization: 'Bearer ' + VALID });
  assert.equal(r.status, 200);
});
await check('Loại file không hỗ trợ => 415', async () => {
  const r = await handler(new Request('https://x/ocr-receipt', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + VALID },
    body: JSON.stringify({ base64Data: 'aGk=', mimeType: 'text/html' })
  }));
  assert.equal(r.status, 415);
});
await check('Preflight OPTIONS từ baoddc.com trả CORS đúng', async () => {
  const r = await handler(new Request('https://x/ocr-receipt', { method: 'OPTIONS', headers: { Origin: 'https://baoddc.com' } }));
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://baoddc.com');
});

console.log(`\n🎉 ${passed}/8 kiểm tra bảo mật Edge Function OCR đạt.`);
