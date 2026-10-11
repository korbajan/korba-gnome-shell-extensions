// SPDX-FileCopyrightText: 2026 korbajan
//
// SPDX-License-Identifier: GPL-2.0-or-later

export function hide(metaWindow, registry) {
    if (!metaWindow) return;
    const record = registry?.get(metaWindow);
    if (metaWindow.is_client_decorated?.()) {
        if (record) record.currentDecorated = false;
        return;
    }
    _applyDecorated(metaWindow, false, record);
}

export function show(metaWindow, registry) {
    if (!metaWindow) return;
    const record = registry?.get(metaWindow);
    _applyDecorated(metaWindow, true, record);
}

export function toggle(metaWindow, registry) {
    if (!metaWindow) return;
    const record = registry?.get(metaWindow);
    const isCurrentlyDecorated = record ? record.currentDecorated : metaWindow.decorated;
    if (isCurrentlyDecorated) {
        hide(metaWindow, registry);
    } else {
        show(metaWindow, registry);
    }
}

export function applyPolicy(metaWindow, policy, registry) {
    if (policy === 'hidden') {
        hide(metaWindow, registry);
    } else {
        show(metaWindow, registry);
    }
}

function _applyDecorated(metaWindow, decorated, record) {
    const before = metaWindow.get_frame_rect();

    // In GNOME 50, unmaximize() takes no arguments.
    if (metaWindow.maximized_horizontally || metaWindow.maximized_vertically) {
        metaWindow.unmaximize();
    }

    // MetaWindowWayland.decorated is read-only; catch and bail for native Wayland windows.
    try {
        metaWindow.set({ decorated });
    } catch (_e) {
        return;
    }
    if (record) record.currentDecorated = decorated;

    // Re-issue outer position so the window does not jump (FR-002).
    metaWindow.move_resize_frame(false, before.x, before.y, before.width, before.height);
}
