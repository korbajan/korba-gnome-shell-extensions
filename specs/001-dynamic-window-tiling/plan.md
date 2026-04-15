# Implementation Plan: Dynamic Window Tiling (Dwindle)

**Branch**: `001-dynamic-window-tiling` | **Date**: 2026-04-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/001-dynamic-window-tiling/spec.md`

## Summary

Build a GNOME Shell 50+ extension that enables per-workspace dynamic window tiling using
the Dwindle (spiral/Fibonacci) layout. Tiling is configured from the extension preferences
panel, not a runtime keyboard shortcut. The Dwindle layout engine is implemented behind
an extensible `LayoutProvider` interface so future layouts can be added without touching
the core infrastructure. All keyboard shortcuts for focus navigation, window movement,
resize, and float-toggle are fully rebindable.

The extension follows patterns from `spatial-window-navigator` (existing extension in this
repo) for ES module structure, GSettings integration, keybinding registration, the custom
`KeybindingRow` preferences widget, and focus control (`window.activate()` + `global.display.focus_window`).

Clarifications resolved post-spec: focus is controlled via `window.activate()`; move-window
uses geometry-based neighbour detection (encapsulated in `LayoutProvider` for future
tree-based replacement); `moveWindow` swaps window references only — rects and split ratios
are stable; stale workspace indices are silently ignored at runtime and auto-cleaned when
the preferences panel opens; debug output is gated behind a `debug-logging` GSettings flag.

## Technical Context

**Language/Version**: GJS (ES Modules, GNOME Shell 50's SpiderMonkey/ES2022)
**Primary Dependencies**: GNOME Shell 50 platform — Meta, Shell, St, Clutter, GLib, Gio,
  GObject, Adw (Adwaita), Gtk 4
**Storage**: GSettings (`org.gnome.shell.extensions.workspace-tiling-window-manager`) via `this.getSettings()`
**Testing**: ESLint + Prettier (static); Node.js + Jasmine for pure lib/ unit tests;
  manual smoke tests in a nested Wayland GNOME Shell session
**Target Platform**: GNOME Shell 50+, Wayland, Linux
**Project Type**: GNOME Shell extension (desktop-app extension)
**Performance Goals**: `enable()` < 50ms; window placement < 300ms; focus nav < 100ms;
  idle CPU < 0.5%; memory < 8MB
**Constraints**: Single-threaded compositor — no blocking I/O; all window signals handled
  async; `disable()` must disconnect every signal and null all references
**Scale/Scope**: Single-user desktop extension; N workspaces × M monitors; ~500–1000 LOC

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. GNOME Shell Extension Patterns | ✅ PASS | `extension.js` with `enable()`/`disable()`, `metadata.json.in`, correct namespace `org.gnome.shell.extensions.workspace-tiling-window-manager`, Adwaita prefs, `gi://` + `resource://` imports |
| II. Code Quality Standards | ✅ PASS | ESLint + Prettier in CI; `const`/`let` only; GObject subclassing only where required; no dead code policy |
| III. Test-First Development | ✅ PASS | `DwindleTree` and `LayoutProvider` are pure JS — unit-testable with Node/Jasmine; lifecycle integration tests via nested shell |
| IV. User Experience Consistency | ✅ PASS | `Adw.PreferencesWindow` with pages/groups; all strings in `_()`; keyboard-accessible controls; `KeybindingRow` from spatial-window-navigator |
| V. Performance Requirements | ✅ PASS | `enable()` < 50ms target; `first-frame` signal avoids race; async `get_work_area_for_monitor`; all signal handlers O(n) max where n = window count |
| VI. Extension Lifecycle & Compatibility | ✅ PASS | min GNOME Shell 50 in `metadata.json`; `disable()` disconnects all signals; `version` integer in metadata; shared `KeybindingRow` extracted to `lib/` |
| VII. Simplicity & YAGNI | ✅ PASS | One layout (Dwindle) in v1; no speculative features; no npm deps; `LayoutProvider` interface adds necessary future-extensibility, not gold-plating |

**Constitution Check result: ALL PASS — Phase 0 research approved.**

## Project Structure

### Documentation (this feature)

```text
specs/001-dynamic-window-tiling/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── layout-provider.md   # LayoutProvider interface contract
│   └── gsettings-schema.md  # GSettings schema contract
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
workspace-tiling-window-manager/
├── extension.js                                         # Extension entry point
├── prefs.js                                             # Preferences UI
├── metadata.json.in                                     # Meson-templated metadata
├── org.gnome.shell.extensions.workspace-tiling-window-manager.gschema.xml # GSettings schema
├── meson.build                                          # Extension build rules
└── lib/
    ├── layoutProvider.js    # Abstract LayoutProvider base class + LayoutRegistry
    ├── dwindleLayout.js     # DwindleLayout: implements LayoutProvider (Dwindle algo)
    ├── tilingManager.js     # TilingManager: top-level coordinator
    ├── workspaceTiler.js    # WorkspaceTiler: manages one (workspace, monitor) pair
    └── keybindingRow.js     # Reusable KeybindingRow + KeyCaptureWindow (from spatial-window-navigator)

# Root build file — add 'workspace-tiling-window-manager' to the extensions list
meson.build                  # Add 'workspace-tiling-window-manager' to extensions array
```

**Structure Decision**: Single extension directory following the `spatial-window-navigator`
pattern. Pure-logic modules live in `lib/` for testability without the GNOME Shell runtime.
The `keybindingRow.js` widget is extracted from `spatial-window-navigator/prefs.js` to
`lib/` to be reusable across extensions in this repo (FR-005 extensibility, Principle VII).

## Complexity Tracking

> No constitution violations to justify. All complexity is required by the feature scope.

| Decision | Why Needed |
|---|---|
| `LayoutProvider` interface | FR-005: future layouts without modifying core; also encapsulates geometry-based neighbour detection (FR-007) for future tree-based replacement |
| `WorkspaceTiler` per (ws, monitor) | Multi-monitor isolation; each tiling unit is independent |
| `first-frame` signal delay | Wayland race: window geometry not stable until first frame rendered |
| Geometry-based neighbour detection | FR-006/007: consistent with `spatial-window-navigator`; simpler than tree-walk for v1 |

## Phase 0: Research Findings

All decisions recorded in `research.md`. Summary:

1. **ES Modules**: `gi://` + `resource://` URI schemes; `export default class extends Extension`.
2. **Window APIs**: `global.display` for `window-created`; `workspace.list_windows()` filtered
   by `!w.skip_taskbar && type === NORMAL && !transient_for`; `get_frame_rect()` /
   `move_resize_frame(false, x, y, w, h)`; `workspace.get_work_area_for_monitor(n)` for
   usable area.
3. **Focus control**: `window.activate(global.get_current_time())` to raise and focus the
   target tile; `global.display.focus_window` as authoritative current-focus source.
   Consistent with `spatial-window-navigator` (clarification Q1).
4. **Move-window neighbour detection**: Geometry-based centre-point distance in requested
   direction (same algorithm as `spatial-window-navigator._focusDirection`). When swapping,
   only window references in leaf nodes are exchanged — rects and split ratios stay fixed
   (clarifications Q2, Q4). Algorithm encapsulated in `LayoutProvider.getNeighbour()` /
   `moveWindow()` for future tree-based replacement.
5. **Keybindings**: `Main.wm.addKeybinding(key, settings, NONE, NORMAL, cb)` and
   `removeKeybinding(key)`; GSettings keys of type `as`.
6. **GSettings**: `this.getSettings()` in `enable()`; schema
   `org.gnome.shell.extensions.workspace-tiling-window-manager`; path
   `/org/gnome/shell/extensions/workspace-tiling-window-manager/`; includes `debug-logging` boolean key
   (default `false`) gating all `console.log`/`console.warn` output (clarification Q5).
7. **Stale workspace indices**: Silently ignored at runtime; auto-removed from
   `tiling-enabled-workspaces` when the preferences panel opens (clarification Q3).
8. **Prefs**: `ExtensionPreferences` + `fillPreferencesWindow()`; custom `KeybindingRow`
   (no Adw built-in); reuse from `spatial-window-navigator/prefs.js`; stale index cleanup
   runs in `fillPreferencesWindow()` before rendering the Workspaces page.
9. **Workspace tracking**: `global.workspace_manager`; `get_work_area_for_monitor` for
   tiles; filter by `window.get_monitor()` for multi-monitor isolation.
10. **Dwindle algorithm**: Binary split-tree with alternating perpendicular axis splits;
    `lastLeaf` always split for next window; sibling promotion on removal.
11. **Build**: Meson, follows existing project; add `'workspace-tiling-window-manager'` to root `meson.build`.

## Phase 1: Design Artifacts

All Phase 1 artifacts are complete:

- `data-model.md` — `TileNode`, `SplitContainer`, `TileLeaf`, `DwindleTree`,
  `WorkspaceTiler`, `TilingManager`, GSettings keys, state transitions.
- `contracts/layout-provider.md` — Full `LayoutProvider` JS interface + `LayoutRegistry`
  + `TileRect` typedef + compliance requirements.
- `contracts/gsettings-schema.md` — Complete XML schema + access patterns +
  validation rules.
- `quickstart.md` — Build/install/develop/lint/test workflow.

## Post-Design Constitution Check

| Principle | Status |
|---|---|
| I. GNOME Shell Extension Patterns | ✅ Structure confirmed in project layout |
| II. Code Quality | ✅ ESLint + Prettier wired into build |
| III. Test-First | ✅ `lib/` pure-JS modules are independently unit-testable |
| IV. UX Consistency | ✅ Four `Adw.PreferencesPage` sections with full a11y |
| V. Performance | ✅ `first-frame` race guard; O(n) reflow; `get_work_area_for_monitor`; debug logging zero-cost when `debug-logging=false` |
| VI. Lifecycle | ✅ `disable()` documented to disconnect all in data-model |
| VII. Simplicity | ✅ Single layout, shared widget in `lib/`, no speculative code |
