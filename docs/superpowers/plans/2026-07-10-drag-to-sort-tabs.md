# Drag-to-Sort Tabs (Browser-Like) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a smooth, browser-like drag-to-sort tab bar using Pointer Events and FLIP animations.

**Architecture:** Replace HTML5 drag-and-drop with custom Pointer Event handlers (`pointerdown`, `pointermove`, `pointerup`) on dynamic `.tab-item`s. Animate neighboring tabs using CSS transforms when they swap DOM positions.

**Tech Stack:** Vanilla JS, CSS.

## Global Constraints

- No external libraries.
- Home tab remains fixed at index 0.
- Dragging does not trigger text selection.

---

### Task 1: Update Drag Styles in CSS

**Files:**
- Modify: `assets/css/sidebar.css`

- [ ] **Step 1: Update tab drag styles in sidebar.css**

Add rules to make pointer dragging look natural, adding transitions and disabling user-select:
```css
.tab-bar {
  position: relative;
  user-select: none;
  -webkit-user-select: none;
}

.tab-item {
  user-select: none;
  -webkit-user-select: none;
  touch-action: none; /* Prevent scrolling while dragging tabs */
}

.tab-item.dragging {
  position: relative;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  opacity: 0.9;
  cursor: grabbing !important;
}

.tab-item.swapping {
  transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
}
```

---

### Task 2: Implement Pointer-Based Drag & FLIP Animation in JS

**Files:**
- Modify: `assets/js/sidebar.js`

- [ ] **Step 1: Write Pointer Event Handlers for Dragging**

In `initTabs()`, replace the HTML5 drag event listeners with pointer-based handlers. We track the mouse movement, translate the active tab element, detect overlaps, perform DOM swaps, and trigger FLIP animations on swapped tabs.

We will write:
1. `pointerdown` listener on `.tab-item` to initialize drag states, rects, and add document-level listeners.
2. `pointermove` listener on document to track absolute movement, update translation of the active tab, and swap with left/right neighbors.
3. `pointerup` listener to animate the active tab back to its static position and cleanup.
4. Clean up inline styles and update the `tabs` state array.

- [ ] **Step 2: Verification**

Test tab dragging to verify it mimics browser tabs perfectly (with slide-aside transitions).
