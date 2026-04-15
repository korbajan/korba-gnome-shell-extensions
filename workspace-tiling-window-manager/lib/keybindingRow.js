// SPDX-FileCopyrightText: 2026 korbajan
//
// SPDX-License-Identifier: GPL-2.0-or-later
//
// Extracted from spatial-window-navigator/prefs.js — reusable keybinding
// capture widget for GNOME Shell extension preferences.

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const MODIFIER_KEYS = new Set([
    Gdk.KEY_Shift_L, Gdk.KEY_Shift_R,
    Gdk.KEY_Control_L, Gdk.KEY_Control_R,
    Gdk.KEY_Alt_L, Gdk.KEY_Alt_R,
    Gdk.KEY_Super_L, Gdk.KEY_Super_R,
    Gdk.KEY_Hyper_L, Gdk.KEY_Hyper_R,
    Gdk.KEY_Meta_L, Gdk.KEY_Meta_R,
    Gdk.KEY_ISO_Level3_Shift,
]);

export class KeyCaptureWindow extends Gtk.Window {
    static [GObject.signals] = {
        'captured': {param_types: [GObject.TYPE_STRING]},
    };

    static {
        GObject.registerClass(this);
    }

    constructor(parent) {
        super({
            modal: true,
            transient_for: parent,
            title: _('Set Shortcut'),
            default_width: 320,
            default_height: 140,
            resizable: false,
        });

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_top: 32,
            margin_bottom: 32,
            margin_start: 24,
            margin_end: 24,
            valign: Gtk.Align.CENTER,
        });
        this.set_child(box);

        box.append(new Gtk.Label({
            label: _('Press the desired key combination'),
            wrap: true,
            justify: Gtk.Justification.CENTER,
            css_classes: ['title-4'],
        }));

        box.append(new Gtk.Label({
            label: _('Press Escape to cancel'),
            justify: Gtk.Justification.CENTER,
            css_classes: ['dim-label'],
        }));

        const controller = new Gtk.EventControllerKey();
        controller.connect('key-pressed', (c, keyval, keycode, state) =>
            this._onKeyPressed(keyval, state));
        this.add_controller(controller);
    }

    _onKeyPressed(keyval, state) {
        if (keyval === Gdk.KEY_Escape) {
            this.close();
            return Gdk.EVENT_STOP;
        }

        if (MODIFIER_KEYS.has(keyval))
            return Gdk.EVENT_STOP;

        const mask = state & Gtk.accelerator_get_default_mod_mask();
        const accel = Gtk.accelerator_name(keyval, mask);

        if (accel) {
            this.emit('captured', accel);
            this.close();
        }

        return Gdk.EVENT_STOP;
    }
}

export class KeybindingRow extends Adw.ActionRow {
    static {
        GObject.registerClass(this);
    }

    constructor(title, subtitle, settings, key) {
        super({title, subtitle, activatable: true});

        this._settings = settings;
        this._key = key;

        this._accelLabel = new Gtk.ShortcutLabel({
            valign: Gtk.Align.CENTER,
            disabled_text: _('Disabled'),
        });
        this.add_suffix(this._accelLabel);

        const clearBtn = new Gtk.Button({
            icon_name: 'edit-clear-symbolic',
            valign: Gtk.Align.CENTER,
            has_frame: false,
            tooltip_text: _('Clear shortcut'),
        });
        clearBtn.connect('clicked', () => {
            this._settings.set_strv(this._key, []);
        });
        this.add_suffix(clearBtn);

        this._settings.connect(`changed::${this._key}`, () => this._sync());
        this._sync();

        this.connect('activated', () => this._capture());
    }

    _sync() {
        const [accel = ''] = this._settings.get_strv(this._key);
        this._accelLabel.set_accelerator(accel);
    }

    _capture() {
        const win = new KeyCaptureWindow(this.get_root());
        win.connect('captured', (w, accel) => {
            this._settings.set_strv(this._key, [accel]);
        });
        win.present();
    }
}
