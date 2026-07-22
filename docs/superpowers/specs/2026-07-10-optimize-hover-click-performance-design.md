# Design: Optimize Hover & Click Performance for 5S Warehouse Maps

Optimize the interactivity and performance of 5S Warehouse maps (Kho Phôi cuộn & Kho Phế liệu) during hover and click interactions by eliminating full page DOM re-rendering, caching DOM element lookups, and replacing heavy CSS filters (`blur`) with lightweight visual indicators (`opacity`).

## User Review Required

No visual changes to the functional layouts. The hover interaction will feel noticeably faster and responsive (60fps), with smoother transitions. The CSS blur effect on non-hovered components is replaced by clean opacity dimming.

## Open Questions

None.

## Proposed Changes

### 1. 5S Waste Map (Sơ đồ Kho Phế liệu)

#### [MODIFY] [5s-so-do-phe-lieu.js](file:///c:/Users/benhhc/Desktop/web/assets/js/5s/5s-so-do-phe-lieu.js)
* Refactor the `render()` function so that it only runs when:
  * Initializing the application.
  * Fetching or refreshing CSV data.
* During initial rendering, output the static layout structures, including the map grid, status lists, and a fixed container for the Hover Details Card (`#hover-details-container`).
* Write an efficient `updateUIForHoverState(id)` function that is invoked on `mouseenter` / `mouseleave` / `click` events instead of calling `render()`.
* `updateUIForHoverState(id)` will:
  * Cache or directly select `.map-area` elements and toggle their styles (`border`, `z-index`, `transform`, `filter`).
  * Select `.status-item` elements and update their active class designations directly.
  * Update the `innerHTML` and visible classes of `#hover-details-container` rather than reconstructing the entire dashboard layout.
  * Eliminate the invocation of `lucide.createIcons()` and event listener re-binding during hover updates.

#### [MODIFY] [5s-so-do-phe-lieu.css](file:///c:/Users/benhhc/Desktop/web/assets/css/5s/5s-so-do-phe-lieu.css)
* Add explicit hover card animation and class rules to facilitate direct style updates.
* Clean up brightness or grayscale filters if needed, to utilize hardware-accelerated transitions.

---

### 2. 5S Coil Map (Sơ đồ Kho Phôi cuộn)

#### [MODIFY] [5s-so-do-phoi-cuon.js](file:///c:/Users/benhhc/Desktop/web/assets/js/5s/5s-so-do-phoi-cuon.js)
* Implement a DOM caching object `domElements` containing references to `#main-title`, `#center-aisle`, `#bottom-area`, `#grating-area`, and each shelf element (`#shelf-${id}`).
* Populate the `domElements` cache during initial rendering inside `renderMainApp()`.
* Refactor `setHoverState(id)` to:
  * Retrieve elements directly from the `domElements` cache instead of querying them continuously on pointer moves.
  * Replace `style.filter = 'blur(...)'` modifications with clean opacity adjustments (`style.opacity`).

#### [MODIFY] [5s-so-do-phoi-cuon.css](file:///c:/Users/benhhc/Desktop/web/assets/css/5s/5s-so-do-phoi-cuon.css)
* Modify `.shelf-container.dimmed` and `.grating-container.dimmed` rule sets:
  * Remove `filter: blur(2px);`.
  * Ensure smooth `transition: opacity 0.25s ease, transform 0.25s ease` to keep rendering hardware-accelerated.

---

## Verification Plan

### Manual Verification
* Access **Sơ đồ kho Phôi cuộn** page:
  * Hover over multiple shelves sequentially. Verify the transition is instantaneous without cursor lag.
  * Ensure adjacent elements dim smoothly via opacity and no visual stuttering occurs.
* Access **Sơ đồ kho Phế liệu** page:
  * Hover over and click areas/status items.
  * Check that the details card updates instantly.
  * Open browser developer tools and verify the console has no loop warning messages, and the CPU usage remains low during active hover.
