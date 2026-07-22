# Thay đổi con trỏ chuột khi di chuyển vào nút đóng tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay đổi trỏ chuột về lại dạng mặc định (mũi tên) khi di chuột vào nút "x" đóng tab.

**Architecture:** Bổ sung thuộc tính `cursor: default;` vào class `.tab-item-close` trong file [sidebar.css](file:///c:/Users/benhhc/Desktop/web/assets/css/sidebar.css) để ghi đè thuộc tính `cursor: grab;` kế thừa từ lớp cha `.tab-item`.

**Tech Stack:** Vanilla CSS.

## Global Constraints

- CSS styling should match the existing dark/light theme properties where applicable.

---

### Task 1: Cấu hình CSS cho .tab-item-close

**Files:**
- Modify: `assets/css/sidebar.css:574-585`

**Interfaces:**
- Produces: CSS class `.tab-item-close` with `cursor: default;`

- [ ] **Step 1: Cập nhật CSS cho `.tab-item-close`**

Cập nhật file [sidebar.css](file:///c:/Users/benhhc/Desktop/web/assets/css/sidebar.css) tại class `.tab-item-close`:
```css
.tab-item-close {
  font-size: 9px;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all var(--transition);
  opacity: 0.5;
  cursor: default;
}
```

- [ ] **Step 2: Commit thay đổi**

```bash
git add assets/css/sidebar.css
git commit -m "style: change cursor to default for tab close button"
```
