# Dark Mode Filter Button Contrast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the contrast and visibility of table column filter buttons (`.ddc-filter-btn`) in dark mode, both in their active and inactive states.

**Architecture:** Append theme-specific CSS rule overrides for `.ddc-filter-btn` and its active state within the Dark Mode block in `assets/css/sidebar.css`.

**Tech Stack:** Vanilla CSS.

## Global Constraints
- Target dark mode theme selector: `html[data-bs-theme="dark"]`
- Inactive color: `#a1a8b9` (contrast-improved lavender gray)
- Active icon color: `#00d9ff` (vibrant high-contrast cyan)
- Active background color: `rgba(0, 217, 255, 0.15)`
- Active border color: `rgba(0, 217, 255, 0.3)`

---

### Task 1: Add Dark Mode CSS Rules to sidebar.css

**Files:**
- Modify: [sidebar.css](file:///c:/Users/benhhc/Desktop/web-supabase/assets/css/sidebar.css) (line 955-956)

**Interfaces:**
- Produces: Enhanced CSS styles for `.ddc-filter-btn` when `html[data-bs-theme="dark"]` is active.

- [ ] **Step 1: Add CSS overrides in assets/css/sidebar.css**

Insert the following rules immediately after the table header selector (around line 955):

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

- [ ] **Step 2: Commit changes**

Run:
```bash
git add assets/css/sidebar.css
git commit -m "style: enhance table column filter button contrast in dark mode"
```
