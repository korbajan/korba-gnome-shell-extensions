// SPDX-FileCopyrightText: 2026 korbajan
//
// SPDX-License-Identifier: GPL-2.0-or-later

// gi://St is only available inside GNOME Shell. The lazy import guard lets
// this module load cleanly in the Node.js/Jasmine runner.

let _St = null;
async function _getSt() {
    if (!_St) _St = (await import('gi://St')).default;
    return _St;
}

function _css(colorStr, thickness) {
    return `border: ${thickness}px solid ${colorStr}; border-radius: 6px; background-color: transparent;`;
}

async function _makeActor(colorStr, thickness) {
    const St = await _getSt();
    const widget = new St.Widget({ style: _css(colorStr, thickness), reactive: false });
    globalThis.global?.window_group.add_child(widget);
    return widget;
}

function _positionActor(actor, rect, thickness) {
    actor.set_position(rect.x - thickness, rect.y - thickness);
    actor.set_size(rect.width + 2 * thickness, rect.height + 2 * thickness);
}

export async function createBorderActor(metaWindow, record, thickness, colorStr, _focusedColorStr) {
    if (record.borderActor) return;
    const actor = await _makeActor(colorStr, thickness);
    record.borderActor = actor;
    record.borderThickness = thickness;
    repositionActor(metaWindow, record);
}

export function destroyBorderActor(_metaWindow, record) {
    if (!record?.borderActor) return;
    record.borderActor.destroy();
    record.borderActor = null;
}

export function repositionActor(metaWindow, record) {
    if (!record?.borderActor) return;
    const rect = metaWindow.get_frame_rect();
    _positionActor(record.borderActor, rect, record.borderThickness ?? 2);
}

export function setFocused(record, isFocused, colorStr, focusedColorStr) {
    if (!record?.borderActor) return;
    const color = isFocused ? focusedColorStr : colorStr;
    record.borderActor.set_style(_css(color, record.borderThickness ?? 2));
}

export function updateFocus(registry, focusedWindow, colorStr, focusedColorStr) {
    registry.forEach((win, record) => {
        setFocused(record, win === focusedWindow, colorStr, focusedColorStr);
    });
}

export function updateAll(registry, thickness, colorStr, focusedColorStr, focusedWindow) {
    registry.forEach((win, record) => {
        if (!record.borderActor) return;
        const isFocused = win === focusedWindow;
        const color = isFocused ? focusedColorStr : colorStr;
        const rect = win.get_frame_rect();
        record.borderThickness = thickness;
        _positionActor(record.borderActor, rect, thickness);
        record.borderActor.set_style(_css(color, thickness));
    });
}

export function destroyAll(registry) {
    registry.forEach((_win, record) => {
        if (!record.borderActor) return;
        record.borderActor.destroy();
        record.borderActor = null;
    });
}

export function hideBorderActor(record) {
    if (!record?.borderActor) return;
    record.borderActor.hide();
}

export function showBorderActor(record) {
    if (!record?.borderActor) return;
    record.borderActor.show();
}
