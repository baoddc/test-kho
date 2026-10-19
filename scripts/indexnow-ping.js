// Gửi danh sách URL trong seo/sitemap.xml tới IndexNow (Bing, Copilot, Yandex, Seznam...)
// để được quét lại ngay. Chạy SAU khi deploy xong: npm run seo:indexnow
const fs = require('fs');
const path = require('path');

const HOST = 'www.baoddc.com';
const KEY = '28306d9154cafe7b'; // trùng tên & nội dung file seo/28306d9154cafe7b.txt

async function run() {
  const sitemap = fs.readFileSync(path.join(__dirname, '..', 'seo', 'sitemap.xml'), 'utf8');
  const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());
  if (urlList.length === 0) {
    console.error('[IndexNow] ❌ Không tìm thấy <loc> nào trong sitemap.xml');
    process.exit(1);
  }

  console.log(`[IndexNow] Gửi ${urlList.length} URL:`, urlList);
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: HOST,
      key: KEY,
      keyLocation: `https://${HOST}/${KEY}.txt`,
      urlList
    })
  });

  // 200/202 = đã nhận; 403 = key không khớp; 422 = URL không thuộc host
  console.log(`[IndexNow] HTTP ${res.status} ${res.statusText}`);
  if (!res.ok) process.exit(1);
  console.log('✅ [IndexNow] Đã gửi thành công');
}

run().catch(err => {
  console.error('[IndexNow] ❌', err.message);
  process.exit(1);
});
