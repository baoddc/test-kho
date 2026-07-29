# Redesign About Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `pages/about.html` into a modern, interactive Tech Hub & Glassmorphism Dashboard highlighting core modules, Supabase Data Engine, Voice Assistant, PWA, 5S, RBAC security, and performance metrics.

**Architecture:** Modern responsive HTML5/CSS3 layout built with glassmorphism card components, CSS gradients, FontAwesome icons, animated background orbs, and IntersectionObserver scroll animations.

**Tech Stack:** HTML5, CSS3 (Vanilla), Bootstrap 5 (Grid/Utilities only), FontAwesome 6, JavaScript (IntersectionObserver).

## Global Constraints

- Design System: Deep Dark Mode (`#0b0f19`), Cyan (`#00d9ff`), Emerald (`#00ff88`), Glassmorphism panels.
- CSS Isolation: Keep unique class prefixes (`.about-page`, `.glass-card`, `.status-pill`, `.spotlight-card`) to prevent Bootstrap override issues.
- All file links must use `file:///` format.

---

### Task 1: Update Styling System in `assets/css/about.css`

**Files:**
- Modify: [assets/css/about.css](file:///c:/Users/benhhc/Desktop/web-supabase/assets/css/about.css)

**Interfaces:**
- Consumes: Existing Bootstrap 5 grid utilities and FontAwesome 6 icon classes.
- Produces: Enhanced CSS styles for `.status-pill`, `.module-card`, `.spotlight-card`, `.dev-terminal-badge`, and optimized responsive styles.

- [ ] **Step 1: Inspect and prepare CSS rules for Live Status Badges & Cards**

Update [assets/css/about.css](file:///c:/Users/benhhc/Desktop/web-supabase/assets/css/about.css) to add rules for status badges, spotlight cards, and developer terminal badge:

```css
/* Live Status Badges */
.status-pills-wrapper {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-top: 1.5rem;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 18px;
  border-radius: 30px;
  font-size: 0.85rem;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
  color: #e2e8f0;
  transition: all 0.3s ease;
}

.status-pill:hover {
  transform: translateY(-2px);
  border-color: rgba(0, 217, 255, 0.3);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: 0 0 10px currentColor;
}

.status-dot.green { background-color: #00ff88; color: #00ff88; }
.status-dot.blue { background-color: #00d9ff; color: #00d9ff; }
.status-dot.purple { background-color: #a855f7; color: #a855f7; }
.status-dot.yellow { background-color: #ffc107; color: #ffc107; }

/* Spotlight & Module Cards */
.spotlight-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 20px;
  padding: 1.8rem;
  height: 100%;
  transition: all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.spotlight-card:hover {
  transform: translateY(-6px);
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(0, 217, 255, 0.25);
  box-shadow: 0 12px 30px rgba(0, 217, 255, 0.08);
}

.spotlight-icon {
  font-size: 2rem;
  margin-bottom: 1.2rem;
}

/* Dev Terminal Badge */
.dev-terminal-badge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(0, 217, 255, 0.25);
  padding: 12px 28px;
  border-radius: 50px;
  font-family: 'Montserrat', sans-serif;
  font-size: 0.95rem;
  color: #94a3b8;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.dev-terminal-badge strong {
  color: #00d9ff;
}
```

- [ ] **Step 2: Commit CSS updates**

```bash
git add assets/css/about.css
git commit -m "style(about): add glassmorphism dashboard and live status badge styles"
```

---

### Task 2: Redesign HTML Structure in `pages/about.html`

**Files:**
- Modify: [pages/about.html](file:///c:/Users/benhhc/Desktop/web-supabase/pages/about.html)

**Interfaces:**
- Consumes: `assets/css/about.css`, `assets/js/sidebar.js`, `assets/js/home.js`.
- Produces: Redesigned HTML structure for Hero section, 5 Core Modules, 5 Spotlight Cards, Performance Section, and Developer Terminal Badge.

- [ ] **Step 1: Rewrite `pages/about.html` body with updated content & layout**

Replace the main content inside [pages/about.html](file:///c:/Users/benhhc/Desktop/web-supabase/pages/about.html) with:
1. Hero title & Live Status Badges (Supabase, Voice, PWA, RBAC).
2. 5 Core Module Cards (Phôi Cuộn, Xà Gồ, Tole, Phế Liệu, 5S & HSE).
3. Tech Stack Grid (HTML5/CSS3, Vanilla JS, Bootstrap 5, Supabase, Google Sheets).
4. 5 Spotlight Architecture Cards (Supabase Data Engine, Voice Assistant, Event Delegation, CSS Isolation, RBAC Security).
5. Performance & Scalability Grid + Glass Table + Supabase Server Optimization Note.
6. Developer Terminal Signature.

- [ ] **Step 2: Verify HTML syntax & tags**

Ensure all closing tags, FontAwesome class names, Bootstrap grid classes (`col-md-6`, `col-lg-4`, etc.), and script references are accurate.

- [ ] **Step 3: Commit HTML updates**

```bash
git add pages/about.html
git commit -m "feat(about): redesign about.html with interactive tech hub layout"
```

---

### Task 3: Verification & Visual Testing

**Files:**
- Test/Verify: [pages/about.html](file:///c:/Users/benhhc/Desktop/web-supabase/pages/about.html)

- [ ] **Step 1: Check page in local server or browser**

Run local server: `npx serve .` or open `pages/about.html` directly in browser.
Verify:
- Live Status Badges render correctly in Hero section.
- 5 Core Modules and 5 Technical Cards load with glassmorphism hover effects.
- Performance section shows 3 threshold cards, glass metrics table, and Supabase optimization note.
- Developer terminal badge renders cleanly at bottom.
- Scroll animations (`fade-up`) trigger properly on scroll.

- [ ] **Step 2: Final Commit**

```bash
git add .
git commit -m "chore(about): complete about page redesign verification"
```
