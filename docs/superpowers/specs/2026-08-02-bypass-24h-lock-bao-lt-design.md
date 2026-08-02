# Bypass 24h Edit/Delete Lock for User "bao.lt" Design

## Overview
Currently, records older than 24 hours are locked from edit and delete operations across all system modules via the central helper `isRecordLocked(record)` in `assets/js/supabase-config.js`. 
This design specifies allowing user `"bao.lt"` to edit and delete any data without the 24-hour time restriction.

## Requirements
- User `"bao.lt"` (case-insensitive check) MUST be able to edit and delete any record, regardless of when it was created.
- Other users MUST remain subject to the existing 24-hour edit/delete restriction.
- No changes required to individual UI modules, as all modules delegate locking logic to `isRecordLocked(record)`.

## Technical Design

### Central Helper Update (`assets/js/supabase-config.js` and `dist-app/assets/js/supabase-config.js`)
Update `isRecordLocked(record)` to check the currently logged-in user retrieved from `localStorage.getItem('currentUser')` or `window.currentUser`.

```javascript
function isRecordLocked(record) {
  if (!record) return false;
  
  // Bypass 24h lock restriction for user "bao.lt"
  const currentUser = (typeof localStorage !== 'undefined' && localStorage.getItem('currentUser')) || window.currentUser;
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

## Affected Files
- [assets/js/supabase-config.js](file:///c:/Users/benhhc/Desktop/web-supabase/assets/js/supabase-config.js)
- [dist-app/assets/js/supabase-config.js](file:///c:/Users/benhhc/Desktop/web-supabase/dist-app/assets/js/supabase-config.js)

## Verification Plan

### Automated / Logic Verification
- Test `isRecordLocked` unit/logic test:
  - When `currentUser` is `'bao.lt'`, records created > 24 hours ago return `false`.
  - When `currentUser` is `'user1'`, records created > 24 hours ago return `true`.
  - When `currentUser` is `'user1'`, records created < 24 hours ago return `false`.
