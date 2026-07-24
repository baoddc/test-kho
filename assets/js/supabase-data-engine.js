/* =============================================================================
   SUPABASE DATA ENGINE (B+ Tree Range Pagination & Block Cache)
   ============================================================================= */

class BPlusBlockCache {
  constructor(maxCapacity = 100, ttlMs = 600000) { // 100 pages, 10 min TTL
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
    // Refresh LRU order
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
    this.tableTotalCounts = new Map(); // Cache total counts per table:filterHash to eliminate count: 'exact' DB scans
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

    // 1. Check cache (Instant 0ms return if present)
    const cached = this.blockCache.get(cacheKey);
    if (cached) {
      // Immediate non-blocking prefetch of page N+1
      setTimeout(() => {
        this.prefetchNextPage(tableName, page, rowsPerPage, filters, orderBy, ascending);
      }, 10);
      return { ...cached, fromCache: true };
    }

    // 2. Optimize DB count query: Skip count: 'exact' full table scan if count is already known
    const countKey = `${tableName}:${filterHash}`;
    const hasCachedCount = this.tableTotalCounts.has(countKey);
    const selectOptions = hasCachedCount ? undefined : { count: 'exact' };

    const from = (page - 1) * rowsPerPage;
    const to = from + rowsPerPage - 1;

    let query = supabase
      .from(tableName)
      .select('*', selectOptions);

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

    let totalCount;
    if (count !== null && count !== undefined) {
      totalCount = count;
      this.tableTotalCounts.set(countKey, count);
    } else {
      totalCount = this.tableTotalCounts.get(countKey) || (data ? data.length : 0);
    }

    const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage));

    const result = {
      data: data || [],
      count: totalCount,
      totalPages: totalPages,
      page: page
    };

    // Store in cache
    this.blockCache.set(cacheKey, result);

    // 3. Immediately prefetch page N+1 in background
    setTimeout(() => {
      this.prefetchNextPage(tableName, page, rowsPerPage, filters, orderBy, ascending);
    }, 10);

    return { ...result, fromCache: false };
  }

  async prefetchNextPage(tableName, currentPage, rowsPerPage, filters, orderBy, ascending) {
    const nextPage = currentPage + 1;
    const filterHash = this.computeFilterHash(filters);
    const cacheKey = this.blockCache.generateKey(tableName, filterHash, nextPage);

    if (this.blockCache.get(cacheKey)) return;

    try {
      const from = (nextPage - 1) * rowsPerPage;
      const to = from + rowsPerPage - 1;

      let query = supabase
        .from(tableName)
        .select('*');

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
      const { data, error } = await query;
      if (!error && data) {
        const countKey = `${tableName}:${filterHash}`;
        const totalCount = this.tableTotalCounts.get(countKey) || data.length;
        const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage));
        if (nextPage <= totalPages) {
          this.blockCache.set(cacheKey, { data: data || [], count: totalCount, totalPages, page: nextPage });
        }
      }
    } catch (e) {
      // Silent catch for background prefetch
    }
  }

  invalidateCache(tableName) {
    this.blockCache.invalidate(tableName);
    for (const key of this.tableTotalCounts.keys()) {
      if (key.startsWith(`${tableName}:`)) {
        this.tableTotalCounts.delete(key);
      }
    }
  }
}

// Export singletons
window.BPlusBlockCache = BPlusBlockCache;
window.supabaseDataEngine = new SupabaseDataEngine();
