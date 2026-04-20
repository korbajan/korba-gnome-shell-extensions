// SPDX-FileCopyrightText: 2026 korbajan
//
// SPDX-License-Identifier: GPL-2.0-or-later

// gi://Meta is only available inside GNOME Shell; guard so the module is
// importable in the Node.js/Jasmine test runner without error.
let _Meta = null;
async function _getMeta() {
    if (!_Meta) _Meta = (await import('gi://Meta')).default;
    return _Meta;
}

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
    const isCurrentlyDecorated = record ? record.currentDecorated : metaWindow.get_decorated();
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

    // Unmaximize before resizing — maximized windows ignore move_resize_frame
    // (CLAUDE.md Wayland gotcha). Access Meta lazily to avoid GJS import at load time.
    if (metaWindow.maximized_horizontally || metaWindow.maximized_vertically) {
        _getMeta().then(Meta => metaWindow.unmaximize(Meta.MaximizeFlags.BOTH));
    }

    metaWindow.set_decorated(decorated);
    if (record) record.currentDecorated = decorated;

    // Re-issue outer position so the window does not jump (FR-002).
    metaWindow.move_resize_frame(false, before.x, before.y, before.width, before.height);
}
