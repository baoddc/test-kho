// --- Constants ---
const COLORS = [
    '#ff0040', '#ff00ff', '#00ffff', '#00ff00', '#ffff00', '#ff8000',
    '#ff0080', '#8000ff', '#ffffff', '#ff4d4d', '#4dff4d', '#4d4dff'
];

const PARTICLE_COUNT = 350;
const GRAVITY = 0.03;
const FRICTION = 0.96;

// --- State ---
const fireworks = [];
const particles = [];
let canvas;
let ctx;
let animId = null;
let isAnimating = false;

// --- Functions ---

function createFirework(x, y) {
    const parent = canvas.parentElement;
    const startX = x ?? Math.random() * canvas.width;
    const startY = canvas.height;
    const targetY = y ?? Math.random() * (canvas.height * 0.5);
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];

    fireworks.push({
        x: startX,
        y: startY,
        targetY,
        vx: (Math.random() - 0.5) * 2,
        vy: -Math.random() * 5 - 10,
        color,
        trail: [],
        exploded: false
    });
}

function explode(x, y, color) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 0.5;
        particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            alpha: 1,
            color,
            size: Math.random() * 0.8 + 0.2,
            decay: Math.random() * 0.008 + 0.004,
            gravity: GRAVITY,
            friction: FRICTION
        });
    }
}

function startAnimation() {
    if (!isAnimating && ctx && canvas && canvas.offsetParent !== null && !document.hidden) {
        isAnimating = true;
        animate();
    }
}

function stopAnimation() {
    isAnimating = false;
    if (animId) {
        cancelAnimationFrame(animId);
        animId = null;
    }
}

function animate() {
    if (!ctx || !canvas || canvas.offsetParent === null || document.hidden) {
        stopAnimation();
        return;
    }

    // Clear with transparency trail effect
    // We use destination-out to fade previous frames without needing a solid fill color
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';

    // Update and draw fireworks
    for (let i = fireworks.length - 1; i >= 0; i--) {
        const fw = fireworks[i];
        fw.x += fw.vx;
        fw.y += fw.vy;
        fw.vy += 0.1;

        fw.trail.push({ x: fw.x, y: fw.y });
        if (fw.trail.length > 10) fw.trail.shift();

        ctx.beginPath();
        ctx.strokeStyle = fw.color;
        ctx.lineWidth = 2;
        if (fw.trail.length > 0) {
            ctx.moveTo(fw.trail[0].x, fw.trail[0].y);
            for (let j = 1; j < fw.trail.length; j++) {
                ctx.lineTo(fw.trail[j].x, fw.trail[j].y);
            }
        }
        ctx.stroke();

        if (fw.vy >= 0 || fw.y <= fw.targetY) {
            explode(fw.x, fw.y, fw.color);
            fireworks.splice(i, 1);
        }
    }

    // Update and draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.vx *= p.friction;
        p.vy *= p.friction;
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
            particles.splice(i, 1);
            continue;
        }

        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        if (Math.random() > 0.9) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
        }
    }
    ctx.globalAlpha = 1;

    if (Math.random() < 0.05) {
        createFirework();
    }

    animId = requestAnimationFrame(animate);
}

function init() {
    canvas = document.getElementById('fireworksCanvas');
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;
    ctx = context;

    const handleResize = () => {
        const parent = canvas.parentElement;
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    // Only add click listener if the element is interactive
    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        createFirework(e.clientX - rect.left, e.clientY - rect.top);
    });

    // Use IntersectionObserver to automatically pause when canvas container is hidden (tab-home inactive)
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !document.hidden) {
                    startAnimation();
                } else {
                    stopAnimation();
                }
            });
        }, { threshold: 0.01 });
        observer.observe(canvas);
    } else {
        startAnimation();
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopAnimation();
        } else if (canvas && canvas.offsetParent !== null) {
            startAnimation();
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
