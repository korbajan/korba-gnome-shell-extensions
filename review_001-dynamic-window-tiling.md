# Code Review: 001-dynamic-window-tiling

**Status**: Approved with Recommendations
**Reviewer**: Senior JS/TS Engineer (Gemini CLI)
**Date**: 2026-04-16

## Executive Summary
The implementation is technically sound, follows the architectural design of a `LayoutProvider` interface, and meets the core requirements of the specification. The use of modern GJS (ES Modules) and GNOME Shell 50 platform features is correct, and the unit test coverage for the tiling logic is excellent.

## 1. Specification Compliance Summary

| Requirement | Status | Verification |
| :--- | :--- | :--- |
| **FR-001–004** (Lifecycle) | **Compliant** | Managed in `WorkspaceTiler` via `window-created`/`removed`. |
| **FR-005** (Layout Interface) | **Compliant** | `LayoutProvider` abstract base class used. |
| **FR-006–007** (Focus/Move) | **Compliant** | Implemented in `DwindleLayout` using geometry-based detection. |
| **FR-008** (Resize) | **Compliant** | Implemented in `DwindleLayout.resizeTile` via `splitRatio`. |
| **FR-009–010** (Floating) | **Compliant** | Implemented in `WorkspaceTiler` with GSettings integration. |
| **FR-011–013** (Prefs/GSettings) | **Compliant** | Adw-based `prefs.js` covers all specified keys. |
| **FR-014** (Fullscreen) | **Compliant** | `_connectFullscreen` handles re-insertion after fullscreen. |
| **FR-015–017** (Edge cases) | **Compliant** | Min-size check and stale index cleanup implemented. |
| **FR-018** (Debug) | **Compliant** | Gated `console.log` present in all major components. |

## 2. Technical Strengths

*   **Robust Unit Tests**: 33 passing specs in `dwindleLayout.test.js` provide high confidence in the tiling math.
*   **Modern GJS Architecture**: Uses ES modules and GNOME Shell 50 platform features correctly.
*   **Separation of Concerns**: `TilingManager` coordinates globally, while `WorkspaceTiler` isolates per-workspace logic.

## 3. Identified Issues & Recommended Improvements

### P1 — Memory Leak in `WorkspaceTiler`
In `WorkspaceTiler.js`, per-window signals (like `notify::fullscreen`) are added to `this._signalIds` but never removed when the window is closed. 
*   **Impact**: `this._signalIds` grows linearly with the number of windows opened since the extension started.
*   **Fix**: Store per-window signals in a separate `Map<Window, number[]>` and disconnect them in the `window-removed` handler.

### P2 — Robustness in Dynamic Environments
`TilingManager.js` does not react to `notify::n-workspaces` on `global.workspace_manager` or `monitors-changed` on `global.display`.
*   **Impact**: Tiling may not activate on newly created workspaces or newly connected monitors until the user toggles a setting in the preferences.
*   **Fix**: Connect to these signals in `TilingManager.enable()` and trigger `_syncTilers()`.

### P3 — Redundant Signal Connections
Each `WorkspaceTiler` connects to `global.display`'s `window-created` signal.
*   **Impact**: Redundant signal dispatching (10+ connections for 10 active tilers).
*   **Fix**: Centralize `window-created` in `TilingManager` and delegate to the relevant tiler based on the window's workspace and monitor.

### P3 — Inconsistent `applyRects`
`TilingManager.js` and `workspaceTiler.js` define duplicate `applyRects` functions with different logic (one unmaximizes, the other doesn't).
*   **Fix**: Move `applyRects` to a shared `lib/utils.js` that always ensures windows are unmaximized before resizing.

---
*Review concluded.*
