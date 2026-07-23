# Design Spec: Apply Flower Interface to Home Page & Organize Flower Assets

## Overview
This design details moving the standalone `flower.html`, `flower.css`, and `flower.js` files into appropriate project asset and page directories, and replacing the existing fireworks theme on `pages/home.html` with the interactive Purple Flowers Smartwatch and Ambient Petal UI.

## File Organization & Relocations
1. **`flower.css`** ➔ `assets/css/flower.css`
2. **`flower.js`** ➔ `assets/js/flower.js`
3. **`flower.html`** ➔ `pages/flower.html` (Standalone copy updated with asset paths)

## Home Page (`pages/home.html`) Changes
- **Head & Fonts**:
  - Add Google Fonts preconnect and link for `Playfair Display`, `Outfit`, and `Cinzel`.
  - Include `/assets/css/flower.css` alongside `/assets/css/sidebar.css` and `/assets/css/home.css`.
- **Body & Component Layout**:
  - Remove `<canvas id="fireworksCanvas"></canvas>` and fireworks script references.
  - Insert ambient background (`<div class="ambient-bg">` with `<canvas id="petalCanvas">`).
  - Insert customizable control panel drawer (`<aside class="control-panel" id="controlPanel">`).
  - Insert watch stage (`<main class="watch-stage">`) with watch case, crown button, bezel, glass screen, dynamic SVG wreath, centered minimalist clock, day/date, and theme caption.
  - Insert interactive modals (`#worldClockModal`, `#alarmModal`, `#msgModal`, `#healthModal`).
- **Scripts**:
  - Load `/assets/js/sidebar.js` (for sidebar/topbar injection).
  - Load `/assets/js/home.js`.
  - Load `/assets/js/flower.js` (replaces `/assets/js/fireworks.js`).

## CSS & Z-Index Compatibility
- Ensure `.ambient-bg` (`z-index: 0`) and `.app-layout` integrate with `sidebar.css` topbar/sidebar components (`z-index: 1000+`).
- Control panel and modal overlays are configured with high z-indices (`z-index: 2000+`) so interactable menus operate over page content.

## Verification
- Verify file movements to `assets/css/`, `assets/js/`, and `pages/`.
- Validate `pages/home.html` and `pages/flower.html` load assets cleanly without 404 errors.
- Confirm interactive elements (theme switching, font selection, particle canvas, clock updates, modals) function properly.
