// SPDX-FileCopyrightText: 2026 korbajan
//
// SPDX-License-Identifier: GPL-2.0-or-later

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {
    ExtensionPreferences,
    gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { KeybindingRow } from './lib/keybindingRow.js';

export default class WorkspaceTilingWindowManagerPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        window.add(_buildWorkspacesPage(settings));
        window.add(_buildShortcutsPage(settings));
        window.add(_buildAppearancePage(settings));
        window.add(_buildFloatRulesPage(settings));
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _getNumWorkspaces() {
    try {
        const s = new Gio.Settings({ schema_id: 'org.gnome.desktop.wm.preferences' });
        return s.get_int('num-workspaces');
    } catch (_e) {
        return 4;
    }
}

// ── Workspaces page ───────────────────────────────────────────────────────────

function _buildWorkspacesPage(settings) {
    const page = new Adw.PreferencesPage({
        title: _('Workspaces'),
        icon_name: 'view-grid-symbolic',
    });

    const group = new Adw.PreferencesGroup({
        title: _('Tiling-enabled Workspaces'),
        description: _('Enable tiling for each workspace independently.'),
    });
    page.add(group);

    const nWorkspaces = _getNumWorkspaces();

    // Remove stale indices (auto-cleanup on prefs open, Clarification Q3)
    const raw = settings.get_value('tiling-enabled-workspaces').deepUnpack();
    const cleaned = raw.filter(i => i >= 0 && i < nWorkspaces);
    if (cleaned.length !== raw.length)
        settings.set_value('tiling-enabled-workspaces', new GLib.Variant('ai', cleaned));

    for (let i = 0; i < nWorkspaces; i++) {
        const row = new Adw.SwitchRow({ title: _('Workspace %d').format(i + 1) });
        row.set_active(settings.get_value('tiling-enabled-workspaces').deepUnpack().includes(i));

        row.connect('notify::active', () => {
            const indices = settings.get_value('tiling-enabled-workspaces').deepUnpack();
            const active = row.get_active();
            let updated;
            if (active)
                updated = indices.includes(i) ? indices : [...indices, i].sort((a, b) => a - b);
            else updated = indices.filter(x => x !== i);
            settings.set_value('tiling-enabled-workspaces', new GLib.Variant('ai', updated));
        });

        group.add(row);
    }

    return page;
}

// ── Shortcuts page ────────────────────────────────────────────────────────────

function _buildShortcutsPage(settings) {
    const page = new Adw.PreferencesPage({
        title: _('Keybindings'),
        icon_name: 'input-keyboard-symbolic',
    });

    const focusGroup = new Adw.PreferencesGroup({ title: _('Focus Window') });
    for (const [key, title] of [
        ['keybind-focus-left', _('Focus Left')],
        ['keybind-focus-right', _('Focus Right')],
        ['keybind-focus-up', _('Focus Up')],
        ['keybind-focus-down', _('Focus Down')],
    ])
        focusGroup.add(new KeybindingRow(title, '', settings, key));
    page.add(focusGroup);

    const moveGroup = new Adw.PreferencesGroup({
        title: _('Swap Window'),
        description: _(
            'Swap the focused tile with its neighbour — tile positions stay fixed, window contents are exchanged',
        ),
    });
    for (const [key, title] of [
        ['keybind-move-left', _('Swap Left')],
        ['keybind-move-right', _('Swap Right')],
        ['keybind-move-up', _('Swap Up')],
        ['keybind-move-down', _('Swap Down')],
    ])
        moveGroup.add(new KeybindingRow(title, '', settings, key));
    page.add(moveGroup);

    const resizeGroup = new Adw.PreferencesGroup({
        title: _('Tile Split Resize'),
        description: _(
            'Move the dividing line between the focused tile and its sibling by 5% per keypress',
        ),
    });
    for (const [key, title] of [
        ['keybind-resize-shrink', _('Shrink')],
        ['keybind-resize-grow', _('Grow')],
    ])
        resizeGroup.add(new KeybindingRow(title, '', settings, key));
    page.add(resizeGroup);

    const floatGroup = new Adw.PreferencesGroup({ title: _('Window Floating') });
    floatGroup.add(new KeybindingRow(_('Toggle Floating'), '', settings, 'keybind-toggle-float'));
    page.add(floatGroup);

    return page;
}

// ── Appearance page ───────────────────────────────────────────────────────────

function _buildAppearancePage(settings) {
    const page = new Adw.PreferencesPage({
        title: _('Appearance'),
        icon_name: 'preferences-desktop-display-symbolic',
    });

    const group = new Adw.PreferencesGroup({ title: _('Layout') });
    page.add(group);

    const gapRow = new Adw.SpinRow({
        title: _('Gap Size'),
        subtitle: _('Pixel gap between tiles and screen edges'),
        adjustment: new Gtk.Adjustment({
            lower: 0,
            upper: 100,
            step_increment: 1,
            page_increment: 10,
        }),
    });
    settings.bind('gap-size', gapRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    group.add(gapRow);

    const axisRow = new Adw.ComboRow({
        title: _('Initial Split Axis'),
        subtitle: _('Direction of the first split when a second window opens'),
        model: new Gtk.StringList({ strings: [_('Horizontal'), _('Vertical')] }),
    });
    const syncAxis = () => {
        axisRow.set_selected(settings.get_string('initial-split-axis') === 'vertical' ? 1 : 0);
    };
    syncAxis();
    settings.connect('changed::initial-split-axis', syncAxis);
    axisRow.connect('notify::selected', () => {
        settings.set_string(
            'initial-split-axis',
            axisRow.get_selected() === 1 ? 'vertical' : 'horizontal',
        );
    });
    group.add(axisRow);

    const ratioRow = new Adw.SpinRow({
        title: _('Default Split Ratio'),
        subtitle: _('Fraction of a split allocated to the first child (0.1 – 0.9)'),
        adjustment: new Gtk.Adjustment({
            lower: 0.1,
            upper: 0.9,
            step_increment: 0.05,
            page_increment: 0.1,
        }),
        digits: 2,
    });
    settings.bind('split-ratio', ratioRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    group.add(ratioRow);

    const minRow = new Adw.SpinRow({
        title: _('Minimum Tile Size'),
        subtitle: _('Windows smaller than this (px) are auto-floated'),
        adjustment: new Gtk.Adjustment({
            lower: 0,
            upper: 500,
            step_increment: 10,
            page_increment: 50,
        }),
    });
    settings.bind('min-tile-size', minRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    group.add(minRow);

    const debugRow = new Adw.SwitchRow({
        title: _('Debug Logging'),
        subtitle: _('Emit tiling events to journalctl (zero cost when off)'),
    });
    settings.bind('debug-logging', debugRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    group.add(debugRow);

    return page;
}

// ── Floating Rules page ───────────────────────────────────────────────────────

class FloatRulesGroup extends Adw.PreferencesGroup {
    static {
        GObject.registerClass(this);
    }

    constructor(settings) {
        super({
            title: _('Window Classes That Always Float'),
            description: _(
                'Enter the WM class of the app to always open floating. To find it: focus the app, then run in a terminal: gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell --method org.gnome.Shell.Eval "global.display.focus_window.get_wm_class()"',
            ),
        });
        this._settings = settings;
        this._rows = [];
        this._rebuild();
        settings.connect('changed::float-window-classes', () => this._rebuild());
    }

    _rebuild() {
        for (const row of this._rows) this.remove(row);
        this._rows = [];

        const classes = this._settings.get_strv('float-window-classes');
        for (const cls of classes) {
            const row = new Adw.ActionRow({ title: cls });
            const delBtn = new Gtk.Button({
                icon_name: 'list-remove-symbolic',
                valign: Gtk.Align.CENTER,
                has_frame: false,
                tooltip_text: _('Remove'),
            });
            const captured = cls;
            delBtn.connect('clicked', () => {
                const updated = this._settings
                    .get_strv('float-window-classes')
                    .filter(c => c !== captured);
                this._settings.set_strv('float-window-classes', updated);
            });
            row.add_suffix(delBtn);
            this.add(row);
            this._rows.push(row);
        }

        const entryRow = new Adw.EntryRow({
            title: _('Add window class'),
            show_apply_button: true,
        });
        entryRow.connect('apply', () => {
            const val = entryRow.get_text().trim();
            if (!val) return;
            const current = this._settings.get_strv('float-window-classes');
            if (!current.includes(val))
                this._settings.set_strv('float-window-classes', [...current, val]);
            entryRow.set_text('');
        });
        this.add(entryRow);
        this._rows.push(entryRow);
    }
}

function _buildFloatRulesPage(settings) {
    const page = new Adw.PreferencesPage({
        title: _('Floating Rules'),
        icon_name: 'window-pop-out-symbolic',
    });
    page.add(new FloatRulesGroup(settings));
    return page;
}
