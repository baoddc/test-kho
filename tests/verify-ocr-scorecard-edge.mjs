/**
 * Kiểm tra Edge Function ocr-scorecard-5s (chạy trong Node, giả lập Deno + Supabase Auth + Gemini).
 * Chạy: node tests/verify-ocr-scorecard-edge.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let src = fs.readFileSync(path.join(root, 'supabase/functions/ocr-scorecard-5s/index.ts'), 'utf8');
src = src.replace(/^import \{ serve \} from .*$/m, 'const serve = (h) => { globalThis.__scorecardHandler = h; };');

const js = execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['-y', 'esbuild@0.23.1', '--loader=ts', '--format=esm'],
  { input: src, encoding: 'utf8', shell: process.platform === 'win32' });

const ANON = 'legacy-anon-jwt';
const VALID = 'valid-user-access-token';
const ENV = { SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_ANON_KEY: ANON, GEMINI_API_KEY: 'gk' };
globalThis.Deno = { env: { get: (k) => ENV[k] } };

let geminiCalls = 0;
let geminiReply = {};
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  if (url.endsWith('/auth/v1/user')) {
    const ok = init.headers?.Authorization === 'Bearer ' + VALID && init.headers?.apikey === ANON;
    return new Response(ok ? JSON.stringify({ id: 'u1' }) : '{}', { status: ok ? 200 : 401 });
  }
  if (url.startsWith('https://generativelanguage.googleapis.com/')) {
    geminiCalls++;
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(geminiReply) }] } }] }), { status: 200 });
  }
  throw new Error('unexpected fetch ' + url);
};

await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const handler = globalThis.__scorecardHandler;
assert.equal(typeof handler, 'function');

const post = (headers) => handler(new Request('https://x/ocr-scorecard-5s', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify({ base64Data: 'aGVsbG8=', mimeType: 'image/jpeg' }),
}));

let passed = 0;
async function check(name, fn) { await fn(); passed++; console.log('✅ ' + name); }

await check('Không token => 401, không gọi Gemini', async () => {
  assert.equal((await post({ Origin: 'https://baoddc.com' })).status, 401);
  assert.equal(geminiCalls, 0);
});
await check('Origin lạ => 403 dù có token', async () => {
  assert.equal((await post({ Origin: 'https://evil.example', Authorization: 'Bearer ' + VALID })).status, 403);
});
await check('Chuẩn hóa tên kho, số thập phân và bỏ kho lạ / trùng', async () => {
  geminiReply = {
    thang: '2026-08',
    items: [
      { area: 'kho sơn', s1: 24, s2: '24', s3: 14, s4: 19, s5: 15, total: 96 },
      { area: 'Kho thép cuộn', s1: 19, s2: '22,5', s3: 10, s4: 14, s5: 16, total: 81.5 },
      { area: 'Kho sơn', s1: 1, s2: 1, s3: 1, s4: 1, s5: 1, total: 5 },
      { area: 'Văn phòng', s1: 20, s2: 20, s3: 10, s4: 10, s5: 10, total: 70 },
    ],
  };
  const r = await post({ Origin: 'https://baoddc.com', Authorization: 'Bearer ' + VALID });
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.equal(j.success, true);
  assert.equal(j.data.thang, '2026-08');
  assert.deepEqual(j.data.items.map((i) => i.area), ['Kho sơn', 'Kho thép cuộn']);
  assert.equal(j.data.items[0].s2, 24);
  assert.equal(j.data.items[1].s2, 22.5);
  assert.equal(j.data.items[1].total, 81.5);
});
await check('Tháng sai định dạng => null', async () => {
  geminiReply = { thang: '08/2026', items: [{ area: 'Thép hình', s1: 20, s2: 20, s3: 12, s4: 18, s5: 13, total: 83 }] };
  const j = await (await post({ Authorization: 'Bearer ' + VALID })).json();
  assert.equal(j.data.thang, null);
});
await check('Không đọc được kho nào => lỗi 500 rõ ràng', async () => {
  geminiReply = { thang: null, items: [{ area: 'Văn phòng', s1: 1 }] };
  const r = await post({ Authorization: 'Bearer ' + VALID });
  assert.equal(r.status, 500);
  assert.equal((await r.json()).success, false);
});

console.log(`\n${passed} kiểm tra đạt`);
