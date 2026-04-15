---
description: "Task list for Dynamic Window Tiling (Dwindle)"
---

# Tasks: Dynamic Window Tiling (Dwindle)

**Input**: Design documents from `specs/001-dynamic-window-tiling/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Tests**: Unit tests added in Phase 2.5 (T056–T058) per Constitution Principle III.

**Organization**: Tasks are grouped by user story to enable independent implementation
and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US6)
- Include exact file paths in all descriptions

## Path Conventions

```text
workspace-tiling-window-manager/
├── extension.js
├── prefs.js
├── metadata.json.in
├── org.gnome.shell.extensions.workspace-tiling-window-manager.gschema.xml
├── meson.build
└── lib/
    ├── layoutProvider.js
    ├── dwindleLayout.js
    ├── tilingManager.js
    ├── workspaceTiler.js
    └── keybindingRow.js
meson.build  (root — add workspace-tiling-window-manager entry)
```

---

## Phase 1: Setup

**Purpose**: Create the extension skeleton so all subsequent phases have a valid build target.

- [ ] T001 Create `workspace-tiling-window-manager/` directory with `lib/` subdirectory at repository root
- [ ] T002 [P] Create `workspace-tiling-window-manager/metadata.json.in` modelled on `spatial-window-navigator/metadata.json.in` with `extension-id = "workspace-tiling-window-manager"`, `name = "Workspace Tiling Window Manager"`, and `shell-version = ["@shell_current@"]`
- [ ] T003 [P] Create `workspace-tiling-window-manager/meson.build` modelled on `spatial-window-navigator/meson.build` with `e = 'workspace-tiling-window-manager'`, schema install, and `extension.js prefs.js` install targets
- [ ] T004 Add `'workspace-tiling-window-manager'` to the `extensions` array in root `meson.build` (after `'spatial-window-navigator'`)
- [ ] T005 [P] Create `workspace-tiling-window-manager/org.gnome.shell.extensions.workspace-tiling-window-manager.gschema.xml` with the complete schema from `contracts/gsettings-schema.md` (all keys: tiling-enabled-workspaces, gap-size, initial-split-axis, split-ratio, min-tile-size, float-window-classes, debug-logging, all 11 keybind keys)

**Checkpoint**: `meson setup build && meson compile -C build` succeeds — extension installs and schema compiles without errors.

---

## Phase 2: Foundational

**Purpose**: Core infrastructure that MUST be complete before any user story can be implemented.

⚠️ **CRITICAL**: No user story work begins until this phase is complete.

- [ ] T006 Implement `workspace-tiling-window-manager/lib/layoutProvider.js`: export abstract `LayoutProvider` class with all methods from `contracts/layout-provider.md` (init, updateWorkArea, addWindow, removeWindow, getNeighbour, moveWindow, resizeTile, reflow, hasWindow, getManagedWindows, destroy, id getter — each throws `Error('not implemented')`); export `LayoutRegistry` Map and `registerLayout(id, factory)` / `createLayout(id)` functions
- [ ] T007 [P] Extract `KeyCaptureWindow` and `KeybindingRow` classes from `spatial-window-navigator/prefs.js` lines 12–138 into `workspace-tiling-window-manager/lib/keybindingRow.js` and adapt as named exports; update `gi://` and `resource://` imports to be self-contained
- [ ] T008 [P] Create `workspace-tiling-window-manager/lib/workspaceTiler.js`: export `WorkspaceTiler` class with constructor `(workspaceIndex, monitorIndex, layout, settings)`, fields `floatingWindows` (Set), `savedRects` (Map), `_signalIds` (Array), and stub `enable()`, `disable()`, `destroy()` methods that do nothing yet
- [ ] T009 [P] Create `workspace-tiling-window-manager/lib/tilingManager.js`: export `TilingManager` class with constructor `(settings)`, fields `_tilers` (Map keyed `"wsIdx:monIdx"`), `_signalIds` (Array), and stub `enable()` / `disable()` methods
- [ ] T010 Create `workspace-tiling-window-manager/extension.js`: import `Extension` from `resource:///org/gnome/shell/extensions/extension.js`; import `TilingManager` from `./lib/tilingManager.js`; import `registerLayout` from `./lib/layoutProvider.js`; import `DwindleLayout` from `./lib/dwindleLayout.js`; export default class calling `registerLayout('dwindle', () => new DwindleLayout())` then `this._manager = new TilingManager(this.getSettings())` and `this._manager.enable()` in `enable()`; call `this._manager.disable()` and `this._manager = null` in `disable()`

**Checkpoint**: Extension loads without errors in nested GNOME Shell — `gnome-extensions enable workspace-tiling-window-manager@korbajan.github.com` produces no journal errors.

---

## Phase 2.5: Unit Tests (Constitution III — Test-First)

**Purpose**: Pure-JS unit tests for `DwindleLayout` and `WorkspaceTiler` that MUST be written
(Red phase) before Phase 3 implementation code is finalised (Green phase).

⚠️ **Constitution III MUST**: Tests must exist and fail before implementation is written.

- [ ] T056a Create `workspace-tiling-window-manager/package.json` with `jasmine` as a dev-dependency and a `"test": "jasmine"` script; create `workspace-tiling-window-manager/spec/support/jasmine.json` configuring `spec_dir: "lib"` and `spec_files: ["**/*.test.js"]`; verify `npm test` exits 0 with zero specs (empty run)
- [ ] T056 Create `workspace-tiling-window-manager/lib/dwindleLayout.test.js` with Node/Jasmine unit tests for `DwindleLayout`: verify `addWindow()` tree structure (1, 2, 3, 4 windows), `removeWindow()` sibling promotion, `reflow()` returns correct rect dimensions summing to work area, and `_computeChildRects()` zero-gap and non-zero-gap cases
- [ ] T057 [P] Add unit tests in `workspace-tiling-window-manager/lib/dwindleLayout.test.js` for `DwindleLayout.getNeighbour()` (returns correct window for each direction) and `moveWindow()` swap semantics (only `window` refs exchanged, rects unchanged, `_leaves` map updated)
- [ ] T058 [P] Add unit tests in `workspace-tiling-window-manager/lib/dwindleLayout.test.js` for `DwindleLayout.resizeTile()`: ratio grows/shrinks by delta, clamps at 0.1/0.9, applies only to immediate parent boundary, returns TileRects for affected subtree only

**Checkpoint**: `npm test` runs all three test suites and all pass (Green). Coverage must not decrease on subsequent commits (Constitution III).

---

## Phase 3: User Stories 1 & 2 — Enable Tiling + Dwindle Layout (Priority: P1) 🎯 MVP

**Goal**: Windows on a tiling-enabled workspace are automatically arranged in the Dwindle
spiral. Enabling/disabling from the preferences panel works. Layout reflows on open/close.

**Independent Test**: Enable tiling for Workspace 1 in preferences. Open 4 application
windows sequentially and verify the Dwindle arrangement: window 1 fills the left half,
window 2 takes the top-right quarter, window 3 takes the bottom-right eighth, window 4
splits further. Close one window and verify reflow. Disable tiling and verify all windows
return to their original positions and sizes.

### Implementation for User Stories 1 & 2

- [ ] T011 [P] [US1] Implement `TileLeaf` and `SplitContainer` classes in `workspace-tiling-window-manager/lib/dwindleLayout.js`: `TileLeaf` has fields `window`, `rect`, `parent`; `SplitContainer` has fields `direction` (`'horizontal'|'vertical'`), `first`, `second`, `splitRatio` (default 0.5, clamped [0.1, 0.9]), `rect`, `parent`
- [ ] T012 [US1] [US2] Implement `DwindleLayout` class skeleton in `workspace-tiling-window-manager/lib/dwindleLayout.js` extending `LayoutProvider`: fields `_root` (null), `_workArea`, `_leaves` (Map), `_lastLeaf` (null), `_initialAxis`, `_gapSize`; implement `init(settings, workArea)` reading `initial-split-axis` and `gap-size` from settings; implement `get id()` returning `'dwindle'`; implement `hasWindow(window)` and `getManagedWindows()` via `_leaves`; implement `destroy()` clearing all fields
- [ ] T013 [US2] Implement `DwindleLayout._computeChildRects(container)` in `workspace-tiling-window-manager/lib/dwindleLayout.js`: compute `first.rect` and `second.rect` from `container.rect`, `direction`, and `splitRatio`; apply `_gapSize` half-gaps between tiles and between tiles and work-area boundary
- [ ] T014 [US2] Implement `DwindleLayout._reflowSubtree(node, rect)` in `workspace-tiling-window-manager/lib/dwindleLayout.js`: recursively assign rects top-down; collect and return `TileRect[]` ({window, x, y, width, height}) for all leaves
- [ ] T015 [US2] Implement `DwindleLayout.reflow()` in `workspace-tiling-window-manager/lib/dwindleLayout.js`: apply outer gap to `_workArea` to get root rect; call `_reflowSubtree` from root; return full `TileRect[]`
- [ ] T016 [US1] [US2] Implement `DwindleLayout.addWindow(window)` in `workspace-tiling-window-manager/lib/dwindleLayout.js`: if tree empty create single `TileLeaf` as root; otherwise wrap `_lastLeaf` and new leaf in a `SplitContainer` whose `direction` alternates perpendicular to the parent direction (first split uses `_initialAxis`); update `_lastLeaf`; call `reflow()` and return `TileRect[]`
- [ ] T017 [US1] Implement `DwindleLayout.removeWindow(window)` in `workspace-tiling-window-manager/lib/dwindleLayout.js`: find leaf in `_leaves`; if root clear tree; otherwise promote sibling to replace parent container in the tree; update `_lastLeaf` to the previous leaf in insertion order; call `reflow()` and return `TileRect[]`; remove leaf from `_leaves`
- [ ] T018 [US1] Implement `DwindleLayout.updateWorkArea(workArea)` in `workspace-tiling-window-manager/lib/dwindleLayout.js`: update `_workArea`; return `reflow()`
- [ ] T019 [US1] Implement `shouldTile(window)` helper in `workspace-tiling-window-manager/lib/workspaceTiler.js`: returns `window.get_window_type() === Meta.WindowType.NORMAL && !window.get_transient_for() && !window.skip_taskbar`
- [ ] T020 [US1] Implement `WorkspaceTiler.enable()` initial collection in `workspace-tiling-window-manager/lib/workspaceTiler.js`: get workspace via `global.workspace_manager.get_workspace_by_index(workspaceIndex)`; get `workArea = workspace.get_work_area_for_monitor(monitorIndex)`; call `this.layout.init(settings, workArea)`; collect existing windows via `workspace.list_windows()` filtered by monitor and `shouldTile()`; save each window's `get_frame_rect()` in `savedRects`; for each window call `layout.addWindow(window)` and apply returned `TileRect[]` via `window.move_resize_frame(false, x, y, w, h)`
- [ ] T021 [US1] Implement `window-created` signal handler in `WorkspaceTiler.enable()` in `workspace-tiling-window-manager/lib/workspaceTiler.js`: connect to `global.display`'s `window-created`; for windows on this workspace+monitor passing `shouldTile()` and not in `floatingWindows`, use `first-frame` guard (connect `window.get_compositor_private()` `first-frame`, disconnect after firing) before calling `layout.addWindow()` and applying `TileRect[]`; store signal ID in `_signalIds`
- [ ] T022 [US1] Implement `window-removed` signal handler in `WorkspaceTiler.enable()` in `workspace-tiling-window-manager/lib/workspaceTiler.js`: connect to the `Meta.Workspace`'s `window-removed` signal; if window is managed by layout call `layout.removeWindow(window)` and apply returned `TileRect[]`; store signal ID in `_signalIds`
- [ ] T023 [US1] Implement `WorkspaceTiler._connectFullscreen(window)` helper in `workspace-tiling-window-manager/lib/workspaceTiler.js`: connect `fullscreen-changed` on the window; on fullscreen=true call `layout.removeWindow()` and apply reflow; on fullscreen=false call `layout.addWindow()` with `first-frame` guard and apply reflow; store signal ID in `_signalIds`. Call this helper from `enable()` for each existing tiled window AND from the `window-created` `first-frame` callback for every newly tiled window (FR-014 applies to all windows, not just those present at enable-time)
- [ ] T024 [US1] Implement `WorkspaceTiler.disable()` in `workspace-tiling-window-manager/lib/workspaceTiler.js`: disconnect all IDs in `_signalIds`; restore each window in `savedRects` via `window.move_resize_frame(false, ...)`; call `this.layout.destroy()`; clear `_signalIds`, `savedRects`, `floatingWindows`
- [ ] T025 [US1] Implement `TilingManager.enable()` in `workspace-tiling-window-manager/lib/tilingManager.js`: read `tiling-enabled-workspaces` from settings; filter to valid workspace indices (0 to `global.workspace_manager.get_n_workspaces()-1`); for each valid index and each monitor (0 to `global.display.get_n_monitors()-1`) create a `WorkspaceTiler` with `createLayout('dwindle')`, store in `_tilers` keyed `"wsIdx:monIdx"`, call `tiler.enable()`; connect `settings.changed::tiling-enabled-workspaces` to `_syncTilers()`; store signal ID in `_signalIds`
- [ ] T026 [US1] Implement `TilingManager._syncTilers()` in `workspace-tiling-window-manager/lib/tilingManager.js`: diff current `tiling-enabled-workspaces` setting against active `_tilers` map; call `tiler.disable()` and delete for removed workspaces; create and `enable()` new tilers for added workspaces
- [ ] T027 [US1] Implement `TilingManager.disable()` in `workspace-tiling-window-manager/lib/tilingManager.js`: disconnect all `_signalIds`; for every entry in `_tilers` call `tiler.disable()` and clear the map

**Checkpoint**: Enable tiling in preferences, open 4 windows, verify Dwindle spiral. Close a window and verify reflow. Disable tiling and verify restore. This is a complete MVP.

---

## Phase 4: User Story 3 — Navigate and Move Windows (Priority: P2)

**Goal**: Keyboard focus moves between tiles; windows swap positions via keyboard shortcuts.

**Independent Test**: With 3 tiled windows, press `Super+h/j/k/l` to navigate focus through
all three. Press `Super+Shift+h` on the rightmost window and verify it swaps with the left
neighbour — screen regions unchanged, window contents exchanged.

### Implementation for User Story 3

- [ ] T028 [P] [US3] Implement `DwindleLayout.getNeighbour(fromWindow, direction)` in `workspace-tiling-window-manager/lib/dwindleLayout.js`: get `fromWindow.get_frame_rect()` centre point `(fcx, fcy)`; iterate all leaves except `fromWindow`; filter to windows whose centre is in the requested direction (`dx < 0` for left, `dx > 0` for right, `dy < 0` for up, `dy > 0` for down); score each by `primary + cross * 0.3` (primary = on-axis distance, cross = off-axis distance) — same algorithm as `spatial-window-navigator._focusDirection`; return window with lowest score or `null`
- [ ] T029 [P] [US3] Implement `DwindleLayout.moveWindow(window, direction)` in `workspace-tiling-window-manager/lib/dwindleLayout.js`: find neighbour via `getNeighbour(window, direction)`; if null return `[]`; get the two `TileLeaf` nodes from `_leaves`; swap their `window` fields; update `_leaves` map entries for both windows; return `TileRect[]` for both affected windows only (rects and splitRatios are unchanged)
- [ ] T030 [US3] Implement `TilingManager._focusDirection(direction)` in `workspace-tiling-window-manager/lib/tilingManager.js`: get `focused = global.display.focus_window`; if none return; find tiler for focused window's workspace+monitor via `focused.get_workspace().index()` and `focused.get_monitor()`; call `tiler.layout.getNeighbour(focused, direction)`; if result call `result.activate(global.get_current_time())`
- [ ] T031 [US3] Implement `TilingManager._moveWindowDirection(direction)` in `workspace-tiling-window-manager/lib/tilingManager.js`: get `focused = global.display.focus_window`; find tiler; call `tiler.layout.moveWindow(focused, direction)`; apply returned `TileRect[]` via `window.move_resize_frame(false, x, y, w, h)` for each entry
- [ ] T032 [US3] Register focus keybindings in `workspace-tiling-window-manager/extension.js` `enable()`: call `Main.wm.addKeybinding` for `keybind-focus-left`, `keybind-focus-right`, `keybind-focus-up`, `keybind-focus-down` each with `Meta.KeyBindingFlags.NONE`, `Shell.ActionMode.NORMAL`, and corresponding `() => this._manager._focusDirection(dir)` callback; add `import Shell from 'gi://Shell'` and `import * as Main from 'resource:///org/gnome/shell/ui/main.js'`
- [ ] T033 [US3] Register move-window keybindings in `workspace-tiling-window-manager/extension.js` `enable()`: call `Main.wm.addKeybinding` for `keybind-move-left`, `keybind-move-right`, `keybind-move-up`, `keybind-move-down` each calling `() => this._manager._moveWindowDirection(dir)`
- [ ] T034 [US3] Unregister all focus and move keybindings in `workspace-tiling-window-manager/extension.js` `disable()`: call `Main.wm.removeKeybinding` for all 8 keys (`keybind-focus-*` and `keybind-move-*`)

**Checkpoint**: User Stories 1–3 all work independently. Focus nav and window swap both function correctly on a tiled workspace.

---

## Phase 5: User Story 4 — Resize Tile Splits (Priority: P3)

**Goal**: Focused tile grows or shrinks relative to its sibling by 5% per keypress.

**Independent Test**: With 2 side-by-side tiles, press `Super+Ctrl+l` five times and verify
the focused tile is approximately 75% wide. Press `Super+Ctrl+h` five times and verify
return to ~50%. Verify no tile exceeds 90% or falls below 10% width.

### Implementation for User Story 4

- [ ] T035 [US4] Implement `DwindleLayout.resizeTile(window, direction, delta)` in `workspace-tiling-window-manager/lib/dwindleLayout.js`: find leaf for `window` in `_leaves`; get its `parent` `SplitContainer`; if `window` is `first` child: `grow` increases `splitRatio`, `shrink` decreases it; if `second` child: invert; clamp `splitRatio` to `[0.1, 0.9]`; call `_reflowSubtree` from the container down; return `TileRect[]` for all leaves in the affected subtree
- [ ] T036 [US4] Implement `TilingManager._resizeTile(direction)` in `workspace-tiling-window-manager/lib/tilingManager.js`: get `focused = global.display.focus_window`; find tiler; call `tiler.layout.resizeTile(focused, direction, 0.05)`; apply returned `TileRect[]`
- [ ] T037 [US4] Register resize keybindings in `workspace-tiling-window-manager/extension.js` `enable()`: `Main.wm.addKeybinding` for `keybind-resize-shrink` calling `() => this._manager._resizeTile('shrink')` and `keybind-resize-grow` calling `() => this._manager._resizeTile('grow')`
- [ ] T038 [US4] Unregister resize keybindings in `workspace-tiling-window-manager/extension.js` `disable()`: call `Main.wm.removeKeybinding` for `keybind-resize-shrink` and `keybind-resize-grow`

**Checkpoint**: User Stories 1–4 all work independently.

---

## Phase 6: User Story 5 — Float / Sink Individual Windows (Priority: P3)

**Goal**: Toggle floating on any window; window-class rules and min-tile-size auto-float
matching windows.

**Independent Test**: Tile 3 windows. Press `Super+Shift+Space` on the middle window;
verify it detaches to the screen centre and moves freely. Press again; verify it rejoins
the tile layout. Open `gnome-calculator`; with `org.gnome.Calculator` in float rules,
verify it appears floating automatically.

### Implementation for User Story 5

- [ ] T039 [US5] Implement `WorkspaceTiler.floatWindow(window)` in `workspace-tiling-window-manager/lib/workspaceTiler.js`: if `layout.hasWindow(window)` call `layout.removeWindow(window)` and apply reflow; add window to `floatingWindows`; move window to centre of work area via `window.move_resize_frame(false, centreX, centreY, w, h)`
- [ ] T040 [US5] Implement `WorkspaceTiler.sinkWindow(window)` in `workspace-tiling-window-manager/lib/workspaceTiler.js`: remove from `floatingWindows`; call `layout.addWindow(window)` with `first-frame` guard; apply returned `TileRect[]`
- [ ] T041 [US5] Implement `TilingManager._toggleFloat()` in `workspace-tiling-window-manager/lib/tilingManager.js`: get `focused = global.display.focus_window`; find tiler; if `tiler.floatingWindows.has(focused)` call `tiler.sinkWindow(focused)`, otherwise call `tiler.floatWindow(focused)`
- [ ] T042 [US5] Add window-class auto-float check to the `window-created` handler in `workspace-tiling-window-manager/lib/workspaceTiler.js`: inside the `first-frame` callback, before calling `layout.addWindow()`, check `settings.get_strv('float-window-classes').includes(window.get_wm_class())`; if true call `this.floatWindow(window)` instead
- [ ] T043 [US5] Add min-tile-size auto-float check to the `window-created` handler in `workspace-tiling-window-manager/lib/workspaceTiler.js`: inside the `first-frame` callback, after the class check, get `window.get_frame_rect()`; if `rect.width < minTileSize || rect.height < minTileSize` call `this.floatWindow(window)` instead of tiling
- [ ] T044 [US5] Register toggle-float keybinding in `workspace-tiling-window-manager/extension.js` `enable()`: `Main.wm.addKeybinding` for `keybind-toggle-float` calling `() => this._manager._toggleFloat()`
- [ ] T045 [US5] Unregister toggle-float keybinding in `workspace-tiling-window-manager/extension.js` `disable()`: call `Main.wm.removeKeybinding('keybind-toggle-float')`

**Checkpoint**: User Stories 1–5 all work independently.

---

## Phase 7: User Story 6 — Preferences UI (Priority: P4)

**Goal**: Full preferences panel with workspace toggles, keyboard shortcuts, appearance
settings, and floating-window class rules. Stale workspace indices auto-cleaned on open.

**Independent Test**: Open preferences. Toggle Workspace 2 on and off; verify tiling
activates/deactivates immediately without shell restart. Change `keybind-focus-left` to
`Super+Left`; close preferences; verify the new binding works. Set gap to 8px; verify all
active tile layouts update. Add `org.gnome.Calculator` to float rules; open Calculator and
verify it floats.

### Implementation for User Story 6

- [ ] T046 [US6] Create `workspace-tiling-window-manager/prefs.js` scaffold: import `ExtensionPreferences` from `resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js`; import `Adw`, `Gtk`, `GLib`, `Gio` via `gi://`; import `{KeybindingRow}` from `./lib/keybindingRow.js`; export default class `WorkspaceTilingWindowManagerPreferences` extending `ExtensionPreferences` with stub `fillPreferencesWindow(window)` adding four empty `Adw.PreferencesPage` instances
- [ ] T047 [US6] Implement Workspaces page in `workspace-tiling-window-manager/prefs.js`: on `fillPreferencesWindow` call, read workspace count via `new Gio.Settings({schema_id: 'org.gnome.desktop.wm.preferences'}).get_int('num-workspaces')` (note: `global` is unavailable in the prefs process); remove stale indices (>= workspace count) from `tiling-enabled-workspaces` setting; for each workspace index (0-based) add an `Adw.SwitchRow` labelled `_('Workspace %d').format(i + 1)` with its active state bound to the corresponding index in the `tiling-enabled-workspaces` array, updating the full array on toggle
- [ ] T048 [P] [US6] Implement Keyboard Shortcuts page in `workspace-tiling-window-manager/prefs.js`: `Adw.PreferencesPage` titled `_('Keyboard Shortcuts')`; four `Adw.PreferencesGroup` sections — Focus (4 × `KeybindingRow` for `keybind-focus-left/right/up/down`), Move Window (4 × `KeybindingRow` for `keybind-move-left/right/up/down`), Resize (2 × `KeybindingRow` for `keybind-resize-shrink/grow`), Float (1 × `KeybindingRow` for `keybind-toggle-float`)
- [ ] T049 [P] [US6] Implement Appearance page in `workspace-tiling-window-manager/prefs.js`: `Adw.PreferencesPage` titled `_('Appearance')`; `Adw.SpinRow` for `gap-size` (range 0–100, step 1, bound to settings); `Adw.ComboRow` for `initial-split-axis` with model `['Horizontal', 'Vertical']` mapped to `'horizontal'/'vertical'`; `Adw.SpinRow` for `split-ratio` (range 0.1–0.9, step 0.05, digits 2); `Adw.SpinRow` for `min-tile-size` (range 0–500, step 10); `Adw.SwitchRow` for `debug-logging`
- [ ] T050 [P] [US6] Implement Floating Rules page in `workspace-tiling-window-manager/prefs.js`: `Adw.PreferencesPage` titled `_('Floating Rules')`; `Adw.PreferencesGroup` containing an `Adw.EntryRow` (placeholder: `_('e.g. org.gnome.Calculator')`) with an add button that appends the entered string to `float-window-classes` via `set_strv`; for each existing class entry add an `Adw.ActionRow` with a delete button that removes it from the array
- [ ] T051 [US6] Wire `gap-size` change to live reflow in `workspace-tiling-window-manager/lib/tilingManager.js`: in `enable()` connect `settings.changed::gap-size` signal; handler reads new gap, calls `tiler.layout.updateWorkArea(tiler.layout._workArea)` for each active tiler (which triggers `reflow()`) and applies all returned `TileRect[]`; store signal ID in `_signalIds`

**Checkpoint**: All 6 user stories work end-to-end as a complete feature.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Code quality, i18n, and final validation across all stories.

- [ ] T052 [P] Wrap all user-visible strings in `_()` gettext calls across `workspace-tiling-window-manager/prefs.js`; verify `gettext-domain` is set in `metadata.json.in` and matches `meson.project_name()`
- [ ] T053 [P] ESLint pass: run `npx eslint workspace-tiling-window-manager/` from repo root; fix all reported errors to zero
- [ ] T054 [P] Prettier pass: run `npx prettier --write "workspace-tiling-window-manager/**/*.js"` from repo root; confirm no diff after formatting
- [ ] T055 Run quickstart.md end-to-end validation: build, install to user dir, enable in nested GNOME Shell; open 4 windows on tiled workspace; verify Dwindle layout, focus nav (`Super+hjkl`), window move (`Super+Shift+hjkl`), resize (`Super+Ctrl+h/l`), float toggle (`Super+Shift+Space`), and preferences all function correctly
- [ ] T059 [P] Add debug-logging calls for "keybinding fired" events (FR-018): in `workspace-tiling-window-manager/extension.js` keybinding callbacks, add `if (this._settings.get_boolean('debug-logging')) console.log('[workspace-tiling-window-manager] keybinding fired:', keyName)` for each of the 11 registered keybindings
- [ ] T060 [P] Manual timing verification (SC-003, SC-007): document in PR smoke-test checklist — (a) measure focus-nav latency with `Super+h` across 4 tiles and confirm <100ms subjective response, (b) confirm no perceptible latency on a non-tiling workspace with extension enabled vs disabled (SC-007 baseline)
- [ ] T061 [P] Generate and commit i18n template: run `xgettext --from-code=UTF-8 -k_ workspace-tiling-window-manager/prefs.js workspace-tiling-window-manager/lib/keybindingRow.js -o workspace-tiling-window-manager/po/workspace-tiling-window-manager.pot` and commit the `.pot` file (Constitution Architecture Standards MUST)
- [ ] T062 [P] Audit prefs.js interactive controls for accessible names: ensure all `Adw.SpinRow`, `Adw.ComboRow`, `Adw.SwitchRow`, `Adw.EntryRow`, and `Gtk.Button` widgets have descriptive `title` or `tooltip_text` properties set so screen readers can identify them (Constitution Principle IV MUST)
- [ ] T063 [P] Add Meson packaging target: add a `meson dist` step or a helper script `scripts/package-extension.sh` that produces `workspace-tiling-window-manager@korbajan.github.com.zip` compatible with extensions.gnome.org submission (Constitution Architecture Standards MUST)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — blocks all user stories
- **Unit Tests (Phase 2.5)**: Depends on Phase 2 (needs DwindleLayout stub) — tests must be written (Red) before Phase 3 finalises (Green)
- **US1+US2 (Phase 3)**: Depends on Phase 2.5 tests existing — blocks all subsequent phases
- **US3 (Phase 4)**: Depends on Phase 3
- **US4 (Phase 5)**: Depends on Phase 3 — can run in parallel with Phase 4 and 6
- **US5 (Phase 6)**: Depends on Phase 3 — can run in parallel with Phase 4 and 5
- **US6 (Phase 7)**: Depends on Phases 3–6 all complete
- **Polish (Phase 8)**: Depends on all user story phases

### User Story Dependencies

- **US1+US2 (P1)**: No story dependencies — must be first
- **US3 (P2)**: Needs tile tree from US1+US2
- **US4 (P3)**: Needs `DwindleLayout` and `WorkspaceTiler` from US1+US2; parallel with US5
- **US5 (P3)**: Needs `WorkspaceTiler` from US1+US2; parallel with US4
- **US6 (P4)**: All stories must be complete before preferences wires everything together

### Within Each Story

- Data structures (`TileLeaf`, `SplitContainer`) before algorithms
- Algorithms before `WorkspaceTiler` wiring
- `WorkspaceTiler` before `TilingManager`
- `TilingManager` methods before keybinding registration in `extension.js`

### Parallel Opportunities

- T002, T003, T005 (Phase 1) — independent files
- T007, T008, T009 (Phase 2) — independent files
- T011 (data structures) runs while T012 scaffold is written
- T028, T029 (Phase 4) — independent methods in `dwindleLayout.js`
- T048, T049, T050 (Phase 7 prefs pages) — independent methods in `prefs.js`
- T052, T053, T054 (Phase 8) — independent tools

---

## Parallel Example: Phase 3 Core Sequence

```
# Step 1 — parallel:
T011: TileLeaf + SplitContainer in dwindleLayout.js

# Step 2 — sequential (builds on T011):
T012: DwindleLayout scaffold
T013: _computeChildRects()
T014: _reflowSubtree()
T015: reflow()
T016: addWindow()
T017: removeWindow()

# Step 3 — parallel (independent of each other, depend on T012–T017):
T018: updateWorkArea()      T019: shouldTile() helper
T020: WorkspaceTiler.enable() initial collection
T021: window-created handler
T022: window-removed handler
T023: fullscreen-changed handler
T024: WorkspaceTiler.disable()

# Step 4 — sequential (needs all tiler methods):
T025: TilingManager.enable()
T026: TilingManager._syncTilers()
T027: TilingManager.disable()
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: US1 + US2
4. **STOP and VALIDATE**: Dwindle tiling works end-to-end — this is a shippable extension
5. Demo or release MVP

### Incremental Delivery

1. Phase 1 + 2 → skeleton builds and loads cleanly
2. Phase 3 → Dwindle tiling MVP ✅
3. Phase 4 → keyboard navigation and window movement
4. Phase 5 + 6 (parallel) → resize and float
5. Phase 7 → full preferences panel
6. Phase 8 → production-ready

---

## Notes

- `[P]` tasks operate on different files or independent methods — safe to parallelise
- `[Story]` label provides full traceability from task to user story
- `first-frame` guard (T021) is critical on Wayland — never skip it
- Every `_signalId` connected in `enable()` MUST be disconnected in `disable()` (Constitution Principle VI)
- `global.display.focus_window` is the authoritative focus source — no separate extension cursor (Clarification Q1)
- `moveWindow` swaps window refs only — rects and `splitRatio` are immutable during a swap (Clarification Q4)
- All debug log calls MUST be guarded: `if (this._settings.get_boolean('debug-logging'))` (Clarification Q5)
