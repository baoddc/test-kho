# Vertical Sidebar Navigation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the site header navigation to a vertical sidebar layout on all pages, improving UI/UX aesthetics while maintaining absolute feature parity.

**Architecture:** A dynamically injected HTML sidebar driven by `home.js` on DOM load, with styles supplied by a new `/assets/css/sidebar.css` loaded dynamically at the end of `<head>`. This ensures visual alignment on all pages (including table views and interactive maps) without manual markup restructuring of every page.

**Tech Stack:** Plain HTML5, Vanilla CSS, Vanilla JavaScript, Lucide Icons, Bootstrap 5.3.

## Global Constraints
- Do not alter existing logic inside table data renders or authentication checks.
- Keep all navigation link destinations identical to their original values.
- Ensure the layout degrades gracefully to a slide-out drawer navigation on mobile viewports (<= 992px).

---

### Task 1: Create Sidebar Stylesheet

**Files:**
- Create: [sidebar.css](file:///c:/Users/benhhc/Desktop/web/assets/css/sidebar.css)

**Interfaces:**
- Produces: CSS rules for styling `.sidebar-nav`, `.sidebar-header`, `.sidebar-menu`, `.submenu`, `.sidebar-footer`, and override rules for `.main-content` and `body.fixed-viewport` on desktop.

- [ ] **Step 1: Write sidebar.css code**
  Write complete styling for the vertical sidebar. Create rules for accordion menus, hover transitions, mobile drawers, and content width offsets.

- [ ] **Step 2: Save sidebar.css**
  Save the file to `assets/css/sidebar.css`.

---

### Task 2: Implement Dynamic Sidebar Injection and JavaScript Logic

**Files:**
- Modify: [home.js](file:///c:/Users/benhhc/Desktop/web/assets/js/home.js)

**Interfaces:**
- Consumes: [sidebar.css](file:///c:/Users/benhhc/Desktop/web/assets/css/sidebar.css)
- Produces: Dynamic sidebar injection on DOM load, accordion toggles, mobile drawer triggers, and automatic stylesheet/icon library loading.

- [ ] **Step 1: Write sidebar html injection code**
  Modify `home.js` to define a function `injectSidebar()` that constructs the vertical sidebar HTML and replaces the existing `<header>` or prepends it to the body.
  
- [ ] **Step 2: Add dynamic stylesheet and Lucide icon loader**
  Ensure that `/assets/css/sidebar.css` and the Lucide icon library CDN are loaded dynamically in the page head.

- [ ] **Step 3: Implement accordion toggles**
  Add click listeners to `.menu-toggle` and `.subtoggle` elements to toggle `.active` classes on parent menu containers.

- [ ] **Step 4: Update mobile hamburger drawer controls**
  Bind mobile triggers to open/close the sidebar drawer using class toggles on the sidebar element.

---

### Task 3: Integrate 5S Pages with Sidebar Portal

**Files:**
- Modify: [5s-so-do-phoi-cuon.html](file:///c:/Users/benhhc/Desktop/web/pages/5s/5s-so-do-phoi-cuon.html)
- Modify: [5s-so-do-phe-lieu.html](file:///c:/Users/benhhc/Desktop/web/pages/5s/5s-so-do-phe-lieu.html)

**Interfaces:**
- Consumes: [home.js](file:///c:/Users/benhhc/Desktop/web/assets/js/home.js), [home.css](file:///c:/Users/benhhc/Desktop/web/assets/css/home.css)

- [ ] **Step 1: Modify 5s-so-do-phoi-cuon.html**
  Add links to `home.css` and `home.js` inside the HTML code.
  
- [ ] **Step 2: Modify 5s-so-do-phe-lieu.html**
  Add links to `home.css` and `home.js` inside the HTML code.

---

### Task 4: Verification Plan

**Files:**
- Modify: None (Test verification task)

- [ ] **Step 1: Start local HTTP Server**
  Propose running `python -m http.server 8000` or `npx http-server` to serve the static repository.
  
- [ ] **Step 2: Launch browser subagent**
  Open the pages in the browser to visually confirm that the sidebar looks premium, the accordions expand correctly, the main content margins are appropriate, and mobile drawer transitions work.
