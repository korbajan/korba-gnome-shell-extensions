# Contract: LayoutProvider Interface

**Feature**: `001-dynamic-window-tiling`
**Date**: 2026-04-14

---

## Purpose

`LayoutProvider` is the extensibility seam between the tiling infrastructure
(`WorkspaceTiler`) and specific layout algorithms. v1 ships one concrete
implementation: `DwindleLayout`. Future layouts (masterstack, grid, spiral, etc.)
MUST implement this contract without modifying any calling code.

---

## Interface Definition

```js
/**
 * Abstract base class for tiling layout algorithms.
 *
 * All methods receive the `workArea` as a Meta.Rectangle-like object
 * { x, y, width, height } representing the usable screen region for this
 * (workspaceIndex, monitorIndex) pair.
 *
 * Implementations MUST:
 *   - Never store a reference to Meta.Window beyond the current call frame
 *     (the caller owns window lifecycle).
 *   - Never call window.move_resize_frame() directly; instead return
 *     a layout result that the caller applies atomically.
 *   - Be pure with respect to GSettings (read settings in constructor, not
 *     in hot paths).
 */
export class LayoutProvider {

    /**
     * Called once when the layout is activated for a workspace.
     * @param {Gio.Settings} settings - Extension settings instance
     * @param {object} workArea - { x, y, width, height }
     */
    init(settings, workArea) {
        throw new Error('LayoutProvider.init() not implemented');
    }

    /**
     * Called when the work area changes (monitor geometry, panel resize).
     * @param {object} workArea - { x, y, width, height }
     */
    updateWorkArea(workArea) {
        throw new Error('LayoutProvider.updateWorkArea() not implemented');
    }

    /**
     * Insert a window into the layout.
     * @param {Meta.Window} window
     * @returns {TileRect[]} Array of { window, x, y, width, height } for all
     *          windows whose geometry must change, including the new window.
     */
    addWindow(window) {
        throw new Error('LayoutProvider.addWindow() not implemented');
    }

    /**
     * Remove a window from the layout (closed, floated, or fullscreened).
     * @param {Meta.Window} window
     * @returns {TileRect[]} Array of { window, x, y, width, height } for all
     *          windows whose geometry must change after the removal.
     */
    removeWindow(window) {
        throw new Error('LayoutProvider.removeWindow() not implemented');
    }

    /**
     * Returns the next window to focus in the given direction from `fromWindow`.
     *
     * v1 implementation: geometry-based centre-point distance in the requested
     * direction (consistent with `spatial-window-navigator._focusDirection`).
     * This method is the designated seam for a future tree-topology-based
     * replacement — callers MUST NOT assume the algorithm.
     *
     * @param {Meta.Window} fromWindow - Currently focused window
     * @param {'left'|'right'|'up'|'down'} direction
     * @returns {Meta.Window | null} Window to focus, or null if none in that direction
     */
    getNeighbour(fromWindow, direction) {
        throw new Error('LayoutProvider.getNeighbour() not implemented');
    }

    /**
     * Move a window to the position of its neighbour in the given direction.
     *
     * Swap semantics: ONLY the window references in the two leaf nodes are
     * exchanged. Rects and splitRatio values remain unchanged — screen regions
     * are stable, windows move between them.
     *
     * v1 neighbour detection: geometry-based (same as getNeighbour). The
     * interface is the seam for future tree-topology-based replacement.
     *
     * @param {Meta.Window} window
     * @param {'left'|'right'|'up'|'down'} direction
     * @returns {TileRect[]} Updated geometry for the two swapped windows only,
     *          or [] if no neighbour found in that direction.
     */
    moveWindow(window, direction) {
        throw new Error('LayoutProvider.moveWindow() not implemented');
    }

    /**
     * Resize the tile of `window` by `delta` fraction along the relevant axis.
     * @param {Meta.Window} window
     * @param {'shrink'|'grow'} direction
     * @param {number} delta - Fraction to adjust (e.g. 0.05 for 5%)
     * @returns {TileRect[]} Updated geometry for affected windows.
     */
    resizeTile(window, direction, delta) {
        throw new Error('LayoutProvider.resizeTile() not implemented');
    }

    /**
     * Recompute and return the full layout for all managed windows.
     * Called when a setting changes (gap size, split ratio) or work area updates.
     * @returns {TileRect[]} Full set of { window, x, y, width, height }
     */
    reflow() {
        throw new Error('LayoutProvider.reflow() not implemented');
    }

    /**
     * Returns true if `window` is currently managed by this layout.
     * @param {Meta.Window} window
     * @returns {boolean}
     */
    hasWindow(window) {
        throw new Error('LayoutProvider.hasWindow() not implemented');
    }

    /**
     * Returns all windows currently managed by this layout, in insertion order.
     * @returns {Meta.Window[]}
     */
    getManagedWindows() {
        throw new Error('LayoutProvider.getManagedWindows() not implemented');
    }

    /**
     * Clean up all internal state. Called when the workspace tiler is destroyed.
     * After destroy(), the instance MUST NOT be used.
     */
    destroy() {
        throw new Error('LayoutProvider.destroy() not implemented');
    }

    /**
     * Human-readable identifier for this layout (used in prefs and logging).
     * @returns {string} e.g. 'dwindle'
     */
    get id() {
        throw new Error('LayoutProvider.id getter not implemented');
    }
}
```

---

## TileRect Type

```js
/**
 * @typedef {object} TileRect
 * @property {Meta.Window} window  - The window to reposition
 * @property {number} x            - New x in screen pixels
 * @property {number} y            - New y in screen pixels
 * @property {number} width        - New width in screen pixels
 * @property {number} height       - New height in screen pixels
 */
```

`TileRect` values account for the configured `gap-size`. The caller applies them via:
```js
tileRect.window.move_resize_frame(false, tileRect.x, tileRect.y,
    tileRect.width, tileRect.height);
```

---

## Layout Registry

A simple registry allows future layout types to be registered and selected per workspace.

```js
/**
 * Registry of available LayoutProvider factories.
 * Key: layout ID string, Value: constructor/factory function
 */
export const LayoutRegistry = new Map();

/**
 * Register a layout factory.
 * @param {string} id - Unique layout ID (e.g. 'dwindle')
 * @param {function} factory - () => LayoutProvider instance
 */
export function registerLayout(id, factory) {
    if (LayoutRegistry.has(id))
        throw new Error(`Layout '${id}' already registered`);
    LayoutRegistry.set(id, factory);
}

/**
 * Create a layout instance by ID.
 * @param {string} id
 * @returns {LayoutProvider}
 */
export function createLayout(id) {
    const factory = LayoutRegistry.get(id);
    if (!factory)
        throw new Error(`Unknown layout '${id}'`);
    return factory();
}
```

**v1 registration** (in `extension.js` `enable()`):
```js
import {registerLayout} from './lib/layoutProvider.js';
import {DwindleLayout}  from './lib/dwindleLayout.js';

registerLayout('dwindle', () => new DwindleLayout());
```

---

## Compliance Requirements

A layout implementation MUST:

1. Return `TileRect[]` from `addWindow`, `removeWindow`, `moveWindow`, `resizeTile`,
   and `reflow` — never apply geometry itself.
2. Include gap adjustments in returned rects (gap is an implementation detail of the
   layout, not the caller).
3. Be idempotent: calling `reflow()` twice in succession returns identical results.
4. Handle the zero-window case: `addWindow` on an empty layout returns one rect
   covering the full work area minus gaps.
5. Handle the one-window case for `moveWindow` and `getNeighbour` by returning
   `[]` / `null` gracefully.
6. Implement `moveWindow` with swap-only semantics: exchange window references in leaf
   nodes only; rects and split ratios MUST remain unchanged after a move.
7. Implement `getNeighbour` and `moveWindow` using geometry-based centre-point
   detection in v1. The algorithm is intentionally encapsulated so it can be replaced
   by a tree-topology-based approach in a future implementation without changing callers.
8. Clean up all state in `destroy()` so GC can collect the instance.
