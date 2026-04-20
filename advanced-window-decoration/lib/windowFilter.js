// SPDX-FileCopyrightText: 2026 korbajan
//
// SPDX-License-Identifier: GPL-2.0-or-later

// Window types that map to Meta.WindowType integer values as used in tests and GJS.
// Kept as a plain object so pure-logic tests can run without GJS.
const EXCLUDED_TYPES = new Set([
    1, // DESKTOP
    2, // DOCK
    3, // DIALOG
    4, // MODAL_DIALOG
    5, // TOOLBAR
    6, // MENU
    7, // UTILITY
    8, // SPLASHSCREEN
    9, // DROPDOWN_MENU
    10, // POPUP_MENU
    11, // TOOLTIP
    12, // NOTIFICATION
    13, // COMBO
    14, // DND
]);

const PREFS_WM_CLASSES = ['gjs', 'advanced-window-decoration'];
const PREFS_WM_CLASS_FRAGMENT = 'AdvancedWindowDecoration';

export function shouldManage(metaWindow) {
    if (metaWindow.is_override_redirect()) return false;
    if (metaWindow.fullscreen) return false;

    const type = metaWindow.get_window_type();
    if (EXCLUDED_TYPES.has(type)) return false;

    const wmClass = metaWindow.get_wm_class() ?? '';
    if (PREFS_WM_CLASSES.includes(wmClass) || wmClass.includes(PREFS_WM_CLASS_FRAGMENT))
        return false;

    return true;
}
