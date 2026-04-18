# Contract: GSettings Schema

**Feature**: `001-dynamic-window-tiling`
**Date**: 2026-04-14
**Schema ID**: `org.gnome.shell.extensions.workspace-tiling-window-manager`
**Schema path**: `/org/gnome/shell/extensions/workspace-tiling-window-manager/`
**File**: `workspace-tiling-window-manager/org.gnome.shell.extensions.workspace-tiling-window-manager.gschema.xml`

---

## Full Schema Definition

```xml
<?xml version="1.0" encoding="UTF-8"?>
<schemalist>
  <schema id="org.gnome.shell.extensions.workspace-tiling-window-manager"
          path="/org/gnome/shell/extensions/workspace-tiling-window-manager/">

    <!-- ── Workspace Configuration ─────────────────────────────────── -->

    <key name="tiling-enabled-workspaces" type="ai">
      <default>[]</default>
      <summary>Tiling-enabled workspace indices</summary>
      <description>
        List of 0-based workspace indices on which tiling is active.
        Changed exclusively from the Preferences panel.
      </description>
    </key>

    <!-- ── Layout ───────────────────────────────────────────────────── -->

    <key name="initial-split-axis" type="s">
      <default>"horizontal"</default>
      <summary>Initial split axis for the Dwindle layout</summary>
      <description>
        Direction of the first split when a second window opens on a tiled
        workspace. Must be "horizontal" or "vertical".
      </description>
    </key>

    <key name="split-ratio" type="d">
      <default>0.5</default>
      <range min="0.1" max="0.9"/>
      <summary>Default tile split ratio</summary>
      <description>
        Fraction of a split container allocated to the primary (first) child.
        Applied as the default when a new split is created. Range: 0.1–0.9.
      </description>
    </key>

    <!-- ── Appearance ───────────────────────────────────────────────── -->

    <key name="gap-size" type="u">
      <default>4</default>
      <summary>Gap between tiled windows (pixels)</summary>
      <description>
        Pixel gap applied between adjacent tiles and between tiles and the
        monitor work-area boundary. Set to 0 for gapless tiling.
      </description>
    </key>

    <!-- ── Floating Rules ───────────────────────────────────────────── -->

    <key name="min-tile-size" type="u">
      <default>100</default>
      <summary>Minimum tile dimension (pixels)</summary>
      <description>
        Windows whose natural size is smaller than this value in either
        dimension are automatically placed in floating mode.
      </description>
    </key>

    <key name="float-window-classes" type="as">
      <default>[]</default>
      <summary>Window classes that always float</summary>
      <description>
        WM class strings (as returned by Meta.Window.get_wm_class()) for
        windows that must always start in floating mode on tiled workspaces.
        Example: ["org.gnome.Calculator", "com.github.xournalpp.xournalpp"]
      </description>
    </key>

    <!-- ── Debug ────────────────────────────────────────────────────── -->

    <key name="debug-logging" type="b">
      <default>false</default>
      <summary>Enable debug logging</summary>
      <description>
        When true, the extension emits structured debug output via console.log /
        console.warn for tiling decisions (window inserted/removed, reflow
        triggered, float override applied, keybinding fired). Output is visible
        via journalctl. Has zero performance overhead when false.
      </description>
    </key>

    <!-- ── Keyboard Shortcuts — Focus ───────────────────────────────── -->

    <key name="keybind-focus-left" type="as">
      <default>["&lt;Super&gt;h"]</default>
      <summary>Move focus left</summary>
    </key>

    <key name="keybind-focus-down" type="as">
      <default>["&lt;Super&gt;j"]</default>
      <summary>Move focus down</summary>
    </key>

    <key name="keybind-focus-up" type="as">
      <default>["&lt;Super&gt;k"]</default>
      <summary>Move focus up</summary>
    </key>

    <key name="keybind-focus-right" type="as">
      <default>["&lt;Super&gt;l"]</default>
      <summary>Move focus right</summary>
    </key>

    <!-- ── Keyboard Shortcuts — Move Window ─────────────────────────── -->

    <key name="keybind-move-left" type="as">
      <default>["&lt;Super&gt;&lt;Shift&gt;h"]</default>
      <summary>Move window left</summary>
    </key>

    <key name="keybind-move-down" type="as">
      <default>["&lt;Super&gt;&lt;Shift&gt;j"]</default>
      <summary>Move window down</summary>
    </key>

    <key name="keybind-move-up" type="as">
      <default>["&lt;Super&gt;&lt;Shift&gt;k"]</default>
      <summary>Move window up</summary>
    </key>

    <key name="keybind-move-right" type="as">
      <default>["&lt;Super&gt;&lt;Shift&gt;l"]</default>
      <summary>Move window right</summary>
    </key>

    <!-- ── Keyboard Shortcuts — Resize ──────────────────────────────── -->

    <key name="keybind-resize-shrink" type="as">
      <default>["&lt;Super&gt;&lt;Ctrl&gt;h"]</default>
      <summary>Shrink focused tile</summary>
      <description>
        Decrease the split ratio at the focused tile's parent boundary
        by the default step (5%).
      </description>
    </key>

    <key name="keybind-resize-grow" type="as">
      <default>["&lt;Super&gt;&lt;Ctrl&gt;l"]</default>
      <summary>Grow focused tile</summary>
      <description>
        Increase the split ratio at the focused tile's parent boundary
        by the default step (5%).
      </description>
    </key>

    <!-- ── Keyboard Shortcuts — Float ───────────────────────────────── -->

    <key name="keybind-toggle-float" type="as">
      <default>["&lt;Super&gt;&lt;Shift&gt;space"]</default>
      <summary>Toggle floating mode for the focused window</summary>
    </key>

  </schema>
</schemalist>
```

---

## Access Patterns

```js
// Read workspace list
const enabledWorkspaces = this._settings.get_value('tiling-enabled-workspaces')
    .deepUnpack();   // → number[]

// Write workspace list
this._settings.set_value('tiling-enabled-workspaces',
    new GLib.Variant('ai', [0, 2]));

// Read gap size
const gap = this._settings.get_uint('gap-size');

// Read/write keybinding
const [accel = ''] = this._settings.get_strv('keybind-focus-left');
this._settings.set_strv('keybind-focus-left', ['<Super>h']);

// Read float classes
const floatClasses = this._settings.get_strv('float-window-classes');

// Read debug flag (check inline, zero-cost when false)
if (this._settings.get_boolean('debug-logging'))
    console.log('[workspace-tiling-window-manager] window inserted:', window.get_title());
```

---

## Validation Rules

| Key | Constraints |
|---|---|
| `tiling-enabled-workspaces` | Indices MUST be in range `[0, n_workspaces - 1]`. Stale indices are silently ignored at runtime. |
| `initial-split-axis` | MUST be exactly `"horizontal"` or `"vertical"`. Any other value is treated as `"horizontal"`. |
| `split-ratio` | GSettings `range` enforces `[0.1, 0.9]` at the schema level. |
| `gap-size` | No upper bound enforced; values > 100 are unreasonably large but not invalid. |
| `min-tile-size` | No upper bound enforced; values > monitor height are treated as "always float". |
| `float-window-classes` | Values are compared to `Meta.Window.get_wm_class()` output — case-sensitive. |
| `debug-logging` | Boolean; no range constraint. Safe to toggle at runtime — the extension reads it on each log call. |
| Keybinding keys | `[]` (empty array) means "unbound". GNOME Shell enforces conflict detection at `addKeybinding` time. |
