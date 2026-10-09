const fs = require('fs');
const path = require('path');

/**
 * Format a single field value according to RFC 4180
 * @param {any} val 
 * @returns {string}
 */
function formatValueForCsv(val) {
  if (val === null || val === undefined) {
    return '';
  }
  if (typeof val === 'object') {
    val = JSON.stringify(val);
  } else {
    val = String(val);
  }

  // If string contains comma, double-quote, or newline, wrap in quotes and escape quotes
  if (val.includes('"') || val.includes(',') || val.includes('\n') || val.includes('\r')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

/**
 * Converts array of JSON objects to a CSV string prefixed with UTF-8 BOM (\uFEFF)
 * @param {Array<Object>} records 
 * @returns {string}
 */
function convertJsonToCsv(records) {
  const BOM = '\uFEFF';
  if (!Array.isArray(records) || records.length === 0) {
    return BOM;
  }

  // Collect all unique header keys across all records
  const headersSet = new Set();
  records.forEach(rec => {
    if (rec && typeof rec === 'object') {
      Object.keys(rec).forEach(k => headersSet.add(k));
    }
  });

  const headers = Array.from(headersSet);
  const headerLine = headers.map(h => formatValueForCsv(h)).join(',');

  const rows = records.map(rec => {
    return headers.map(h => formatValueForCsv(rec[h])).join(',');
  });

  return BOM + [headerLine, ...rows].join('\r\n');
}

/**
 * Extracts Supabase URL and Anon Key from project configuration file
 * @returns {{ url: string, anonKey: string }}
 */
function extractSupabaseCredentials() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    return {
      url: process.env.SUPABASE_URL.trim(),
      anonKey: process.env.SUPABASE_ANON_KEY.trim()
    };
  }

  const candidates = [
    path.join(__dirname, '..', 'assets', 'js', 'core', 'supabase-config.js'),
    path.join(__dirname, '..', 'assets', 'js', 'supabase-config.js'),
    path.join(__dirname, '..', 'public', 'assets', 'js', 'core', 'supabase-config.js')
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      const urlMatch = content.match(/const\s+SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
      const keyMatch = content.match(/const\s+SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/);
      if (urlMatch && keyMatch) {
        return {
          url: urlMatch[1].trim(),
          anonKey: keyMatch[1].trim()
        };
      }
    }
  }

  throw new Error('Không tìm thấy cấu hình SUPABASE_URL và SUPABASE_ANON_KEY trong file supabase-config.js');
}

module.exports = {
  formatValueForCsv,
  convertJsonToCsv,
  extractSupabaseCredentials
};
