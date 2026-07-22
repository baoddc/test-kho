# Design Spec: Vertical Sidebar Navigation Redesign

## Goal
Redesign the horizontal header/navigation bar across all pages of the application into a vertical, modern, premium, and space-efficient sidebar. Ensure that all functionalities are retained and visual quality is elevated.

## Proposed Design Details

### 1. Unified Sidebar Component
A single header structure that will be injected/styled consistently on all pages:
- **Left Docked Sidebar (Desktop)**: A fixed vertical sidebar (`260px` width) styled with a modern dark-navy gradient matching the corporate palette.
- **Accordion Menu (Desktop & Mobile)**: Submenus (such as `5S`, `Xà Gồ`, `Tole`, `Phế liệu`) will use an accordion expand/collapse pattern instead of absolute hover dropdowns, providing a cleaner tree-like hierarchy.
- **Footer Profile & Actions**: User login status and logout button are pinned to the bottom of the sidebar with premium styling.
- **Slide-out Drawer (Mobile)**: On mobile viewports (width <= 992px), the sidebar will stay off-screen and slide in from the left when the hamburger button is clicked.

### 2. Styles and Layout Adaptability
- Create a dedicated stylesheet [sidebar.css](file:///c:/Users/benhhc/Desktop/web/assets/css/sidebar.css) containing all sidebar and layout override rules.
- Automatically load `sidebar.css` and dynamic Lucide icons (if not present) from `home.js`.
- Use a robust CSS override selector to adjust `.main-content` and pages using `.fixed-viewport` to prevent content overlapping:
  - Add `margin-left: 260px` and set width to `calc(100% - 260px)` on desktop.
  - Reset layout parameters dynamically to work with bootstrap rows and responsive tables.
  - Apply special body styles for `5s-so-do-phoi-cuon.html` and `5s-so-do-phe-lieu.html` when loaded, giving them the navigation sidebar on the left and centering the app content in the remaining viewport.

### 3. Files Impacted

#### [NEW] [sidebar.css](file:///c:/Users/benhhc/Desktop/web/assets/css/sidebar.css)
- Contains all sidebar rules: structure, grid, transitions, accordion animations, fonts, and dark mode layout overrides.

#### [MODIFY] [home.js](file:///c:/Users/benhhc/Desktop/web/assets/js/home.js)
- Modify to dynamically load `sidebar.css`.
- Inject the unified sidebar HTML structure on page load to replace the old header (or prepend it if none exists).
- Add JavaScript logic to control accordion expansion (`menu-toggle` click handlers) and mobile sidebar drawer state.
- Automatically ensure that Lucide Icons script is loaded.

#### [MODIFY] [5s-so-do-phoi-cuon.html](file:///c:/Users/benhhc/Desktop/web/pages/5s/5s-so-do-phoi-cuon.html)
- Include `/assets/js/home.js` and `/assets/css/home.css` so that it integrates with the rest of the portal.

#### [MODIFY] [5s-so-do-phe-lieu.html](file:///c:/Users/benhhc/Desktop/web/pages/5s/5s-so-do-phe-lieu.html)
- Include `/assets/js/home.js` and `/assets/css/home.css` so that it integrates with the rest of the portal.

## Spec Self-Review
1. **Placeholder scan**: No placeholders.
2. **Internal consistency**: The styling matches the DOM structure perfectly, and layout shifting is handled for both standard bootstrap views and scroll-locked grid views.
3. **Decomposition**: Simple enough to implement in a single plan.
