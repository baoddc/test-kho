# Flower Home Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move flower asset files into standard asset directories (`assets/css/`, `assets/js/`, `pages/`) and update `pages/home.html` to display the interactive Flower Smartwatch & Petal interface instead of fireworks.

**Architecture:** Relocate `flower.css`, `flower.js`, and `flower.html` from the workspace root into standard project asset paths. Replace fireworks canvas and fireworks script in `pages/home.html` with the full Flower DOM structure, CSS, and JS, integrating seamlessly with `sidebar.js`.

**Tech Stack:** HTML5, Vanilla CSS3 (Custom properties/variables, SVG animations, CSS Grid/Flexbox), Vanilla JS (ES6 Canvas API, Web Audio API, SVG manipulation).

## Global Constraints
- Keep standard project structure (`pages/`, `assets/css/`, `assets/js/`).
- Preserve sidebar auto-injection functionality from `sidebar.js`.
- No broken links or 404 asset requests.

---

### Task 1: Organize Flower Files into Appropriate Folders

**Files:**
- Create: `assets/css/flower.css` (move from `flower.css`)
- Create: `assets/js/flower.js` (move from `flower.js`)
- Create: `pages/flower.html` (move from `flower.html`)
- Remove: `flower.css`, `flower.js`, `flower.html` from root

**Interfaces:**
- Consumes: Existing root flower files.
- Produces: `assets/css/flower.css`, `assets/js/flower.js`, `pages/flower.html` with absolute asset pathing (`/assets/css/flower.css`, `/assets/js/flower.js`).

- [ ] **Step 1: Move flower.css to assets/css/flower.css and flower.js to assets/js/flower.js**

Move files into target asset folders.

- [ ] **Step 2: Move flower.html to pages/flower.html and update asset paths**

Update `<link rel="stylesheet" href="style.css">` to `<link rel="stylesheet" href="/assets/css/flower.css">` and `<script src="script.js"></script>` to `<script src="/assets/js/flower.js"></script>`.

- [ ] **Step 3: Verify path updates in pages/flower.html**

Ensure no references to root `style.css` or `script.js` remain in `pages/flower.html`.

- [ ] **Step 4: Commit asset reorganization**

```bash
git add assets/css/flower.css assets/js/flower.js pages/flower.html
git rm flower.css flower.js flower.html
git commit -m "refactor: relocate flower files into assets and pages directories"
```

---

### Task 2: Apply Flower Interface to `pages/home.html`

**Files:**
- Modify: `pages/home.html`

**Interfaces:**
- Consumes: `/assets/css/flower.css`, `/assets/js/flower.js`, `/assets/js/sidebar.js`.
- Produces: Updated `pages/home.html` displaying the Flower Smartwatch UI, particle canvas, control drawer, and interactive modals.

- [ ] **Step 1: Update `<head>` in `pages/home.html`**

Add Google Fonts (`Playfair Display`, `Outfit`, `Cinzel`) and `/assets/css/flower.css`:

```html
<!-- Google Fonts for stylish serif time and clean interface -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Outfit:wght@300;400;500;600;700&family=Cinzel:wght@400;600;700&display=swap" rel="stylesheet">

<link rel="stylesheet" href="/assets/css/sidebar.css">
<link rel="stylesheet" href="/assets/css/home.css">
<link rel="stylesheet" href="/assets/css/flower.css">
```

- [ ] **Step 2: Replace fireworks section with Flower DOM elements in `pages/home.html`**

Replace `<section class="hero" id="home">...<canvas id="fireworksCanvas"></canvas></section>` with:
1. Ambient particle canvas container (`<div class="ambient-bg">...<canvas id="petalCanvas"></canvas></div>`)
2. Floating control panel drawer (`<aside class="control-panel" id="controlPanel">...`)
3. Watch stage (`<main class="watch-stage">...`)
4. Modals (`#worldClockModal`, `#alarmModal`, `#msgModal`, `#healthModal`)

- [ ] **Step 3: Update `<script>` tags at the bottom of `pages/home.html`**

Remove `/assets/js/fireworks.js` and include `/assets/js/flower.js`:

```html
<script src="/assets/js/sidebar.js"></script>
<script src="/assets/js/home.js"></script>
<script src="/assets/js/flower.js"></script>
```

- [ ] **Step 4: Commit changes to pages/home.html**

```bash
git add pages/home.html
git commit -m "feat: replace fireworks with flower smartwatch interface on home page"
```

---

### Task 3: Z-Index & Layout Integration Adjustments

**Files:**
- Modify: `assets/css/flower.css`

**Interfaces:**
- Consumes: `sidebar.css` header/sidebar layout.
- Produces: Resolved z-index stacking context ensuring sidebar and topbar stay accessible above ambient background while control drawer and modals display on top.

- [ ] **Step 1: Verify and adjust z-index in `assets/css/flower.css`**

Ensure `.ambient-bg` has `z-index: 0` (behind sidebar), `.app-layout` has `z-index: 1`, `.control-panel` has `z-index: 2000`, and `.modal-overlay` has `z-index: 2100`.

- [ ] **Step 2: Commit CSS layer adjustments**

```bash
git add assets/css/flower.css
git commit -m "style: adjust flower z-indices for clean sidebar and modal overlay rendering"
```

---

### Task 4: Verification and Smoke Testing

**Files:**
- Test: `pages/home.html` and `pages/flower.html`

- [ ] **Step 1: Check for missing file references**

Ensure all referenced scripts, stylesheets, fonts, and icons resolve without 404s.

- [ ] **Step 2: Test interactive features**

Verify theme chip clicks (Purple, Rose, Emerald, Gold, Cyber), canvas particle toggle, clock ticking sound toggle, and modal popups work properly on `pages/home.html`.
