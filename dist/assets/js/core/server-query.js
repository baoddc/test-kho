/* =============================================================================
   SERVER QUERY - lọc, phân trang, tính tổng ngay tại Supabase
   Trình duyệt chỉ nhận đúng số dòng đang hiển thị (mặc định 100 dòng / trang)
   thay vì tải toàn bộ bảng. Dùng các RPC trong
   supabase/sql/migrations/scale_1m_rows_2026-10-20.sql:
     qry_rows / qry_group / qry_distinct / next_roll_number / dashboard_kho / pl_tong_hop

   Bộ lọc (filters) gửi lên server:
     range:     [{ col, gte, lte, gt, lt }]
     in:        { 'Loại nhập': ['A', 'B'] }
     eq:        { col: value }
     ieq:       { col: value }        // so khớp lower(trim()) chính xác
     ilike:     { col: 'chuỗi' }      // chứa chuỗi
     not_empty: ['col']
     search:    'từ khóa'             // các cột tìm kiếm của bảng
     ton:       true                  // chỉ cuộn còn tồn (bảng nhập)
     ids:       [1, 2]
     one_of:    [{ col, values, blank }]  // bộ lọc cột trên tiêu đề bảng
     and:       [{ ...bộ lọc con }]       // AND thêm các nhóm điều kiện
================================================================================ */

(function () {
  const EXPORT_WARN_ROWS = 50000;
  const EXPORT_MAX_ROWS = 300000;
  const BATCH_SIZE = 1000;

  function client() {
    const c = window.supabase;
    if (!c || typeof c.rpc !== 'function') {
      throw new Error('Kết nối máy chủ chưa sẵn sàng');
    }
    return c;
  }

  async function rpc(name, args) {
    const { data, error } = await client().rpc(name, args);
    if (error) throw error;
    return data;
  }

  // Bỏ các khóa rỗng để server không phải xử lý (và để so sánh bộ lọc ổn định)
  function cleanFilters(filters) {
    const out = {};
    if (!filters) return out;
    if (Array.isArray(filters.range)) {
      const range = filters.range.filter(r => r && r.col && (r.gte || r.lte || r.gt || r.lt));
      if (range.length) out.range = range;
    }
    ['in', 'eq', 'ieq', 'ilike'].forEach(key => {
      const obj = filters[key];
      if (!obj) return;
      const kept = {};
      Object.keys(obj).forEach(col => {
        const v = obj[col];
        if (key === 'in') {
          if (Array.isArray(v) && v.length) kept[col] = v;
        } else if (key === 'eq') {
          if (v !== undefined) kept[col] = v;
        } else if (v !== undefined && v !== null && String(v).trim() !== '') {
          kept[col] = v;
        }
      });
      if (Object.keys(kept).length) out[key] = kept;
    });
    if (Array.isArray(filters.not_empty) && filters.not_empty.length) out.not_empty = filters.not_empty;
    if (filters.search && String(filters.search).trim()) out.search = String(filters.search).trim();
    if (filters.ton) out.ton = true;
    if (Array.isArray(filters.ids) && filters.ids.length) out.ids = filters.ids;
    if (Array.isArray(filters.one_of)) {
      const oneOf = filters.one_of.filter(f => f && f.col);
      if (oneOf.length) out.one_of = oneOf;
    }
    if (Array.isArray(filters.and)) {
      const parts = filters.and.map(cleanFilters).filter(f => Object.keys(f).length);
      if (parts.length) out.and = parts;
    }
    return out;
  }

  function filtersKey(filters) {
    return JSON.stringify(cleanFilters(filters));
  }

  /**
   * Lấy 1 trang dữ liệu.
   * @returns {Promise<{rows: Object[], total: number|null, sums: Object}>}
   */
  async function rows({ table, filters, order, limit = 100, offset = 0, withTotal = true, sumCols = null, columns = null, totalHint = null }) {
    const data = await rpc('qry_rows', {
      p_table: table,
      p_filters: cleanFilters(filters),
      p_order: order || [{ col: 'id', asc: true }],
      p_limit: limit,
      p_offset: offset,
      p_with_total: withTotal,
      p_sum_cols: sumCols && sumCols.length ? sumCols : null,
      p_columns: columns && columns.length ? columns : null,
      p_total_hint: totalHint
    });
    return {
      rows: Array.isArray(data?.rows) ? data.rows : [],
      total: data?.total ?? null,
      sums: data?.sums || {}
    };
  }

  async function group({ table, filters, groupCol, sumCols = null, keys = null, limit = 1000 }) {
    const data = await rpc('qry_group', {
      p_table: table,
      p_filters: cleanFilters(filters),
      p_group_col: groupCol,
      p_sum_cols: sumCols && sumCols.length ? sumCols : null,
      p_keys: Array.isArray(keys) ? keys : null,
      p_limit: limit
    });
    return Array.isArray(data) ? data : [];
  }

  // Giá trị khác nhau của 1 cột (cho dropdown lọc), có cache ngắn trong phiên
  const distinctCache = new Map();
  async function distinct({ table, col, filters = null, limit = 1000, fresh = false }) {
    const f = filters ? cleanFilters(filters) : null;
    const key = `${table}|${col}|${JSON.stringify(f)}|${limit}`;
    if (!fresh && distinctCache.has(key)) {
      const hit = distinctCache.get(key);
      if (Date.now() - hit.at < 60000) return hit.values;
    }
    const data = await rpc('qry_distinct', {
      p_table: table,
      p_col: col,
      p_filters: f && Object.keys(f).length ? f : null,
      p_limit: limit
    });
    const values = (Array.isArray(data) ? data : []).filter(v => v !== null && v !== undefined && String(v).trim() !== '');
    distinctCache.set(key, { at: Date.now(), values });
    return values;
  }

  function invalidateDistinct(table) {
    for (const key of distinctCache.keys()) {
      if (!table || key.startsWith(table + '|')) distinctCache.delete(key);
    }
  }

  /**
   * Tải toàn bộ các dòng khớp bộ lọc theo lô 1000 dòng (keyset theo id tăng dần).
   * Dùng cho xuất Excel và các trang cần cả tập tồn kho (vốn giới hạn theo số cuộn trong kho).
   */
  async function fetchAll({ table, filters, columns = null, maxRows = Infinity, onProgress = null }) {
    const base = cleanFilters(filters);
    const out = [];
    let lastId = null;
    let total = null;
    while (out.length < maxRows) {
      const f = JSON.parse(JSON.stringify(base));
      if (lastId !== null) {
        f.range = (f.range || []).concat([{ col: 'id', gt: String(lastId) }]);
      }
      const page = await rows({
        table,
        filters: f,
        order: [{ col: 'id', asc: true }],
        limit: Math.min(BATCH_SIZE, maxRows - out.length),
        offset: 0,
        withTotal: lastId === null,
        columns
      });
      if (lastId === null) total = page.total;
      out.push(...page.rows);
      if (onProgress) onProgress(out.length, total);
      if (page.rows.length < BATCH_SIZE) break;
      lastId = page.rows[page.rows.length - 1].id;
    }
    return { rows: out, total: total ?? out.length, truncated: total !== null && out.length < total };
  }

  // Các cuộn còn tồn của 1 bảng nhập (xg-nhap / tole-nhap)
  async function fetchTon(table, { columns = null, filters = null, maxRows = Infinity } = {}) {
    const res = await fetchAll({ table, filters: Object.assign({}, filters || {}, { ton: true }), columns, maxRows });
    return res.rows;
  }

  // Kiểm tra số dòng trước khi xuất Excel; trả về false nếu người dùng hủy
  function confirmExportSize(total) {
    if (total > EXPORT_MAX_ROWS) {
      alert(`Bộ lọc hiện tại có ${total.toLocaleString('vi-VN')} dòng, vượt giới hạn xuất Excel ${EXPORT_MAX_ROWS.toLocaleString('vi-VN')} dòng.\nVui lòng thu hẹp khoảng ngày hoặc thêm điều kiện lọc.`);
      return false;
    }
    if (total > EXPORT_WARN_ROWS) {
      return confirm(`Sẽ xuất ${total.toLocaleString('vi-VN')} dòng ra Excel, có thể mất vài chục giây. Tiếp tục?`);
    }
    return true;
  }

  async function exportRows({ table, filters, columns = null, onProgress = null }) {
    const head = await rows({ table, filters, limit: 1, withTotal: true, columns: ['id'] });
    const total = head.total || 0;
    if (!confirmExportSize(total)) return null;
    const res = await fetchAll({ table, filters, columns, maxRows: EXPORT_MAX_ROWS, onProgress });
    return res.rows;
  }

  async function nextRollNumber(table, maVatTu, excludeId = null) {
    if (!maVatTu || !String(maVatTu).trim()) return 0;
    const data = await rpc('next_roll_number', {
      p_table: table,
      p_ma_vt: String(maVatTu).trim(),
      p_exclude_id: excludeId ? Number(excludeId) : null
    });
    return Number(data) || 0;
  }

  // Ngày hôm nay theo giờ máy (YYYY-MM-DD), tránh lệch ngày khi server chạy UTC
  function localToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  async function dashboard(kho, fromDate, toDate) {
    return rpc('dashboard_kho', {
      p_kho: kho,
      p_from: fromDate || null,
      p_to: toDate || null,
      p_today: localToday()
    });
  }

  async function plTongHop(table, period, detailLimit = 300) {
    return rpc('pl_tong_hop', {
      p_table: table,
      p_period: period && period !== 'All' ? period : null,
      p_detail_limit: detailLimit
    });
  }

  // Ghép bộ lọc / sắp xếp theo cột trên tiêu đề bảng (home.js) vào truy vấn của trang
  function applyColumnFilters(pager, pageFilters, defaultOrder) {
    pager.setFilters(window.ddcMergeServerFilters ? window.ddcMergeServerFilters(pageFilters) : pageFilters);
    pager.setOrder(window.ddcServerOrder ? window.ddcServerOrder(defaultOrder) : defaultOrder);
  }

  /**
   * Cột DB tương ứng với 1 cột giao diện (theo chỉ số trong danh sách tiêu đề), dùng cho
   * window.ddcServerAdapter.column(). types: { date: [...], number: [...], age: { 'Tiêu đề': 'Cột DB' } }
   */
  function headerColumn(headers, key, types = {}) {
    const name = headers[parseInt(key, 10)];
    if (!name) return null;
    if (types.age && types.age[name]) return { name: types.age[name], type: 'age' };
    if (types.skip && types.skip.includes(name)) return null;
    if (types.date && types.date.includes(name)) return { name, type: 'date' };
    if (types.number && types.number.includes(name)) return { name, type: 'number' };
    return { name, type: 'text' };
  }

  /**
   * Quản lý 1 bảng phân trang ở server: giữ bộ lọc, trang hiện tại, tổng dòng/tổng số lượng.
   * Chỉ đếm lại tổng khi bộ lọc đổi; chuyển trang chỉ tải 100 dòng.
   */
  class ServerPager {
    constructor({ table, pageSize = 100, order = null, sumCols = null, columns = null }) {
      this.table = table;
      this.pageSize = pageSize;
      this.order = order || [{ col: 'id', asc: true }];
      this.sumCols = sumCols;
      this.columns = columns;
      this.filters = {};
      this.page = 1;
      this.total = 0;
      this.sums = {};
      this.rows = [];
      this._countedKey = null;
      this._seq = 0;
    }

    get totalPages() {
      return Math.max(1, Math.ceil((this.total || 0) / this.pageSize));
    }

    setFilters(filters) {
      this.filters = cleanFilters(filters);
    }

    setOrder(order) {
      this.order = order;
    }

    // Buộc đếm lại tổng ở lần tải tới (sau khi thêm / sửa / xóa)
    invalidate() {
      this._countedKey = null;
    }

    /**
     * Tải trang `page`. Trả về null nếu đã có yêu cầu mới hơn (kết quả cũ bị bỏ qua).
     */
    async load(page = this.page) {
      const seq = ++this._seq;
      const key = JSON.stringify([this.filters, this.order]);
      const needTotal = this._countedKey !== key;
      let target = Math.max(1, page);
      if (!needTotal) target = Math.min(target, this.totalPages);

      let res = await rows({
        table: this.table,
        filters: this.filters,
        order: this.order,
        limit: this.pageSize,
        offset: (target - 1) * this.pageSize,
        withTotal: needTotal,
        sumCols: needTotal ? this.sumCols : null,
        columns: this.columns,
        totalHint: needTotal ? null : this.total
      });
      if (seq !== this._seq) return null;

      if (needTotal) {
        this.total = Number(res.total) || 0;
        this.sums = res.sums || {};
        this._countedKey = key;
        // Trang yêu cầu vượt quá số trang mới (vd: vừa lọc hẹp lại) → về trang cuối
        if (target > this.totalPages) {
          target = this.totalPages;
          res = await rows({
            table: this.table,
            filters: this.filters,
            order: this.order,
            limit: this.pageSize,
            offset: (target - 1) * this.pageSize,
            withTotal: false,
            columns: this.columns,
            totalHint: this.total
          });
          if (seq !== this._seq) return null;
        }
      }

      this.page = target;
      this.rows = res.rows;
      return { rows: this.rows, page: this.page, totalPages: this.totalPages, total: this.total, sums: this.sums };
    }
  }

  window.SQ = {
    rows,
    group,
    distinct,
    invalidateDistinct,
    fetchAll,
    fetchTon,
    exportRows,
    confirmExportSize,
    nextRollNumber,
    dashboard,
    plTongHop,
    localToday,
    filtersKey,
    cleanFilters,
    applyColumnFilters,
    headerColumn,
    ServerPager,
    EXPORT_MAX_ROWS
  };
})();
