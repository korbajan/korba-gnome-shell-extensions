# GNOME Extensions Project: GEMINI Mandates

## Project Core
- **Target**: GNOME Shell 50+ (GJS / SpiderMonkey ES2022)
- **Environment**: Wayland ONLY (X11 is explicitly out of scope)
- **Architecture**: Modular ESM (ES Modules)

---

## Foundational Mandates

### 1. Wayland & GJS Integrity
- **`first-frame` Guard**: For **newly created** windows, ALWAYS use `actor.connect('first-frame', ...)` before calling `move_resize_frame`. Wayland ignores geometry calls before the first frame is drawn.
- **`first-frame` fires once**: For already-mapped windows (workspace moves, sinking a float), `first-frame` will NOT fire again — call `layout.addWindow()` / `move_resize_frame` directly.
- **`actor.realized`**: Use to distinguish newly-created (unrealized) windows from already-mapped ones in `window-added` handlers. If `!actor || !actor.realized`, let the `first-frame` path handle it.
- **Unmaximize Before Resize**: Check `window.maximized_horizontally || window.maximized_vertically` and call `window.unmaximize(Meta.MaximizeFlags.BOTH)` before `move_resize_frame`. Maximized windows silently ignore resize calls. `window.get_maximized()` does NOT exist in GJS.
- **Signal names on Wayland**: `notify::fullscreen` is correct — `fullscreen-changed` does NOT exist on `MetaWindowWayland` and will throw.
- **`monitors-changed`**: Lives on `Main.layoutManager`, NOT on `global.display`.
- **Module cache**: Disable/enable does NOT reload JS modules — GJS caches them. Logout/login required for source changes.
- **Signal Lifecycle**: Every `connect()` in `enable()` MUST have a corresponding `disconnect()` in `disable()`. Store connections in an array or map to ensure no memory leaks.
- **Per-Window Signals**: Store in `Map<Window, Array<{obj,id}>>`. Disconnect in `window-removed` handlers (not just `disable()`) to prevent memory leaks.

### 2. Architectural Patterns
- **LayoutProvider Interface**: Tiling logic must be encapsulated in a `LayoutProvider` implementation (e.g., `DwindleLayout`). The core tiling engine should be layout-agnostic.
- **WorkspaceTiler**: Each (Workspace, Monitor) pair has its own `WorkspaceTiler` instance managed by the `TilingManager`.
- **Coordinate System**: Use `Meta.Rectangle` and the `applyRects` utility in `lib/utils.js` for all window placement.

### 3. Engineering Standards
- **Style**: Strict Prettier and ESLint (8+) compliance. No `var`.
- **License Headers**: Every JS file MUST start with SPDX identifiers:
  ```javascript
  // SPDX-FileCopyrightText: 2026 korbajan
  //
  // SPDX-License-Identifier: GPL-2.0-or-later
  ```
- **Testing**: New logic in `workspace-tiling-window-manager` MUST be accompanied by Jasmine unit tests in `lib/*.test.js`.
- **Keybindings**: Use `Main.wm.addKeybinding` in `enable()` and `Main.wm.removeKeybinding` in `disable()`.
- **Logging**: All debug logs MUST be gated by the `debug-logging` GSettings key:
  ```javascript
  if (this._settings.get_boolean('debug-logging')) console.log('...');
  ```
- **Documentation**: Use the `specs/` directory for detailed feature planning (Spec -> Plan -> Tasks).

---

## Critical Commands

### Development Workflow
- **Build/Install**: `meson install -C build` (installs to `~/.local`)
- **Reload Shell**: Extension changes often require logout/login on Wayland. For quick JS-only tests, use `gdbus` to disable/enable, but be aware of module caching.
- **Testing**: `cd workspace-tiling-window-manager && npm test`
- **Linting**: `npm run lint` from the root (also: `npm run lint:fix`, `npm run format`, `npm run format:check`).

### Debugging
- **Journal**: `journalctl /usr/bin/gnome-shell -f --no-pager | grep workspace-tiling`
- **WM Class**: `gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell --method org.gnome.Shell.Eval "global.display.focus_window.get_wm_class()"`
