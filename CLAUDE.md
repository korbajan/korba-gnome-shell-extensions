# korba-gnome-extensions Development Guidelines

## Project Overview

GNOME Shell 50 extensions written in GJS (ES Modules, SpiderMonkey/ES2022), targeting **Wayland only**.

**Extensions:**
- `spatial-window-navigator/` — keyboard-driven spatial window focus
- `workspace-tiling-window-manager/` — per-workspace Dwindle tiling layout

---

## Project Structure

```text
korba-gnome-extensions/
├── CLAUDE.md
├── meson.build                  # root build — lists both extensions
├── package.json                 # root ESLint + Prettier devDependencies
├── .eslintrc.yml
├── .prettierrc
├── .gitignore
├── scripts/
│   └── package-extension.sh    # produces .zip for extensions.gnome.org
├── specs/
│   └── 001-dynamic-window-tiling/   # feature spec, plan, tasks, review
├── spatial-window-navigator/
│   ├── extension.js
│   ├── prefs.js
│   ├── metadata.json.in
│   ├── meson.build
│   └── org.gnome.shell.extensions.spatial-window-navigator.gschema.xml
└── workspace-tiling-window-manager/
    ├── extension.js
    ├── prefs.js
    ├── metadata.json.in
    ├── meson.build
    ├── org.gnome.shell.extensions.workspace-tiling-window-manager.gschema.xml
    ├── package.json             # Jasmine unit tests
    ├── spec/support/jasmine.json
    └── lib/
        ├── layoutProvider.js    # abstract LayoutProvider + LayoutRegistry
        ├── dwindleLayout.js     # Dwindle binary split-tree implementation
        ├── dwindleLayout.test.js
        ├── tilingManager.js     # top-level coordinator
        ├── workspaceTiler.js    # per-(workspace, monitor) tiler
        ├── keybindingRow.js     # Adw keybinding widget (shared with prefs)
        └── utils.js             # applyRects (shared between tiler + manager)
```

---

## Commands

### Build & Install

```bash
# Configure (once, targets ~/.local so no sudo needed)
meson setup build --prefix="$HOME/.local"

# Build + install both extensions
meson install -C build

# Reload extension without logout (module cache may persist — logout/login for JS changes)
gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell \
  --method org.gnome.Shell.Extensions.DisableExtension \
  "workspace-tiling-window-manager@korbajan.github.com"
gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell \
  --method org.gnome.Shell.Extensions.EnableExtension \
  "workspace-tiling-window-manager@korbajan.github.com"

# Check extension state
gnome-extensions info workspace-tiling-window-manager@korbajan.github.com

# Open preferences
gnome-extensions prefs workspace-tiling-window-manager@korbajan.github.com
```

### Unit Tests (workspace-tiling-window-manager only)

```bash
cd workspace-tiling-window-manager
npm install       # first time only
npm test          # runs Jasmine — 33 specs, must stay green
```

### Lint & Format

```bash
# ESLint (from repo root)
node_modules/.bin/eslint workspace-tiling-window-manager/

# Prettier
node_modules/.bin/prettier --write "workspace-tiling-window-manager/**/*.js"
```

### Debugging

```bash
# Watch live journal output
journalctl /usr/bin/gnome-shell -f --no-pager | grep workspace-tiling

# Enable debug logging via GSettings
gsettings --schemadir ~/.local/share/glib-2.0/schemas \
  set org.gnome.shell.extensions.workspace-tiling-window-manager debug-logging true

# Find WM class of focused window (Wayland)
gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell \
  --method org.gnome.Shell.Eval "global.display.focus_window.get_wm_class()"
```

---

## Code Style

- **Formatter**: Prettier (`singleQuote`, `trailingComma: all`, `printWidth: 100`, `tabWidth: 4`)
- **Linter**: ESLint 8 with `no-var`, `prefer-const`, `eqeqeq`, `no-unused-vars`
- **No comments** unless the WHY is non-obvious
- **No `var`** — always `const` / `let`
- Files over 400 lines need a justification comment at the top

---

## GJS / GNOME Shell Conventions

- **Imports**: `gi://Meta`, `gi://Gio`, `resource:///org/gnome/shell/ui/main.js` etc.
- **GSettings schema**: lives at extension root (not `schemas/` subdir), installed via meson
- **Signal disconnect**: every `connect()` in `enable()` MUST be disconnected in `disable()`; store as `Array<{obj, id}>`
- **Per-window signals**: store in `Map<Window, Array<{obj,id}>>`, disconnect in `window-removed` handler (not just `disable()`) to avoid memory leaks
- **`monitors-changed`**: lives on `Main.layoutManager`, NOT `global.display`
- **`notify::fullscreen`**: correct Wayland signal name; `fullscreen-changed` does NOT exist on `MetaWindowWayland`

## Wayland-Specific Gotchas

- **`first-frame` guard**: always use `actor.connect('first-frame', ...)` before calling `move_resize_frame` on a **newly created** window — Wayland ignores geometry calls before the first frame is drawn
- **`first-frame` fires once**: for already-mapped windows (moved between workspaces, sinking a float), `first-frame` will NOT fire again — call `layout.addWindow()` / `move_resize_frame` directly
- **`actor.realized`**: use this to distinguish newly-created (unrealized) windows from moved (already-rendered) windows in `window-added` handlers
- **Unmaximize before resize**: call `window.unmaximize(Meta.MaximizeFlags.BOTH)` before `move_resize_frame` — maximized windows silently ignore resize calls; check via `window.maximized_horizontally || window.maximized_vertically`
- **Module cache on disable/enable**: JS modules are NOT reloaded on extension disable+enable; a full logout/login is needed to pick up JS source changes

---

## Architecture: workspace-tiling-window-manager

```
TilingManager
  ├── connects: window-created (global.display) → routes to tiler._addNewWindow()
  ├── connects: notify::n-workspaces, monitors-changed → _syncTilers()
  ├── connects: changed::tiling-enabled-workspaces, changed::gap-size
  └── Map<"wsIdx:monIdx", WorkspaceTiler>
        ├── connects: workspace window-added (moved windows), window-removed
        ├── Map<Window, [{obj,id}]>  ← per-window signals (fullscreen)
        └── DwindleLayout (via LayoutProvider interface)
              ├── TileLeaf { window, rect, parent }
              └── SplitContainer { direction, first, second, splitRatio, rect, parent }
```

**Key invariants:**
- `moveWindow()` swaps window refs in TileLeaf nodes only — rects and splitRatios never change during a swap
- `_lastLeaf` tracks the insertion target for the next `addWindow()` call
- All debug logs gated: `if (this._settings.get_boolean('debug-logging')) console.log(...)`
- `applyRects()` lives in `lib/utils.js` — always unmaximizes before resizing
