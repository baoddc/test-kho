/* =============================================================================
   VOICE ASSISTANT WIDGET JS
   Midnight Neo Theme - Modern Conversational AI UI & Voice Intent Recognition
================================================================================ */

(function () {
  // Google Sheets Config for different sheet categories
  const SHEETS = {
    xg: {
      id: '1KqP0KIZmKzgKvZcCJRsTVO4lhScOGRa1OzQgE893eUU',
      gids: {
        nhap: '0',
        ton: '1968603689',
        xuat: '1888497588'
      }
    },
    tole: {
      id: '1GgNUPIYxvfJ1eQL4As6Vs0nb10A9ZIvoFQ4r2ZYm2pU',
      gids: {
        nhap: '425790242',
        ton: '869739970',
        xuat: '353555921'
      }
    }
  };

  // Cache for fetched sheets data to prevent multiple network hits
  const dataCache = {};

  // Speech Recognition & Synthesis variables
  let recognition = null;
  let isListening = false;
  let isSpeaking = false;
  let synth = window.speechSynthesis;
  let viVoice = null;

  // DOM Elements
  let fabContainer = null;
  let micBtn = null;
  let panel = null;
  let chatBody = null;
  let statusDot = null;
  let statusText = null;
  let waveContainer = null;

  // Initial greeting flag (greet only once)
  let hasGreeted = false;

  // Initialize Speech Synthesis Voices
  function loadVoices() {
    if (!synth) return;
    const voices = synth.getVoices();
    // Prioritize Vietnamese voices (Google, Microsoft, Apple, etc.)
    viVoice = voices.find(voice => voice.lang.toLowerCase().includes('vi') || voice.lang.toLowerCase().includes('vn'));
  }

  if (synth) {
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = loadVoices;
    }
    loadVoices();
  }

  // Parse ngày tháng từ các định dạng khác nhau
  function parseRowDate(raw) {
    if (raw === undefined || raw === null || raw === '') return null;
    if (typeof raw === 'number') {
      return new Date((raw - 25569) * 86400 * 1000);
    }
    if (typeof raw === 'string') {
      const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if (m) {
        let d = parseInt(m[1], 10);
        let mo = parseInt(m[2], 10) - 1;
        let y = parseInt(m[3], 10);
        if (y < 100) y += y < 50 ? 2000 : 1900;
        return new Date(y, mo, d);
      }
      const dt = new Date(raw);
      if (!isNaN(dt.getTime())) return dt;
    }
    return null;
  }

  // Chuyển đổi ngày tháng sang định dạng dd/mm/yy
  function formatDate(dateValue) {
    if (!dateValue && dateValue !== 0) return '';
    let date = null;
    if (typeof dateValue === 'number') {
      date = new Date((dateValue - 25569) * 86400 * 1000);
    } else if (typeof dateValue === 'string') {
      date = parseRowDate(dateValue);
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else {
      return String(dateValue ?? '');
    }
    if (!date || isNaN(date.getTime())) {
      return String(dateValue ?? '');
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  // Load SheetJS dynamically if not present
  async function ensureXLSXLoaded() {
    if (window.XLSX) return true;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error('Không thể tải thư viện XLSX.'));
      document.head.appendChild(script);
    });
  }

  // Fetch sheet and convert to 2D array
  async function fetchSheetData(sheetType, gidType) {
    const sheetConfig = SHEETS[sheetType];
    if (!sheetConfig) throw new Error(`Không tìm thấy cấu hình cho loại: ${sheetType}`);
    const sheetId = sheetConfig.id;
    const gid = sheetConfig.gids[gidType];
    
    const cacheKey = `${sheetId}_${gid}`;
    if (dataCache[cacheKey]) return dataCache[cacheKey];

    try {
      await ensureXLSXLoaded();
      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx&gid=${gid}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
      
      // Clean data and apply formatting
      const cleaned = [];
      if (rawData.length > 0) {
        cleaned.push(rawData[0]); // Header
        const headers = rawData[0].map(h => String(h || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
        const dateCols = [];
        const idCols = [];
        headers.forEach((h, idx) => {
          if (h.includes('ngay') || h.includes('date')) {
            dateCols.push(idx);
          } else if (h.includes('id')) {
            idCols.push(idx);
          }
        });
        
        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.length === 0) continue;
          
          // Check if row is entirely empty
          const isEmpty = row.every(cell => cell === undefined || cell === null || String(cell).trim() === '');
          if (isEmpty) continue;
          
          // Skip #REF rows
          const hasRef = row.some(cell => String(cell || '').toUpperCase().includes('#REF'));
          if (hasRef) continue;

          // Format ID columns as number
          idCols.forEach(idx => {
            if (row[idx] !== undefined && row[idx] !== null && row[idx] !== '') {
              const cleanedVal = String(row[idx]).trim().replace(/\s+/g, '');
              const parsedNum = Number(cleanedVal);
              if (!isNaN(parsedNum)) {
                row[idx] = parsedNum;
              }
            }
          });
          
          // Format Date columns
          dateCols.forEach(idx => {
            if (row[idx] !== undefined && row[idx] !== null && row[idx] !== '') {
              row[idx] = formatDate(row[idx]);
            }
          });

          cleaned.push(row);
        }
      }

      dataCache[cacheKey] = cleaned;
      return cleaned;
    } catch (error) {
      console.error(`Error fetching sheet type ${sheetType} (GID ${gid}):`, error);
      throw error;
    }
  }

  // Text-To-Speech (TTS) response
  function speak(text) {
    if (!synth) return;
    
    // Stop any active speech
    synth.cancel();
    
    // Remove emojis or special symbols for cleaner speech
    const cleanText = text.replace(/[\u2600-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '')
                          .replace(/\*/g, '')
                          .replace(/-\s+/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    if (viVoice) utterance.voice = viVoice;
    utterance.lang = 'vi-VN';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => { isSpeaking = true; };
    utterance.onend = () => { isSpeaking = false; };
    utterance.onerror = () => { isSpeaking = false; };

    synth.speak(utterance);
  }

  // Inject UI elements
  function injectUI() {
    // 1. FAB (Floating action button)
    fabContainer = document.createElement('div');
    fabContainer.className = 'va-fab-container';
    fabContainer.innerHTML = `
      <div class="va-tooltip">Trợ lý ảo giọng nói</div>
      <button class="va-mic-btn" id="vaMicBtn" aria-label="Nói với trợ lý ảo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
          <line x1="12" y1="19" x2="12" y2="23"></line>
          <line x1="8" y1="23" x2="16" y2="23"></line>
        </svg>
      </button>
    `;
    document.body.appendChild(fabContainer);

    // 2. Chat Panel
    panel = document.createElement('div');
    panel.className = 'va-panel';
    panel.id = 'vaPanel';
    panel.innerHTML = `
      <div class="va-header">
        <div class="va-header-info">
          <div class="va-avatar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <div class="va-title-container">
            <h4 class="va-title">Trợ lý ảo I'M BAO</h4>
            <div class="va-status">
              <div class="va-status-dot idle" id="vaStatusDot"></div>
              <span id="vaStatusText">Sẵn sàng</span>
            </div>
          </div>
        </div>
        <button class="va-close-btn" id="vaCloseBtn" title="Đóng">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="va-body" id="vaChatBody">
        <!-- Messages loaded here -->
      </div>
      <div class="va-suggestions" style="display: none;">
        <div class="va-chip" data-cmd="Tồn kho mã 1.2 x 100?">Tồn kho 1.2 x 100?</div>
        <div class="va-chip" data-cmd="Tìm tất cả">Tìm tất cả</div>
        <div class="va-chip" data-cmd="Tổng hợp tồn kho">Tổng hợp tồn kho</div>
        <div class="va-chip" data-cmd="Nhập ngày 10/05/2026?">Nhập ngày 10/05/2026?</div>
        <div class="va-chip" data-cmd="Đi tới trang nhập xà gồ">Đi tới Nhập Xà Gồ</div>
        <div class="va-chip" data-cmd="Hướng dẫn">Hướng dẫn</div>
      </div>
      <div style="padding: 10px 20px; display: flex; align-items: center; gap: 8px; border-top: 1px solid rgba(255, 255, 255, 0.05); background: rgba(30, 41, 59, 0.3);">
        <input type="text" id="vaChatInput" placeholder="Nhập câu lệnh của bạn..." style="flex-grow: 1; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 6px 12px; color: white; font-size: 0.85rem; outline: none;">
        <button id="vaSendBtn" style="background: var(--va-accent); border: none; border-radius: 8px; padding: 6px 12px; color: white; font-size: 0.85rem; cursor: pointer;">Gửi</button>
      </div>
      <div class="va-wave-container" id="vaWaveContainer">
        <div class="va-wave-bar"></div>
        <div class="va-wave-bar"></div>
        <div class="va-wave-bar"></div>
        <div class="va-wave-bar"></div>
        <div class="va-wave-bar"></div>
      </div>
    `;
    document.body.appendChild(panel);

    // Bind DOM
    micBtn = document.getElementById('vaMicBtn');
    chatBody = document.getElementById('vaChatBody');
    statusDot = document.getElementById('vaStatusDot');
    statusText = document.getElementById('vaStatusText');
    waveContainer = document.getElementById('vaWaveContainer');

    // Register Event Listeners
    micBtn.addEventListener('click', toggleListening);
    document.getElementById('vaCloseBtn').addEventListener('click', togglePanel);
    
    // Chips click
    document.querySelectorAll('.va-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const cmd = chip.getAttribute('data-cmd');
        if (cmd) {
          addUserMessage(cmd);
          processCommand(cmd);
        }
      });
    });

    // Chat Input Enter Key
    const chatInput = document.getElementById('vaChatInput');
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendInputMessage();
      }
    });

    document.getElementById('vaSendBtn').addEventListener('click', sendInputMessage);
  }

  function sendInputMessage() {
    const chatInput = document.getElementById('vaChatInput');
    const text = chatInput.value.trim();
    if (text) {
      addUserMessage(text);
      processCommand(text);
      chatInput.value = '';
    }
  }

  function togglePanel() {
    panel.classList.toggle('active');
    if (panel.classList.contains('active') && !hasGreeted) {
      hasGreeted = true;
      addBotMessage("Xin chào! Tôi là trợ lý ảo I'M BAO. Tôi có thể giúp bạn tra cứu tồn kho, xem thông tin nhập hàng, tổng hợp báo cáo hoặc mở các trang nhanh bằng giọng nói. Nhấp vào Micro để bắt đầu nói!");
      speak("Xin chào! Tôi là trợ lý ảo I'M BAO. Tôi có thể giúp bạn tra cứu tồn kho, nhập hàng hoặc tổng hợp báo cáo. Hãy nhấn nút mic để nói.");
    }
  }

  // Add Messages to UI
  function addUserMessage(text) {
    const msg = document.createElement('div');
    msg.className = 'va-msg user';
    msg.innerHTML = `
      <span>${text}</span>
      <span class="va-msg-time">${getCurrentTime()}</span>
    `;
    chatBody.appendChild(msg);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function addBotMessage(text, dataBoxText = null) {
    const msg = document.createElement('div');
    msg.className = 'va-msg bot';
    let content = `<span>${text}</span>`;
    
    if (dataBoxText) {
      content += `<div class="va-data-box">${dataBoxText}</div>`;
    }
    
    content += `<span class="va-msg-time">${getCurrentTime()}</span>`;
    msg.innerHTML = content;
    chatBody.appendChild(msg);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function getCurrentTime() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  // Setup Web Speech API
  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition API is not supported in this browser.");
      return false;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListening = true;
      micBtn.classList.add('listening');
      statusDot.className = 'va-status-dot listening';
      statusText.textContent = 'Đang lắng nghe...';
      waveContainer.classList.add('active');
    };

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      addUserMessage(text);
      processCommand(text);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      let errorMsg = "Có lỗi xảy ra khi nhận diện.";
      if (event.error === 'no-speech') errorMsg = "Không nghe thấy tiếng nói. Bạn vui lòng thử lại.";
      if (event.error === 'audio-capture') errorMsg = "Không tìm thấy thiết bị thu âm (Microphone).";
      if (event.error === 'not-allowed') errorMsg = "Quyền truy cập Microphone bị từ chối.";
      
      addBotMessage(errorMsg);
      speak(errorMsg);
    };

    recognition.onend = () => {
      isListening = false;
      micBtn.classList.remove('listening');
      statusDot.className = 'va-status-dot idle';
      statusText.textContent = 'Sẵn sàng';
      waveContainer.classList.remove('active');
    };

    return true;
  }

  function toggleListening() {
    // Open panel if closed
    if (!panel.classList.contains('active')) {
      togglePanel();
    }

    if (!recognition) {
      const ok = initSpeechRecognition();
      if (!ok) {
        addBotMessage("Trình duyệt của bạn không hỗ trợ nhận diện giọng nói tiếng Việt. Bạn hãy gõ câu lệnh vào ô phía dưới.");
        return;
      }
    }

    if (isListening) {
      recognition.stop();
    } else {
      // Cancel speech if speaking
      if (synth) synth.cancel();
      try {
        recognition.start();
      } catch (e) {
        console.error(e);
      }
    }
  }

  // ==================== VOICE INTENT PARSING ====================
  
  // Normalization helper
  function normalizeText(text) {
    return text.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accent marks
      .replace(/[^\w\s\.\/x\*]/g, '') // keep letters, numbers, spaces, dots, slashes, x, asterisks
      .replace(/\s+/g, ' ')
      .trim();
  }

  async function processCommand(rawText) {
    const cleanText = rawText.trim().toLowerCase();

    // Check for explicit "ton " / "tồn " / "/ton " prefix commands to search all columns
    if (cleanText.startsWith('/ton') || cleanText.startsWith('ton ') || cleanText.startsWith('tồn ')) {
      let query = rawText.trim();
      if (cleanText.startsWith('/ton')) {
        query = query.substring(4).trim();
      } else if (cleanText.startsWith('ton ')) {
        query = query.substring(4).trim();
      } else {
        query = query.substring(4).trim();
      }
      
      if (!query) {
        const reply = "Vui lòng nhập từ khóa tìm kiếm (Ví dụ: tồn 3X451VN)";
        addBotMessage(reply);
        speak(reply);
        resetStatus();
        return;
      }
      await handleInventoryQuery(query, true);
      return;
    }

    // Check for explicit "nhap " / "nhập " / "/nhap " prefix commands
    if (cleanText.startsWith('/nhap') || cleanText.startsWith('nhap ') || cleanText.startsWith('nhập ')) {
      let query = rawText.trim();
      if (cleanText.startsWith('/nhap')) {
        query = query.substring(5).trim();
      } else if (cleanText.startsWith('nhap ')) {
        query = query.substring(5).trim();
      } else {
        query = query.substring(5).trim();
      }
      
      if (!query) {
        const reply = "Vui lòng nhập từ khóa để tìm kiếm lịch sử nhập kho (Ví dụ: nhập 3X451VN)";
        addBotMessage(reply);
        speak(reply);
        resetStatus();
        return;
      }
      await handleLogQuery(query, 'nhap', true);
      return;
    }

    // Check for explicit "xuat " / "xuất " / "/xuat " prefix commands
    if (cleanText.startsWith('/xuat') || cleanText.startsWith('xuat ') || cleanText.startsWith('xuất ')) {
      let query = rawText.trim();
      if (cleanText.startsWith('/xuat')) {
        query = query.substring(5).trim();
      } else if (cleanText.startsWith('xuat ')) {
        query = query.substring(5).trim();
      } else {
        query = query.substring(5).trim();
      }
      
      if (!query) {
        const reply = "Vui lòng nhập từ khóa để tìm kiếm lịch sử xuất kho (Ví dụ: xuất 3X451VN)";
        addBotMessage(reply);
        speak(reply);
        resetStatus();
        return;
      }
      await handleLogQuery(query, 'xuat', true);
      return;
    }

    const norm = normalizeText(cleanText);
 
    statusDot.className = 'va-status-dot listening';
    statusText.textContent = 'Đang xử lý...';

    try {
      // 1. Navigation Commands
      if (norm.includes('nhap xa go') || norm.includes('trang nhap xa go')) {
        handleNavigation('/pages/xg/xg-nhap.html', "Nhập xà gồ");
        return;
      }
      if (norm.includes('xuat xa go') || norm.includes('trang xuat xa go')) {
        handleNavigation('/pages/xg/xg-xuat.html', "Xuất xà gồ");
        return;
      }
      if (norm.includes('ton xa go') || norm.includes('trang ton xa go')) {
        handleNavigation('/pages/xg/xg-ton.html', "Tồn xà gồ");
        return;
      }
      if (norm.includes('bieu do xa go')) {
        handleNavigation('/pages/xg/xg-bieu-do.html', "Biểu đồ xà gồ");
        return;
      }
      if (norm.includes('nhap tole') || norm.includes('trang nhap tole')) {
        handleNavigation('/pages/tole/tole-nhap.html', "Nhập tole");
        return;
      }
      if (norm.includes('xuat tole') || norm.includes('trang xuat tole')) {
        handleNavigation('/pages/tole/tole-xuat.html', "Xuất tole");
        return;
      }
      if (norm.includes('ton tole') || norm.includes('trang ton tole')) {
        handleNavigation('/pages/tole/tole-ton.html', "Tồn tole");
        return;
      }
      if (norm.includes('bieu do tole')) {
        handleNavigation('/pages/tole/tole-bieu-do.html', "Biểu đồ tole");
        return;
      }
      if (norm.includes('so do kho') || norm.includes('phoi cuon')) {
        handleNavigation('/pages/5s/5s-so-do-phoi-cuon.html', "Sơ đồ kho phôi cuộn");
        return;
      }
      if (norm.includes('phe lieu') || norm.includes('so do phe lieu')) {
        handleNavigation('/pages/5s/5s-so-do-phe-lieu.html', "Sơ đồ kho phế liệu");
        return;
      }
      if (norm.includes('hse') || norm.includes('trang hse')) {
        handleNavigation('/pages/5s/hse.html', "HSE");
        return;
      }
      if (norm.includes('trang chu') || norm.includes('ve trang chu')) {
        handleNavigation('/pages/home.html', "Trang chủ");
        return;
      }
      if (norm.includes('gioi thieu') || norm.includes('ve gioi thieu')) {
        handleNavigation('/pages/about.html', "Giới thiệu");
        return;
      }

      // 2. Help/Greeting Commands
      if (norm.includes('huong dan') || norm.includes('tro giup') || norm.includes('giup do') || norm.includes('lam duoc gi')) {
        const helpText = "Tôi có thể giúp bạn các câu lệnh sau:\n" +
          "1. Kiểm tra tồn kho: 'Mã [X] còn bao nhiêu?'\n" +
          "2. Kiểm tra danh sách nhập: 'Nhập ngày [ngày/tháng/năm]?'\n" +
          "3. Tổng hợp báo cáo tồn: 'Tổng hợp tồn kho'\n" +
          "4. Điều hướng nhanh: 'Đi tới trang nhập xà gồ', 'Về trang chủ'";
        addBotMessage(helpText);
        speak("Tôi có thể giúp bạn kiểm tra tồn kho, xem danh sách nhập ngày, tổng hợp báo cáo và chuyển nhanh sang các trang.");
        resetStatus();
        return;
      }

      // 2.5. Find All Command ("Tìm tất cả", "danh sách tồn kho")
      if (norm.includes('tim tat ca') || norm.includes('danh sach ton') || norm === 'tat ca' || norm === 'tim het') {
        let category = 'all';
        if (norm.includes('xa go')) category = 'xg';
        else if (norm.includes('tole')) category = 'tole';
        
        await handleFindAllQuery(category);
        return;
      }

      // 3. Inventory Query ("Mã X còn bao nhiêu / Tồn kho mã X")
      // Match keywords: "còn bao nhiêu", "ton kho", "ton", "so luong"
      if (norm.includes('con bao nhieu') || norm.includes('ton kho') || norm.includes('kiem tra ma') || norm.includes('ma so') || norm.startsWith('ma ') || norm.includes('ton cua ma')) {
        // Extract the code:
        // Strip out trigger words
        let queryCode = rawText;
        const stopWords = [
          /kiểm tra tồn kho mã số/i, /kiểm tra tồn kho mã/i, /kiểm tra mã số/i, /kiểm tra mã/i,
          /tồn kho mã số/i, /tồn kho mã/i, /mã số/i, /mã/i, /còn bao nhiêu/i, /bao nhiêu/i,
          /kg/i, /tồn/i, /bao nhiêu/i, /xem/i, /kho/i, /của/i
        ];
        
        stopWords.forEach(pattern => {
          queryCode = queryCode.replace(pattern, '');
        });
        
        queryCode = queryCode.replace(/[?？.,]/g, '').trim();

        if (!queryCode) {
          const reply = "Bạn muốn kiểm tra tồn kho của mã vật tư nào? Vui lòng nói: 'Mã XG-001 còn bao nhiêu'";
          addBotMessage(reply);
          speak(reply);
          resetStatus();
          return;
        }

        await handleInventoryQuery(queryCode);
        return;
      }

      // 4. Date Import Query ("Nhập ngày 10/05/2026 gồm những gì", "ngày 10 tháng 5 nhập bao nhiêu")
      if (norm.includes('nhap ngay') || norm.includes('ngay') && (norm.includes('nhap') || norm.includes('gồm những gì') || norm.includes('co gi'))) {
        // Parse date from text
        const targetDateStr = parseDateFromText(rawText);
        if (!targetDateStr) {
          const reply = "Tôi không hiểu rõ ngày bạn yêu cầu. Vui lòng nói theo định dạng: 'Nhập ngày mười tháng năm' hoặc 'Nhập ngày 10 tháng 5 năm 2026'.";
          addBotMessage(reply);
          speak(reply);
          resetStatus();
          return;
        }

        await handleDateImportQuery(targetDateStr);
        return;
      }

      // 5. General Summary Query ("Tổng hợp lại", "báo cáo tổng hợp")
      if (norm.includes('tong hop lai') || norm.includes('tong hop') || norm.includes('bao cao')) {
        await handleGeneralSummaryQuery();
        return;
      }

      // Fallback response: try treating it as an inventory query, then import log, then export log!
      const targetQuery = rawText.trim().replace(/[?？.,]/g, '');
      if (targetQuery.length >= 2) {
        const tonMatches = await handleInventoryQuery(targetQuery, true, true);
        if (tonMatches > 0) return;

        const nhapMatches = await handleLogQuery(targetQuery, 'nhap', true, true);
        if (nhapMatches > 0) return;

        const xuatMatches = await handleLogQuery(targetQuery, 'xuat', true, true);
        if (xuatMatches > 0) return;
      }

      const fallbackText = `Tôi nghe thấy: "${rawText}". Nhưng tôi chưa hiểu câu lệnh này. Bạn nói lại hoặc xem "Hướng dẫn" nhé!`;
      addBotMessage(fallbackText);
      speak("Tôi nghe thấy câu lệnh nhưng chưa hiểu rõ. Bạn vui lòng xem hướng dẫn.");
      resetStatus();
    } catch (err) {
      console.error(err);
      let errMsg = "Rất tiếc, đã xảy ra lỗi trong quá trình xử lý truy vấn dữ liệu: " + err.message;
      if (window.location.protocol === 'file:') {
        errMsg += "\n\nCảnh báo: Bạn đang mở trang bằng giao thức file://. Trình duyệt chặn CORS không thể tải dữ liệu từ Google Sheets. Vui lòng chạy trang web thông qua Live Server hoặc Máy chủ Web cục bộ (ví dụ: localhost) để tính năng hoạt động chính xác.";
      }
      addBotMessage(errMsg);
      speak("Đã xảy ra lỗi truy vấn dữ liệu.");
      resetStatus();
    }
  }

  function resetStatus() {
    statusDot.className = 'va-status-dot idle';
    statusText.textContent = 'Sẵn sàng';
  }

  function handleNavigation(url, pageName) {
    const text = `Đang chuyển hướng tới trang: ${pageName}...`;
    addBotMessage(text);
    speak(`Chuyển tới ${pageName}`);
    setTimeout(() => {
      window.location.href = url;
    }, 1200);
  }

  // Helper to parse date from string (e.g. "ngày 10 tháng 5" -> "10/05/2026")
  function parseDateFromText(text) {
    // 1. Try to find dd/mm/yyyy or dd/mm
    const dateRegex = /(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/;
    const match = text.match(dateRegex);
    
    if (match) {
      const d = String(parseInt(match[1], 10)).padStart(2, '0');
      const m = String(parseInt(match[2], 10)).padStart(2, '0');
      let y = match[3] ? parseInt(match[3], 10) : new Date().getFullYear();
      if (y < 100) y += 2000;
      return `${d}/${m}/${y}`;
    }

    // 2. Try to find verbal vietnamese format "ngày X tháng Y năm Z"
    const verbalRegex = /ngày\s*(\d{1,2})\s*tháng\s*(\d{1,2})(?:\s*năm\s*(\d{2,4}))?/i;
    const verbalMatch = text.match(verbalRegex);
    if (verbalMatch) {
      const d = String(parseInt(verbalMatch[1], 10)).padStart(2, '0');
      const m = String(parseInt(verbalMatch[2], 10)).padStart(2, '0');
      let y = verbalMatch[3] ? parseInt(verbalMatch[3], 10) : new Date().getFullYear();
      if (y < 100) y += 2000;
      return `${d}/${m}/${y}`;
    }

    // 3. Verbal word matching for single digits (e.g. "mười", "năm")
    // Simple lookup map for spoken numbers
    const numMap = {
      'một': 1, 'hai': 2, 'ba': 3, 'bốn': 4, 'năm': 5, 'sáu': 6, 'bảy': 7, 'tám': 8, 'chín': 9, 'mười': 10,
      'mười một': 11, 'mười hai': 12, 'mười ba': 13, 'mười bốn': 14, 'mười lăm': 15, 'mười sáu': 16, 'mười bảy': 17,
      'mười tám': 18, 'mười chín': 19, 'hai mươi': 20, 'hai mốt': 21, 'hai hai': 22, 'hai ba': 23, 'hai tư': 24,
      'hai lăm': 25, 'hai sáu': 26, 'hai bảy': 27, 'hai tám': 28, 'hai chín': 29, 'ba mươi': 30, 'ba mốt': 31
    };

    // Replace written numbers with digits
    let processedText = text.toLowerCase();
    Object.keys(numMap).forEach(word => {
      processedText = processedText.replace(new RegExp(word, 'g'), numMap[word]);
    });

    const secondMatch = processedText.match(/ngày\s*(\d{1,2})\s*tháng\s*(\d{1,2})/i);
    if (secondMatch) {
      const d = String(parseInt(secondMatch[1], 10)).padStart(2, '0');
      const m = String(parseInt(secondMatch[2], 10)).padStart(2, '0');
      const y = new Date().getFullYear();
      return `${d}/${m}/${y}`;
    }

    return null;
  }

  // Normalize string for code comparison (remove spaces, symbols)
  function normalizeCode(code) {
    return String(code || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, ''); // keep only alphanumerics
  }

  // Helper to check match detail for multi-column search
  function getMatchDetail(row, headers, targetNorm) {
    for (let c = 0; c < row.length; c++) {
      const cellVal = String(row[c] || '').trim();
      const cellNorm = normalizeCode(cellVal);
      if (cellNorm && cellNorm.includes(targetNorm)) {
        return `ở cột "${headers[c]}" chứa "${cellVal}"`;
      }
    }
    return '';
  }

  // Handle Inventory Query
  async function handleInventoryQuery(queryCode, searchAllColumns = true, suppressNoResultsMessage = false) {
    const searchModeText = searchAllColumns ? " (tìm ở tất cả các cột)" : "";
    if (!suppressNoResultsMessage) {
      addBotMessage(`Đang truy vấn tồn kho cho từ khóa: "${queryCode}"${searchModeText}...`);
    }
    
    // Load both inventory sheets
    let xgTon = [], toleTon = [];
    try {
      [xgTon, toleTon] = await Promise.all([
        fetchSheetData('xg', 'ton'),
        fetchSheetData('tole', 'ton')
      ]);
    } catch (err) {
      console.error(err);
      if (!suppressNoResultsMessage) {
        addBotMessage("Không thể kết nối đến dữ liệu Google Sheets để tra cứu: " + err.message);
      }
      resetStatus();
      return 0;
    }

    const targetNorm = normalizeCode(queryCode);
    
    // Search in sheets
    let results = [];
    
    function searchSheet(sheetData, category) {
      if (!sheetData || sheetData.length < 2) return;
      const headers = sheetData[0];
      
      // Dynamic header mapping
      const codeColIdx = headers.findIndex(h => {
        const normH = normalizeText(h);
        return normH.includes('ma vat tu') || normH === 'ma';
      });
      const nameColIdx = headers.findIndex(h => {
        const normH = normalizeText(h);
        return normH.includes('ten vat tu') || normH === 'ten';
      });
      const qtyColIdx = headers.findIndex(h => {
        const normH = normalizeText(h);
        return normH.includes('ton cuoi') || normH.includes('so luong') || normH.includes('kg') || normH.includes('ton');
      });
      const projColIdx = headers.findIndex(h => {
        const normH = normalizeText(h);
        return normH.includes('ten cong trinh') || normH === 'cong trinh';
      });
      const projCodeColIdx = headers.findIndex(h => {
        const normH = normalizeText(h);
        return normH.includes('ma cong trinh');
      });
      const locColIdx = headers.findIndex(h => {
        const normH = normalizeText(h);
        return normH.includes('vi tri') || normH === 'vitri' || normH === 'vị trí';
      });

      if (codeColIdx === -1 || qtyColIdx === -1) return;

      for (let i = 1; i < sheetData.length; i++) {
        const row = sheetData[i];
        
        let projName = '';
        if (projColIdx !== -1 && row[projColIdx]) {
          const val = String(row[projColIdx]).trim();
          if (val && val !== '-' && val.toLowerCase() !== 'null' && val.toLowerCase() !== 'undefined') {
            projName = val;
          }
        }
        if (!projName && projCodeColIdx !== -1 && row[projCodeColIdx]) {
          const val = String(row[projCodeColIdx]).trim();
          if (val && val !== '-' && val.toLowerCase() !== 'null' && val.toLowerCase() !== 'undefined') {
            projName = val;
          }
        }
        
        let location = '';
        if (locColIdx !== -1 && row[locColIdx]) {
          const val = String(row[locColIdx]).trim();
          if (val && val !== '-' && val.toLowerCase() !== 'null' && val.toLowerCase() !== 'undefined') {
            location = val;
          }
        }

        if (searchAllColumns) {
          // Check all columns in the row
          let matchFound = false;
          let matchColDetail = '';
          
          for (let c = 0; c < row.length; c++) {
            const cellVal = String(row[c] || '').trim();
            const cellNorm = normalizeCode(cellVal);
            if (cellNorm && cellNorm.includes(targetNorm)) {
              matchFound = true;
              matchColDetail = `[${headers[c]}: ${cellVal}]`;
              break;
            }
          }
          
          if (matchFound) {
            const cellCode = String(row[codeColIdx] || '').trim();
            results.push({
              code: cellCode || 'Không có mã',
              name: row[nameColIdx] || '',
              qty: row[qtyColIdx] !== undefined && row[qtyColIdx] !== null ? row[qtyColIdx] : 0,
              category: category,
              matchDetail: matchColDetail,
              projName: projName,
              location: location
            });
          }
        } else {
          // Normal search: only search in code column
          const cellCode = String(row[codeColIdx] || '').trim();
          if (!cellCode) continue;
          
          const cellNorm = normalizeCode(cellCode);
          if (cellNorm && (cellNorm.includes(targetNorm) || targetNorm.includes(cellNorm))) {
            results.push({
              code: cellCode,
              name: row[nameColIdx] || '',
              qty: row[qtyColIdx] !== undefined && row[qtyColIdx] !== null ? row[qtyColIdx] : 0,
              category: category,
              projName: projName,
              location: location
            });
          }
        }
      }
    }

    searchSheet(xgTon, "Xà Gồ");
    searchSheet(toleTon, "Tole");

    if (results.length === 0) {
      if (!suppressNoResultsMessage) {
        const reply = `Không tìm thấy thông tin tồn kho cho từ khóa "${queryCode}".`;
        addBotMessage(reply);
        speak(reply);
      }
      resetStatus();
      return 0;
    } else {
      // If we were in trial search and found matches, write the introductory message now!
      if (suppressNoResultsMessage) {
        addBotMessage(`Đang truy vấn tồn kho cho từ khóa: "${queryCode}"${searchModeText}...`);
      }

      // Format results
      let responseText = `Đã tìm thấy ${results.length} kết quả phù hợp:\n`;
      let ttsText = "";
      
      let dataBoxContent = `<table class="va-table"><thead><tr><th>Mã (Loại)</th><th>Vị trí</th><th>Số lượng</th><th>Công trình</th></tr></thead><tbody>`;
      results.forEach((item, idx) => {
        const qtyNum = parseFloat(String(item.qty).replace(/[^0-9.-]/g, ''));
        const qtyFormatted = isNaN(qtyNum) ? item.qty : qtyNum.toLocaleString('vi-VN') + " Kg";
        const detailText = item.matchDetail ? ` (Khớp ${item.matchDetail})` : '';
        const projText = item.projName ? ` - Công trình: ${item.projName}` : ' - Tồn trơn';
        const locText = item.location ? ` - Vị trí: ${item.location}` : '';
        
        responseText += `- [${item.category}] Mã **${item.code}** - ${item.name}: ${locText ? locText.substring(3) + ' - ' : ''}Tồn ${qtyFormatted}${projText}${detailText}\n`;
        const projTableText = item.projName ? item.projName : 'Tồn trơn';
        const locTableText = item.location ? item.location : '-';
        const detailTableText = item.matchDetail ? `<br><small style="color:#64748b; font-size: 0.65rem;">(Khớp ${item.matchDetail})</small>` : '';
        dataBoxContent += `<tr><td>${item.code} (${item.category})${detailTableText}</td><td>${locTableText}</td><td>${qtyFormatted}</td><td>${projTableText}</td></tr>`;
        
        if (idx === 0) {
          ttsText = `${item.category} mã ${item.code} tồn ${qtyFormatted}.`;
        }
      });
      dataBoxContent += `</tbody></table>`;
      
      if (results.length > 1) {
        ttsText = `Đã tìm thấy ${results.length} mặt hàng tương tự.`;
      }

      addBotMessage(responseText, dataBoxContent.trim());
      speak(ttsText);
      resetStatus();
      return results.length;
    }
  }

  // Handle log query (Nhập or Xuất)
  async function handleLogQuery(queryCode, type = 'nhap', searchAllColumns = true, suppressNoResultsMessage = false) {
    const typeLabel = type === 'nhap' ? "Nhập" : "Xuất";
    const searchModeText = searchAllColumns ? " (tìm ở tất cả các cột)" : "";
    
    if (!suppressNoResultsMessage) {
      addBotMessage(`Đang truy vấn lịch sử ${typeLabel} kho cho từ khóa: "${queryCode}"${searchModeText}...`);
    }

    // Use IIFE-level formatDate helper
    
    // Load both Nhập or Xuất sheets
    let xgData = [], toleData = [];
    try {
      [xgData, toleData] = await Promise.all([
        fetchSheetData('xg', type),
        fetchSheetData('tole', type)
      ]);
    } catch (err) {
      console.error(err);
      if (!suppressNoResultsMessage) {
        addBotMessage(`Không thể kết nối đến dữ liệu Google Sheets để tra cứu lịch sử ${typeLabel}: ` + err.message);
      }
      resetStatus();
      return 0;
    }

    const targetNorm = normalizeCode(queryCode);
    let results = [];

    function searchSheet(sheetData, category) {
      if (!sheetData || sheetData.length < 2) return;
      const headers = sheetData[0];
      
      const dateColIdx = headers.findIndex(h => {
        const normH = normalizeText(h);
        return normH.includes('ngay');
      });
      const codeColIdx = headers.findIndex(h => {
        const normH = normalizeText(h);
        return normH.includes('ma vat tu') || normH === 'ma';
      });
      const nameColIdx = headers.findIndex(h => {
        const normH = normalizeText(h);
        return normH.includes('ten vat tu') || normH === 'ten';
      });
      const qtyColIdx = headers.findIndex(h => {
        const normH = normalizeText(h);
        return normH.includes('so luong') || normH.includes('kg') || normH.includes('khoi luong');
      });
      const projColIdx = headers.findIndex(h => {
        const normH = normalizeText(h);
        return normH.includes('ten cong trinh') || normH === 'cong trinh';
      });
      const projCodeColIdx = headers.findIndex(h => {
        const normH = normalizeText(h);
        return normH.includes('ma cong trinh');
      });

      if (codeColIdx === -1 || qtyColIdx === -1) return;

      for (let i = 1; i < sheetData.length; i++) {
        const row = sheetData[i];
        if (!row || row.length === 0) continue;

        let projName = '';
        if (projColIdx !== -1 && row[projColIdx]) {
          const val = String(row[projColIdx]).trim();
          if (val && val !== '-' && val.toLowerCase() !== 'null' && val.toLowerCase() !== 'undefined') {
            projName = val;
          }
        }
        if (!projName && projCodeColIdx !== -1 && row[projCodeColIdx]) {
          const val = String(row[projCodeColIdx]).trim();
          if (val && val !== '-' && val.toLowerCase() !== 'null' && val.toLowerCase() !== 'undefined') {
            projName = val;
          }
        }

        let matchFound = false;
        let matchColDetail = '';

        if (searchAllColumns) {
          for (let c = 0; c < row.length; c++) {
            const cellVal = String(row[c] || '').trim();
            const cellNorm = normalizeCode(cellVal);
            if (cellNorm && cellNorm.includes(targetNorm)) {
              matchFound = true;
              matchColDetail = `[${headers[c]}: ${cellVal}]`;
              break;
            }
          }
        } else {
          const cellCode = String(row[codeColIdx] || '').trim();
          const cellNorm = normalizeCode(cellCode);
          if (cellNorm && (cellNorm.includes(targetNorm) || targetNorm.includes(cellNorm))) {
            matchFound = true;
          }
        }

        if (matchFound) {
          const cellCode = String(row[codeColIdx] || '').trim();
          const cellDate = dateColIdx !== -1 ? (row[dateColIdx] || '') : '';
          results.push({
            code: cellCode || 'Không có mã',
            name: row[nameColIdx] || '',
            qty: row[qtyColIdx] !== undefined && row[qtyColIdx] !== null ? row[qtyColIdx] : 0,
            date: formatDate(cellDate),
            category: category,
            matchDetail: matchColDetail,
            projName: projName
          });
        }
      }
    }

    searchSheet(xgData, type === 'nhap' ? 'Xà Gồ Nhập' : 'Xà Gồ Xuất');
    searchSheet(toleData, type === 'nhap' ? 'Tole Nhập' : 'Tole Xuất');

    if (results.length === 0) {
      if (!suppressNoResultsMessage) {
        const reply = `Không tìm thấy bản ghi ${typeLabel} kho nào cho từ khóa "${queryCode}".`;
        addBotMessage(reply);
        speak(reply);
      }
      resetStatus();
      return 0;
    } else {
      if (suppressNoResultsMessage) {
        addBotMessage(`Đang truy vấn lịch sử ${typeLabel} kho cho từ khóa: "${queryCode}"${searchModeText}...`);
      }

      // Format results
      let responseText = `Đã tìm thấy ${results.length} bản ghi ${typeLabel} kho phù hợp:\n`;
      let ttsText = `Đã tìm thấy ${results.length} bản ghi ${typeLabel} kho.`;
      
      let dataBoxContent = `<table class="va-table"><thead><tr><th>Mã (Loại)</th><th>Ngày</th><th>Số lượng</th><th>Công trình</th></tr></thead><tbody>`;
      results.forEach((item, idx) => {
        const qtyNum = parseFloat(String(item.qty).replace(/[^0-9.-]/g, ''));
        const qtyFormatted = isNaN(qtyNum) ? item.qty : qtyNum.toLocaleString('vi-VN') + " Kg";
        const dateText = item.date ? ` ngày ${item.date}` : '';
        const detailText = item.matchDetail ? ` (Khớp ${item.matchDetail})` : '';
        const projText = item.projName ? ` - Công trình: ${item.projName}` : '';
        
        responseText += `- [${item.category}] Mã **${item.code}** - ${item.name}: ${typeLabel}${dateText} ${qtyFormatted}${projText}${detailText}\n`;
        const detailTableText = item.matchDetail ? `<br><small style="color:#64748b; font-size: 0.65rem;">(Khớp ${item.matchDetail})</small>` : '';
        dataBoxContent += `<tr><td>${item.code} (${item.category})${detailTableText}</td><td>${item.date || ''}</td><td>${qtyFormatted}</td><td>${item.projName || ''}</td></tr>`;
      });
      dataBoxContent += `</tbody></table>`;

      addBotMessage(responseText, dataBoxContent.trim());
      speak(ttsText);
      resetStatus();
      return results.length;
    }
  }
 
  // Handle Find All Query
  async function handleFindAllQuery(category) {
    addBotMessage("Đang quét toàn bộ dữ liệu tồn kho để lập danh sách...");

    let xgTon = [], toleTon = [];
    try {
      if (category === 'xg' || category === 'all') {
        xgTon = await fetchSheetData('xg', 'ton');
      }
      if (category === 'tole' || category === 'all') {
        toleTon = await fetchSheetData('tole', 'ton');
      }
    } catch (err) {
      console.error("Lỗi khi tải dữ liệu cho Tìm tất cả:", err);
      addBotMessage("Không thể tải dữ liệu từ Google Sheets: " + err.message);
      resetStatus();
      return;
    }

    const items = [];

    function extractItems(sheetData, catName) {
      if (!sheetData || sheetData.length < 2) return;
      const headers = sheetData[0];
      
      const codeColIdx = headers.findIndex(h => {
        const normH = normalizeText(h);
        return normH.includes('ma vat tu') || normH === 'ma';
      });
      const nameColIdx = headers.findIndex(h => {
        const normH = normalizeText(h);
        return normH.includes('ten vat tu') || normH === 'ten';
      });
      const qtyColIdx = headers.findIndex(h => {
        const normH = normalizeText(h);
        return normH.includes('ton cuoi') || normH.includes('so luong') || normH.includes('kg') || normH.includes('ton');
      });
      const locColIdx = headers.findIndex(h => {
        const normH = normalizeText(h);
        return normH.includes('vi tri') || normH === 'vitri' || normH === 'vị trí';
      });

      if (codeColIdx === -1 || qtyColIdx === -1) return;

      for (let i = 1; i < sheetData.length; i++) {
        const row = sheetData[i];
        const cellCode = String(row[codeColIdx] || '').trim();
        if (!cellCode) continue;

        const qtyVal = row[qtyColIdx];
        const qtyNum = parseFloat(String(qtyVal).replace(/[^0-9.-]/g, '')) || 0;
        
        let location = '';
        if (locColIdx !== -1 && row[locColIdx]) {
          const val = String(row[locColIdx]).trim();
          if (val && val !== '-' && val.toLowerCase() !== 'null' && val.toLowerCase() !== 'undefined') {
            location = val;
          }
        }
        
        if (qtyNum > 0) {
          items.push({
            code: cellCode,
            name: row[nameColIdx] || '',
            qty: qtyNum,
            category: catName,
            location: location
          });
        }
      }
    }

    if (category === 'xg' || category === 'all') extractItems(xgTon, "Xà Gồ");
    if (category === 'tole' || category === 'all') extractItems(toleTon, "Tole");

    if (items.length === 0) {
      const reply = "Không tìm thấy mặt hàng nào đang tồn kho.";
      addBotMessage(reply);
      speak(reply);
    } else {
      let responseText = `Đã tìm thấy tổng cộng **${items.length}** mặt hàng đang tồn kho:\n`;
      let dataBoxContent = `<table class="va-table"><thead><tr><th>Mã (Loại)</th><th>Vị trí</th><th>Số lượng</th></tr></thead><tbody>`;
      
      items.forEach((item, idx) => {
        const qtyFormatted = item.qty.toLocaleString('vi-VN') + " Kg";
        const locText = item.location ? ` - Vị trí: ${item.location}` : '';
        const locTableText = item.location ? item.location : '-';
        responseText += `- [${item.category}] Mã **${item.code}** - ${item.name}: ${locText ? locText.substring(3) + ' - ' : ''}Tồn ${qtyFormatted}\n`;
        dataBoxContent += `<tr><td>${item.code} (${item.category})</td><td>${locTableText}</td><td>${qtyFormatted}</td></tr>`;
      });
      dataBoxContent += `</tbody></table>`;

      const verbalText = `Đã tìm thấy ${items.length} mặt hàng đang tồn kho. Tôi đã liệt kê danh sách chi tiết ở khung chat.`;
      
      addBotMessage(responseText, dataBoxContent.trim());
      speak(verbalText);
    }

    resetStatus();
  }

  // Handle Date Import Query
  async function handleDateImportQuery(dateStr) {
    addBotMessage(`Đang tra cứu danh sách nhập hàng ngày: ${dateStr}...`);

    // Load both import sheets
    const [xgNhap, toleNhap] = await Promise.all([
      fetchSheetData('xg', 'nhap'),
      fetchSheetData('tole', 'nhap')
    ]);

    let results = [];

    // Parse date parts for comparison
    const targetParts = dateStr.split('/'); // [dd, mm, yyyy]
    
    function parseDateToCompare(cellVal) {
      if (!cellVal) return null;
      
      // If cell is date serial number (Excel)
      if (typeof cellVal === 'number') {
        const d = new Date((cellVal - 25569) * 86400 * 1000);
        return {
          day: d.getDate(),
          month: d.getMonth() + 1,
          year: d.getFullYear()
        };
      }
      
      const valStr = String(cellVal).trim();
      const m = valStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if (m) {
        let y = parseInt(m[3], 10);
        if (y < 100) y += 2000;
        return {
          day: parseInt(m[1], 10),
          month: parseInt(m[2], 10),
          year: y
        };
      }
      
      // ISO format or other
      const dt = new Date(valStr);
      if (!isNaN(dt.getTime())) {
        return {
          day: dt.getDate(),
          month: dt.getMonth() + 1,
          year: dt.getFullYear()
        };
      }

      return null;
    }

    function searchNhapSheet(sheetData, category) {
      if (!sheetData || sheetData.length < 2) return;
      const headers = sheetData[0];
      
      // Find Date and Weight column index
      const dateColIdx = headers.findIndex(h => {
        const norm = normalizeText(h);
        return norm.includes('ngay') || norm.includes('thoi gian');
      });
      const qtyColIdx = headers.findIndex(h => {
        const norm = normalizeText(h);
        return norm.includes('so luong') || norm.includes('kg') || norm.includes('khoi luong');
      });
      const codeColIdx = headers.findIndex(h => {
        const norm = normalizeText(h);
        return norm.includes('ma vat tu') || norm === 'ma';
      });

      if (dateColIdx === -1) return;

      for (let i = 1; i < sheetData.length; i++) {
        const row = sheetData[i];
        const dateObj = parseDateToCompare(row[dateColIdx]);
        
        if (dateObj) {
          const matches = dateObj.day === parseInt(targetParts[0], 10) && 
                          dateObj.month === parseInt(targetParts[1], 10) &&
                          dateObj.year === parseInt(targetParts[2], 10);
          if (matches) {
            results.push({
              code: row[codeColIdx] || 'Không có mã',
              qty: row[qtyColIdx] || 0,
              category: category
            });
          }
        }
      }
    }

    searchNhapSheet(xgNhap, "Xà Gồ");
    searchNhapSheet(toleNhap, "Tole");

    if (results.length === 0) {
      const reply = `Không tìm thấy lượt nhập hàng nào trong ngày ${dateStr}.`;
      addBotMessage(reply);
      speak(reply);
    } else {
      // Calculate total weight
      let totalXG = 0;
      let totalTole = 0;
      let dataBoxContent = "";

      results.forEach((item) => {
        // Parse float weight
        const qtyNum = parseFloat(String(item.qty).replace(/[^0-9.-]/g, '')) || 0;
        if (item.category === "Xà Gồ") totalXG += qtyNum;
        if (item.category === "Tole") totalTole += qtyNum;
        
        dataBoxContent += `+ [${item.category}] Mã ${item.code}: ${qtyNum.toLocaleString('vi-VN')} Kg\n`;
      });

      const totalXGText = totalXG > 0 ? `${totalXG.toLocaleString('vi-VN')} kg xà gồ` : '';
      const totalToleText = totalTole > 0 ? `${totalTole.toLocaleString('vi-VN')} kg tole` : '';
      const andText = (totalXG > 0 && totalTole > 0) ? ' và ' : '';

      const summaryText = `Ngày ${dateStr} đã nhập tổng cộng: ${totalXGText}${andText}${totalToleText}. Chi tiết:\n`;
      const ttsText = `Ngày ${dateStr} nhập tổng cộng ${totalXG > 0 ? (totalXG + ' ký xà gồ') : ''} ${totalTole > 0 ? (' và ' + totalTole + ' ký tole') : ''}.`;
      
      addBotMessage(summaryText, dataBoxContent.trim());
      speak(ttsText);
    }

    resetStatus();
  }

  // Handle General Summary Query
  async function handleGeneralSummaryQuery() {
    addBotMessage("Đang tính toán tổng hợp báo cáo tồn kho hiện tại...");

    const [xgTon, toleTon] = await Promise.all([
      fetchSheetData('xg', 'ton'),
      fetchSheetData('tole', 'ton')
    ]);

    function getSum(sheetData) {
      if (!sheetData || sheetData.length < 2) return { count: 0, sum: 0 };
      const headers = sheetData[0];
      const qtyColIdx = headers.findIndex(h => {
        const norm = normalizeText(h);
        return norm.includes('ton cuoi') || norm.includes('so luong') || norm.includes('kg') || norm.includes('ton');
      });

      if (qtyColIdx === -1) return { count: 0, sum: 0 };

      let sum = 0;
      let count = 0;
      for (let i = 1; i < sheetData.length; i++) {
        const row = sheetData[i];
        const val = row[qtyColIdx];
        if (val !== undefined && val !== null) {
          const num = parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0;
          sum += num;
          count++;
        }
      }
      return { count, sum };
    }

    const xgResult = getSum(xgTon);
    const toleResult = getSum(toleTon);

    const totalSum = xgResult.sum + toleResult.sum;

    const summaryText = `Báo cáo tồn kho tổng hợp:\n` +
      `- Xà gồ: Tồn ${xgResult.count} cuộn/mặt hàng. Tổng khối lượng: ${xgResult.sum.toLocaleString('vi-VN')} Kg.\n` +
      `- Tole: Tồn ${toleResult.count} cuộn/mặt hàng. Tổng khối lượng: ${toleResult.sum.toLocaleString('vi-VN')} Kg.\n` +
      `- Tổng cộng kho đang tồn: ${totalSum.toLocaleString('vi-VN')} Kg.`;
      
    const ttsText = `Hiện tại, xà gồ tồn ${xgResult.sum.toLocaleString('vi-VN')} ký, tole tồn ${toleResult.sum.toLocaleString('vi-VN')} ký. Tổng tồn kho là ${totalSum.toLocaleString('vi-VN')} ký.`;

    addBotMessage(summaryText);
    speak(ttsText);
    resetStatus();
  }

  // Initialize Voice Assistant when document is fully loaded
  function init() {
    // Avoid double injection
    if (document.getElementById('vaMicBtn')) return;
    
    injectUI();
    console.log("DDC Voice Assistant successfully initialized!");
  }

  // Wait for load event
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }

})();
