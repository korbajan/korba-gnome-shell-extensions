// SPDX-FileCopyrightText: 2026 korbajan
//
// SPDX-License-Identifier: GPL-2.0-or-later

import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { registerLayout } from './lib/layoutProvider.js';
import { DwindleLayout } from './lib/dwindleLayout.js';
import { TilingManager } from './lib/tilingManager.js';

export default class WorkspaceTilingWindowManagerExtension extends Extension {
    enable() {
        this._settings = this.getSettings();

        registerLayout('dwindle', () => new DwindleLayout());

        this._manager = new TilingManager(this._settings);
        this._manager.enable();

        const flags = Meta.KeyBindingFlags.NONE;
        const mode = Shell.ActionMode.NORMAL;

        const _dbg = key => {
            if (this._settings.get_boolean('debug-logging'))
                console.log(`[workspace-tiling-window-manager] keybinding fired: ${key}`);
        };

        // Focus navigation
        Main.wm.addKeybinding('keybind-focus-left', this._settings, flags, mode, () => {
            _dbg('keybind-focus-left');
            this._manager._focusDirection('left');
        });
        Main.wm.addKeybinding('keybind-focus-right', this._settings, flags, mode, () => {
            _dbg('keybind-focus-right');
            this._manager._focusDirection('right');
        });
        Main.wm.addKeybinding('keybind-focus-up', this._settings, flags, mode, () => {
            _dbg('keybind-focus-up');
            this._manager._focusDirection('up');
        });
        Main.wm.addKeybinding('keybind-focus-down', this._settings, flags, mode, () => {
            _dbg('keybind-focus-down');
            this._manager._focusDirection('down');
        });

        // Window movement
        Main.wm.addKeybinding('keybind-move-left', this._settings, flags, mode, () => {
            _dbg('keybind-move-left');
            this._manager._moveWindowDirection('left');
        });
        Main.wm.addKeybinding('keybind-move-right', this._settings, flags, mode, () => {
            _dbg('keybind-move-right');
            this._manager._moveWindowDirection('right');
        });
        Main.wm.addKeybinding('keybind-move-up', this._settings, flags, mode, () => {
            _dbg('keybind-move-up');
            this._manager._moveWindowDirection('up');
        });
        Main.wm.addKeybinding('keybind-move-down', this._settings, flags, mode, () => {
            _dbg('keybind-move-down');
            this._manager._moveWindowDirection('down');
        });

        // Resize
        Main.wm.addKeybinding('keybind-resize-shrink', this._settings, flags, mode, () => {
            _dbg('keybind-resize-shrink');
            this._manager._resizeTile('shrink');
        });
        Main.wm.addKeybinding('keybind-resize-grow', this._settings, flags, mode, () => {
            _dbg('keybind-resize-grow');
            this._manager._resizeTile('grow');
        });

        // Float toggle
        Main.wm.addKeybinding('keybind-toggle-float', this._settings, flags, mode, () => {
            _dbg('keybind-toggle-float');
            this._manager._toggleFloat();
        });
    }

    disable() {
        Main.wm.removeKeybinding('keybind-focus-left');
        Main.wm.removeKeybinding('keybind-focus-right');
        Main.wm.removeKeybinding('keybind-focus-up');
        Main.wm.removeKeybinding('keybind-focus-down');

        Main.wm.removeKeybinding('keybind-move-left');
        Main.wm.removeKeybinding('keybind-move-right');
        Main.wm.removeKeybinding('keybind-move-up');
        Main.wm.removeKeybinding('keybind-move-down');

        Main.wm.removeKeybinding('keybind-resize-shrink');
        Main.wm.removeKeybinding('keybind-resize-grow');

        Main.wm.removeKeybinding('keybind-toggle-float');

        this._manager.disable();
        this._manager = null;
        this._settings = null;
    }
}
