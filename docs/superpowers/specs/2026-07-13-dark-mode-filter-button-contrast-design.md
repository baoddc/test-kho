# Design Spec: Dark Mode Filter Button Contrast Enhancement

Specifies the design and implementation changes to increase contrast for active and inactive column filter buttons in dark mode.

## Problem Statement
In dark mode (`html[data-bs-theme="dark"]`), when a filter is applied to a table column, the filter button (`.ddc-filter-btn.active`) uses a medium blue color (`#2563eb`) and a low-opacity background. This blue color has extremely low contrast (1.56:1) against the dark grayish-blue table header background (`#3f4769`), making it very difficult for users to visually identify which columns have filters applied.

## Selected Approach
**Vibrant Cyan Accent (`#00d9ff`)**
- Changes the active state color of the filter button to bright cyan.
- Sets a semi-transparent cyan background and border.
- Changes the inactive state color from a dark slate gray (`#64748b`) to a lighter lavender gray (`#a1a8b9`) for subtle but improved visibility.
- Enhances the hover state to light cyan with a subtle background glow.

## Design Details

### CSS Rules to Add
Add the following styles to [sidebar.css](file:///c:/Users/benhhc/Desktop/web-supabase/assets/css/sidebar.css) inside the dark mode block:

```css
/* Custom styles for table column filter buttons in Dark Mode */
html[data-bs-theme="dark"] .ddc-filter-btn {
  color: #a1a8b9;
}

html[data-bs-theme="dark"] .ddc-filter-btn:hover {
  color: #00d9ff;
  background-color: rgba(0, 217, 255, 0.1) !important;
}

html[data-bs-theme="dark"] .ddc-filter-btn.active {
  color: #00d9ff !important;
  background-color: rgba(0, 217, 255, 0.15) !important;
  border-color: rgba(0, 217, 255, 0.3) !important;
}
```

## Verification Plan

### Automated Verification
- CSS parsing validation (checking that the rules are correctly written and do not break the CSS syntax).

### Manual Verification
1. Open any page with a table (e.g., `xg-xuat.html`, `xg-nhap.html`).
2. Switch to Dark Mode using the theme toggle in the top-right corner.
3. Click a column header filter button and apply a filter.
4. Verify that the filter button turns a bright, high-contrast cyan color.
5. Verify that hover effects on filter buttons show a bright cyan color and glow.
