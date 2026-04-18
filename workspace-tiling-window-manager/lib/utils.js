// SPDX-FileCopyrightText: 2026 korbajan
//
// SPDX-License-Identifier: GPL-2.0-or-later

/**
 * Apply an array of TileRects by moving/resizing each window.
 * Unmaximizes first so move_resize_frame is not ignored by the compositor.
 * @param {import('./layoutProvider.js').TileRect[]} rects
 */
export function applyRects(rects) {
    for (const { window, x, y, width, height } of rects) {
        if (window.maximized_horizontally || window.maximized_vertically) window.unmaximize();
        window.move_resize_frame(false, x, y, width, height);
    }
}
