// SPDX-FileCopyrightText: 2026 korbajan
//
// SPDX-License-Identifier: GPL-2.0-or-later

export class WindowRegistry {
    constructor() {
        this._map = new Map();
    }

    attach(metaWindow) {
        const rect = metaWindow.get_frame_rect();
        this._map.set(metaWindow, {
            window: metaWindow,
            originalDecorated: metaWindow.get_decorated(),
            originalFrameRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            currentDecorated: metaWindow.get_decorated(),
            userOverrode: false,
            borderActor: null,
            signalHandles: [],
        });
    }

    detach(metaWindow) {
        const record = this._map.get(metaWindow);
        if (!record) return;
        for (const { obj, id } of record.signalHandles) obj.disconnect(id);
        this._map.delete(metaWindow);
    }

    get(metaWindow) {
        return this._map.get(metaWindow);
    }

    toggleOverride(metaWindow) {
        const record = this._map.get(metaWindow);
        if (!record) return;
        record.userOverrode = !record.userOverrode;
    }

    // Calls cb(metaWindow, policy) for every window that is not under a user override.
    applyDefaultPolicy(policy, cb) {
        for (const [win, record] of this._map) {
            if (!record.userOverrode) cb(win, policy);
        }
    }

    // Restores every window to its original decoration state and clears the registry.
    disableAll() {
        for (const [win, record] of this._map) {
            win.set_decorated(record.originalDecorated);
            for (const { obj, id } of record.signalHandles) obj.disconnect(id);
        }
        this._map.clear();
    }

    forEach(cb) {
        for (const [win, record] of this._map) cb(win, record);
    }

    get size() {
        return this._map.size;
    }
}
