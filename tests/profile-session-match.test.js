/**
 * Hồ sơ quyền cache theo từng tab (sessionStorage) phải khớp với phiên Supabase Auth hiện tại
 * (localStorage, dùng chung mọi tab). Nếu không, tab cũ có thể hiện nút Thêm/Sửa/Xóa của người khác.
 * Chạy: node tests/profile-session-match.test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '../assets/js/core/supabase-config.js'), 'utf8');
const AUTH_KEY = 'sb-ahcethtonjwktjtmxzog-auth-token';

const vuong = {
  id: 'uuid-vuong', username: 'vuong.pm', is_admin: false,
  can_view: true, can_add: false, can_edit: false, can_delete: false,
  allowed_pages: { pages: ['/pages/xg/xg-nhap.html'], groups: { xg: { canView: true, canAdd: false, canEdit: false, canDelete: false } } }
};
const bao = {
  id: 'uuid-bao', username: 'bao.lt', is_admin: true,
  can_view: true, can_add: true, can_edit: true, can_delete: true, allowed_pages: ['*']
};
const session = (user) => JSON.stringify({ access_token: 'x', refresh_token: 'y', user: { id: user.id } });

function store(init) {
  const m = new Map(Object.entries(init || {}));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i],
    get length() { return m.size; }
  };
}

/** Chạy supabase-config.js thật trên trang Nhập XG giả lập, trả về các nút còn hiện */
function visibleButtons(sessionInit, localInit) {
  const btns = ['add', 'edit', 'delete'].map((perm) => ({
    perm, style: { display: '' }, attrs: {},
    getAttribute(n) { return n === 'data-perm' ? this.perm : this.attrs[n]; },
    setAttribute(n, v) { this.attrs[n] = v; }
  }));
  const ctx = {
    window: {
      location: { pathname: '/pages/xg/xg-nhap.html' },
      supabase: { createClient: () => ({ auth: { onAuthStateChange() {}, getSession: async () => ({ data: { session: null } }) }, from() {} }) }
    },
    document: { readyState: 'complete', querySelectorAll: (s) => (s === '[data-perm]' ? btns : []), addEventListener() {} },
    sessionStorage: store(sessionInit),
    localStorage: store(localInit),
    URL, JSON, console,
    setTimeout: (f) => f()
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return btns.filter((b) => b.style.display !== 'none').map((b) => b.perm);
}

const vuongLocal = {
  currentUser: 'vuong.pm',
  userPermissions: JSON.stringify({ canView: true, canAdd: false, canEdit: false, canDelete: false }),
  userGroupPermissions: JSON.stringify(vuong.allowed_pages.groups)
};
const baoLocal = {
  currentUser: 'bao.lt',
  userPermissions: JSON.stringify({ canView: true, canAdd: true, canEdit: true, canDelete: true })
};

let passed = 0;
function check(name, actual, expected) {
  assert.deepStrictEqual(actual, expected, name);
  passed++;
  console.log('✅ ' + name);
}

check('vuong.pm đăng nhập bình thường: ẩn hết nút',
  visibleButtons({ supabase_user_profile: JSON.stringify(vuong) }, { ...vuongLocal, [AUTH_KEY]: session(vuong) }), []);

check('Tab còn sót hồ sơ bao.lt nhưng phiên thật là vuong.pm: ẩn hết nút (lỗi cũ: hiện cả 3)',
  visibleButtons({ supabase_user_profile: JSON.stringify(bao) }, { ...vuongLocal, [AUTH_KEY]: session(vuong) }), []);

check('bao.lt (admin): hiện đủ 3 nút',
  visibleButtons({ supabase_user_profile: JSON.stringify(bao) }, { ...baoLocal, [AUTH_KEY]: session(bao) }), ['add', 'edit', 'delete']);

check('Tab còn sót hồ sơ vuong.pm nhưng phiên thật là bao.lt: hiện theo quyền bao.lt',
  visibleButtons({ supabase_user_profile: JSON.stringify(vuong) }, { ...baoLocal, [AUTH_KEY]: session(bao) }), ['add', 'edit', 'delete']);

check('Đã đăng xuất (không còn phiên) dù tab còn hồ sơ bao.lt: ẩn hết nút',
  visibleButtons({ supabase_user_profile: JSON.stringify(bao) }, {}), []);

console.log(`\n🎉 ${passed}/5 kiểm tra đồng bộ hồ sơ quyền với phiên đăng nhập đạt.`);
