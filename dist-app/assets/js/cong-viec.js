/* =============================================================================
   JAVASCRIPT LOGIC: QUẢN LÝ CÔNG VIỆC & ENGINE NHẮC HẸN (DDC)
   ============================================================================= */

document.addEventListener('DOMContentLoaded', () => {
  const LOCAL_STORAGE_KEY = 'ddc_cong_viec_local';
  let allTasks = [];
  let currentReminderTask = null;
  let audioContext = null;

  // DOM Elements
  const taskTableBody = document.getElementById('taskTableBody');
  const emptyState = document.getElementById('emptyState');
  const searchInput = document.getElementById('searchInput');
  const filterStatus = document.getElementById('filterStatus');
  const filterPriority = document.getElementById('filterPriority');
  const filterUserCreated = document.getElementById('filterUserCreated');

  // KPI DOM Elements
  const statTotal = document.getElementById('statTotal');
  const statToday = document.getElementById('statToday');
  const statOverdue = document.getElementById('statOverdue');
  const statCompleted = document.getElementById('statCompleted');

  // Modal Form Elements
  const taskModal = document.getElementById('taskModal');
  const taskForm = document.getElementById('taskForm');
  const modalTaskTitle = document.getElementById('modalTaskTitle');
  const taskIdInput = document.getElementById('taskIdInput');
  const tieuDeInput = document.getElementById('tieuDeInput');
  const ghiChuInput = document.getElementById('ghiChuInput');
  const ngayHenInput = document.getElementById('ngayHenInput');
  const uuTienSelect = document.getElementById('uuTienSelect');
  const trangThaiSelect = document.getElementById('trangThaiSelect');
  const openCreateModalBtn = document.getElementById('openCreateModalBtn');
  const closeTaskModalBtn = document.getElementById('closeTaskModalBtn');
  const cancelTaskModalBtn = document.getElementById('cancelTaskModalBtn');

  // Reminder Modal Elements
  const reminderModal = document.getElementById('reminderModal');
  const reminderTaskTitle = document.getElementById('reminderTaskTitle');
  const reminderTaskDesc = document.getElementById('reminderTaskDesc');
  const reminderTaskTime = document.getElementById('reminderTaskTime');
  const closeReminderModalBtn = document.getElementById('closeReminderModalBtn');
  const dismissReminderBtn = document.getElementById('dismissReminderBtn');
  const completeReminderBtn = document.getElementById('completeReminderBtn');

  // Initialize currentUser
  const currentUser = (typeof localStorage !== 'undefined' && localStorage.getItem('currentUser')) || 'bao.lt';

  // ===========================================================================
  // 1. DATA PERSISTENCE & FETCHING (SUPABASE + LOCALSTORAGE FALLBACK)
  // ===========================================================================

  async function loadTasks() {
    let supabaseLoaded = false;
    try {
      if (window.supabase) {
        const { data, error } = await window.supabase
          .from('cong_viec')
          .select('*')
          .order('ngay_hen', { ascending: true });

        if (!error && Array.isArray(data)) {
          allTasks = data;
          supabaseLoaded = true;
        } else if (error) {
          console.warn('Supabase cong_viec table fetch error:', error.message);
        }
      }
    } catch (err) {
      console.warn('Supabase fetch failed, falling back to LocalStorage:', err);
    }

    if (!supabaseLoaded) {
      const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
      allTasks = localData ? JSON.parse(localData) : [];
    } else {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(allTasks));
    }

    populateUserFilter();
    renderTasks();
    updateStats();
  }

  function getMockTasks() {
    const now = new Date();
    const future = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    return [
      {
        id: 1,
        tieu_de: 'Kiểm tra tồn kho xưởng tôn cuộn A',
        ghi_chu: 'Đối chiếu số liệu phôi cuộn xuất xưởng với chứng từ giao nhận.',
        ngay_hen: future.toISOString(),
        uu_tien: 'cao',
        trang_thai: 'cho_xu_ly',
        da_nhac_hen: false,
        user_created: 'bao.lt'
      }
    ];
  }

  // Helper to get logged-in user dynamically
  function getActiveUser() {
    return (typeof localStorage !== 'undefined' && localStorage.getItem('currentUser')) || 'bao.lt';
  }

  function isAdminUser() {
    return getActiveUser() === 'bao.lt';
  }

  function getVisibleTasks() {
    const activeUser = getActiveUser();
    if (isAdminUser()) {
      const selectedUser = filterUserCreated ? filterUserCreated.value : 'tat_ca';
      if (selectedUser && selectedUser !== 'tat_ca') {
        return allTasks.filter(t => (t.user_created || 'bao.lt') === selectedUser);
      }
      return allTasks;
    }
    return allTasks.filter(t => (t.user_created || 'bao.lt') === activeUser);
  }

  function populateUserFilter() {
    if (!filterUserCreated) return;
    if (isAdminUser()) {
      filterUserCreated.style.display = 'inline-block';
      const currentSelected = filterUserCreated.value || 'tat_ca';
      const creators = Array.from(new Set(allTasks.map(t => t.user_created || 'bao.lt'))).sort();

      let html = '<option value="tat_ca">Tất cả người tạo</option>';
      creators.forEach(user => {
        html += `<option value="${escapeHtml(user)}"${user === currentSelected ? ' selected' : ''}>👤 ${escapeHtml(user)}</option>`;
      });
      filterUserCreated.innerHTML = html;
    } else {
      filterUserCreated.style.display = 'none';
    }
  }

  function canManageTask(task) {
    if (!task) return false;
    if (isAdminUser()) return true;
    return (task.user_created || 'bao.lt') === getActiveUser();
  }

  async function saveTaskToStorage(task) {
    if (!task.user_created) {
      task.user_created = getActiveUser();
    }

    if (window.supabase) {
      try {
        if (task.id) {
          const { error } = await window.supabase
            .from('cong_viec')
            .update({
              tieu_de: task.tieu_de,
              ghi_chu: task.ghi_chu,
              ngay_hen: task.ngay_hen,
              uu_tien: task.uu_tien,
              trang_thai: task.trang_thai,
              da_nhac_hen: task.da_nhac_hen,
              user_created: task.user_created
            })
            .eq('id', task.id);

          if (error) console.error('Supabase update error:', error);
        } else {
          // Omit 'id' when inserting so PostgreSQL Identity auto-generates PK
          const insertPayload = {
            tieu_de: task.tieu_de,
            ghi_chu: task.ghi_chu,
            ngay_hen: task.ngay_hen,
            uu_tien: task.uu_tien,
            trang_thai: task.trang_thai,
            da_nhac_hen: task.da_nhac_hen || false,
            user_created: task.user_created
          };

          const { data, error } = await window.supabase
            .from('cong_viec')
            .insert([insertPayload])
            .select();

          if (error) {
            console.error('Supabase insert error:', error);
          } else if (data && data.length > 0) {
            task.id = data[0].id;
          }
        }
      } catch (err) {
        console.warn('Supabase save failed, fallback to local:', err);
      }
    }

    // Always update LocalStorage
    if (!task.id) task.id = Date.now();
    const idx = allTasks.findIndex(t => t.id === task.id);
    if (idx >= 0) {
      allTasks[idx] = task;
    } else {
      allTasks.push(task);
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(allTasks));
    return task;
  }

  async function deleteTaskFromStorage(id) {
    if (window.supabase) {
      try {
        await window.supabase.from('cong_viec').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase delete failed:', err);
      }
    }
    allTasks = allTasks.filter(t => t.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(allTasks));
  }

  // ===========================================================================
  // 2. HELPER FUNCTIONS & FORMATTING
  // ===========================================================================

  function formatDateTime(isoString) {
    if (!isoString) return '--/--/---- --:--';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  function getPriorityBadge(priority) {
    switch (priority) {
      case 'cao':
        return '<span class="badge-prio badge-prio-cao"><i class="ri-fire-fill"></i> Cao</span>';
      case 'thap':
        return '<span class="badge-prio badge-prio-thap"><i class="ri-leaf-fill"></i> Thấp</span>';
      default:
        return '<span class="badge-prio badge-prio-trung_binh"><i class="ri-flashlight-fill"></i> Trung bình</span>';
    }
  }

  function getStatusBadge(status, isOverdue) {
    if (status === 'hoan_thanh') {
      return '<span class="badge-stt badge-stt-hoan_thanh"><i class="ri-check-double-line"></i> Hoàn thành</span>';
    }
    if (isOverdue) {
      return '<span class="badge-stt badge-stt-qua_han"><i class="ri-time-line"></i> Quá hạn</span>';
    }
    if (status === 'dang_lam') {
      return '<span class="badge-stt badge-stt-dang_lam"><i class="ri-loader-4-line"></i> Đang làm</span>';
    }
    return '<span class="badge-stt badge-stt-cho_xu_ly"><i class="ri-time-line"></i> Chờ xử lý</span>';
  }

  // ===========================================================================
  // 3. UI RENDERING & FILTERING
  // ===========================================================================

  function renderTasks() {
    const searchVal = (searchInput.value || '').toLowerCase().trim();
    const statusVal = filterStatus.value;
    const priorityVal = filterPriority.value;
    const now = new Date();
    const visibleTasks = getVisibleTasks();

    const filtered = visibleTasks.filter(task => {
      const isOverdue = new Date(task.ngay_hen) < now && task.trang_thai !== 'hoan_thanh';

      // Search match
      const titleMatch = (task.tieu_de || '').toLowerCase().includes(searchVal);
      const descMatch = (task.ghi_chu || '').toLowerCase().includes(searchVal);
      if (!titleMatch && !descMatch) return false;

      // Status match
      if (statusVal === 'cho_xu_ly' && task.trang_thai !== 'cho_xu_ly') return false;
      if (statusVal === 'dang_lam' && task.trang_thai !== 'dang_lam') return false;
      if (statusVal === 'hoan_thanh' && task.trang_thai !== 'hoan_thanh') return false;
      if (statusVal === 'qua_han' && !isOverdue) return false;

      // Priority match
      if (priorityVal !== 'tat_ca' && task.uu_tien !== priorityVal) return false;

      return true;
    });

    if (filtered.length === 0) {
      taskTableBody.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    taskTableBody.innerHTML = filtered.map((task, index) => {
      const isOverdue = new Date(task.ngay_hen) < now && task.trang_thai !== 'hoan_thanh';
      const trClass = isOverdue ? 'tr-overdue' : '';

      return `
        <tr class="${trClass}">
          <td style="font-weight: 600; color: #94a3b8;">${index + 1}</td>
          <td>
            <div style="font-weight: 600; color: #fff; font-size: 0.95rem;">${escapeHtml(task.tieu_de)}</div>
            ${task.ghi_chu ? `<div style="font-size: 0.85rem; color: #94a3b8; margin-top: 0.2rem;">${escapeHtml(task.ghi_chu)}</div>` : ''}
          </td>
          <td style="font-size: 0.9rem; color: #cbd5e1;">
            <i class="ri-calendar-event-line" style="color: #38bdf8; margin-right: 4px;"></i>${formatDateTime(task.ngay_hen)}
          </td>
          <td>${getPriorityBadge(task.uu_tien)}</td>
          <td>${getStatusBadge(task.trang_thai, isOverdue)}</td>
          <td style="color: #94a3b8; font-size: 0.85rem;">${escapeHtml(task.user_created || 'N/A')}</td>
          <td>
            <div class="cv-actions">
              ${task.trang_thai !== 'hoan_thanh' ? `
                <button class="cv-btn-icon btn-done" title="Đánh dấu hoàn thành" onclick="handleMarkComplete(${task.id})">
                  <i class="ri-check-line"></i>
                </button>
              ` : `
                <button class="cv-btn-icon" title="Mở lại công việc" onclick="handleReopenTask(${task.id})">
                  <i class="ri-restart-line"></i>
                </button>
              `}
              <button class="cv-btn-icon" title="Chỉnh sửa" onclick="handleEditTask(${task.id})">
                <i class="ri-pencil-line"></i>
              </button>
              <button class="cv-btn-icon btn-delete" title="Xóa" onclick="handleDeleteTask(${task.id})">
                <i class="ri-delete-bin-line"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function updateStats() {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const visibleTasks = getVisibleTasks();

    let total = visibleTasks.length;
    let today = 0;
    let overdue = 0;
    let completed = 0;

    visibleTasks.forEach(task => {
      if (task.trang_thai === 'hoan_thanh') {
        completed++;
      } else {
        const taskDateStr = new Date(task.ngay_hen).toISOString().slice(0, 10);
        if (taskDateStr === todayStr) today++;
        if (new Date(task.ngay_hen) < now) overdue++;
      }
    });

    statTotal.textContent = total;
    statToday.textContent = today;
    statOverdue.textContent = overdue;
    statCompleted.textContent = completed;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[m]));
  }

  // ===========================================================================
  // 4. WEB AUDIO CHIME & REAL-TIME REMINDER ENGINE
  // ===========================================================================

  function playReminderSound() {
    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      // Play double-beep chime
      const playTone = (freq, duration, delay) => {
        setTimeout(() => {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, audioContext.currentTime);
          gain.gain.setValueAtTime(0.3, audioContext.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
          osc.connect(gain);
          gain.connect(audioContext.destination);
          osc.start();
          osc.stop(audioContext.currentTime + duration);
        }, delay);
      };

      playTone(880, 0.25, 0);    // A5 tone
      playTone(1046.5, 0.4, 250); // C6 tone
    } catch (e) {
      console.warn('Audio playback not allowed or failed:', e);
    }
  }

  async function checkReminders() {
    const now = new Date();
    const visibleTasks = getVisibleTasks();
    const dueTask = visibleTasks.find(t => 
      t.trang_thai !== 'hoan_thanh' && 
      !t.da_nhac_hen && 
      new Date(t.ngay_hen) <= now
    );

    if (dueTask) {
      currentReminderTask = dueTask;
      reminderTaskTitle.textContent = dueTask.tieu_de;
      reminderTaskDesc.textContent = dueTask.ghi_chu || '(Không có ghi chú)';
      reminderTaskTime.textContent = `Thời gian hẹn: ${formatDateTime(dueTask.ngay_hen)}`;
      
      reminderModal.classList.add('active');
      playReminderSound();

      // Mark as reminded to avoid repetitive popups
      dueTask.da_nhac_hen = true;
      await saveTaskToStorage(dueTask);
    }
  }

  // Start background reminder interval every 15s
  setInterval(checkReminders, 15000);

  // ===========================================================================
  // 5. EVENT HANDLERS & MODAL MANAGEMENT
  // ===========================================================================

  // Form Modal Handlers
  const openModalHandler = () => {
    modalTaskTitle.textContent = 'Tạo Công Việc Mới';
    taskIdInput.value = '';
    taskForm.reset();
    
    // Set default datetime to now + 30 minutes
    const future = new Date(Date.now() + 30 * 60000);
    const localIso = new Date(future.getTime() - future.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    ngayHenInput.value = localIso;

    taskModal.classList.add('active');
  };

  if (openCreateModalBtn) openCreateModalBtn.addEventListener('click', openModalHandler);
  const emptyStateCreateBtn = document.getElementById('emptyStateCreateBtn');
  if (emptyStateCreateBtn) emptyStateCreateBtn.addEventListener('click', openModalHandler);
  const filterCreateBtn = document.getElementById('filterCreateBtn');
  if (filterCreateBtn) filterCreateBtn.addEventListener('click', openModalHandler);
  const fabCreateBtn = document.getElementById('fabCreateBtn');
  if (fabCreateBtn) fabCreateBtn.addEventListener('click', openModalHandler);

  function closeFormModal() {
    taskModal.classList.remove('active');
  }

  closeTaskModalBtn.addEventListener('click', closeFormModal);
  cancelTaskModalBtn.addEventListener('click', closeFormModal);

  taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = taskIdInput.value ? Number(taskIdInput.value) : null;
    const existingTask = id ? allTasks.find(t => t.id === id) : null;

    const taskObj = {
      id: id,
      tieu_de: tieuDeInput.value.trim(),
      ghi_chu: ghiChuInput.value.trim(),
      ngay_hen: new Date(ngayHenInput.value).toISOString(),
      uu_tien: uuTienSelect.value,
      trang_thai: trangThaiSelect.value,
      da_nhac_hen: false,
      user_created: existingTask ? existingTask.user_created : getActiveUser()
    };

    await saveTaskToStorage(taskObj);
    closeFormModal();
    renderTasks();
    updateStats();
  });

  // Global Action Functions
  window.handleEditTask = (id) => {
    const task = allTasks.find(t => t.id === id);
    if (!task) return;
    if (!canManageTask(task)) {
      alert('Bạn không có quyền chỉnh sửa công việc này!');
      return;
    }

    modalTaskTitle.textContent = 'Chỉnh Sửa Công Việc';
    taskIdInput.value = task.id;
    tieuDeInput.value = task.tieu_de || '';
    ghiChuInput.value = task.ghi_chu || '';
    
    const localIso = new Date(new Date(task.ngay_hen).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    ngayHenInput.value = localIso;
    uuTienSelect.value = task.uu_tien || 'trung_binh';
    trangThaiSelect.value = task.trang_thai || 'cho_xu_ly';

    taskModal.classList.add('active');
  };

  window.handleMarkComplete = async (id) => {
    const task = allTasks.find(t => t.id === id);
    if (!task) return;
    if (!canManageTask(task)) {
      alert('Bạn không có quyền thay đổi trạng thái công việc này!');
      return;
    }
    task.trang_thai = 'hoan_thanh';
    await saveTaskToStorage(task);
    await loadTasks();
  };

  window.handleReopenTask = async (id) => {
    const task = allTasks.find(t => t.id === id);
    if (!task) return;
    if (!canManageTask(task)) {
      alert('Bạn không có quyền mở lại công việc này!');
      return;
    }
    task.trang_thai = 'cho_xu_ly';
    task.da_nhac_hen = false;
    await saveTaskToStorage(task);
    await loadTasks();
  };

  window.handleDeleteTask = async (id) => {
    const task = allTasks.find(t => t.id === id);
    if (!task) return;
    if (!canManageTask(task)) {
      alert('Bạn không có quyền xóa công việc này!');
      return;
    }
    if (confirm('Bạn có chắc chắn muốn xóa công việc này?')) {
      await deleteTaskFromStorage(id);
      await loadTasks();
    }
  };

  // Reminder Modal Event Handlers
  closeReminderModalBtn.addEventListener('click', () => {
    reminderModal.classList.remove('active');
  });

  dismissReminderBtn.addEventListener('click', () => {
    reminderModal.classList.remove('active');
  });

  completeReminderBtn.addEventListener('click', async () => {
    if (currentReminderTask) {
      currentReminderTask.trang_thai = 'hoan_thanh';
      await saveTaskToStorage(currentReminderTask);
      await loadTasks();
    }
    reminderModal.classList.remove('active');
  });

  // Filter Listeners
  searchInput.addEventListener('input', renderTasks);
  filterStatus.addEventListener('change', renderTasks);
  filterPriority.addEventListener('change', renderTasks);
  if (filterUserCreated) filterUserCreated.addEventListener('change', renderTasks);

  // Initial Load
  loadTasks();
});
