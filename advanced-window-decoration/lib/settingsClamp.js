// SPDX-FileCopyrightText: 2026 korbajan
//
// SPDX-License-Identifier: GPL-2.0-or-later

const THICKNESS_MIN = 0;
const THICKNESS_MAX = 32;

// Regex: rgba(r,g,b,a) — tolerates optional spaces, integer or float components.
const RGBA_RE =
    /^rgba\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\)$/;

export function clampThickness(n) {
    return Math.min(THICKNESS_MAX, Math.max(THICKNESS_MIN, Math.floor(n)));
}

export function parseRgba(str, fallback) {
    if (!str) return fallback;
    const m = RGBA_RE.exec(str);
    if (!m) return fallback;
    const r = parseFloat(m[1]) / 255;
    const g = parseFloat(m[2]) / 255;
    const b = parseFloat(m[3]) / 255;
    const a = parseFloat(m[4]);
    if (r < 0 || r > 1 || g < 0 || g > 1 || b < 0 || b > 1 || a < 0 || a > 1) return fallback;
    return { r, g, b, a };
}

export function formatRgba(rgba) {
    const r = Math.round(rgba.r * 255);
    const g = Math.round(rgba.g * 255);
    const b = Math.round(rgba.b * 255);
    const a = rgba.a.toFixed(2);
    return `rgba(${r},${g},${b},${a})`;
}
