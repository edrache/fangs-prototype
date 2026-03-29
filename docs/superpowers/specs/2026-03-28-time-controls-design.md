# Time Controls — Design Spec

**Date:** 2026-03-28
**Status:** Approved

## Summary

Add time control to the city simulation: pause, 1×, 2×, 4×, 10× speed. Controllable via UI buttons and keyboard shortcuts. The existing control panel can be collapsed, hiding all sliders — leaving only the time controls visible.

---

## 1. Simulation logic (`main.js`)

A single `timeScale` variable (default `1`) is added to `main.js`. The `tick()` function multiplies `elapsed` by `timeScale` before passing it to `stepSimulation`:

```js
stepSimulation(elapsed * timeScale);
```

- `timeScale = 0` → `stepSimulation(0)` — simulation freezes; `requestAnimationFrame` keeps running so the canvas continues to render normally.
- `timeScale` is updated via the `onSpeedChange(scale)` callback provided by `ui/timeControls.js`.

No other changes to simulation logic.

---

## 2. New module: `ui/timeControls.js`

Exports a single function:

```js
createTimeControls({ mount, onSpeedChange })
```

Same pattern as `createControls`. Renders a row of five buttons:

| Button  | Key | `timeScale` |
|---------|-----|-------------|
| ■ PAUSE | `0` | 0           |
| 1×      | `1` | 1           |
| 2×      | `2` | 2           |
| 4×      | `3` | 4           |
| 10×     | `4` | 10          |

- The active button is visually highlighted.
- Registers a `keydown` listener on `document` for keys `0`–`4`.
- Has no knowledge of the simulation — only calls `onSpeedChange(scale)`.

---

## 3. Panel collapse

A toggle button (`▲`/`▼`) is added inside `#time-controls`. Clicking it toggles a `collapsed` class on `#controls`.

### HTML structure of `#controls` after the change:

```
#controls
├── .controls-left      ← hidden when collapsed
├── .controls-right     ← hidden when collapsed
└── #time-controls      ← always visible
    ├── [toggle btn]
    └── [pause][1×][2×][4×][10×]
```

### CSS rule:

```css
#controls.collapsed .controls-left,
#controls.collapsed .controls-right {
  display: none;
}
```

No JS logic needed for collapse — pure CSS controlled by the class toggle.

---

## Files changed

| File | Change |
|------|--------|
| `main.js` | Add `timeScale`, wire `onSpeedChange`, import `createTimeControls` |
| `ui/timeControls.js` | New module |
| `index.html` | Add `#time-controls` div, collapse CSS |
