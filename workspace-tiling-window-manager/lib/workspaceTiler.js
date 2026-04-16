// SPDX-FileCopyrightText: 2026 korbajan
//
// SPDX-License-Identifier: GPL-2.0-or-later

import Meta from 'gi://Meta';
import { applyRects } from './utils.js';

/**
 * Returns true if `window` should be managed by the tiling layout.
 * @param {import('gi://Meta').Window} window
 * @returns {boolean}
 */
export function shouldTile(window) {
    return (
        window.get_window_type() === Meta.WindowType.NORMAL &&
        !window.get_transient_for() &&
        !window.skip_taskbar
    );
}

/**
 * Connect a signal and store the ID in `store` for later disconnection.
 * @param {object} obj
 * @param {string} signal
 * @param {Function} handler
 * @param {Array<{obj:object,id:number}>} store
 */
function connectStored(obj, signal, handler, store) {
    const id = obj.connect(signal, handler);
    store.push({ obj, id });
    return id;
}

/**
 * Manages tiling for one (workspaceIndex, monitorIndex) pair.
 *
 * Lifecycle: construct → enable() → [runtime] → disable()
 */
export class WorkspaceTiler {
    /**
     * @param {number} workspaceIndex
     * @param {number} monitorIndex
     * @param {import('./layoutProvider.js').LayoutProvider} layout
     * @param {import('gi://Gio').Settings} settings
     */
    constructor(workspaceIndex, monitorIndex, layout, settings) {
        this.workspaceIndex = workspaceIndex;
        this.monitorIndex = monitorIndex;
        this.layout = layout;
        this._settings = settings;

        /** @type {Set<import('gi://Meta').Window>} */
        this.floatingWindows = new Set();

        /** @type {Map<import('gi://Meta').Window, {x:number,y:number,width:number,height:number}>} */
        this.savedRects = new Map();

        /** @type {Array<{obj:object,id:number}>} — non-window signals (workspace, display) */
        this._signalIds = [];

        /** @type {Map<import('gi://Meta').Window, Array<{obj:object,id:number}>>} — per-window signals */
        this._windowSignalIds = new Map();
    }

    // ── Enable / initial collection ───────────────────────────────────────────

    enable() {
        const workspace = global.workspace_manager.get_workspace_by_index(this.workspaceIndex);
        if (!workspace) return;

        const workArea = workspace.get_work_area_for_monitor(this.monitorIndex);
        this.layout.init(this._settings, workArea);

        // Tile existing windows
        const existing = workspace
            .list_windows()
            .filter(w => w.get_monitor() === this.monitorIndex && shouldTile(w));

        for (const w of existing) {
            const r = w.get_frame_rect();
            this.savedRects.set(w, { x: r.x, y: r.y, width: r.width, height: r.height });
            applyRects(this.layout.addWindow(w));
            this._connectFullscreen(w);
        }

        // window-removed (workspace signal)
        connectStored(
            workspace,
            'window-removed',
            (_ws, window) => {
                this._disconnectWindowSignals(window);
                if (!this.layout.hasWindow(window)) return;
                applyRects(this.layout.removeWindow(window));
                this.savedRects.delete(window);

                if (this._settings.get_boolean('debug-logging'))
                    console.log(
                        '[workspace-tiling-window-manager] window removed:',
                        window.get_title(),
                    );
            },
            this._signalIds,
        );
    }

    /**
     * Handle a newly created window routed here by TilingManager.
     * Uses a first-frame guard (required on Wayland) before tiling.
     * @param {import('gi://Meta').Window} window
     */
    _addNewWindow(window) {
        if (!shouldTile(window)) return;
        if (this.floatingWindows.has(window)) return;

        const actor = window.get_compositor_private();
        if (!actor) return;

        const frameId = actor.connect('first-frame', () => {
            actor.disconnect(frameId);

            const minSize = this._settings.get_uint('min-tile-size');
            const floatClasses = this._settings.get_strv('float-window-classes');

            if (floatClasses.includes(window.get_wm_class())) {
                this.floatWindow(window);
                return;
            }

            const nat = window.get_frame_rect();
            if (nat.width < minSize || nat.height < minSize) {
                this.floatWindow(window);
                return;
            }

            const r = window.get_frame_rect();
            this.savedRects.set(window, { x: r.x, y: r.y, width: r.width, height: r.height });
            applyRects(this.layout.addWindow(window));
            this._connectFullscreen(window);

            if (this._settings.get_boolean('debug-logging'))
                console.log(
                    '[workspace-tiling-window-manager] window inserted:',
                    window.get_title(),
                );
        });
    }

    /**
     * Connect notify::fullscreen for a window, stored in _windowSignalIds.
     * @param {import('gi://Meta').Window} window
     */
    _connectFullscreen(window) {
        if (!this._windowSignalIds.has(window)) this._windowSignalIds.set(window, []);

        connectStored(
            window,
            'notify::fullscreen',
            () => {
                if (window.fullscreen) {
                    if (this.layout.hasWindow(window)) applyRects(this.layout.removeWindow(window));
                } else {
                    if (!this.layout.hasWindow(window) && !this.floatingWindows.has(window)) {
                        const actor = window.get_compositor_private();
                        if (!actor) return;
                        const frameId = actor.connect('first-frame', () => {
                            actor.disconnect(frameId);
                            applyRects(this.layout.addWindow(window));
                        });
                    }
                }
            },
            this._windowSignalIds.get(window),
        );
    }

    /**
     * Disconnect and remove all per-window signals for `window`.
     * @param {import('gi://Meta').Window} window
     */
    _disconnectWindowSignals(window) {
        const ids = this._windowSignalIds.get(window);
        if (!ids) return;
        for (const { obj, id } of ids) obj.disconnect(id);
        this._windowSignalIds.delete(window);
    }

    // ── Disable / restore ─────────────────────────────────────────────────────

    disable() {
        for (const { obj, id } of this._signalIds) obj.disconnect(id);
        this._signalIds = [];

        for (const ids of this._windowSignalIds.values())
            for (const { obj, id } of ids) obj.disconnect(id);
        this._windowSignalIds.clear();

        for (const [window, rect] of this.savedRects) {
            try {
                window.move_resize_frame(false, rect.x, rect.y, rect.width, rect.height);
            } catch (_e) {
                // Window may already be gone
            }
        }

        this.layout.destroy();
        this.savedRects.clear();
        this.floatingWindows.clear();
    }

    // ── Float / sink ──────────────────────────────────────────────────────────

    /**
     * Detach a window from the tile layout and centre it.
     * @param {import('gi://Meta').Window} window
     */
    floatWindow(window) {
        if (this.layout.hasWindow(window)) applyRects(this.layout.removeWindow(window));

        this.floatingWindows.add(window);

        const workspace = global.workspace_manager.get_workspace_by_index(this.workspaceIndex);
        const workArea = workspace ? workspace.get_work_area_for_monitor(this.monitorIndex) : null;

        if (workArea) {
            const r = window.get_frame_rect();
            const cx = workArea.x + Math.floor((workArea.width - r.width) / 2);
            const cy = workArea.y + Math.floor((workArea.height - r.height) / 2);
            window.move_resize_frame(false, cx, cy, r.width, r.height);
        }

        if (this._settings.get_boolean('debug-logging'))
            console.log('[workspace-tiling-window-manager] window floated:', window.get_title());
    }

    /**
     * Re-insert a floating window into the tile layout.
     * @param {import('gi://Meta').Window} window
     */
    sinkWindow(window) {
        this.floatingWindows.delete(window);

        const actor = window.get_compositor_private();
        if (!actor) {
            applyRects(this.layout.addWindow(window));
            return;
        }

        const frameId = actor.connect('first-frame', () => {
            actor.disconnect(frameId);
            applyRects(this.layout.addWindow(window));
        });
    }
}
