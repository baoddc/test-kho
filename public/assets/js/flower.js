/* ==========================================================================
   AURA WATCH OS - PURPLE FLOWERS INTERACTIVE SCRIPT
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  
  // ------------------------------------------------------------------------
  // 1. STATE & CONFIGURATION
  // ------------------------------------------------------------------------
  const state = {
    selectedCity: 'New York',
    timezone: 'America/New_York',
    activeTheme: 'purple',
    soundEnabled: false,
    particlesEnabled: true,
    audioCtx: null,
    stepCount: 65,
    heartRate: 80
  };

  // Theme Caption Map
  const themeCaptions = {
    purple: 'P U R P L E &nbsp;&nbsp; F L O W E R S',
    rose: 'R O S E &nbsp;&nbsp; Q U A R T Z',
    emerald: 'E M E R A L D &nbsp;&nbsp; B O T A N I C A L S',
    gold: 'G O L D E N &nbsp;&nbsp; S U N F L O W E R S',
    cyber: 'C Y B E R &nbsp;&nbsp; N E O N'
  };

  // DOM Elements
  const mainTimeDisplay = document.getElementById('mainTimeDisplay');
  const ampmDisplay = document.getElementById('ampmDisplay');
  const secondsDisplay = document.getElementById('secondsDisplay');
  const dayName = document.getElementById('dayName');
  const dayNum = document.getElementById('dayNum');
  const worldTime = document.getElementById('worldTime');
  const worldCity = document.getElementById('worldCity');
  const captionTitle = document.getElementById('captionTitle');
  const watchCrown = document.getElementById('watchCrown');
  const watchWrapper = document.getElementById('watchWrapper');
  const controlPanel = document.getElementById('controlPanel');
  const wreathRenderGroup = document.getElementById('wreathRenderGroup');

  // ------------------------------------------------------------------------
  // 2. LIVE CLOCK ENGINE
  // ------------------------------------------------------------------------
  function updateClock() {
    const now = new Date();

    // 1. Main Time (Hours:Minutes)
    let hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; // convert 0 to 12
    const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
    const formattedSeconds = seconds < 10 ? '0' + seconds : seconds;

    mainTimeDisplay.textContent = `${hours}:${formattedMinutes}`;
    ampmDisplay.textContent = ampm;
    secondsDisplay.textContent = formattedSeconds;

    // 2. Day & Date
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    dayName.textContent = days[now.getDay()];
    dayNum.textContent = now.getDate();

    // 3. World Time (Target Timezone)
    if (worldTime) {
      try {
        const cityTimeString = now.toLocaleTimeString('en-US', {
          timeZone: state.timezone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
        worldTime.textContent = cityTimeString;
      } catch (e) {
        worldTime.textContent = `${hours}:${formattedMinutes} ${ampm}`;
      }
    }

    // Play tick sound if enabled
    if (state.soundEnabled && seconds % 1 === 0) {
      playTickSound();
    }
  }

  setInterval(updateClock, 1000);
  updateClock();

  // Dynamic Heart Rate Simulation
  setInterval(() => {
    state.heartRate = Math.floor(78 + Math.random() * 5);
    document.getElementById('heartVal').textContent = state.heartRate;
  }, 4000);

  // Dynamic Steps Counter Increments
  setInterval(() => {
    state.stepCount += Math.floor(Math.random() * 2);
    document.getElementById('stepsVal').textContent = state.stepCount;
    document.getElementById('modalStepsVal').textContent = `${(6500 + state.stepCount).toLocaleString()} / 10,000`;
  }, 12000);

  // ------------------------------------------------------------------------
  // 3. SVG FLORAL WREATH GENERATOR (WITH GRADUAL BLOOMING ANIMATION)
  // ------------------------------------------------------------------------
  function generateFloralWreath(isRebloom = false) {
    wreathRenderGroup.innerHTML = '';
    const cx = 250, cy = 250, radius = 212;
    const totalFlowers = 24;

    for (let i = 0; i < totalFlowers; i++) {
      const angle = (i / totalFlowers) * Math.PI * 2;
      // Add slight organic offset
      const rOffset = radius + (Math.sin(i * 3) * 6);
      const fx = cx + Math.cos(angle) * rOffset;
      const fy = cy + Math.sin(angle) * rOffset;

      const scale = 0.6 + (Math.sin(i * 2.5) * 0.4 + 0.4);
      const rot = (angle * 180 / Math.PI) + 90;
      const randDelay = (Math.random() * 5.2).toFixed(2);

      // Group for each flower element with bloom animation variables & random delay
      const flowerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      flowerGroup.setAttribute('class', 'flower-group-item');
      flowerGroup.setAttribute('style', `
        --fx: ${fx.toFixed(1)}px;
        --fy: ${fy.toFixed(1)}px;
        --rot: ${rot.toFixed(1)}deg;
        --scale: ${scale.toFixed(2)};
        --flower-idx: ${i};
        --rand-delay: ${randDelay}s;
      `);

      // Draw 5 Petals with individual gradual unfurling animation
      const petalCount = 5;
      for (let p = 0; p < petalCount; p++) {
        const pAngleDeg = p * 72;
        const petal = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        
        // Leaf/Petal organic teardrop path
        const d = `M 0 0 C -8 -16, -12 -28, 0 -36 C 12 -28, 8 -16, 0 0 Z`;
        petal.setAttribute('d', d);
        petal.setAttribute('class', `petal-anim-item ${p % 2 === 0 ? 'flower-petal-bright' : 'flower-petal'}`);
        petal.setAttribute('style', `
          --p-rot: ${pAngleDeg}deg;
          --petal-idx: ${p};
        `);
        flowerGroup.appendChild(petal);
      }

      // Flower Center Core Dot
      const centerDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      centerDot.setAttribute('cx', '0');
      centerDot.setAttribute('cy', '0');
      centerDot.setAttribute('r', '4');
      centerDot.setAttribute('class', 'flower-center');
      flowerGroup.appendChild(centerDot);

      // Stamen accents
      for (let s = 0; s < 6; s++) {
        const sAngle = (s / 6) * Math.PI * 2;
        const sx = Math.cos(sAngle) * 7;
        const sy = Math.sin(sAngle) * 7;
        const stamen = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        stamen.setAttribute('cx', sx);
        stamen.setAttribute('cy', sy);
        stamen.setAttribute('r', '1.2');
        stamen.setAttribute('fill', 'var(--flower-bright)');
        stamen.setAttribute('opacity', '0.8');
        flowerGroup.appendChild(stamen);
      }

      wreathRenderGroup.appendChild(flowerGroup);
    }

    // Add Decorative Leaf Bunches with random bloom delay
    for (let l = 0; l < 18; l++) {
      const lAngle = (l / 18) * Math.PI * 2 + 0.15;
      const lx = cx + Math.cos(lAngle) * (radius - 8);
      const ly = cy + Math.sin(lAngle) * (radius - 8);
      const lRot = (lAngle * 180 / Math.PI) + 45;
      const randLeafDelay = (Math.random() * 5.2).toFixed(2);

      const leafGroup = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      leafGroup.setAttribute('d', 'M 0 0 C -6 -10, -8 -18, 0 -22 C 8 -18, 6 -10, 0 0 Z');
      leafGroup.setAttribute('class', 'leaf-shape leaf-group-item');
      leafGroup.setAttribute('style', `
        --lx: ${lx.toFixed(1)}px;
        --ly: ${ly.toFixed(1)}px;
        --lrot: ${lRot.toFixed(1)}deg;
        --leaf-idx: ${l};
        --rand-delay: ${randLeafDelay}s;
      `);
      wreathRenderGroup.appendChild(leafGroup);
    }
  }

  generateFloralWreath();

  // ------------------------------------------------------------------------
  // 4. FLOATING PETAL CANVAS ANIMATION
  // ------------------------------------------------------------------------
  const canvas = document.getElementById('petalCanvas');
  const ctx = canvas.getContext('2d');
  let petals = [];

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  class FloatingPetal {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = Math.random() * canvas.width;
      this.y = -20;
      this.size = 5 + Math.random() * 8;
      this.speedY = 0.5 + Math.random() * 1.2;
      this.speedX = -0.5 + Math.random() * 1;
      this.rotation = Math.random() * Math.PI * 2;
      this.rotSpeed = 0.01 + Math.random() * 0.03;
      this.opacity = 0.2 + Math.random() * 0.5;
    }

    update() {
      this.y += this.speedY;
      this.x += Math.sin(this.y * 0.01) + this.speedX;
      this.rotation += this.rotSpeed;

      if (this.y > canvas.height + 20) {
        this.reset();
      }
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.globalAlpha = this.opacity;

      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--flower-main').trim() || '#b8a5fc';
      ctx.beginPath();
      ctx.ellipse(0, 0, this.size, this.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  for (let i = 0; i < 28; i++) {
    petals.push(new FloatingPetal());
  }

  function animatePetals() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (state.particlesEnabled) {
      petals.forEach(petal => {
        petal.update();
        petal.draw();
      });
    }
    requestAnimationFrame(animatePetals);
  }
  animatePetals();

  // ------------------------------------------------------------------------
  // 5. INTERACTIVE HARDWARE CROWN & THEME SWITCHER
  // ------------------------------------------------------------------------
  const themes = ['purple', 'rose', 'emerald', 'gold', 'cyber'];
  let currentThemeIndex = 0;

  function applyTheme(themeName) {
    state.activeTheme = themeName;
    document.documentElement.setAttribute('data-active-theme', themeName);
    
    if (captionTitle) {
      captionTitle.innerHTML = themeCaptions[themeName] || themeCaptions['purple'];
    }

    // Update active chip state in control panel
    document.querySelectorAll('.theme-chip').forEach(chip => {
      chip.classList.toggle('active', chip.getAttribute('data-theme') === themeName);
    });

    // Subtle crown feedback animation
    watchCrown.style.transform = 'translateY(-50%) rotate(45deg)';
    setTimeout(() => {
      watchCrown.style.transform = 'translateY(-50%) rotate(0deg)';
    }, 200);

    generateFloralWreath();
  }

  // Click Crown to cycle through themes!
  watchCrown.addEventListener('click', () => {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    applyTheme(themes[currentThemeIndex]);
  });

  // Click Theme Chips in Panel
  document.querySelectorAll('.theme-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const theme = chip.getAttribute('data-theme');
      currentThemeIndex = themes.indexOf(theme);
      applyTheme(theme);
    });
  });

  // ------------------------------------------------------------------------
  // 6. UI CONTROLS & SIDE PANEL TOGGLES
  // ------------------------------------------------------------------------
  const toggleControlBtn = document.getElementById('toggleControlBtn');
  const closePanelBtn = document.getElementById('closePanelBtn');
  const rebloomBtn = document.getElementById('rebloomBtn');

  if (rebloomBtn) {
    rebloomBtn.addEventListener('click', () => {
      generateFloralWreath(true);
    });
  }

  toggleControlBtn.addEventListener('click', () => controlPanel.classList.toggle('active'));
  closePanelBtn.addEventListener('click', () => controlPanel.classList.remove('active'));

  // Font Switcher
  document.getElementById('fontSelect').addEventListener('change', (e) => {
    mainTimeDisplay.className = `main-time-val ${e.target.value}`;
  });

  // Grid Divider Toggle
  document.getElementById('gridToggle').addEventListener('change', (e) => {
    document.getElementById('gridOverlay').style.opacity = e.target.checked ? '1' : '0';
  });

  // Petal Toggle
  document.getElementById('petalToggle').addEventListener('change', (e) => {
    state.particlesEnabled = e.target.checked;
  });

  // Glass Glare Toggle
  document.getElementById('glareToggle').addEventListener('change', (e) => {
    document.getElementById('glassGlare').style.opacity = e.target.checked ? '1' : '0';
  });

  // AOD Mode Toggle
  const toggleAodBtn = document.getElementById('toggleAodBtn');
  toggleAodBtn.addEventListener('click', () => {
    document.body.classList.toggle('aod-active');
  });

  // ------------------------------------------------------------------------
  // 7. WEB AUDIO API SYNTHESIZER FOR TICKING SOUND
  // ------------------------------------------------------------------------
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundLabel = document.getElementById('soundLabel');

  soundToggleBtn.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    soundLabel.textContent = state.soundEnabled ? 'Bật' : 'Tắt';
    soundToggleBtn.style.borderColor = state.soundEnabled ? 'var(--flower-accent)' : 'var(--glass-border)';

    if (state.soundEnabled && !state.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      state.audioCtx = new AudioContext();
    }
  });

  function playTickSound() {
    if (!state.audioCtx) return;
    try {
      const osc = state.audioCtx.createOscillator();
      const gain = state.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, state.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.015, state.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, state.audioCtx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(state.audioCtx.destination);
      osc.start();
      osc.stop(state.audioCtx.currentTime + 0.05);
    } catch (e) {
      // Audio playback safety catch
    }
  }

  // ------------------------------------------------------------------------
  // 8. INTERACTIVE MODALS FOR WIDGETS
  // ------------------------------------------------------------------------
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  }

  function closeModal(modal) {
    modal.classList.remove('active');
  }

  // Modal Triggers
  const bindModalTrigger = (id, modalTarget) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => openModal(modalTarget));
  };

  bindModalTrigger('worldClockWidget', 'worldClockModal');
  bindModalTrigger('alarmWidget', 'alarmModal');
  bindModalTrigger('msgWidgetBtn', 'msgModal');
  bindModalTrigger('stepsWidget', 'healthModal');
  bindModalTrigger('heartWidget', 'healthModal');
  bindModalTrigger('profileWidgetBtn', 'msgModal');

  // Close buttons and overlay backdrop click
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      closeModal(e.target.closest('.modal-overlay'));
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay);
    });
  });

  // World Clock City Selection
  document.querySelectorAll('#cityList li').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('#cityList li').forEach(l => l.classList.remove('active'));
      item.classList.add('active');

      state.selectedCity = item.getAttribute('data-city');
      state.timezone = item.getAttribute('data-tz');
      worldCity.textContent = state.selectedCity;
      updateClock();

      closeModal(document.getElementById('worldClockModal'));
    });
  });

  // 3D Parallax Tilt Effect on Mouse Move
  document.addEventListener('mousemove', (e) => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const dx = (e.clientX - cx) / cx;
    const dy = (e.clientY - cy) / cy;

    watchWrapper.style.transform = `rotateY(${dx * 8}deg) rotateX(${-dy * 8}deg)`;
  });

});
