# Design: Premium Browser-Like Tab Dragging (Pointer Events & FLIP Animation)

Implement a high-fidelity, smooth browser-like tab dragging experience using pointer events and FLIP (First, Last, Invert, Play) transition animations.

## User Review Required

No breaking changes. The Home tab remains fixed, while dynamic tabs can be dragged and swapped smoothly with visual animations.

## Open Questions

None.

## Proposed Changes

### Topbar & Tabs Component

#### [MODIFY] [sidebar.js](file:///c:/Users/benhhc/Desktop/web/assets/js/sidebar.js)
- Remove the HTML5 native drag-and-drop implementation.
- Implement pointer-based dragging (`pointerdown`, `pointermove`, `pointerup` / `pointercancel`) on `.tab-item` elements (excluding the fixed Home tab).
- During pointer drag, update the dragged tab's position in real-time using CSS transforms (`translateX`).
- Detect collisions with neighboring tabs: when the dragged tab passes the midpoint of a neighbor, swap their positions in the DOM.
- Apply a FLIP animation to the swapped neighbor tab so it transitions smoothly to its new position.
- Adjust the pointer offset dynamically when a DOM swap occurs so the dragged tab remains stuck to the cursor.
- On pointer release, animate the dragged tab smoothly back into its static position, clear transient inline styles, and update the internal `tabs` state array.

#### [MODIFY] [sidebar.css](file:///c:/Users/benhhc/Desktop/web/assets/css/sidebar.css)
- Update styling for dragging states to support pointer-based drag.
- Ensure pointer events are handled correctly (e.g., `user-select: none` during drag to prevent text selection).
- Apply appropriate transitional classes for tab items during drag rearrangement.

## Verification Plan

### Manual Verification
- Open multiple tabs.
- Drag a tab left or right.
- Verify the tab tracks the cursor smoothly without any native browser "ghost image".
- Verify that neighboring tabs slide out of the way with a smooth horizontal animation when the dragged tab crosses them.
- Release the tab and verify it snaps smoothly into place.
