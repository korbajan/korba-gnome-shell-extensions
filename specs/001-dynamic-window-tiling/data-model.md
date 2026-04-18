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

### DwindleLayout extends LayoutProvider

Manages the binary split-tree for one `(workspaceIndex, monitorIndex)` tiling unit.
Implements the `LayoutProvider` interface (see `contracts/layout-provider.md`).

| Field | Type | Description |
|---|---|---|
| `_root` | `TileNode \| null` | Root of the tree; null when no windows are tiled |
| `_workArea` | `{x, y, width, height}` | Monitor work area (excluding panels) |
| `_leaves` | `Map<Meta.Window, TileLeaf>` | Window → leaf lookup for O(1) access |
| `_lastLeaf` | `TileLeaf \| null` | Most recently inserted leaf (next split target) |
| `_initialAxis` | `'horizontal' \| 'vertical'` | First split direction (from settings) |
| `_gapSize` | `number` | Pixel gap applied between tiles (from settings) |

**Key operations** (all return `TileRect[]` for the caller to apply via `move_resize_frame`):

- `addWindow(window)` — Find `_lastLeaf`, wrap it and the new window in a new
  `SplitContainer` with perpendicular axis, recompute rects, return `TileRect[]`.
- `removeWindow(window)` — Find leaf, promote sibling to replace parent container,
  recompute rects, return `TileRect[]` for remaining windows.
- `getNeighbour(fromWindow, direction)` — Find nearest tile by geometry (centre-point
  distance in requested direction; same algorithm as `spatial-window-navigator`).
  Returns the neighbour `Meta.Window` or `null`. This is the designated seam for a
  future tree-topology-based replacement.
- `moveWindow(window, direction)` — Find neighbour via `getNeighbour`. **Swap only the
  `window` references** in the two `TileLeaf` nodes — rects and `splitRatio` values
  remain unchanged. Returns `TileRect[]` for the two affected windows only.
- `resizeTile(window, direction, delta)` — Adjust `splitRatio` on parent container,
  clamp to `[0.1, 0.9]`, recompute child rects, return `TileRect[]` for affected subtree.
- `reflow()` — Apply outer gap to `_workArea` and recursively recompute all rects;
  return full `TileRect[]`.

> **Note**: Focus operations (`getNeighbour` result → `window.activate(...)`) are performed
> by `TilingManager._focusDirection()`, not by `DwindleLayout` itself.  `DwindleLayout`
> only returns data — it never calls `window.activate()` or `move_resize_frame()` directly.

---

### WorkspaceTiler

Manages tiling for one `(workspaceIndex, monitorIndex)` pair.
Owns a `DwindleLayout` (via the `LayoutProvider` interface) and all lifecycle signal
connections for that context.

| Field | Type | Description |
|---|---|---|
| `workspaceIndex` | `number` | 0-based workspace index |
| `monitorIndex` | `number` | Physical monitor index |
| `layout` | `LayoutProvider` | Active layout strategy (v1: always `DwindleLayout`) |
| `floatingWindows` | `Set<Meta.Window>` | Windows excluded from the tile tree |
| `savedRects` | `Map<Meta.Window, Rect>` | Pre-tiling rects for restore on `disable()` |
| `_signalIds` | `Array<{obj, id}>` | Signal connection objects for cleanup in `disable()` |

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
                      └─► DwindleLayout.insert(window)
                            └─► geometry applied ──► TILED

TILED
  ├─► user toggle-float ──► DwindleLayout.remove(window) ──► FloatingWindows set ──► FLOATING
  ├─► window fullscreen ──► DwindleLayout.remove(window) ──► FULLSCREEN (saved in savedRects)
  └─► window closed     ──► DwindleLayout.remove(window) ──► (gone)

FLOATING ──► user toggle-float ──► DwindleLayout.insert(window) ──► TILED

FULLSCREEN ──► exit fullscreen ──► DwindleLayout.insert(window) ──► TILED

tiling disabled for workspace
  └─► all TILED windows ──► DwindleLayout cleared, savedRects restored ──► FREE
```

### Workspace tiler lifecycle

```
settings toggle ON
  └─► WorkspaceTiler created for (wsIndex, monitorIndex)
        └─► existing windows collected and inserted into DwindleLayout
              └─► layout applied ──► ACTIVE

ACTIVE ──► settings toggle OFF
  └─► all windows restored from savedRects
        └─► WorkspaceTiler.destroy() (signals disconnected) ──► DESTROYED
```
