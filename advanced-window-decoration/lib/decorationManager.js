// SPDX-FileCopyrightText: 2026 korbajan
//
// SPDX-License-Identifier: GPL-2.0-or-later

// GJS imports are lazy (inside enable()) so this module is loadable by the
// Node.js/Jasmine test runner without a GJS environment (T015a).

import { WindowRegistry } from './windowRegistry.js';
import { shouldManage } from './windowFilter.js';
import * as TitlebarController from './titlebarController.js';
import * as BorderController from './borderController.js';

export class DecorationManager {
    constructor(settings, { display = null } = {}) {
        this._settings = settings;
        // Allow injection of a fake emitter in unit tests (T015a).
        this._display = display;
        this._registry = new WindowRegistry();
        this._signalHandles = [];
    }

    // Exposed for test observability (Constitution III / T015a).
    getSignalHandleCount() {
        return this._signalHandles.length;
    }

    enable() {
        const display = this._display ?? globalThis.global?.display;
        if (!display) return;

        this._connect(display, 'window-created', (_d, win) => this._onWindowCreated(win));
        this._connect(display, 'notify::focus-window', () => this._onFocusChanged());

        // Only wire GJS-dependent keybinding and settings signals in a real shell environment.
        if (!this._display) this._enableShellFeatures();

        // Manage already-open windows.
        const windows = display.list_all_windows ? display.list_all_windows() : [];
        for (const win of windows) {
            if (shouldManage(win)) this._manageWindow(win);
        }
    }

    async _enableShellFeatures() {
        const [{ default: Meta }, { default: Shell }, Main] = await Promise.all([
            import('gi://Meta'),
            import('gi://Shell'),
            import('resource:///org/gnome/shell/ui/main.js'),
        ]);
        this._Meta = Meta;
        this._Shell = Shell;
        this._Main = Main;

        this._Main.wm.addKeybinding(
            'toggle-titlebar-shortcut',
            this._settings,
            this._Meta.KeyBindingFlags.NONE,
            this._Shell.ActionMode.NORMAL,
            () => this._onToggleShortcut(),
        );

        this._connect(this._settings, 'changed::default-titlebar-policy', () =>
            this._onPolicyChanged(),
        );
        this._connect(this._settings, 'changed::toggle-titlebar-shortcut', () => {
            this._Main.wm.removeKeybinding('toggle-titlebar-shortcut');
            this._Main.wm.addKeybinding(
                'toggle-titlebar-shortcut',
                this._settings,
                this._Meta.KeyBindingFlags.NONE,
                this._Shell.ActionMode.NORMAL,
                () => this._onToggleShortcut(),
            );
        });
        for (const key of ['border-thickness', 'border-color', 'focused-border-color']) {
            this._connect(this._settings, `changed::${key}`, () => this._onBorderSettingChanged());
        }
    }

    disable() {
        this._Main?.wm.removeKeybinding('toggle-titlebar-shortcut');

        for (const { obj, id } of this._signalHandles) obj.disconnect(id);
        this._signalHandles = [];

        BorderController.destroyAll(this._registry);
        this._registry.disableAll();
    }

    _connect(obj, signal, handler) {
        const id = obj.connect(signal, handler);
        this._signalHandles.push({ obj, id });
    }

    _onWindowCreated(win) {
        if (!shouldManage(win)) return;
        const actor = win.get_compositor_private?.();
        if (actor?.realized) {
            this._manageWindow(win);
        } else {
            actor?.connect('first-frame', () => this._manageWindow(win));
        }
    }

    _manageWindow(win) {
        if (this._registry.get(win)) return;
        this._registry.attach(win);
        const record = this._registry.get(win);

        const policy = this._getPolicy();
        TitlebarController.applyPolicy(win, policy, this._registry);

        const thickness = this._getThickness();
        if (thickness > 0) {
            BorderController.createBorderActor(
                win,
                record,
                thickness,
                this._getColor(),
                this._getFocusedColor(),
            );
        }

        const addHandle = (obj, signal, handler) => {
            const id = obj.connect(signal, handler);
            record.signalHandles.push({ obj, id });
        };

        addHandle(win, 'position-changed', () => BorderController.repositionActor(win, record));
        addHandle(win, 'size-changed', () => BorderController.repositionActor(win, record));
        addHandle(win, 'notify::fullscreen', () => this._onFullscreen(win, record));

        const workspace = win.get_workspace?.();
        if (workspace) {
            const id = workspace.connect('window-removed', (_ws, removed) => {
                if (removed === win) this._onWindowRemoved(win);
            });
            record.signalHandles.push({ obj: workspace, id });
        }
    }

    _onWindowRemoved(win) {
        BorderController.destroyBorderActor(win, this._registry.get(win));
        this._registry.detach(win);
    }

    _onFocusChanged() {
        const focused = globalThis.global?.display.focus_window;
        BorderController.updateFocus(
            this._registry,
            focused,
            this._getColor(),
            this._getFocusedColor(),
        );
        this._dbg('focus-changed');
    }

    _onToggleShortcut() {
        const win = globalThis.global?.display.focus_window;
        if (!win || !this._registry.get(win)) return;
        TitlebarController.toggle(win, this._registry);
        this._registry.toggleOverride(win);
        this._dbg(`toggled titlebar for ${win.get_title?.()}`);
    }

    _onPolicyChanged() {
        const policy = this._getPolicy();
        this._registry.applyDefaultPolicy(policy, win => {
            TitlebarController.applyPolicy(win, policy, this._registry);
        });
        this._dbg(`policy changed to ${policy}`);
    }

    _onBorderSettingChanged() {
        const thickness = this._getThickness();
        const color = this._getColor();
        const focusedColor = this._getFocusedColor();
        const focused = globalThis.global?.display.focus_window;

        if (thickness === 0) {
            BorderController.destroyAll(this._registry);
        } else {
            this._registry.forEach((win, record) => {
                if (!record.borderActor) {
                    BorderController.createBorderActor(win, record, thickness, color, focusedColor);
                } else {
                    BorderController.updateAll(
                        this._registry,
                        thickness,
                        color,
                        focusedColor,
                        focused,
                    );
                }
            });
        }
    }

    _onFullscreen(win, record) {
        if (win.fullscreen) {
            BorderController.hideBorderActor(record);
        } else {
            const thickness = this._getThickness();
            if (thickness > 0) {
                BorderController.showBorderActor(record);
                BorderController.repositionActor(win, record);
            }
        }
    }

    _getPolicy() {
        const raw = this._settings?.get_string('default-titlebar-policy') ?? 'visible';
        return raw === 'hidden' ? 'hidden' : 'visible';
    }

    _getThickness() {
        const raw = this._settings?.get_uint('border-thickness') ?? 2;
        return Math.min(32, Math.max(0, raw));
    }

    _getColor() {
        return this._settings?.get_string('border-color') ?? 'rgba(128,128,128,0.80)';
    }

    _getFocusedColor() {
        return this._settings?.get_string('focused-border-color') ?? 'rgba(53,132,228,1.00)';
    }

    _dbg(msg) {
        if (this._settings?.get_boolean('debug-logging'))
            console.log(`[advanced-window-decoration] ${msg}`);
    }
}
