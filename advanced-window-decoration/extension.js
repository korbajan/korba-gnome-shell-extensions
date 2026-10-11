// SPDX-FileCopyrightText: 2026 korbajan
//
// SPDX-License-Identifier: GPL-2.0-or-later

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { DecorationManager } from './lib/decorationManager.js';

export default class AdvancedWindowDecorationExtension extends Extension {
    enable() {
        this._manager = new DecorationManager(this.getSettings());
        this._manager.enable();
    }

    disable() {
        this._manager?.disable();
        this._manager = null;
    }
}
