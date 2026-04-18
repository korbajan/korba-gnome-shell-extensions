// SPDX-FileCopyrightText: 2026 korbajan
//
// SPDX-License-Identifier: GPL-2.0-or-later

import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export default class SpatialWindowNavigator extends Extension {
    enable() {
        this._settings = this.getSettings();

        const mode = Shell.ActionMode.NORMAL;
        const flags = Meta.KeyBindingFlags.NONE;

        Main.wm.addKeybinding('focus-window-left', this._settings, flags, mode, () =>
            this._focusDirection('left'),
        );
        Main.wm.addKeybinding('focus-window-right', this._settings, flags, mode, () =>
            this._focusDirection('right'),
        );
        Main.wm.addKeybinding('focus-window-up', this._settings, flags, mode, () =>
            this._focusDirection('up'),
        );
        Main.wm.addKeybinding('focus-window-down', this._settings, flags, mode, () =>
            this._focusDirection('down'),
        );
    }

    disable() {
        Main.wm.removeKeybinding('focus-window-left');
        Main.wm.removeKeybinding('focus-window-right');
        Main.wm.removeKeybinding('focus-window-up');
        Main.wm.removeKeybinding('focus-window-down');
        this._settings = null;
    }

    _focusDirection(direction) {
        const focused = global.display.focus_window;
        const workspace = global.workspace_manager.get_active_workspace();
        const windows = workspace
            .list_windows()
            .filter(w => !w.minimized && !w.skip_taskbar && w !== focused);

        if (windows.length === 0) return;

        if (!focused) {
            windows[0].activate(global.get_current_time());
            return;
        }

        const fr = focused.get_frame_rect();
        const fcx = fr.x + fr.width / 2;
        const fcy = fr.y + fr.height / 2;

        let best = null;
        let bestScore = Infinity;

        for (const win of windows) {
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

            // Weight cross-axis distance less so nearby windows are preferred
            // even if not perfectly aligned
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

        best?.activate(global.get_current_time());
    }
}
