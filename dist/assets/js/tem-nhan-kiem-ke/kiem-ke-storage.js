(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.KiemKeStorage = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  const SESSION_KEY = 'kiem_ke_scanned_rolls_session';
  const EXCEL_CACHE_KEY = 'kiem_ke_excel_cache';

  function checkDuplicate(scannedList, identifier) {
    if (!Array.isArray(scannedList) || !identifier) return false;
    const cleanId = String(identifier).trim().toLowerCase();
    return scannedList.some(item => {
      const b = String(item.barcode || '').trim().toLowerCase();
      const c = String(item.cuonId || '').trim().toLowerCase();
      return b === cleanId || (c && c === cleanId);
    });
  }

  function saveSession(scannedRolls, excelMetadata) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(scannedRolls || []));
      if (excelMetadata) {
        localStorage.setItem(EXCEL_CACHE_KEY, JSON.stringify(excelMetadata));
      }
    } catch (e) {
      console.warn('Lỗi lưu LocalStorage:', e);
    }
  }

  function loadSession() {
    if (typeof localStorage === 'undefined') return { scannedRolls: [], excelMetadata: null };
    try {
      const rawScanned = localStorage.getItem(SESSION_KEY);
      const rawExcel = localStorage.getItem(EXCEL_CACHE_KEY);
      return {
        scannedRolls: rawScanned ? JSON.parse(rawScanned) : [],
        excelMetadata: rawExcel ? JSON.parse(rawExcel) : null
      };
    } catch (e) {
      console.warn('Lỗi đọc LocalStorage:', e);
      return { scannedRolls: [], excelMetadata: null };
    }
  }

  function clearSession() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(EXCEL_CACHE_KEY);
    } catch (e) {
      console.warn('Lỗi xóa LocalStorage:', e);
    }
  }

  function clearScannedOnly() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (e) {
      console.warn('Lỗi xóa LocalStorage:', e);
    }
  }

  // Web Audio API Synthesizer
  let audioCtx = null;
  function getAudioContext() {
    if (typeof window === 'undefined') return null;
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playBeepSuccess() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([250, 100, 250]); } catch (e) {}
    }
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 (trong trẻo)
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {}
  }

  function playBoopError() {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime); // A3 (trầm)
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {}
  }

  return {
    checkDuplicate,
    saveSession,
    loadSession,
    clearSession,
    clearScannedOnly,
    playBeepSuccess,
    playBoopError
  };
}));
