// SPDX-FileCopyrightText: 2026 korbajan
//
// SPDX-License-Identifier: GPL-2.0-or-later

/**
 * @typedef {Object} TileRect
 * @property {import('gi://Meta').Window} window
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 */

/**
 * Abstract base class for tiling layout algorithms.
 *
 * A LayoutProvider manages all windows on one (workspace, monitor) pair and
 * returns TileRect arrays that the WorkspaceTiler applies via
 * window.move_resize_frame().
 */
export class LayoutProvider {
    /**
     * Unique identifier for this layout (e.g. 'dwindle').
     * @type {string}
     */
    get id() {
        throw new Error('not implemented');
    }

    /**
     * Initialise the layout with settings and the usable work area.
     * Called once after construction before any addWindow() calls.
     *
     * @param {import('gi://Gio').Settings} settings
     * @param {import('gi://Meta').Rectangle} workArea
     */
    init(_settings, _workArea) {
        throw new Error('not implemented');
    }

    /**
     * Update the usable work area and reflow all managed windows.
     *
     * @param {import('gi://Meta').Rectangle} workArea
     * @returns {TileRect[]}
     */
    updateWorkArea(_workArea) {
        throw new Error('not implemented');
    }

    /**
     * Insert a window into the layout and return new tile rects for all
     * affected windows.
     *
     * @param {import('gi://Meta').Window} window
     * @returns {TileRect[]}
     */
    addWindow(_window) {
        throw new Error('not implemented');
    }

    /**
     * Remove a window from the layout, reflow, and return new tile rects for
     * all remaining windows.
     *
     * @param {import('gi://Meta').Window} window
     * @returns {TileRect[]}
     */
    removeWindow(_window) {
        throw new Error('not implemented');
    }

    /**
     * Find the best neighbour of `fromWindow` in `direction`.
     *
     * v1 implementation: geometry-based centre-point distance algorithm
     * (same as spatial-window-navigator._focusDirection). This method is the
     * designated seam for a future tree-topology-based replacement.
     *
     * @param {import('gi://Meta').Window} fromWindow
     * @param {'left'|'right'|'up'|'down'} direction
     * @returns {import('gi://Meta').Window|null}
     */
    getNeighbour(_fromWindow, _direction) {
        throw new Error('not implemented');
    }

    /**
     * Swap `window` with its neighbour in `direction`.
     *
     * Swap semantics: ONLY the window references in the two leaf nodes are
     * exchanged. Rects and splitRatio values remain unchanged.
     *
     * @param {import('gi://Meta').Window} window
     * @param {'left'|'right'|'up'|'down'} direction
     * @returns {TileRect[]} rects for the two affected windows only
     */
    moveWindow(_window, _direction) {
        throw new Error('not implemented');
    }

    /**
     * Adjust the split ratio at the focused tile's parent boundary.
     *
     * @param {import('gi://Meta').Window} window
     * @param {'shrink'|'grow'} direction
     * @param {number} delta  fraction to adjust (e.g. 0.05)
     * @returns {TileRect[]}
     */
    resizeTile(_window, _direction, _delta) {
        throw new Error('not implemented');
    }

    /**
     * Recompute all tile rects without adding or removing windows.
     *
     * @returns {TileRect[]}
     */
    reflow() {
        throw new Error('not implemented');
    }

    /**
     * @param {import('gi://Meta').Window} window
     * @returns {boolean}
     */
    hasWindow(_window) {
        throw new Error('not implemented');
    }

    /**
     * @returns {import('gi://Meta').Window[]}
     */
    getManagedWindows() {
        throw new Error('not implemented');
    }

    /**
     * Tear down: release all references. Called from WorkspaceTiler.disable().
     */
    destroy() {
        throw new Error('not implemented');
    }
}

/** @type {Map<string, () => LayoutProvider>} */
export const LayoutRegistry = new Map();

/**
 * Register a layout factory.
 * @param {string} id
 * @param {() => LayoutProvider} factory
 */
export function registerLayout(id, factory) {
    LayoutRegistry.set(id, factory);
}

/**
 * Create a layout instance by id.
 * @param {string} id
 * @returns {LayoutProvider}
 */
export function createLayout(id) {
    const factory = LayoutRegistry.get(id);
    if (!factory)
        throw new Error(`Unknown layout id: ${id}`);
    return factory();
}
