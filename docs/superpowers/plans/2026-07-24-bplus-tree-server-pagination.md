# Server-side B+ Tree Cursor Pagination & Block Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable, high-performance Server-side B+ Tree Range Pagination & Block Cache engine (`assets/js/supabase-data-engine.js`) to provide sub-50ms initial page load and 0ms page navigation across all data tables.

**Architecture:** A centralized `SupabaseDataEngine` class handles range queries using PostgreSQL B-Tree indexes via Supabase `.range(start, end)` with exact count. Differentiates cache blocks in a `BPlusBlockCache` map by `tableName:filterHash:page`. Idle pre-fetcher automatically fetches page $N+1$ in background.

**Tech Stack:** JavaScript (ES6+), Supabase JS Client v2, HTML5.

## Global Constraints

- Reusable module: `assets/js/supabase-data-engine.js` (and synced to `dist-app/assets/js/supabase-data-engine.js`).
- Default rows per page: `100`.
- Cache LRU capacity: `50` pages max per session.
- Cache TTL: `300,000 ms` (5 minutes).

---

### Task 1: Create Reusable Supabase Data Engine Module

**Files:**
- Create: `assets/js/supabase-data-engine.js`
- Create: `dist-app/assets/js/supabase-data-engine.js`

**Interfaces:**
- Produces: `window.BPlusBlockCache`, `window.SupabaseDataEngine`
  - `BPlusBlockCache.get(key)` -> `{ data, count, totalPages, timestamp }`
  - `BPlusBlockCache.set(key, val)`
  - `BPlusBlockCache.invalidate(tableName)`
  - `SupabaseDataEngine.fetchPage(tableName, page, rowsPerPage, filters)` -> `{ data, count, totalPages, fromCache }`
  - `SupabaseDataEngine.invalidateCache(tableName)`

- [ ] **Step 1: Write `assets/js/supabase-data-engine.js`**

```javascript
/* =============================================================================
   SUPABASE DATA ENGINE (B+ Tree Range Pagination & Block Cache)
   ============================================================================= */

class BPlusBlockCache {
  constructor(maxCapacity = 50, ttlMs = 300000) {
    this.cache = new Map();
    this.maxCapacity = maxCapacity;
    this.ttlMs = ttlMs;
  }

  generateKey(tableName, filterHash, page) {
    return `${tableName}:${filterHash}:p${page}`;
  }

  get(key) {
    if (!this.cache.has(key)) return null;
    const entry = this.cache.get(key);
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    // Refresh position for LRU
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxCapacity) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, {
      ...value,
      timestamp: Date.now()
    });
  }

  invalidate(tableName) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${tableName}:`)) {
        this.cache.delete(key);
      }
    }
  }
}

class SupabaseDataEngine {
  constructor() {
    this.blockCache = new BPlusBlockCache();
  }

  computeFilterHash(filters = {}) {
    const serialized = JSON.stringify(filters, Object.keys(filters).sort());
    let hash = 0;
    for (let i = 0; i < serialized.length; i++) {
      const char = serialized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash.toString(36);
  }

  async fetchPage(tableName, page = 1, rowsPerPage = 100, filters = {}, orderBy = 'id', ascending = true) {
    const filterHash = this.computeFilterHash(filters);
    const cacheKey = this.blockCache.generateKey(tableName, filterHash, page);

    // 1. Check cache
    const cached = this.blockCache.get(cacheKey);
    if (cached) {
      // Trigger background prefetch for page + 1
      this.prefetchNextPage(tableName, page, rowsPerPage, filters, orderBy, ascending);
      return { ...cached, fromCache: true };
    }

    // 2. Fetch page range from Supabase
    const from = (page - 1) * rowsPerPage;
    const to = from + rowsPerPage - 1;

    let query = supabase
      .from(tableName)
      .select('*', { count: 'exact' });

    // Apply date range filters if present
    if (filters.fromDate && filters.dateColumn) {
      query = query.gte(filters.dateColumn, filters.fromDate);
    }
    if (filters.toDate && filters.dateColumn) {
      query = query.lte(filters.dateColumn, filters.toDate);
    }

    // Apply text search if present
    if (filters.searchTerm && filters.searchColumns && filters.searchColumns.length > 0) {
      const ilikeConditions = filters.searchColumns
        .map(col => `${col}.ilike.%${filters.searchTerm}%`)
        .join(',');
      query = query.or(ilikeConditions);
    }

    // Apply exact match dropdown filters
    if (filters.equals && typeof filters.equals === 'object') {
      for (const [col, val] of Object.entries(filters.equals)) {
        if (val !== undefined && val !== null && val !== '') {
          if (Array.isArray(val) && val.length > 0) {
            query = query.in(col, val);
          } else if (typeof val === 'string') {
            query = query.eq(col, val);
          }
        }
      }
    }

    query = query.order(orderBy, { ascending }).range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;

    const totalCount = count || 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage));

    const result = {
      data: data || [],
      count: totalCount,
      totalPages: totalPages,
      page: page
    };

    // Store in cache
    this.blockCache.set(cacheKey, result);

    // 3. Background prefetch page + 1
    this.prefetchNextPage(tableName, page, rowsPerPage, filters, orderBy, ascending);

    return { ...result, fromCache: false };
  }

  async prefetchNextPage(tableName, currentPage, rowsPerPage, filters, orderBy, ascending) {
    const nextPage = currentPage + 1;
    const filterHash = this.computeFilterHash(filters);
    const cacheKey = this.blockCache.generateKey(tableName, filterHash, nextPage);

    if (this.blockCache.get(cacheKey)) return;

    // Use requestIdleCallback or setTimeout for non-blocking prefetch
    const prefetchTask = async () => {
      try {
        const from = (nextPage - 1) * rowsPerPage;
        const to = from + rowsPerPage - 1;

        let query = supabase
          .from(tableName)
          .select('*', { count: 'exact' });

        if (filters.fromDate && filters.dateColumn) query = query.gte(filters.dateColumn, filters.fromDate);
        if (filters.toDate && filters.dateColumn) query = query.lte(filters.dateColumn, filters.toDate);
        if (filters.searchTerm && filters.searchColumns && filters.searchColumns.length > 0) {
          const ilikeConditions = filters.searchColumns.map(col => `${col}.ilike.%${filters.searchTerm}%`).join(',');
          query = query.or(ilikeConditions);
        }
        if (filters.equals && typeof filters.equals === 'object') {
          for (const [col, val] of Object.entries(filters.equals)) {
            if (val !== undefined && val !== null && val !== '') {
              if (Array.isArray(val) && val.length > 0) query = query.in(col, val);
              else if (typeof val === 'string') query = query.eq(col, val);
            }
          }
        }

        query = query.order(orderBy, { ascending }).range(from, to);
        const { data, count, error } = await query;
        if (!error && data) {
          const totalCount = count || 0;
          const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage));
          if (nextPage <= totalPages) {
            this.blockCache.set(cacheKey, { data: data || [], count: totalCount, totalPages, page: nextPage });
          }
        }
      } catch (e) {
        // Silent catch for background prefetch
      }
    };

    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(prefetchTask, { timeout: 2000 });
    } else {
      setTimeout(prefetchTask, 200);
    }
  }

  invalidateCache(tableName) {
    this.blockCache.invalidate(tableName);
  }
}

// Export singletons
window.BPlusBlockCache = BPlusBlockCache;
window.supabaseDataEngine = new SupabaseDataEngine();
```

- [ ] **Step 2: Sync file to `dist-app/assets/js/supabase-data-engine.js`**

- [ ] **Step 3: Commit**

```bash
git add assets/js/supabase-data-engine.js dist-app/assets/js/supabase-data-engine.js
git commit -m "feat: add SupabaseDataEngine with B+ Tree Block Cache and pre-fetching"
```

---

### Task 2: Include `supabase-data-engine.js` Script Tag in HTML pages

**Files:**
- Modify: `pages/pl/pl-phieu-in.html`
- Modify: `pages/tole/tole-nhap.html`
- Modify: `pages/tole/tole-xuat.html`
- Modify: `pages/xg/xg-nhap.html`
- Modify: `pages/xg/xg-xuat.html`
- Sync to corresponding `dist-app/pages/` files.

- [ ] **Step 1: Add `<script src="/assets/js/supabase-data-engine.js"></script>` before page JS scripts**

- [ ] **Step 2: Commit**

```bash
git add pages/ dist-app/pages/
git commit -m "chore: include supabase-data-engine.js script tag across HTML pages"
```

---

### Task 3: Integrate `supabaseDataEngine` into `pl-phieu-in.js`

**Files:**
- Modify: `assets/js/pl/pl-phieu-in.js`
- Modify: `dist-app/assets/js/pl/pl-phieu-in.js`

- [ ] **Step 1: Update `loadGoogleSheet()` to use `supabaseDataEngine.fetchPage('pl-phieu-in', currentPage, ROWS_PER_PAGE)`**
- [ ] **Step 2: Update `confirmDelete()` & `handleEditFormSubmit()` to call `supabaseDataEngine.invalidateCache('pl-phieu-in')`**
- [ ] **Step 3: Commit**

```bash
git add assets/js/pl/pl-phieu-in.js dist-app/assets/js/pl/pl-phieu-in.js
git commit -m "feat: integrate SupabaseDataEngine into pl-phieu-in.js"
```

---

### Task 4: Integrate `supabaseDataEngine` into Tôn & Xưởng Supabase files

**Files:**
- Modify: `assets/js/tole/tole-nhap-supabase.js`
- Modify: `assets/js/tole/tole-xuat-supabase.js`
- Modify: `assets/js/xg/xg-nhap-supabase.js`
- Modify: `assets/js/xg/xg-xuat-supabase.js`
- Sync to `dist-app/assets/js/`.

- [ ] **Step 1: Update `loadSupabaseData()` to use `supabaseDataEngine.fetchPage`**
- [ ] **Step 2: Update Insert/Update/Delete handlers to call `supabaseDataEngine.invalidateCache`**
- [ ] **Step 3: Commit**

```bash
git add assets/js/ dist-app/assets/js/
git commit -m "feat: integrate SupabaseDataEngine into tole & xg supabase files"
```
