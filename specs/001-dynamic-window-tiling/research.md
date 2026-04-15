# Research: Dynamic Window Tiling (Dwindle)

**Feature**: `001-dynamic-window-tiling`
**Date**: 2026-04-14
**Status**: Complete — all NEEDS CLARIFICATION resolved

---

## 1. Module System & Extension Base Class

**Decision**: GJS ES Modules (ES2022) with `gi://` and `resource://` URI schemes.
Extension class extends `Extension` from `resource:///org/gnome/shell/extensions/extension.js`.

**Patterns** (confirmed from `spatial-window-navigator/extension.js` in this repo):

```js
import Meta   from 'gi://Meta';
import Shell  from 'gi://Shell';
import GLib   from 'gi://GLib';
import Gio    from 'gi://Gio';
import GObject from 'gi://GObject';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main   from 'resource:///org/gnome/shell/ui/main.js';

export default class WorkspaceTilingWindowManagerExtension extends Extension {
    enable()  { /* set up */ }
    disable() { /* tear down — MUST disconnect all signals */ }
}
```

Note: `prefs.js` uses a **different** resource path with mixed case:
`resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js`

**Rationale**: GNOME Shell 45 completed the ESM migration. The `gi://` scheme is the
only supported introspection import path in GS45+. The `Extension` base class provides
`this.getSettings()`, `this.path`, and `this.metadata` without any constructor boilerplate.

**Alternatives considered**: Legacy `imports.gi.*` — rejected, unsupported in GS45+.

---

## 2. Window Management APIs

**Decision**: Use `Meta.Display` + `Meta.Workspace` + `Meta.Window` directly.
`Meta.WindowActor` is NOT needed for tiling geometry operations.

### Lifecycle signals

| Signal | Object | Use |
|---|---|---|
| `window-created` | `global.display` | Insert new window into tile tree |
| `window-added` | `Meta.Workspace` | Supplement for multi-workspace moves |
| `window-removed` | `Meta.Workspace` | Remove window, reflow layout |
| `unmanaged` | `Meta.Window` | Final cleanup of tile node |
| `fullscreen-changed` | `Meta.Window` | Pause/resume tiling for fullscreen |
| `size-changed` | `Meta.Window` | Detect user-initiated resize (optional) |

### Window filtering (what to tile)

```js
function shouldTile(window) {
    return window.get_window_type() === Meta.WindowType.NORMAL
        && !window.get_transient_for()
        && !window.skip_taskbar;
}
```

### Geometry

```js
// Read current geometry (frame = outer visible boundary)
const r = window.get_frame_rect();   // { x, y, width, height }

// Write geometry (false = programmatic, bypass user-op constraints)
window.move_resize_frame(false, x, y, width, height);
```

**Important**: `move_resize_frame` is correct for Wayland. The older `move_resize`
uses gravity coordinates that differ when server-side decorations are present.

### Work area (usable area for tiling, excludes GNOME top bar)

```js
const workArea = workspace.get_work_area_for_monitor(monitorIndex);
// Returns Meta.Rectangle: { x, y, width, height }
```

Always use `get_work_area_for_monitor`, not `global.display.get_monitor_geometry`,
which returns raw physical resolution before subtracting panels.

### `window-created` race condition

`window-created` fires before the window is fully mapped. Apply tile geometry after
the first frame is rendered by connecting to `Meta.WindowActor`'s `first-frame` signal:

```js
global.display.connect('window-created', (display, window) => {
    const actor = window.get_compositor_private();
    const id = actor.connect('first-frame', () => {
        actor.disconnect(id);
        this._tileWindow(window);
    });
});
```

**Rationale**: Positioning a window before its first frame can cause compositing artefacts
or be overridden by the application's own initial size request on Wayland.

**Alternatives considered**: GLib.timeout_add delay — rejected as fragile and
non-deterministic; `first-frame` is the canonical approach used by gnome-shell itself.

---

## 3. Keyboard Shortcuts

**Decision**: `Main.wm.addKeybinding()` + `Main.wm.removeKeybinding()`.
All bindings registered with `Shell.ActionMode.NORMAL`.

```js
// Register (in enable())
Main.wm.addKeybinding(
    'keybind-focus-left',           // must match GSettings key name (type "as")
    this._settings,                  // Gio.Settings
    Meta.KeyBindingFlags.NONE,
    Shell.ActionMode.NORMAL,
    () => this._focusDirection('left')
);

// Remove (in disable())
Main.wm.removeKeybinding('keybind-focus-left');
```

GSettings key type MUST be `as` (array of strings), e.g.:
```xml
<key name="keybind-focus-left" type="as">
    <default>["&lt;Super&gt;h"]</default>
</key>
```

**Default bindings** (i3-inspired, GNOME-conflict-free):

| Action | Default |
|---|---|
| Focus left/down/up/right | `<Super>h`, `<Super>j`, `<Super>k`, `<Super>l` |
| Move left/down/up/right | `<Super><Shift>h`, `<Super><Shift>j`, `<Super><Shift>k`, `<Super><Shift>l` |
| Resize shrink/grow | `<Super><Ctrl>h`, `<Super><Ctrl>l` |
| Toggle float | `<Super><Shift>space` |

**Rationale**: Super+hjkl is unused by GNOME Shell defaults, consistent with i3
conventions, and fully rebindable via the prefs UI.

**Alternatives considered**: Libinput gesture-based switching — rejected, too complex
and out of scope; GNOME shortcut schema registration — superseded by `addKeybinding`.

---

## 4. GSettings & Persistence

**Decision**: Extension GSettings via `this.getSettings()`. Schema ID:
`org.gnome.shell.extensions.workspace-tiling-window-manager`.

```js
// enable()
this._settings = this.getSettings();

// disable()
this._settings = null;
```

Schema path: `/org/gnome/shell/extensions/workspace-tiling-window-manager/`

Settings keys:

| Key | Type | Default | Purpose |
|---|---|---|---|
| `tiling-enabled-workspaces` | `ai` | `[]` | 0-based workspace indices with tiling on |
| `gap-size` | `u` | `4` | Pixel gap between tiles |
| `initial-split-axis` | `s` | `"horizontal"` | First split axis for Dwindle |
| `split-ratio` | `d` | `0.5` | Default split ratio |
| `min-tile-size` | `u` | `100` | Minimum px dimension before auto-float |
| `float-window-classes` | `as` | `[]` | WM class names that always float |
| `keybind-focus-left/right/up/down` | `as` | see above | Focus navigation |
| `keybind-move-left/right/up/down` | `as` | see above | Window movement |
| `keybind-resize-shrink/grow` | `as` | see above | Resize |
| `keybind-toggle-float` | `as` | `["<Super><Shift>space"]` | Float toggle |

**Workspace index stability**: Indices shift when workspaces are added/removed.
Listen to `global.workspace_manager`'s `workspaces-reordered` signal to revalidate
stored indices. For v1, simple index storage is sufficient.

**Rationale**: GSettings is the canonical GNOME settings store, integrates with dconf,
and survives shell restarts automatically. No custom serialisation needed.

---

## 5. Preferences UI

**Decision**: `ExtensionPreferences` with `fillPreferencesWindow(window)` for full
`Adw.PreferencesWindow` control with multiple pages. Custom `KeybindingRow` widget
(no built-in Adw keybinding row exists).

```js
// prefs.js
import {ExtensionPreferences} from
    'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class WorkspaceTilingWindowManagerPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window.add(buildWorkspacesPage(settings));
        window.add(buildShortcutsPage(settings));
        window.add(buildAppearancePage(settings));
        window.add(buildFloatRulesPage(settings));
    }
}
```

**KeybindingRow pattern** (from `spatial-window-navigator/prefs.js`):
- `KeyCaptureWindow` extends `Gtk.Window` — modal dialog capturing keypress via
  `Gtk.EventControllerKey`, converting to accelerator string with
  `Gtk.accelerator_name(keyval, mask)`.
- `KeybindingRow` extends `Adw.ActionRow` — shows `Gtk.ShortcutLabel`, clear button,
  opens `KeyCaptureWindow` on activation, reads/writes via `get_strv`/`set_strv`.

**Rationale**: The `spatial-window-navigator` extension already ships a complete,
working implementation of this pattern. The tiling extension will reuse it verbatim
by extracting it to `lib/keybindingRow.js`.

---

## 6. Workspace & Multi-Monitor Tracking

**Decision**: `global.workspace_manager` for workspace access; `workspace.get_work_area_for_monitor(n)` for usable rect; filter windows by `window.get_monitor()` for per-monitor isolation.

```js
// All workspaces
const n = global.workspace_manager.get_n_workspaces();
const ws = global.workspace_manager.get_workspace_by_index(i);

// Windows on workspace+monitor combo
const windows = ws.list_windows().filter(w =>
    w.get_monitor() === monitorIndex && shouldTile(w));

// Usable tiling area
const area = ws.get_work_area_for_monitor(monitorIndex);
```

**Multi-monitor model**: GNOME workspaces are global (span all monitors). Each
`(workspaceIndex, monitorIndex)` pair is treated as an independent tiling unit.
The `WorkspaceTiler` class manages one such pair.

**Alternatives considered**: Per-monitor workspace mode (`workspaces-only-on-primary`)
— out of scope for v1, assumed disabled.

---

## 7. Dwindle Layout Algorithm

**Decision**: Binary split-tree with alternating perpendicular axis splits.

```
n=1: [A fills screen]
n=2: [A | B]   (horizontal split, ratio 0.5)
n=3: [A | B ]  (B's right half splits vertically)
         [ C ]
n=4: [A | B ]  (C's bottom half splits horizontally)
         [C|D]
```

**Tree structure**:
- Internal node (`SplitContainer`): `{ direction, first, second, splitRatio, rect }`
- Leaf node (`TileNode`): `{ window, rect }`
- The "active leaf" (last inserted) is always split for the next window.

**Window removal reflow**: When a leaf is removed, its sibling takes the parent
container's full rect. The parent container is replaced by the sibling in the tree.

**Resize**: Adjusting `splitRatio` on the immediate parent container of the focused
leaf and recalculating child rects.

**Alternatives considered**: Spiral/Fibonacci (fixed ratios) — rejected in favour of
the more practical Dwindle (adjustable ratios per node, same visual pattern).
AwesomeWM masterstack — rejected as a different layout, deferred to v2.

---

## 8. Build System

**Decision**: Meson, following the existing `korba-gnome-extensions` project structure.

New extension directory: `workspace-tiling-window-manager/`
Add to `meson.build` extensions list: `'workspace-tiling-window-manager'`

```
workspace-tiling-window-manager/
├── extension.js
├── prefs.js
├── metadata.json.in
├── org.gnome.shell.extensions.workspace-tiling-window-manager.gschema.xml
├── meson.build
└── lib/
    ├── layoutProvider.js     # Abstract LayoutProvider base + registry
    ├── dwindleLayout.js      # DwindleLayout implements LayoutProvider
    ├── workspaceTiler.js     # Manages one (workspace, monitor) pair
    ├── tilingManager.js      # Coordinates all WorkspaceTilers
    └── keybindingRow.js      # Reusable keybinding prefs widget
```

**Rationale**: Mirrors the existing extension structure, uses the same Meson variables
(`uuid_suffix`, `shell_version`, `schemadir`, `extensiondir`), and keeps shared UI
utilities in `lib/` for potential reuse by future extensions in this repo.
