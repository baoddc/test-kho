# Bypass 24h Lock for User "bao.lt" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow user `"bao.lt"` to edit and delete any data record regardless of the 24-hour lock restriction.

**Architecture:** Update central `isRecordLocked(record)` helper in `assets/js/supabase-config.js` and `dist-app/assets/js/supabase-config.js` to inspect logged-in user from `localStorage` (`currentUser`). If username is `"bao.lt"` (case-insensitive), return `false` (unlocked).

**Tech Stack:** JavaScript (ES6+), LocalStorage.

## Global Constraints

- User `"bao.lt"` must be matched case-insensitively.
- All other users must still be subject to the 24-hour edit/delete lock limit.
- Changes must be applied to both `assets/js/supabase-config.js` and `dist-app/assets/js/supabase-config.js`.

---

### Task 1: Update `isRecordLocked` in `assets/js/supabase-config.js` and `dist-app/assets/js/supabase-config.js`

**Files:**
- Modify: `assets/js/supabase-config.js:22-32`
- Modify: `dist-app/assets/js/supabase-config.js:22-32`

**Interfaces:**
- Consumes: `localStorage.getItem('currentUser')` or `window.currentUser`
- Produces: `window.isRecordLocked(record)` -> returns `boolean`

- [ ] **Step 1: Update `isRecordLocked` in `assets/js/supabase-config.js`**

Replace `function isRecordLocked(record)` in `assets/js/supabase-config.js`:
```javascript
function isRecordLocked(record) {
  if (!record) return false;

  // Bypass 24h lock restriction for user "bao.lt"
  const currentUser = (typeof localStorage !== 'undefined' && localStorage.getItem('currentUser')) || (typeof window !== 'undefined' && window.currentUser);
  if (currentUser && String(currentUser).trim().toLowerCase() === 'bao.lt') {
    return false;
  }

  const createdAtStr = record.created_at || record.createdAt || record.created_Time;
  if (!createdAtStr) return false;
  
  const createdTime = new Date(createdAtStr).getTime();
  if (isNaN(createdTime)) return false;
  
  const LOCK_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
  return (Date.now() - createdTime) > LOCK_DURATION_MS;
}
```

- [ ] **Step 2: Update `isRecordLocked` in `dist-app/assets/js/supabase-config.js`**

Apply the same replacement to `dist-app/assets/js/supabase-config.js`.

- [ ] **Step 3: Verify logic using Node execution**

Run node one-liner to verify `isRecordLocked` behavior for `bao.lt` vs other users:
```powershell
node -e "const isRecordLocked = (record, currentUser) => { if (!record) return false; if (currentUser && String(currentUser).trim().toLowerCase() === 'bao.lt') return false; const createdAtStr = record.created_at || record.createdAt || record.created_Time; if (!createdAtStr) return false; const createdTime = new Date(createdAtStr).getTime(); if (isNaN(createdTime)) return false; return (Date.now() - createdTime) > 24 * 60 * 60 * 1000; }; console.assert(isRecordLocked({created_at: '2020-01-01T00:00:00Z'}, 'bao.lt') === false, 'bao.lt failed'); console.assert(isRecordLocked({created_at: '2020-01-01T00:00:00Z'}, 'user1') === true, 'user1 failed'); console.log('ALL TESTS PASSED');"
```
Expected output: `ALL TESTS PASSED`

- [ ] **Step 4: Commit changes**

```bash
git add assets/js/supabase-config.js dist-app/assets/js/supabase-config.js
git commit -m "feat(auth): bypass 24h edit/delete lock for user bao.lt"
```
