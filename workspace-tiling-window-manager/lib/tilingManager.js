// SPDX-FileCopyrightText: 2026 korbajan
//
// SPDX-License-Identifier: GPL-2.0-or-later

import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { createLayout } from './layoutProvider.js';
import { WorkspaceTiler } from './workspaceTiler.js';
import { applyRects } from './utils.js';

/**
 * Top-level coordinator.  Creates and manages one WorkspaceTiler per
 * (workspaceIndex, monitorIndex) pair listed in `tiling-enabled-workspaces`.
 */
export class TilingManager {
    /**
     * @param {import('gi://Gio').Settings} settings
     */
    constructor(settings) {
        this._settings = settings;

        /** @type {Map<string, WorkspaceTiler>} */
        this._tilers = new Map();

        /** @type {Array<{obj:object,id:number}>} */
        this._signalIds = [];

        /** Windows being routed via first-frame — window-added handlers skip these. */
        this._pendingTile = new Set();
    }

    // ── Enable ────────────────────────────────────────────────────────────────

    enable() {
        this._startTilersFromSettings();

        // React to tiling workspace list changes
        this._connect(this._settings, 'changed::tiling-enabled-workspaces', () =>
            this._syncTilers(),
        );

        // React to gap-size changes: reflow all active tilers
        this._connect(this._settings, 'changed::gap-size', () => {
            for (const tiler of this._tilers.values()) {
                const workspace = global.workspace_manager.get_workspace_by_index(
                    tiler.workspaceIndex,
                );
                if (!workspace) continue;
                const workArea = workspace.get_work_area_for_monitor(tiler.monitorIndex);
                applyRects(tiler.layout.updateWorkArea(workArea));
            }
        });

        // Centralized window-created: wait for first-frame before routing.
        // On Wayland, window.get_monitor() is not stable until after the first
        // frame is drawn — routing at creation time sends windows to the wrong
        // tiler on multi-monitor setups.
        this._connect(global.display, 'window-created', (_display, window) => {
            const actor = window.get_compositor_private();
            if (!actor) return;
            const frameId = actor.connect('first-frame', () => {
                actor.disconnect(frameId);
                // Defer one idle cycle so GNOME's window placement (and
                // auto-move-windows) can settle the final monitor before we tile.
                GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                    const wsIdx = window.get_workspace()?.index();
                    if (wsIdx === null || wsIdx === undefined) return GLib.SOURCE_REMOVE;
                    const mon = window.get_monitor();
                    if (this._settings.get_boolean('debug-logging'))
                        console.log('[workspace-tiling-window-manager] first-frame route:',
                            window.get_title(), '| ws:', wsIdx, '| mon:', mon,
                            '| tiler:', this._tilers.has(`${wsIdx}:${mon}`) ? 'found' : 'NONE');
                    const tiler = this._tilers.get(`${wsIdx}:${mon}`);
                    if (tiler) {
                        this._pendingTile.add(window);
                        tiler._tileNewWindow(window);
                        // Allow window-added on other monitors to handle this window
                        // again after a short grace period (e.g. user drags it elsewhere).
                        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                            this._pendingTile.delete(window);
                            return GLib.SOURCE_REMOVE;
                        });
                    }
                    return GLib.SOURCE_REMOVE;
                });
            });
        });

        // React to workspace count changes (e.g. new workspace created)
        this._connect(global.workspace_manager, 'notify::n-workspaces', () =>
            this._syncTilers(),
        );

        // React to monitor hotplug
        this._connect(Main.layoutManager, 'monitors-changed', () => this._syncTilers());
    }

    // ── Disable ───────────────────────────────────────────────────────────────

    disable() {
        for (const { obj, id } of this._signalIds) obj.disconnect(id);
        this._signalIds = [];

        for (const tiler of this._tilers.values()) tiler.disable();
        this._tilers.clear();
    }

    // ── Tiler lifecycle helpers ───────────────────────────────────────────────

    _connect(obj, signal, handler) {
        const id = obj.connect(signal, handler);
        this._signalIds.push({ obj, id });
    }

    _startTilersFromSettings() {
        const n = global.workspace_manager.get_n_workspaces();
        const indices = this._settings
            .get_value('tiling-enabled-workspaces')
            .deepUnpack()
            .filter(i => i >= 0 && i < n);

        const nMonitors = global.display.get_n_monitors();

        for (const wsIdx of indices) {
            for (let mon = 0; mon < nMonitors; mon++) {
                const key = `${wsIdx}:${mon}`;
                if (this._tilers.has(key)) continue;
                const tiler = new WorkspaceTiler(
                    wsIdx, mon, createLayout('dwindle'), this._settings, this._pendingTile,
                );
                tiler.enable();
                this._tilers.set(key, tiler);
            }
        }
    }

    _syncTilers() {
        const n = global.workspace_manager.get_n_workspaces();
        const desired = new Set(
            this._settings
                .get_value('tiling-enabled-workspaces')
                .deepUnpack()
                .filter(i => i >= 0 && i < n)
                .flatMap(wsIdx => {
                    const nMon = global.display.get_n_monitors();
                    return Array.from({ length: nMon }, (_, m) => `${wsIdx}:${m}`);
                }),
        );

        // Remove tilers no longer needed
        for (const [key, tiler] of this._tilers) {
            if (!desired.has(key)) {
                tiler.disable();
                this._tilers.delete(key);
            }
        }

        // Add new tilers
        for (const key of desired) {
            if (this._tilers.has(key)) continue;
            const [wsIdx, mon] = key.split(':').map(Number);
            const tiler = new WorkspaceTiler(
                wsIdx, mon, createLayout('dwindle'), this._settings, this._pendingTile,
            );
            tiler.enable();
            this._tilers.set(key, tiler);
        }
    }

    // ── Keybinding actions ────────────────────────────────────────────────────

    /**
     * @param {'left'|'right'|'up'|'down'} direction
     */
    _focusDirection(direction) {
        const focused = global.display.focus_window;
        if (!focused) return;

        const tiler = this._tilerForWindow(focused);
        if (!tiler) return;

        const neighbour = tiler.layout.getNeighbour(focused, direction);
        neighbour?.activate(global.get_current_time());
    }

    /**
     * @param {'left'|'right'|'up'|'down'} direction
     */
    _moveWindowDirection(direction) {
        const focused = global.display.focus_window;
        if (!focused) return;

        const tiler = this._tilerForWindow(focused);
        if (!tiler) return;

        applyRects(tiler.layout.moveWindow(focused, direction));
    }

    /**
     * @param {'shrink'|'grow'} direction
     */
    _resizeTile(direction) {
        const focused = global.display.focus_window;
        if (!focused) return;

        const tiler = this._tilerForWindow(focused);
        if (!tiler) return;

        applyRects(tiler.layout.resizeTile(focused, direction, 0.05));
    }

    _toggleFloat() {
        const focused = global.display.focus_window;
        if (!focused) return;

        const tiler = this._tilerForWindow(focused);
        if (!tiler) return;

        if (tiler.floatingWindows.has(focused)) tiler.sinkWindow(focused);
        else tiler.floatWindow(focused);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Find the active WorkspaceTiler for a given window.
     * @param {import('gi://Meta').Window} window
     * @returns {WorkspaceTiler|null}
     */
    _tilerForWindow(window) {
        const wsIdx = window.get_workspace()?.index();
        const mon = window.get_monitor();
        if (wsIdx === null || wsIdx === undefined) return null;
        return this._tilers.get(`${wsIdx}:${mon}`) ?? null;
    }
}
