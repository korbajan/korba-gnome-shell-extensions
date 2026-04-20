// SPDX-FileCopyrightText: 2026 korbajan
//
// SPDX-License-Identifier: GPL-2.0-or-later

// gi://St and gi://Clutter are only available inside GNOME Shell. The lazy
// import guards let this module load cleanly in the Node.js/Jasmine runner.

let _St = null;
async function _getSt() {
    if (!_St) _St = (await import('gi://St')).default;
    return _St;
}

function _cssColor(colorStr) {
    return `background-color: ${colorStr};`;
}

async function _makeEdge(colorStr) {
    const St = await _getSt();
    const widget = new St.Widget({ style: _cssColor(colorStr), reactive: false });
    globalThis.global?.window_group.add_child(widget);
    return widget;
}

function _positionEdges(edges, rect, thickness) {
    const { x, y, width, height } = rect;
    const t = thickness;
    edges[0].set_position(x - t, y - t);
    edges[0].set_size(width + 2 * t, t);
    edges[1].set_position(x - t, y + height);
    edges[1].set_size(width + 2 * t, t);
    edges[2].set_position(x - t, y);
    edges[2].set_size(t, height);
    edges[3].set_position(x + width, y);
    edges[3].set_size(t, height);
}

export async function createBorderActor(metaWindow, record, thickness, colorStr, _focusedColorStr) {
    if (record.borderActor) return;
    const edges = await Promise.all([
        _makeEdge(colorStr),
        _makeEdge(colorStr),
        _makeEdge(colorStr),
        _makeEdge(colorStr),
    ]);
    record.borderActor = edges;
    record.borderThickness = thickness;
    repositionActor(metaWindow, record);
}

export function destroyBorderActor(_metaWindow, record) {
    if (!record?.borderActor) return;
    for (const edge of record.borderActor) edge.destroy();
    record.borderActor = null;
}

export function repositionActor(metaWindow, record) {
    if (!record?.borderActor) return;
    const rect = metaWindow.get_frame_rect();
    _positionEdges(record.borderActor, rect, record.borderThickness ?? 2);
}

export function setFocused(record, isFocused, colorStr, focusedColorStr) {
    if (!record?.borderActor) return;
    const style = _cssColor(isFocused ? focusedColorStr : colorStr);
    for (const edge of record.borderActor) edge.set_style(style);
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
        const style = _cssColor(isFocused ? focusedColorStr : colorStr);
        const rect = win.get_frame_rect();
        record.borderThickness = thickness;
        _positionEdges(record.borderActor, rect, thickness);
        for (const edge of record.borderActor) edge.set_style(style);
    });
}

export function destroyAll(registry) {
    registry.forEach((_win, record) => {
        if (!record.borderActor) return;
        for (const edge of record.borderActor) edge.destroy();
        record.borderActor = null;
    });
}

export function hideBorderActor(record) {
    if (!record?.borderActor) return;
    for (const edge of record.borderActor) edge.hide();
}

export function showBorderActor(record) {
    if (!record?.borderActor) return;
    for (const edge of record.borderActor) edge.show();
}
