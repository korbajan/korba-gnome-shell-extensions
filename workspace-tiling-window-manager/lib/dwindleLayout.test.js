// SPDX-FileCopyrightText: 2026 korbajan
//
// SPDX-License-Identifier: GPL-2.0-or-later
//
// Unit tests for DwindleLayout — pure JS, no GNOME Shell runtime required.
// Run with: npm test  (from workspace-tiling-window-manager/)

import { DwindleLayout } from './dwindleLayout.js';

// ── Test helpers ──────────────────────────────────────────────────────────────

/**
 * A mutable mock Meta.Window with a rect that can be updated when the
 * caller "applies" the TileRects returned by the layout.
 */
function makeWin(label = 'win', initialRect = { x: 0, y: 0, width: 100, height: 100 }) {
    let rect = { ...initialRect };
    return {
        _label: label,
        get_frame_rect: () => ({ ...rect }),
        _applyRect: r => {
            rect = { x: r.x, y: r.y, width: r.width, height: r.height };
        },
        get_title: () => label,
        get_wm_class: () => '',
    };
}

/** Simulate WorkspaceTiler applying TileRects to mock windows. */
function applyRects(tileRects) {
    for (const r of tileRects) r.window._applyRect(r);
}

function makeSettings({ axis = 'horizontal', gap = 0 } = {}) {
    return {
        get_string: k => (k === 'initial-split-axis' ? axis : ''),
        get_uint: k => (k === 'gap-size' ? gap : 0),
        get_boolean: () => false,
    };
}

const WA = { x: 0, y: 0, width: 1920, height: 1080 };

function newLayout(opts = {}) {
    const layout = new DwindleLayout();
    layout.init(makeSettings(opts), WA);
    return layout;
}

// ── T056: addWindow, removeWindow, reflow, _computeChildRects ────────────────

describe('DwindleLayout — addWindow()', () => {
    it('single window fills entire work area (no gap)', () => {
        const layout = newLayout();
        const w = makeWin('w1');
        const rects = layout.addWindow(w);

        expect(rects.length).toBe(1);
        expect(rects[0]).toEqual({ window: w, x: 0, y: 0, width: 1920, height: 1080 });
    });

    it('two windows split horizontally by default', () => {
        const layout = newLayout();
        const w1 = makeWin('w1');
        const w2 = makeWin('w2');
        applyRects(layout.addWindow(w1));
        const rects = layout.addWindow(w2);
        applyRects(rects);

        expect(rects.length).toBe(2);
        const r1 = rects.find(r => r.window === w1);
        const r2 = rects.find(r => r.window === w2);
        expect(r1).toEqual({ window: w1, x: 0, y: 0, width: 960, height: 1080 });
        expect(r2).toEqual({ window: w2, x: 960, y: 0, width: 960, height: 1080 });
    });

    it('two windows split vertically when axis=vertical', () => {
        const layout = newLayout({ axis: 'vertical' });
        const w1 = makeWin('w1');
        const w2 = makeWin('w2');
        applyRects(layout.addWindow(w1));
        const rects = layout.addWindow(w2);

        const r1 = rects.find(r => r.window === w1);
        const r2 = rects.find(r => r.window === w2);
        expect(r1.height).toBe(540);
        expect(r2.y).toBe(540);
        expect(r2.height).toBe(540);
    });

    it('third window splits the last tile perpendicularly (H→V)', () => {
        const layout = newLayout();
        const [w1, w2, w3] = ['w1', 'w2', 'w3'].map(makeWin);
        applyRects(layout.addWindow(w1));
        applyRects(layout.addWindow(w2));
        const rects = layout.addWindow(w3);
        applyRects(rects);

        // w1 still on left half
        const r1 = rects.find(r => r.window === w1);
        expect(r1.x).toBe(0);
        expect(r1.width).toBe(960);

        // w2 and w3 share the right half vertically
        const r2 = rects.find(r => r.window === w2);
        const r3 = rects.find(r => r.window === w3);
        expect(r2.x).toBe(960);
        expect(r2.height).toBe(540);
        expect(r3.x).toBe(960);
        expect(r3.y).toBe(540);
        expect(r3.height).toBe(540);
    });

    it('fourth window splits last tile perpendicularly (V→H)', () => {
        const layout = newLayout();
        const wins = ['w1', 'w2', 'w3', 'w4'].map(makeWin);
        for (const w of wins.slice(0, 3)) applyRects(layout.addWindow(w));
        const rects = layout.addWindow(wins[3]);
        applyRects(rects);

        // w3 and w4 share the bottom-right quadrant horizontally
        const r3 = rects.find(r => r.window === wins[2]);
        const r4 = rects.find(r => r.window === wins[3]);
        expect(r3.y).toBe(540);
        expect(r4.y).toBe(540);
        expect(r3.x + r3.width).toBeLessThanOrEqual(r4.x + 1); // r3 left of r4
    });

    it('_lastLeaf tracks newly inserted window', () => {
        const layout = newLayout();
        const w1 = makeWin('w1');
        const w2 = makeWin('w2');
        layout.addWindow(w1);
        layout.addWindow(w2);
        expect(layout._lastLeaf.window).toBe(w2);
    });

    it('hasWindow returns true for added windows, false otherwise', () => {
        const layout = newLayout();
        const w = makeWin('w');
        const other = makeWin('other');
        layout.addWindow(w);
        expect(layout.hasWindow(w)).toBe(true);
        expect(layout.hasWindow(other)).toBe(false);
    });

    it('getManagedWindows returns all added windows', () => {
        const layout = newLayout();
        const wins = ['a', 'b', 'c'].map(makeWin);
        for (const w of wins) layout.addWindow(w);
        expect(layout.getManagedWindows()).toEqual(jasmine.arrayContaining(wins));
        expect(layout.getManagedWindows().length).toBe(3);
    });
});

describe('DwindleLayout — removeWindow()', () => {
    it('removing the only window clears the tree', () => {
        const layout = newLayout();
        const w = makeWin('w');
        layout.addWindow(w);
        const rects = layout.removeWindow(w);

        expect(rects).toEqual([]);
        expect(layout._root).toBeNull();
        expect(layout._lastLeaf).toBeNull();
        expect(layout.hasWindow(w)).toBe(false);
    });

    it('removing one of two windows: sibling becomes root', () => {
        const layout = newLayout();
        const w1 = makeWin('w1');
        const w2 = makeWin('w2');
        applyRects(layout.addWindow(w1));
        applyRects(layout.addWindow(w2));

        const rects = layout.removeWindow(w1);
        expect(rects.length).toBe(1);
        expect(rects[0].window).toBe(w2);
        // w2 now fills entire work area
        expect(rects[0]).toEqual({ window: w2, x: 0, y: 0, width: 1920, height: 1080 });
        expect(layout.hasWindow(w1)).toBe(false);
        expect(layout.hasWindow(w2)).toBe(true);
    });

    it('removing non-last leaf from 3-window tree reflows remaining two', () => {
        const layout = newLayout();
        const [w1, w2, w3] = ['w1', 'w2', 'w3'].map(makeWin);
        applyRects(layout.addWindow(w1));
        applyRects(layout.addWindow(w2));
        applyRects(layout.addWindow(w3));

        // Remove w2 — w3 should promote up and share the right half with nothing
        layout.removeWindow(w2);
        const rects = layout.reflow();

        // Two windows remain: w1 on left, w3 on right (sibling of w2's container)
        expect(rects.length).toBe(2);
        expect(layout.hasWindow(w2)).toBe(false);
        expect(layout.getManagedWindows().length).toBe(2);
    });

    it('_lastLeaf updates when last leaf is removed', () => {
        const layout = newLayout();
        const [w1, w2] = ['w1', 'w2'].map(makeWin);
        layout.addWindow(w1);
        layout.addWindow(w2);
        expect(layout._lastLeaf.window).toBe(w2);

        layout.removeWindow(w2);
        expect(layout._lastLeaf.window).toBe(w1);
    });
});

describe('DwindleLayout — reflow() and _computeChildRects()', () => {
    it('zero gap: two tiles fill exact work area with no margin', () => {
        const layout = newLayout({ gap: 0 });
        const [w1, w2] = ['w1', 'w2'].map(makeWin);
        layout.addWindow(w1);
        layout.addWindow(w2);
        const rects = layout.reflow();

        const r1 = rects.find(r => r.window === w1);
        const r2 = rects.find(r => r.window === w2);
        expect(r1.x).toBe(0);
        expect(r1.width + r2.width).toBe(1920);
        expect(r1.height).toBe(1080);
        expect(r2.height).toBe(1080);
    });

    it('non-zero gap: outer boundary gap applied, inner gap between tiles', () => {
        const gap = 4;
        const layout = newLayout({ gap });
        const [w1, w2] = ['w1', 'w2'].map(makeWin);
        layout.addWindow(w1);
        layout.addWindow(w2);
        const rects = layout.reflow();

        const r1 = rects.find(r => r.window === w1);
        const r2 = rects.find(r => r.window === w2);

        // Outer gap: tiles don't start at x=0 or go to x=1920
        expect(r1.x).toBe(gap);
        expect(r2.x + r2.width).toBe(1920 - gap);

        // Heights respect outer gap
        expect(r1.y).toBe(gap);
        expect(r1.height).toBe(1080 - 2 * gap);
    });

    it('reflow returns empty array when no windows', () => {
        const layout = newLayout();
        expect(layout.reflow()).toEqual([]);
    });

    it('updateWorkArea triggers reflow with new dimensions', () => {
        const layout = newLayout();
        const w = makeWin('w');
        layout.addWindow(w);

        const smallArea = { x: 0, y: 0, width: 800, height: 600 };
        const rects = layout.updateWorkArea(smallArea);
        expect(rects[0]).toEqual({ window: w, x: 0, y: 0, width: 800, height: 600 });
    });
});

// ── T057: getNeighbour() and moveWindow() ─────────────────────────────────────

describe('DwindleLayout — getNeighbour()', () => {
    it('finds right neighbour for left window', () => {
        const layout = newLayout();
        const [w1, w2] = ['w1', 'w2'].map(makeWin);
        applyRects(layout.addWindow(w1));
        applyRects(layout.addWindow(w2));
        // w1 is on the left, w2 on the right after applyRects updates mock rects

        expect(layout.getNeighbour(w1, 'right')).toBe(w2);
    });

    it('finds left neighbour for right window', () => {
        const layout = newLayout();
        const [w1, w2] = ['w1', 'w2'].map(makeWin);
        applyRects(layout.addWindow(w1));
        applyRects(layout.addWindow(w2));

        expect(layout.getNeighbour(w2, 'left')).toBe(w1);
    });

    it('returns null when no neighbour in requested direction', () => {
        const layout = newLayout();
        const [w1, w2] = ['w1', 'w2'].map(makeWin);
        applyRects(layout.addWindow(w1));
        applyRects(layout.addWindow(w2));

        // No window to the left of the left window
        expect(layout.getNeighbour(w1, 'left')).toBeNull();
        // No window above (both are same height, full height)
        expect(layout.getNeighbour(w1, 'up')).toBeNull();
    });

    it('returns null when only one window', () => {
        const layout = newLayout();
        const w = makeWin('w');
        layout.addWindow(w);

        expect(layout.getNeighbour(w, 'right')).toBeNull();
        expect(layout.getNeighbour(w, 'down')).toBeNull();
    });

    it('finds vertical neighbour in three-window layout', () => {
        const layout = newLayout();
        const [w1, w2, w3] = ['w1', 'w2', 'w3'].map(makeWin);
        applyRects(layout.addWindow(w1));
        applyRects(layout.addWindow(w2));
        applyRects(layout.addWindow(w3));
        // w2 top-right, w3 bottom-right

        expect(layout.getNeighbour(w2, 'down')).toBe(w3);
        expect(layout.getNeighbour(w3, 'up')).toBe(w2);
    });
});

describe('DwindleLayout — moveWindow()', () => {
    it('swaps only window references, rects stay the same', () => {
        const layout = newLayout();
        const [w1, w2] = ['w1', 'w2'].map(makeWin);
        applyRects(layout.addWindow(w1));
        applyRects(layout.addWindow(w2));

        // Record rects before swap
        const leaf1Before = { ...layout._leaves.get(w1).rect };
        const leaf2Before = { ...layout._leaves.get(w2).rect };

        layout.moveWindow(w1, 'right');

        // Rects are unchanged
        expect(layout._leaves.get(w1).rect).toEqual(leaf2Before); // w1 is now in right leaf
        expect(layout._leaves.get(w2).rect).toEqual(leaf1Before); // w2 is now in left leaf
    });

    it('returns TileRects for both affected windows only', () => {
        const layout = newLayout();
        const [w1, w2] = ['w1', 'w2'].map(makeWin);
        applyRects(layout.addWindow(w1));
        applyRects(layout.addWindow(w2));

        const result = layout.moveWindow(w1, 'right');

        expect(result.length).toBe(2);
        expect(result.some(r => r.window === w1)).toBe(true);
        expect(result.some(r => r.window === w2)).toBe(true);
    });

    it('updates _leaves map so windows are at swapped positions', () => {
        const layout = newLayout();
        const [w1, w2] = ['w1', 'w2'].map(makeWin);
        applyRects(layout.addWindow(w1));
        applyRects(layout.addWindow(w2));

        // Before: w1 is on left (x=0), w2 is on right (x=960)
        expect(layout._leaves.get(w1).rect.x).toBe(0);
        expect(layout._leaves.get(w2).rect.x).toBe(960);

        layout.moveWindow(w1, 'right');

        // After: w1 is on right, w2 is on left
        expect(layout._leaves.get(w1).rect.x).toBe(960);
        expect(layout._leaves.get(w2).rect.x).toBe(0);
    });

    it('returns empty array when no neighbour in that direction', () => {
        const layout = newLayout();
        const [w1, w2] = ['w1', 'w2'].map(makeWin);
        applyRects(layout.addWindow(w1));
        applyRects(layout.addWindow(w2));

        expect(layout.moveWindow(w1, 'left')).toEqual([]);
    });
});

// ── T058: resizeTile() ────────────────────────────────────────────────────────

describe('DwindleLayout — resizeTile()', () => {
    it('grow increases splitRatio by delta for first child', () => {
        const layout = newLayout();
        const [w1, w2] = ['w1', 'w2'].map(makeWin);
        layout.addWindow(w1);
        layout.addWindow(w2);

        layout.resizeTile(w1, 'grow', 0.05);

        expect(layout._leaves.get(w1).parent.splitRatio).toBeCloseTo(0.55);
    });

    it('shrink decreases splitRatio by delta for first child', () => {
        const layout = newLayout();
        const [w1, w2] = ['w1', 'w2'].map(makeWin);
        layout.addWindow(w1);
        layout.addWindow(w2);

        layout.resizeTile(w1, 'shrink', 0.05);

        expect(layout._leaves.get(w1).parent.splitRatio).toBeCloseTo(0.45);
    });

    it('second child: grow increases ratio from second child perspective', () => {
        const layout = newLayout();
        const [w1, w2] = ['w1', 'w2'].map(makeWin);
        layout.addWindow(w1);
        layout.addWindow(w2);

        // w2 is the second child; growing it should decrease splitRatio (less for first)
        layout.resizeTile(w2, 'grow', 0.05);

        expect(layout._leaves.get(w1).parent.splitRatio).toBeCloseTo(0.45);
    });

    it('clamps at 0.9 when growing past maximum', () => {
        const layout = newLayout();
        const [w1, w2] = ['w1', 'w2'].map(makeWin);
        layout.addWindow(w1);
        layout.addWindow(w2);

        for (let i = 0; i < 20; i++) layout.resizeTile(w1, 'grow', 0.05);

        expect(layout._leaves.get(w1).parent.splitRatio).toBe(0.9);
    });

    it('clamps at 0.1 when shrinking past minimum', () => {
        const layout = newLayout();
        const [w1, w2] = ['w1', 'w2'].map(makeWin);
        layout.addWindow(w1);
        layout.addWindow(w2);

        for (let i = 0; i < 20; i++) layout.resizeTile(w1, 'shrink', 0.05);

        expect(layout._leaves.get(w1).parent.splitRatio).toBe(0.1);
    });

    it('returns TileRects only for affected subtree', () => {
        const layout = newLayout();
        const [w1, w2] = ['w1', 'w2'].map(makeWin);
        layout.addWindow(w1);
        layout.addWindow(w2);

        const result = layout.resizeTile(w1, 'grow', 0.05);

        // Two-window tree: both windows are in the affected container
        expect(result.length).toBe(2);
        expect(result.some(r => r.window === w1)).toBe(true);
        expect(result.some(r => r.window === w2)).toBe(true);
    });

    it('returns empty array for root leaf (no parent to resize)', () => {
        const layout = newLayout();
        const w = makeWin('w');
        layout.addWindow(w);

        expect(layout.resizeTile(w, 'grow', 0.05)).toEqual([]);
    });

    it('applies only to immediate parent boundary, not ancestors', () => {
        const layout = newLayout();
        const [w1, w2, w3] = ['w1', 'w2', 'w3'].map(makeWin);
        applyRects(layout.addWindow(w1));
        applyRects(layout.addWindow(w2));
        applyRects(layout.addWindow(w3));
        // Tree: H(w1, V(w2, w3))
        // w3's parent is V-container; w1's parent is H-container

        const w3ParentBefore = layout._leaves.get(w3).parent.splitRatio;
        const topRatioBefore = layout._leaves.get(w1).parent.splitRatio;

        layout.resizeTile(w3, 'grow', 0.05);

        // Only w3's immediate parent (V-container) should change
        expect(layout._leaves.get(w3).parent.splitRatio).not.toBeCloseTo(w3ParentBefore);
        // Top H-container ratio unchanged
        expect(layout._leaves.get(w1).parent.splitRatio).toBeCloseTo(topRatioBefore);
    });
});
