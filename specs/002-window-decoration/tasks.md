# Tasks: Advanced Window Decoration

**Input**: Design documents from `/specs/002-window-decoration/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Tests**: Jasmine unit tests are **mandatory** for all pure `lib/` modules per Constitution Principle III (test-first). Visual / compositor behavior is covered by documented manual smoke tests (see `quickstart.md`).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. Story phase tasks carry `[USN]` labels.

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no incomplete task dependencies)
- **[Story]**: User story this task belongs to (US1, US2, US3)
- Exact file paths are included in every description

---

## Phase 1: Setup (Extension Skeleton)

**Purpose**: Bootstrap the new extension so Meson can build and install it alongside the existing two extensions.

- [x] T001 Create `advanced-window-decoration/` directory layout: `lib/`, `spec/support/` (matches siblings' structure per `plan.md`)
- [x] T002 Create `advanced-window-decoration/metadata.json.in` — uuid `advanced-window-decoration@korbajan.github.com`, name, description, `shell-version ["@shell_current@"]`, `version 1`
- [x] T003 Create `advanced-window-decoration/meson.build` — `install_data` for `extension.js`, `prefs.js`, `metadata.json`, schema XML, and all `lib/*.js` files; configure `uuid`, `gschemaname`, `gettext_domain` (follow `workspace-tiling-window-manager/meson.build` pattern exactly)
- [x] T004 Update root `meson.build` — add `'advanced-window-decoration'` to the `extensions` array (line 23)
- [x] T005 [P] Create `advanced-window-decoration/package.json` with `jasmine` dev-dependency and `"test": "jasmine"` script; create `advanced-window-decoration/spec/support/jasmine.json` pointing spec paths to `lib/**/*.test.js`
- [x] T006 [P] Create `advanced-window-decoration/org.gnome.shell.extensions.advanced-window-decoration.gschema.xml` — XML skeleton with schema id and path; leave key bodies empty (populated in US1 and US2 task phases)
- [x] T007 Create `advanced-window-decoration/extension.js` — stub `Extension` subclass with empty `enable()` and `disable()`; SPDX header matching siblings
- [x] T008 [P] Create `advanced-window-decoration/prefs.js` — stub `ExtensionPreferences` subclass with empty `fillPreferencesWindow()`; SPDX header

**Checkpoint**: `meson install -C build` succeeds and `gnome-extensions info advanced-window-decoration@korbajan.github.com` shows the extension (State: DISABLED initially). Zero ESLint errors on the stubs.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure-logic `lib/` modules that ALL three user stories depend on. Must be red-green-refactor complete before any compositor work begins.

**⚠️ CRITICAL**: No user story implementation can begin until T009–T016 (including T015a) are complete.

- [x] T009 Write failing Jasmine specs in `advanced-window-decoration/lib/windowFilter.test.js` — cover `shouldManage()` returning `false` for: dialog, popup-menu, tooltip, utility, modal, fullscreen, override-redirect, and any window whose `wm_class` matches the extension's own preferences window (`gjs` / `org.gnome.Shell.Extensions.AdvancedWindowDecoration.Prefs`); returning `true` for regular top-level windows (FR-009, FR-010)
- [x] T010 Implement `advanced-window-decoration/lib/windowFilter.js` — `shouldManage(metaWindow)` predicate using `Meta.WindowType`, `window.get_window_type()`, `window.fullscreen`, and a `wm_class` check for the extension's prefs window (FR-009, FR-010) — make T009 green; refactor
- [x] T011 Write failing Jasmine specs in `advanced-window-decoration/lib/settingsClamp.test.js` — cover `clampThickness(n)` for negatives, zero, mid-range, and above-32; `parseRgba(str)` for valid, partially invalid, and fully invalid inputs returning fallback; `formatRgba(gdk_rgba)` round-trip (FR-014, FR-020)
- [x] T012 Implement `advanced-window-decoration/lib/settingsClamp.js` — `clampThickness(n)`, `parseRgba(str, fallback)`, `formatRgba(rgba)` helpers — make T011 green; refactor
- [x] T013 Write failing Jasmine specs in `advanced-window-decoration/lib/windowRegistry.test.js` — cover `attach()` sets `userOverrode=false` and captures `originalDecorated`; `toggleOverride()` flips flag; `applyDefaultPolicy()` skips overridden windows; `detach()` removes record; `disableAll()` restores originals (FR-011, FR-018, FR-021)
- [x] T014 Implement `advanced-window-decoration/lib/windowRegistry.js` — `Map<MetaWindow, ManagedWindowState>` with `attach()`, `detach()`, `toggleOverride()`, `applyDefaultPolicy()`, `disableAll()`, `get()`, `forEach()` — make T013 green; refactor
- [x] T015 Implement `advanced-window-decoration/lib/decorationManager.js` scaffold — constructor accepts `settings`; empty `enable()` / `disable()` stubs that connect / disconnect `global.display` signals using the `Array<{obj,id}>` pattern from CLAUDE.md; expose a `getSignalHandleCount()` accessor for test observability; no titlebar or border logic yet
- [x] T015a Write failing Jasmine spec in `advanced-window-decoration/lib/decorationManager.test.js` — with a minimal `FakeEmitter` (implements `connect` / `disconnect`, tracks live handlers) as stand-in for `global.display`, assert: (a) after `enable()`, `getSignalHandleCount()` equals the number of registered listeners; (b) after `disable()`, `getSignalHandleCount()` is zero and the emitter reports zero live handlers; (c) `windowRegistry.disableAll()` is invoked exactly once during `disable()` (Constitution III integration-test clause, FR-011, FR-015)
- [x] T016 Wire `advanced-window-decoration/extension.js` — `enable()` instantiates `DecorationManager(this.getSettings())` and calls `.enable()`; `disable()` calls `.disable()`; import from `./lib/decorationManager.js`

**Checkpoint**: `cd advanced-window-decoration && npm test` — all Jasmine specs green. `meson install -C build` succeeds. Extension enables/disables without journal errors.

---

## Phase 3: User Story 1 — Toggle Window Title Bars on Demand (Priority: P1) 🎯 MVP

**Goal**: User can press `<Super><Alt>d` to hide or show the focused window's title bar. New windows respect the default-title-bar-policy. Disable restores all windows.

**Independent Test**: Focus a window, press `<Super><Alt>d` → title bar disappears and content expands. Press again → restores. No jump in outer position. Disable extension → all title bars back. No other feature required.

- [x] T017 [US1] Implement `advanced-window-decoration/lib/titlebarController.js` — `hide(window, registry)`, `show(window, registry)`, `toggle(window, registry)` using `Meta.Window.set_decorated()` + `is_client_decorated()` for silent CSD fallback (FR-019); capture outer frame rect before toggle and re-issue `move_resize_frame` after to preserve outer position (FR-002); unmaximize before resize if `maximized_horizontally || maximized_vertically` (CLAUDE.md Wayland gotcha)
- [x] T018 [US1] Implement `window-created` handler in `advanced-window-decoration/lib/decorationManager.js` — for each new window passing `windowFilter.shouldManage()`: `windowRegistry.attach()`; if the window actor is already realized call `titlebarController` to apply default policy directly; otherwise wait for `actor.connect('first-frame', ...)` per CLAUDE.md `first-frame` guard (FR-004)
- [x] T019 [US1] Register `keybind-toggle-titlebar` shortcut in `decorationManager.enable()` via `Main.wm.addKeybinding('toggle-titlebar-shortcut', settings, Meta.KeyBindingFlags.NONE, Shell.ActionMode.NORMAL, () => { ... })` — handler calls `titlebarController.toggle(display.focus_window, registry)` and flips `userOverrode` via `windowRegistry.toggleOverride()` (FR-001, FR-018)
- [x] T020 [US1] Add `changed::default-titlebar-policy` settings listener in `decorationManager.enable()` — calls `windowRegistry.applyDefaultPolicy(newPolicy, titlebarController)` to retroactively update all non-overridden managed windows (FR-021)
- [x] T021 [US1] Implement `window-removed` handler in `decorationManager.js` — calls `windowRegistry.detach(window)` which drains per-window `signalHandles` (FR-015 — no leak); no title-bar restoration needed (window is gone)
- [x] T022 [US1] Implement full `decorationManager.disable()` — `Main.wm.removeKeybinding('toggle-titlebar-shortcut')`; calls `windowRegistry.disableAll(titlebarController)` to restore every window's original decoration state (FR-011, SC-003); disconnect all display-level signals from `_signalHandles`
- [x] T023 [US1] Populate GSettings schema XML (`org.gnome.shell.extensions.advanced-window-decoration.gschema.xml`) with `default-titlebar-policy` (type `s`, default `"visible"`), `toggle-titlebar-shortcut` (type `as`, default `["<Super><Alt>d"]`), and `debug-logging` (type `b`, default `false`) keys per `contracts/gsettings-schema.md`
- [x] T024 [US1] Add `notify::fullscreen` per-window signal in `windowRegistry.attach()` — on enter fullscreen: call `titlebarController.show()` if title bar was hidden (restore temporarily); on exit fullscreen: re-apply managed state; store signal handle in `ManagedWindow.signalHandles` (FR-009, edge case)
- [x] T025 [US1] Manual smoke test — run acceptance scenarios 1.1, 1.2, 1.3, 1.4 and the disable-restore invariant from `quickstart.md`; fix any regressions before proceeding

**Checkpoint**: All five acceptance scenarios of User Story 1 pass manually. `npm test` stays green. Zero journal errors during a 2-minute toggle session.

---

## Phase 4: User Story 2 — Configurable Window Border (Priority: P2)

**Goal**: Every managed window has a colored border of user-configured thickness. Border tracks window movement. Focused window uses a separate color. Settings changes apply live.

**Independent Test**: Set `border-thickness` to 4 and `border-color` to red via preferences. Open any window → red border visible. Change color to blue → all borders turn blue within 1 second. Set thickness to 0 → borders disappear. No title-bar feature required.

- [x] T026 [US2] Populate remaining GSettings schema keys: `border-thickness` (type `u`, default `2`, `<range min="0" max="32"/>`), `border-color` (type `s`, default `"rgba(128,128,128,0.80)"`), `focused-border-color` (type `s`, default `"rgba(53,132,228,1.00)"`) per `contracts/gsettings-schema.md`
- [x] T027 [P] [US2] Implement `advanced-window-decoration/lib/borderController.js` — `createBorderActor(metaWindow, thickness, colorStr)` creates four `St.Widget` edge rectangles parented to `global.window_group` positioned at `window.get_frame_rect()`; `destroyBorderActor(metaWindow)`; `repositionActor(metaWindow)` recalculates from current `get_frame_rect()`; `setFocused(metaWindow, focusedColorStr, unfocusedColorStr)` updates CSS `background-color` on all tracked actors; `updateAll(thickness, colorStr, focusedColorStr)` iterates every actor (FR-005, FR-006, FR-007, FR-008)
- [x] T028 [US2] Wire `borderController` into `advanced-window-decoration/lib/decorationManager.js` — on `window-created`/`first-frame`: call `borderController.createBorderActor()` if `thickness > 0`; on `window-removed`: call `borderController.destroyBorderActor()`; on `notify::focus-window`: call `borderController.setFocused()`; on `changed::border-thickness` / `changed::border-color` / `changed::focused-border-color`: call `borderController.updateAll()` (FR-007, SC-002)
- [x] T029 [US2] Add `position-changed` and `size-changed` per-window signal handlers in `windowRegistry.attach()` — each fires `borderController.repositionActor(window)`; store handles in `ManagedWindow.signalHandles` (FR-005 acceptance 2.5)
- [x] T030 [US2] Handle fullscreen in border lifecycle — in the `notify::fullscreen` handler (T024): on enter fullscreen hide the border actor (`actor.hide()`); on exit fullscreen show it again if `thickness > 0` (`actor.show()`); do not destroy/recreate (FR-009 fullscreen edge case)
- [x] T031 [US2] Handle `border-thickness = 0` in `decorationManager`'s settings-change listener — destroy all existing border actors when thickness drops to 0; create them when thickness rises from 0 (FR-008)
- [x] T032 [US2] Manual smoke test — run acceptance scenarios 2.1, 2.2, 2.3, 2.4, 2.5, 2.6 from `quickstart.md`; verify border updates live within 1 second (SC-002)

**Checkpoint**: All six acceptance scenarios of User Story 2 pass manually. Sibling extension tile layout is unaffected (borders sit inside the gap). `npm test` stays green.

---

## Phase 5: User Story 3 — Preferences Window (Priority: P3)

**Goal**: All settings configurable from a graphical `AdwPreferencesWindow`. Settings persist across sessions and take effect live.

**Independent Test**: Open `gnome-extensions prefs advanced-window-decoration@korbajan.github.com`. Change every control. Close and reopen — values retained. Log out and back in — values retained.

- [x] T033 [US3] Implement `advanced-window-decoration/prefs.js` outer structure — `ExtensionPreferences` subclass; `fillPreferencesWindow(window)` adds four `AdwPreferencesPage` sections: "Behaviour", "Borders", "Shortcut", "Debug"; all strings wrapped in `_()` (Constitution IV)
- [x] T034 [P] [US3] Implement "Behaviour" page in `prefs.js` — one `AdwPreferencesGroup` containing one `AdwSwitchRow` (label "Hide title bars by default") bound to `default-titlebar-policy` via `Gio.Settings.bind_with_mapping()` mapping `"hidden"↔true` / `"visible"↔false` (FR-003, FR-012)
- [x] T035 [P] [US3] Implement "Borders" page in `prefs.js` — `AdwSpinRow` for `border-thickness` (lower 0, upper 32, step 1); two `AdwActionRow` rows each containing a `Gtk.ColorDialogButton` with `Gtk.ColorDialog(with_alpha=true)` for `border-color` and `focused-border-color`; bind via `bind_with_mapping()` serializing/deserializing `"rgba(...)"` strings using `settingsClamp.parseRgba()` / `settingsClamp.formatRgba()` (FR-005, FR-006, FR-012, FR-020)
- [x] T036 [P] [US3] Implement inline shortcut-capture row in `prefs.js` — `AdwActionRow` titled "Toggle title bar" with a `Gtk.ShortcutLabel` suffix showing the current accelerator from `toggle-titlebar-shortcut[0]`; a "Set shortcut…" `Gtk.Button` opens a modal dialog that captures the next non-modifier keypress, validates via `Gtk.accelerator_valid()`, and writes the new `["<accelerator>"]` array to GSettings (FR-001, FR-012, acceptance 3.4 conflict warning)
- [x] T037 [P] [US3] Implement "Debug" page in `prefs.js` — one `AdwSwitchRow` (label "Enable debug logging") bound to `debug-logging` via `Gio.Settings.bind()` with `DEFAULT` flags
- [x] T038 [US3] Add input validation in `prefs.js` — `AdwSpinRow` for thickness: emit visual error feedback if user types a negative value (clamp on `output` signal); shortcut row: if captured shortcut is already bound to a GNOME Shell action, show an inline warning row and do not save; color parse failure: show toast or inline subtitle noting the value was rejected (FR-014, acceptance 3.3, 3.4)
- [x] T039 [US3] Manual smoke test — (a) run acceptance scenarios 3.1, 3.2, 3.3, 3.4 from `quickstart.md`; (b) persistence check for FR-013: set thickness to `6`, color to blue, close prefs, run `gsettings --schemadir "$HOME/.local/share/glib-2.0/schemas" get org.gnome.shell.extensions.advanced-window-decoration border-thickness` and confirm `uint32 6`, then log out / back in and re-open prefs to confirm the UI still reflects `6` / blue (FR-013, SC-006)

**Checkpoint**: All four acceptance scenarios of User Story 3 pass manually. All three user stories function together without regression.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates required by the Constitution before PR can be opened.

- [x] T040 Add debug-logging gates throughout `lib/decorationManager.js`, `lib/titlebarController.js`, `lib/borderController.js` — every decoration decision (`window accepted`, `title bar toggled`, `CSD fallback`, `border created/destroyed`, `settings change applied`) emits `console.log('[advanced-window-decoration] ...')` when `debug-logging=true`; zero overhead when `false` (FR-015, Constitution II — no debug `log()` left ungated)
- [x] T041 [P] Verify all UI strings in `advanced-window-decoration/prefs.js` are wrapped in `_()` — run `xgettext -o /dev/null` as a check; add any missing wrappers (Constitution IV)
- [x] T042 [P] Add `accessible-name` (or label association) to every interactive control in `prefs.js` that does not already get one from `AdwPreferencesRow.title` — specifically both `Gtk.ColorDialogButton` instances and the shortcut capture button (Constitution IV)
- [x] T043 Run `npm run lint` and `npm run format:check` from repo root — fix all ESLint errors and Prettier drift in `advanced-window-decoration/**/*.js` (Constitution II, Quality Gate 1+2)
- [x] T044 Run `cd advanced-window-decoration && npm test` — all Jasmine specs pass; fix any regressions; confirm coverage of `windowFilter`, `settingsClamp`, `windowRegistry` (Constitution III, Quality Gate 3)
- [ ] T045 [P] Coexistence regression test — enable all three extensions simultaneously; run acceptance scenarios for `workspace-tiling-window-manager` (tiling, focus keys, float toggle) and `spatial-window-navigator` (spatial focus) — no regressions; borders sit inside tile gaps without altering geometry (FR-016, FR-017, SC-007)
- [ ] T046 Full `quickstart.md` smoke test sequence — complete all scenarios (1.1, 2.1, 2.3, 3.2, lifecycle-integrity, disable-restore) end-to-end; run a 10-minute continuous soak (open, focus, move, resize, close a mix of windows; toggle title bars; change colors) and capture `cat /proc/$(pgrep gnome-shell)/status | grep VmRSS` before and after to confirm no measurable heap growth; record all pass/fail results in PR description (SC-004)
- [ ] T047 Final Constitution Check — confirm plan.md Constitution Check table still accurate after all implementation changes; no ungated log calls, no `var`, all signal connections tracked, file lengths under 400 lines (add justification comment if any file exceeds); PR is ready to open

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all user stories**
- **Phase 3 (US1)**: Depends on Phase 2
- **Phase 4 (US2)**: Depends on Phase 2; integrates with Phase 3 (shares `decorationManager`, `windowRegistry`)
- **Phase 5 (US3)**: Depends on Phase 2; references schema keys from Phases 3 and 4 (T023, T026 must be complete)
- **Phase 6 (Polish)**: Depends on all desired user stories complete

### User Story Dependencies (within Phases 3–5)

| Story | Depends on | Notes |
|-------|-----------|-------|
| US1 (P1) | Phase 2 only | Independently testable after T025 |
| US2 (P2) | Phase 2 + T023 (schema keys), T018 (window-created handler), T021 (window-removed handler) | Border lifecycle reuses registry and manager wiring from US1 |
| US3 (P3) | Phase 2 + T023 (US1 schema keys) + T026 (US2 schema keys) | Prefs UI reads all schema keys; schema must be complete |

### Within Each User Story

1. **Red**: write failing tests (`windowFilter`, `settingsClamp`, `windowRegistry` — Phase 2)
2. **Green**: implement to make tests pass
3. **Refactor**: clean up while keeping green
4. Implementation tasks: schema keys → lib module → wiring into manager → manual smoke test

### Parallel Opportunities

- **Phase 1**: T005, T006, T007, T008 can run in parallel after T001–T004
- **Phase 2**: T009/T011/T013 (test writing) can run in parallel; T010/T012/T014 (implementations) follow their respective test tasks
- **Phase 5**: T034, T035, T036, T037 (individual Adw pages) can run in parallel after T033

---

## Parallel Execution Examples

### Phase 2 — Foundational specs (write tests in parallel)

```text
In parallel:
  T009: windowFilter.test.js (dialog/popup/fullscreen exclusion rules)
  T011: settingsClamp.test.js (clamp + parseRgba + formatRgba)
  T013: windowRegistry.test.js (attach/detach/override state machine)
```

### Phase 5 — Preferences pages (after T033 scaffold)

```text
In parallel:
  T034: "Behaviour" page (default-titlebar-policy toggle)
  T035: "Borders" page (thickness spin + two color buttons)
  T036: "Shortcut" page (inline shortcut-capture row)
  T037: "Debug" page (debug-logging switch)
```

### Phase 6 — Polish passes (independent concerns)

```text
In parallel:
  T041: Verify _() wrappers in prefs.js
  T042: Add accessible-name to interactive controls
  T045: Coexistence regression test with sibling extensions
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T008)
2. Complete Phase 2: Foundational (T009–T016) — **CRITICAL BLOCKER**
3. Complete Phase 3: User Story 1 (T017–T025)
4. **STOP and VALIDATE**: smoke test 1.1, 1.2, disable-restore; `npm test` green
5. Demo: keyboard-driven title bar toggle works on any SSD window

### Incremental Delivery

1. Phase 1 + 2 → foundation ready
2. Phase 3 (US1) → MVP: title bar toggle ✓ → demo
3. Phase 4 (US2) → add configurable borders ✓ → demo
4. Phase 5 (US3) → add preferences window ✓ → demo
5. Phase 6 → quality gates → PR open

### Single-Developer Sequence

```text
T001 → T002 → T003 → T004
T005 ║ T006 ║ T007 ║ T008      (parallel)
T009 ║ T011 ║ T013              (parallel test writing)
T010 → T012 → T014              (sequential implementations)
T015 → T015a → T016            (manager scaffold → lifecycle spec → extension wire-up)
--- Phase 2 checkpoint: npm test green ---
T017 → T018 → T019 → T020 → T021 → T022 → T023 → T024 → T025
--- Phase 3 checkpoint: US1 manual smoke test passes ---
T026 → T027 ║ (after T028 wiring ready)
T028 → T029 → T030 → T031 → T032
--- Phase 4 checkpoint: US2 manual smoke test passes ---
T033 → T034 ║ T035 ║ T036 ║ T037   (parallel pages)
T038 → T039
--- Phase 5 checkpoint: US3 manual smoke test passes ---
T040 → T041 ║ T042 ║ T045
T043 → T044 → T046 → T047
```

---

## Notes

- `[P]` = different files, no dependency on incomplete tasks — safe to run in parallel
- `[USN]` label maps each task to a user story for traceability back to `spec.md`
- Every Jasmine test task (T009, T011, T013) MUST be written and **confirmed to fail** before its implementation task runs (Constitution III Red-Green-Refactor)
- Commit after each logical group (at minimum after each phase checkpoint)
- Avoid touching `workspace-tiling-window-manager/` or `spatial-window-navigator/` — they are out of scope
- If any file exceeds 400 lines, add a justification comment at the top before Phase 6 (Constitution II)
