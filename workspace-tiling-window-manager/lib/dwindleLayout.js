// SPDX-FileCopyrightText: 2026 korbajan
//
// SPDX-License-Identifier: GPL-2.0-or-later
//
// NOTE: This file exceeds the 400-line SHOULD threshold (Constitution §II).
// Justification: TileLeaf, SplitContainer, and DwindleLayout are tightly
// coupled — the tree traversal algorithms (reflow, getNeighbour, resizeTile)
// require direct access to node internals and cannot be cleanly separated
// without exposing private state.  Splitting across files would reduce
// clarity without reducing complexity.

import { LayoutProvider } from './layoutProvider.js';

/**
 * A leaf node in the Dwindle binary split-tree.
 * Holds a reference to the managed window and its current tile rect.
 */
export class TileLeaf {
    /**
     * @param {import('gi://Meta').Window} window
     * @param {{x:number,y:number,width:number,height:number}} rect
     * @param {SplitContainer|null} parent
     */
    constructor(window, rect, parent = null) {
        this.window = window;
        this.rect = rect;
        this.parent = parent;
    }
}

/**
 * An internal node in the Dwindle binary split-tree.
 * Splits its rect between two children (first, second) along `direction`.
 */
export class SplitContainer {
    /**
     * @param {'horizontal'|'vertical'} direction
     * @param {TileLeaf|SplitContainer} first
     * @param {TileLeaf|SplitContainer} second
     * @param {number} splitRatio  clamped to [0.1, 0.9]
     * @param {{x:number,y:number,width:number,height:number}} rect
     * @param {SplitContainer|null} parent
     */
    constructor(direction, first, second, splitRatio, rect, parent = null) {
        this.direction = direction;
        this.first = first;
        this.second = second;
        this.splitRatio = Math.max(0.1, Math.min(0.9, splitRatio));
        this.rect = rect;
        this.parent = parent;
    }
}

/**
 * Dwindle (spiral/Fibonacci) layout.
 *
 * The last-inserted leaf is always split for the next window.  Splits
 * alternate the axis perpendicular to the parent direction.
 */
export class DwindleLayout extends LayoutProvider {
    constructor() {
        super();
        /** @type {TileLeaf|SplitContainer|null} */
        this._root = null;
        /** @type {{x:number,y:number,width:number,height:number}|null} */
        this._workArea = null;
        /** @type {Map<import('gi://Meta').Window, TileLeaf>} */
        this._leaves = new Map();
        /** @type {TileLeaf|null} */
        this._lastLeaf = null;
        /** @type {'horizontal'|'vertical'} */
        this._initialAxis = 'horizontal';
        /** @type {number} */
        this._gapSize = 4;
        /** @type {import('gi://Gio').Settings|null} */
        this._settings = null;
    }

    get id() {
        return 'dwindle';
    }

    /**
     * @param {import('gi://Gio').Settings} settings
     * @param {import('gi://Meta').Rectangle} workArea
     */
    init(settings, workArea) {
        this._settings = settings;
        const axis = settings.get_string('initial-split-axis');
        this._initialAxis = axis === 'vertical' ? 'vertical' : 'horizontal';
        this._gapSize = settings.get_uint('gap-size');
        this._workArea = {
            x: workArea.x,
            y: workArea.y,
            width: workArea.width,
            height: workArea.height,
        };
    }

    /**
     * @param {import('gi://Meta').Rectangle} workArea
     * @returns {import('./layoutProvider.js').TileRect[]}
     */
    updateWorkArea(workArea) {
        this._workArea = {
            x: workArea.x,
            y: workArea.y,
            width: workArea.width,
            height: workArea.height,
        };
        // Refresh gap-size in case it changed
        if (this._settings) this._gapSize = this._settings.get_uint('gap-size');
        return this.reflow();
    }

    // ── Tree helpers ──────────────────────────────────────────────────────────

    /**
     * Compute first and second child rects for a SplitContainer, applying gaps.
     * @param {SplitContainer} container
     */
    _computeChildRects(container) {
        const { x, y, width, height } = container.rect;
        const gap = this._gapSize;
        const half = Math.floor(gap / 2);

        if (container.direction === 'horizontal') {
            const firstW = Math.round(width * container.splitRatio);
            container.first.rect = {
                x,
                y,
                width: firstW - half,
                height,
            };
            container.second.rect = {
                x: x + firstW + (gap - half),
                y,
                width: width - firstW - (gap - half),
                height,
            };
        } else {
            const firstH = Math.round(height * container.splitRatio);
            container.first.rect = {
                x,
                y,
                width,
                height: firstH - half,
            };
            container.second.rect = {
                x,
                y: y + firstH + (gap - half),
                width,
                height: height - firstH - (gap - half),
            };
        }
    }

    /**
     * Recursively assign rects top-down and collect TileRects for all leaves.
     * @param {TileLeaf|SplitContainer} node
     * @param {{x:number,y:number,width:number,height:number}} rect
     * @returns {import('./layoutProvider.js').TileRect[]}
     */
    _reflowSubtree(node, rect) {
        node.rect = rect;
        if (node instanceof TileLeaf) {
            return [
                {
                    window: node.window,
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                },
            ];
        }
        // SplitContainer
        this._computeChildRects(node);
        return [
            ...this._reflowSubtree(node.first, node.first.rect),
            ...this._reflowSubtree(node.second, node.second.rect),
        ];
    }

    /**
     * Apply outer gap to work area and reflow all windows.
     * @returns {import('./layoutProvider.js').TileRect[]}
     */
    reflow() {
        if (!this._root || !this._workArea) return [];

        const g = this._gapSize;
        const rootRect = {
            x: this._workArea.x + g,
            y: this._workArea.y + g,
            width: this._workArea.width - 2 * g,
            height: this._workArea.height - 2 * g,
        };

        return this._reflowSubtree(this._root, rootRect);
    }

    // ── LayoutProvider implementation ─────────────────────────────────────────

    /**
     * @param {import('gi://Meta').Window} window
     * @returns {import('./layoutProvider.js').TileRect[]}
     */
    addWindow(window) {
        const placeholderRect = { x: 0, y: 0, width: 0, height: 0 };
        const newLeaf = new TileLeaf(window, placeholderRect);

        if (!this._root) {
            this._root = newLeaf;
            this._leaves.set(window, newLeaf);
            this._lastLeaf = newLeaf;
            return this.reflow();
        }

        // Determine the direction for the new split: perpendicular to parent
        const splitTarget = this._lastLeaf;
        const parentDir = splitTarget.parent ? splitTarget.parent.direction : null;
        const newDir =
            parentDir === 'horizontal'
                ? 'vertical'
                : parentDir === 'vertical'
                  ? 'horizontal'
                  : this._initialAxis;

        // Replace splitTarget in the tree with a new SplitContainer
        const container = new SplitContainer(
            newDir,
            splitTarget,
            newLeaf,
            0.5,
            splitTarget.rect,
            splitTarget.parent,
        );

        splitTarget.parent = container;
        newLeaf.parent = container;

        if (container.parent === null) {
            this._root = container;
        } else {
            const p = container.parent;
            if (p.first === splitTarget) p.first = container;
            else p.second = container;
        }

        this._leaves.set(window, newLeaf);
        this._lastLeaf = newLeaf;
        return this.reflow();
    }

    /**
     * @param {import('gi://Meta').Window} window
     * @returns {import('./layoutProvider.js').TileRect[]}
     */
    removeWindow(window) {
        const leaf = this._leaves.get(window);
        if (!leaf) return this.reflow();

        this._leaves.delete(window);

        if (leaf === this._root) {
            this._root = null;
            this._lastLeaf = null;
            return [];
        }

        // Promote the sibling to replace the parent container
        const parent = leaf.parent;
        const sibling = parent.first === leaf ? parent.second : parent.first;
        sibling.parent = parent.parent;

        if (parent.parent === null) {
            this._root = sibling;
        } else {
            const gp = parent.parent;
            if (gp.first === parent) gp.first = sibling;
            else gp.second = sibling;
        }

        // Update _lastLeaf: pick the last leaf in insertion order still present
        if (this._lastLeaf === leaf) {
            const allLeaves = [...this._leaves.values()];
            this._lastLeaf = allLeaves.length > 0 ? allLeaves[allLeaves.length - 1] : null;
        }

        return this.reflow();
    }

    /**
     * @param {import('gi://Meta').Window} fromWindow
     * @param {'left'|'right'|'up'|'down'} direction
     * @returns {import('gi://Meta').Window|null}
     */
    getNeighbour(fromWindow, direction) {
        const fr = fromWindow.get_frame_rect();
        const fcx = fr.x + fr.width / 2;
        const fcy = fr.y + fr.height / 2;

        let best = null;
        let bestScore = Infinity;

        for (const [win] of this._leaves) {
            if (win === fromWindow) continue;

            const r = win.get_frame_rect();
            const cx = r.x + r.width / 2;
            const cy = r.y + r.height / 2;
            const dx = cx - fcx;
            const dy = cy - fcy;

            const inDir =
                direction === 'left'
                    ? dx < 0
                    : direction === 'right'
                      ? dx > 0
                      : direction === 'up'
                        ? dy < 0
                        : /* down */ dy > 0;

            if (!inDir) continue;

            const primary =
                direction === 'left' || direction === 'right' ? Math.abs(dx) : Math.abs(dy);
            const cross =
                direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);

            const score = primary + cross * 0.3;
            if (score < bestScore) {
                bestScore = score;
                best = win;
            }
        }

        return best;
    }

    /**
     * Swap only the window references in two leaf nodes.
     * Rects and splitRatios are unchanged.
     *
     * @param {import('gi://Meta').Window} window
     * @param {'left'|'right'|'up'|'down'} direction
     * @returns {import('./layoutProvider.js').TileRect[]}
     */
    moveWindow(window, direction) {
        const neighbour = this.getNeighbour(window, direction);
        if (!neighbour) return [];

        const leafA = this._leaves.get(window);
        const leafB = this._leaves.get(neighbour);

        // Swap window references in leaves
        leafA.window = neighbour;
        leafB.window = window;

        // Update map
        this._leaves.set(window, leafB);
        this._leaves.set(neighbour, leafA);

        return [
            {
                window: neighbour,
                x: leafA.rect.x,
                y: leafA.rect.y,
                width: leafA.rect.width,
                height: leafA.rect.height,
            },
            {
                window,
                x: leafB.rect.x,
                y: leafB.rect.y,
                width: leafB.rect.width,
                height: leafB.rect.height,
            },
        ];
    }

    /**
     * @param {import('gi://Meta').Window} window
     * @param {'shrink'|'grow'} direction
     * @param {number} delta
     * @returns {import('./layoutProvider.js').TileRect[]}
     */
    resizeTile(window, direction, delta) {
        const leaf = this._leaves.get(window);
        if (!leaf || !leaf.parent) return [];

        const container = leaf.parent;
        const isFirst = container.first === leaf;

        if (direction === 'grow') container.splitRatio += isFirst ? delta : -delta;
        else container.splitRatio += isFirst ? -delta : delta;

        container.splitRatio = Math.max(0.1, Math.min(0.9, container.splitRatio));

        this._computeChildRects(container);
        return this._reflowSubtree(container.first, container.first.rect).concat(
            this._reflowSubtree(container.second, container.second.rect),
        );
    }

    /** @param {import('gi://Meta').Window} window */
    hasWindow(window) {
        return this._leaves.has(window);
    }

    /** @returns {import('gi://Meta').Window[]} */
    getManagedWindows() {
        return [...this._leaves.keys()];
    }

    destroy() {
        this._root = null;
        this._workArea = null;
        this._leaves.clear();
        this._lastLeaf = null;
        this._settings = null;
    }
}
