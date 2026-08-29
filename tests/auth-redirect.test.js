const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Running Auth Redirect & Route Verification Tests ---');

// Test 1: dang_nhap.js files should redirect to '/' instead of 'home.html'
const dangNhapFiles = [
  path.join(__dirname, '../assets/js/dang_nhap.js'),
  path.join(__dirname, '../dist/assets/js/dang_nhap.js'),
  path.join(__dirname, '../dist-app/assets/js/dang_nhap.js')
];

dangNhapFiles.forEach((file) => {
  const content = fs.readFileSync(file, 'utf8');
  assert.ok(
    !content.includes("window.location.href = 'home.html'"),
    `File ${file} should NOT contain "window.location.href = 'home.html'"`
  );
  assert.ok(
    content.includes("window.location.href = '/'"),
    `File ${file} should contain "window.location.href = '/'"`
  );
  console.log(`[PASS] ${path.relative(path.join(__dirname, '..'), file)} redirects to '/'`);
});

// Test 2: quan-ly-user.js should redirect to '/' instead of 'home.html'
const quanLyUserFiles = [
  path.join(__dirname, '../assets/js/quan-ly-user.js'),
  path.join(__dirname, '../dist/assets/js/quan-ly-user.js')
];

quanLyUserFiles.forEach((file) => {
  const content = fs.readFileSync(file, 'utf8');
  assert.ok(
    !content.includes("window.location.href = 'home.html'"),
    `File ${file} should NOT contain "window.location.href = 'home.html'"`
  );
  assert.ok(
    content.includes("window.location.href = '/'"),
    `File ${file} should contain "window.location.href = '/'"`
  );
  console.log(`[PASS] ${path.relative(path.join(__dirname, '..'), file)} redirects to '/'`);
});

// Test 3: voice-assistant.js should route home to '/'
const voiceFiles = [
  path.join(__dirname, '../assets/js/components/voice-assistant.js'),
  path.join(__dirname, '../dist/assets/js/components/voice-assistant.js'),
  path.join(__dirname, '../dist-app/assets/js/voice-assistant.js')
];

voiceFiles.forEach((file) => {
  const content = fs.readFileSync(file, 'utf8');
  assert.ok(
    content.includes("handleNavigation('/', \"Trang chủ\")"),
    `File ${file} should navigate home to '/'`
  );
  console.log(`[PASS] ${path.relative(path.join(__dirname, '..'), file)} navigates home to '/'`);
});

// Test 4: vercel.json contains redirects for /home
const vercelJsonPath = path.join(__dirname, '../vercel.json');
const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));

assert.ok(Array.isArray(vercelConfig.redirects), 'vercel.json must have redirects array');
const homeRedirect = vercelConfig.redirects.find(r => r.source === '/home');
assert.ok(homeRedirect, 'vercel.json must redirect /home');
assert.strictEqual(homeRedirect.destination, '/', '/home must redirect to /');

const pagesHomeRedirect = vercelConfig.redirects.find(r => r.source === '/pages/home');
assert.ok(pagesHomeRedirect, 'vercel.json must redirect /pages/home');
assert.strictEqual(pagesHomeRedirect.destination, '/', '/pages/home must redirect to /');

console.log('[PASS] vercel.json redirect configuration verified');
console.log('--- ALL AUTH REDIRECT TESTS PASSED! ---');
