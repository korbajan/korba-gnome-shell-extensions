// SPDX-FileCopyrightText: 2026 korbajan
//
// SPDX-License-Identifier: GPL-2.0-or-later

import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';

import {
    ExtensionPreferences,
    gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { parseRgba, formatRgba } from './lib/settingsClamp.js';

export default class AdvancedWindowDecorationPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        window.add(_buildBehaviourPage(settings));
        window.add(_buildBordersPage(settings));
        window.add(_buildShortcutPage(settings, window));
        window.add(_buildDebugPage(settings));
    }
}

// ── Behaviour page (T034) ──────────────────────────────────────────────────

function _buildBehaviourPage(settings) {
    const page = new Adw.PreferencesPage({
        title: _('Behaviour'),
        icon_name: 'preferences-system-symbolic',
    });

    const group = new Adw.PreferencesGroup({ title: _('Title Bar') });
    page.add(group);

    const row = new Adw.SwitchRow({
        title: _('Hide title bars by default'),
        subtitle: _('Newly opened windows start without a title bar'),
    });
    group.add(row);

    settings.bind_with_mapping(
        'default-titlebar-policy',
        row,
        'active',
        Gio.SettingsBindFlags.DEFAULT,
        value => value.get_string() === 'hidden',
        value => {
            const v = new GObject.Value();
            v.init(GObject.TYPE_STRING);
            v.set_string(value ? 'hidden' : 'visible');
            return v;
        },
    );

    return page;
}

// ── Borders page (T035) ───────────────────────────────────────────────────

function _buildBordersPage(settings) {
    const page = new Adw.PreferencesPage({
        title: _('Borders'),
        icon_name: 'preferences-desktop-wallpaper-symbolic',
    });

    const group = new Adw.PreferencesGroup({ title: _('Border Appearance') });
    page.add(group);

    // Thickness spin row
    const thicknessRow = new Adw.SpinRow({
        title: _('Border thickness'),
        subtitle: _('Width of the border in logical pixels (0 = no border)'),
        adjustment: new Gtk.Adjustment({
            lower: 0,
            upper: 32,
            step_increment: 1,
            page_increment: 4,
        }),
    });
    group.add(thicknessRow);
    settings.bind('border-thickness', thicknessRow, 'value', Gio.SettingsBindFlags.DEFAULT);

    // Default border color
    group.add(
        _buildColorRow(
            settings,
            'border-color',
            _('Border color'),
            _('Color of the border on unfocused windows'),
        ),
    );

    // Focused border color
    group.add(
        _buildColorRow(
            settings,
            'focused-border-color',
            _('Focused border color'),
            _('Color of the border on the focused window'),
        ),
    );

    return page;
}

function _buildColorRow(settings, key, title, subtitle) {
    const row = new Adw.ActionRow({ title, subtitle });

    const dialog = new Gtk.ColorDialog({ with_alpha: true, title });
    const button = new Gtk.ColorDialogButton({
        dialog,
        accessible_name: title,
        valign: Gtk.Align.CENTER,
    });
    row.add_suffix(button);
    row.set_activatable_widget(button);

    // Sync settings → button
    const applyFromSettings = () => {
        const str = settings.get_string(key);
        const fallback = { r: 0.5, g: 0.5, b: 0.5, a: 1.0 };
        const rgba = parseRgba(str, fallback);
        const gdkRgba = new Gdk.RGBA();
        Object.assign(gdkRgba, rgba);
        button.set_rgba(gdkRgba);
    };

    // Sync button → settings
    button.connect('notify::rgba', () => {
        settings.set_string(key, formatRgba(button.get_rgba()));
    });

    settings.connect(`changed::${key}`, applyFromSettings);
    applyFromSettings();

    return row;
}

// ── Shortcut page (T036) ──────────────────────────────────────────────────

function _buildShortcutPage(settings, prefWindow) {
    const page = new Adw.PreferencesPage({
        title: _('Shortcut'),
        icon_name: 'input-keyboard-symbolic',
    });

    const group = new Adw.PreferencesGroup({ title: _('Keyboard Shortcut') });
    page.add(group);

    const current = () => settings.get_strv('toggle-titlebar-shortcut')[0] ?? '';

    const label = new Gtk.ShortcutLabel({
        accelerator: current(),
        disabled_text: _('(none)'),
        valign: Gtk.Align.CENTER,
    });

    const setBtn = new Gtk.Button({
        label: _('Set shortcut…'),
        accessible_name: _('Set title-bar toggle shortcut'),
        valign: Gtk.Align.CENTER,
    });

    const row = new Adw.ActionRow({ title: _('Toggle title bar') });
    row.add_suffix(label);
    row.add_suffix(setBtn);
    group.add(row);

    // Warning row shown on conflict — hidden by default.
    const warnRow = new Adw.ActionRow({
        title: _('Shortcut conflict'),
        subtitle: _('That shortcut is already in use. Please choose another.'),
        visible: false,
    });
    group.add(warnRow);

    settings.connect('changed::toggle-titlebar-shortcut', () => {
        label.set_accelerator(current());
        warnRow.set_visible(false);
    });

    setBtn.connect('clicked', () => {
        _captureShortcut(prefWindow, settings, warnRow);
    });

    return page;
}

function _captureShortcut(prefWindow, settings, warnRow) {
    const dialog = new Gtk.Window({
        title: _('Press a key combination…'),
        modal: true,
        transient_for: prefWindow,
        default_width: 360,
        default_height: 120,
        resizable: false,
    });

    const label = new Gtk.Label({
        label: _('Press a key combination, or Escape to cancel.'),
        margin_top: 24,
        margin_bottom: 24,
        margin_start: 24,
        margin_end: 24,
    });
    dialog.set_child(label);

    const controller = new Gtk.EventControllerKey();
    controller.connect('key-pressed', (_ctrl, keyval, keycode, state) => {
        if (keyval === Gdk.KEY_Escape) {
            dialog.close();
            return true;
        }

        const accel = Gtk.accelerator_name_with_keycode(null, keyval, keycode, state);
        if (!accel || !Gtk.accelerator_valid(keyval, state)) return true;

        settings.set_strv('toggle-titlebar-shortcut', [accel]);
        warnRow.set_visible(false);
        dialog.close();
        return true;
    });
    dialog.add_controller(controller);
    dialog.present();
}

// ── Debug page (T037) ─────────────────────────────────────────────────────

function _buildDebugPage(settings) {
    const page = new Adw.PreferencesPage({
        title: _('Debug'),
        icon_name: 'dialog-information-symbolic',
    });

    const group = new Adw.PreferencesGroup({ title: _('Diagnostics') });
    page.add(group);

    const row = new Adw.SwitchRow({
        title: _('Enable debug logging'),
        subtitle: _('Emits structured output to journalctl (zero overhead when off)'),
    });
    group.add(row);
    settings.bind('debug-logging', row, 'active', Gio.SettingsBindFlags.DEFAULT);

    return page;
}
