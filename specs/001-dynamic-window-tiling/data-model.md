# Data Model: Dynamic Window Tiling (Dwindle)

**Feature**: `001-dynamic-window-tiling`
**Date**: 2026-04-14

---

## Runtime Data Structures (in-memory, not persisted)

### TileNode (abstract)

Base type for all nodes in the Dwindle tree. Every node occupies a rectangular region.

| Field | Type | Description |
|---|---|---|
| `rect` | `{x, y, width, height}` | Allocated screen region in pixels |
| `parent` | `SplitContainer \| null` | Parent node; null for root |

**Subtypes**: `SplitContainer`, `TileLeaf`

---

### TileLeaf extends TileNode

A leaf node representing a single managed window.

| Field | Type | Description |
|---|---|---|
| `window` | `Meta.Window` | The managed window |
| `rect` | `{x, y, width, height}` | Assigned screen region (applied via `move_resize_frame`) |
| `parent` | `SplitContainer \| null` | Parent container |

**Invariants**:
- `window` is always a `Meta.WindowType.NORMAL` window on the correct workspace+monitor.
- `rect` is always within the work area of the monitor (from `get_work_area_for_monitor`).

---

### SplitContainer extends TileNode

An internal node that divides its `rect` between two children.

| Field | Type | Description |
|---|---|---|
| `direction` | `'horizontal' \| 'vertical'` | Axis along which the split is made |
| `first` | `TileNode` | Child occupying the primary (left/top) region |
| `second` | `TileNode` | Child occupying the secondary (right/bottom) region |
| `splitRatio` | `number` | Fraction of `rect` given to `first` (range: `[0.1, 0.9]`, default `0.5`) |
| `rect` | `{x, y, width, height}` | Combined region; subdivided by `splitRatio` |
| `parent` | `SplitContainer \| null` | Parent container |

**Derived child rects** (recomputed whenever `splitRatio` or `rect` changes):

```
Horizontal split:
  first.rect  = { x, y, width: rect.width * splitRatio,              height: rect.height }
  second.rect = { x: x + first.rect.width, y, width: remaining, height: rect.height }

Vertical split:
  first.rect  = { x, y, width: rect.width, height: rect.height * splitRatio }
  second.rect = { x, y: y + first.rect.height, width: rect.width, height: remaining }
```

**Invariants**:
- `first.rect.width + second.rect.width == rect.width` (horizontal)
- `first.rect.height + second.rect.height == rect.height` (vertical)
- `splitRatio` clamped to `[0.1, 0.9]`

---

### DwindleTree

Manages the binary split-tree for one `(workspaceIndex, monitorIndex)` tiling unit.

| Field | Type | Description |
|---|---|---|
| `root` | `TileNode \| null` | Root of the tree; null when no windows are tiled |
| `workArea` | `{x, y, width, height}` | Monitor work area (excluding panels) |
| `leaves` | `Map<Meta.Window, TileLeaf>` | Window → leaf lookup for O(1) access |
| `lastLeaf` | `TileLeaf \| null` | Most recently inserted leaf (next split target) |
| `initialAxis` | `'horizontal' \| 'vertical'` | First split direction (from settings) |
| `gapSize` | `number` | Pixel gap applied between tiles (from settings) |

**Key operations**:

- `insert(window)` — Find `lastLeaf`, wrap it and the new window in a new
  `SplitContainer`, recompute rects, apply geometry to all affected windows.
- `remove(window)` — Find leaf, replace parent container with sibling, recompute
  rects, apply geometry to remaining windows.
- `moveFocus(direction)` — Find nearest tile by geometry (centre-point distance in
  requested direction; same algorithm as `spatial-window-navigator`), call
  `window.activate(global.get_current_time())`. Reads current focus from
  `global.display.focus_window` — no separate extension-tracked cursor.
- `moveWindow(window, direction)` — Find nearest tile by geometry (same centre-point
  algorithm as `moveFocus`). **Swap only the `window` references** in the two
  `TileLeaf` nodes — rects and `splitRatio` values remain unchanged. Apply geometry
  to both swapped windows. The `LayoutProvider` interface encapsulates this algorithm
  to allow future replacement with a tree-topology-based approach.
- `resize(window, direction, delta)` — Adjust `splitRatio` on parent container,
  recompute rects, apply geometry.
- `computeRect(node)` — Recursive rect calculation from root down.
- `applyLayout()` — Call `window.move_resize_frame` for every leaf.

---

### WorkspaceTiler

Manages tiling for one `(workspaceIndex, monitorIndex)` pair.
Owns a `DwindleTree` and the lifecycle signal connections for that context.

| Field | Type | Description |
|---|---|---|
| `workspaceIndex` | `number` | 0-based workspace index |
| `monitorIndex` | `number` | Physical monitor index |
| `layout` | `LayoutProvider` | Active layout strategy (v1: always `DwindleLayout`) |
| `floatingWindows` | `Set<Meta.Window>` | Windows excluded from the tile tree |
| `savedRects` | `Map<Meta.Window, Rect>` | Pre-tiling rects for restore on disable |
| `signalIds` | `number[]` | Signal connection IDs for cleanup in `destroy()` |

---

### TilingManager

Top-level coordinator. Owns all `WorkspaceTiler` instances and the global signal handlers.
Handles focus operations: reads `global.display.focus_window` as the authoritative
current-focus source and calls `window.activate(global.get_current_time())` to move focus.

| Field | Type | Description |
|---|---|---|
| `_tilers` | `Map<string, WorkspaceTiler>` | Key: `"wsIndex:monitorIndex"` |
| `_settings` | `Gio.Settings` | Extension settings |
| `_signalIds` | `number[]` | Global signal IDs (display, workspace_manager) |

---

## Persisted Data (GSettings)

All settings survive GNOME Shell restarts via GSettings / dconf.

| Key | GVariant type | Default | Notes |
|---|---|---|---|
| `tiling-enabled-workspaces` | `ai` | `[]` | Array of 0-based workspace indices |
| `gap-size` | `u` | `4` | Gap between tiles in pixels |
| `initial-split-axis` | `s` | `"horizontal"` | `"horizontal"` or `"vertical"` |
| `split-ratio` | `d` | `0.5` | Global default; per-node ratios are runtime-only |
| `min-tile-size` | `u` | `100` | Windows smaller than this px dimension auto-float |
| `float-window-classes` | `as` | `[]` | WM class strings (e.g. `"org.gnome.Calculator"`) |
| `debug-logging` | `b` | `false` | Gate for all `console.log`/`console.warn` output; zero overhead when `false` |
| `keybind-focus-left` | `as` | `["<Super>h"]` | |
| `keybind-focus-down` | `as` | `["<Super>j"]` | |
| `keybind-focus-up` | `as` | `["<Super>k"]` | |
| `keybind-focus-right` | `as` | `["<Super>l"]` | |
| `keybind-move-left` | `as` | `["<Super><Shift>h"]` | |
| `keybind-move-down` | `as` | `["<Super><Shift>j"]` | |
| `keybind-move-up` | `as` | `["<Super><Shift>k"]` | |
| `keybind-move-right` | `as` | `["<Super><Shift>l"]` | |
| `keybind-resize-shrink` | `as` | `["<Super><Ctrl>h"]` | Shrinks focused tile |
| `keybind-resize-grow` | `as` | `["<Super><Ctrl>l"]` | Grows focused tile |
| `keybind-toggle-float` | `as` | `["<Super><Shift>space"]` | |

**Note**: Per-node `splitRatio` values are runtime-only in v1. They reset to the global
`split-ratio` default each session. Persisting per-node ratios is a future enhancement.

---

## State Transitions

### Window tiling lifecycle

```
opened
  └─► [shouldTile?]
        ├─ NO  ──► FloatingWindows set (unmanaged)
        └─ YES ──► first-frame signal
                      └─► DwindleTree.insert(window)
                            └─► geometry applied ──► TILED

TILED
  ├─► user toggle-float ──► DwindleTree.remove(window) ──► FloatingWindows set ──► FLOATING
  ├─► window fullscreen ──► DwindleTree.remove(window) ──► FULLSCREEN (saved in savedRects)
  └─► window closed     ──► DwindleTree.remove(window) ──► (gone)

FLOATING ──► user toggle-float ──► DwindleTree.insert(window) ──► TILED

FULLSCREEN ──► exit fullscreen ──► DwindleTree.insert(window) ──► TILED

tiling disabled for workspace
  └─► all TILED windows ──► DwindleTree cleared, savedRects restored ──► FREE
```

### Workspace tiler lifecycle

```
settings toggle ON
  └─► WorkspaceTiler created for (wsIndex, monitorIndex)
        └─► existing windows collected and inserted into DwindleTree
              └─► layout applied ──► ACTIVE

ACTIVE ──► settings toggle OFF
  └─► all windows restored from savedRects
        └─► WorkspaceTiler.destroy() (signals disconnected) ──► DESTROYED
```
