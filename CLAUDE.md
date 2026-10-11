# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GNOME Shell 50 extensions written in GJS (ES Modules, SpiderMonkey/ES2022), targeting **Wayland only** (X11 is out of scope). No npm runtime dependencies; npm is only used for ESLint/Prettier (root) and Jasmine (per extension).

**Extensions** (all UUIDs are `<dir>@korbajan.github.com`):
- `spatial-window-navigator/`: keyboard-driven spatial window focus
- `workspace-tiling-window-manager/`: per-workspace Dwindle tiling layout
- `advanced-window-decoration/`: titlebar hide/show policy + per-window focus-colored borders

Feature work follows the Spec Kit flow (`specs/NNN-feature/` → spec, plan, tasks); branches are named `NNN-feature`.

---

## Commands

### Build & Install

```bash
meson setup build --prefix="$HOME/.local"   # once
meson install -C build                       # builds + installs all extensions, compiles schemas

gnome-extensions info  <uuid>
gnome-extensions prefs <uuid>
gnome-extensions disable <uuid> && gnome-extensions enable <uuid>
```

GJS caches modules: disable/enable does **not** pick up JS source changes. A logout/login is required.

**Each extension's `meson.build` lists its `lib/*.js` files explicitly.** A new lib module must be added there or it won't be installed and the extension will fail to load.

`scripts/package-extension.sh` builds the extensions.gnome.org zip (currently only for workspace-tiling-window-manager).

### Unit Tests

Jasmine, per extension (`workspace-tiling-window-manager/` and `advanced-window-decoration/`), specs live next to sources as `lib/*.test.js`:

```bash
cd advanced-window-decoration       # or workspace-tiling-window-manager
npm install                         # first time only
npm test                            # all specs
npx jasmine lib/windowRegistry.test.js        # single file
npx jasmine --filter="WindowRegistry attach"  # by spec name
```

CI (`.github/workflows/ci.yml`) runs `npm run lint`, `npm run format:check`, and `npm test` in every extension dir whose `package.json` has a `test` script.

### Lint & Format (repo root)

```bash
npm run lint          # ESLint all extensions
npm run lint:fix
npm run format        # Prettier write
npm run format:check
```

### Debugging

```bash
journalctl /usr/bin/gnome-shell -f --no-pager | grep <extension-name>

gsettings --schemadir ~/.local/share/glib-2.0/schemas \
  set org.gnome.shell.extensions.<extension-name> debug-logging true

# WM class of focused window
gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell \
  --method org.gnome.Shell.Eval "global.display.focus_window.get_wm_class()"
```

---

## Code Style

- Prettier: `singleQuote`, `trailingComma: all`, `printWidth: 100`, `tabWidth: 4`. ESLint 8: `no-var`, `prefer-const`, `eqeqeq`, `no-unused-vars`.
- Every JS file starts with the SPDX header:
  ```js
  // SPDX-FileCopyrightText: 2026 korbajan
  //
  // SPDX-License-Identifier: GPL-2.0-or-later
  ```
- No comments unless the WHY is non-obvious. Files over 400 lines need a justification comment at the top.
- All debug logs are gated on the `debug-logging` GSettings key.

## GJS / GNOME Shell Conventions

- **GSettings schema** lives at the extension root (not `schemas/`), installed by meson; `metadata.json` is generated from `metadata.json.in`.
- **Signal lifecycle**: every `connect()` in `enable()` is disconnected in `disable()`; store as `Array<{obj, id}>`. Per-window signals go in a per-window store and are disconnected in the `window-removed` handler too, not just in `disable()`.
- **Keybindings**: `Main.wm.addKeybinding` in `enable()`, `Main.wm.removeKeybinding` in `disable()`.
- **`monitors-changed`** is on `Main.layoutManager`, not `global.display`.
- **`notify::fullscreen`** is the correct signal; `fullscreen-changed` does not exist on `MetaWindowWayland`.
- **Testability**: modules under test must load in Node. Keep `gi://` / `resource://` imports lazy (dynamic `import()` inside methods) in any module with a `.test.js`, and allow injecting fakes (e.g. `DecorationManager(settings, { display })`).

## Wayland Gotchas

- **`first-frame` guard**: for newly created windows, wait for `actor.connect('first-frame', ...)` before `move_resize_frame`; Wayland ignores earlier geometry calls.
- **`first-frame` fires once**: for already-mapped windows (moved between workspaces, un-floated), act directly. Use `actor.realized` to tell the two cases apart.
- **Unmaximize before resize**: maximized windows silently ignore resizes. Check `window.maximized_horizontally || window.maximized_vertically`, then call `window.unmaximize()`. In GNOME 50 it takes **no arguments**; `get_maximized()` does not exist.
- **`MetaWindowWayland.decorated` is read-only**: `win.set({ decorated })` throws for native Wayland clients, so wrap it in try/catch. Titlebar toggling only takes effect on Xwayland/server-decorated windows.

---

## Architecture: workspace-tiling-window-manager

```
TilingManager
  ├── window-created (global.display) → tiler._addNewWindow()
  ├── notify::n-workspaces, monitors-changed → _syncTilers()
  ├── changed::tiling-enabled-workspaces, changed::gap-size
  └── Map<"wsIdx:monIdx", WorkspaceTiler>
        ├── workspace window-added (moved windows), window-removed
        ├── Map<Window, [{obj,id}]>  per-window signals (fullscreen)
        └── DwindleLayout (via LayoutProvider / LayoutRegistry)
              ├── TileLeaf { window, rect, parent }
              └── SplitContainer { direction, first, second, splitRatio, rect, parent }
```

- Tiling logic stays behind the `LayoutProvider` interface; the tiler is layout-agnostic.
- `moveWindow()` swaps window refs in TileLeaf nodes only; rects and splitRatios never change during a swap.
- `_lastLeaf` tracks the insertion target for the next `addWindow()`.
- All placement goes through `applyRects()` in `lib/utils.js` (handles unmaximize).
- `lib/keybindingRow.js` is shared between the extension and `prefs.js`.

## Architecture: advanced-window-decoration

```
extension.js → DecorationManager (lib/decorationManager.js)
  ├── window-created / notify::focus-window / workspace-switched / settings changed::*
  ├── windowFilter.shouldManage(win)       which windows get decorated
  ├── WindowRegistry                       Map<MetaWindow, record>
  │     record = { originalDecorated, originalFrameRect, currentDecorated,
  │                userOverrode, borderActor, borderThickness, signalHandles[] }
  ├── TitlebarController (stateless fns)   set decorated + re-issue frame rect so the window doesn't jump
  └── BorderController (stateless fns)     St.Widget per window in global.window_group,
                                           repositioned on position/size-changed, hidden on fullscreen
                                           and when the window is off the active workspace
```

- Per-window signal handles live in `record.signalHandles`; `WindowRegistry.detach()` / `disableAll()` disconnect them, and `disableAll()` restores `originalDecorated`.
- `userOverrode` (set by the toggle shortcut) exempts a window from later `default-titlebar-policy` changes.
- `settingsClamp.js` holds RGBA parsing/formatting and value clamping used by `prefs.js`; it is unit-tested.

---

## Active Technologies
- GJS / ES2022 (SpiderMonkey in GNOME Shell 50), ESM modules; GJS built-ins only. Jasmine as dev-only test dependency. (002-window-decoration)
- GSettings schema `org.gnome.shell.extensions.advanced-window-decoration`, installed via Meson `gnome.post_install(glib_compile_schemas: true)`. (002-window-decoration)

## Recent Changes
- 002-window-decoration: added `advanced-window-decoration` extension.
