# GSettings Schema Contract: `advanced-window-decoration`

**Schema ID**: `org.gnome.shell.extensions.advanced-window-decoration`
**Path**: `/org/gnome/shell/extensions/advanced-window-decoration/`
**Source file**: `advanced-window-decoration/org.gnome.shell.extensions.advanced-window-decoration.gschema.xml`
**Installed by**: Meson `gnome.post_install(glib_compile_schemas: true)`

This document is the canonical reference for every key the extension exposes to users and tests. Changes to the XML must keep this document in sync. Changes to this document are breaking changes to the extension's public interface.

---

## Keys

### `default-titlebar-policy`

| Attribute | Value |
|-----------|-------|
| Type | `s` (string) |
| Default | `"visible"` |
| Valid values | `"visible"` — title bars shown on new windows; `"hidden"` — title bars hidden on new windows |
| Summary | Default title bar visibility for newly created windows |
| Description | Determines whether the extension hides or shows the title bar as each new regular window is mapped. Applies retroactively to all open windows whose title bar state has not been overridden by the per-window keyboard shortcut. |
| Related FRs | FR-003, FR-004, FR-021 |

**Validation**: if an unrecognised string is stored (e.g. by a bug or manual `gsettings set`), the extension falls back to `"visible"` and emits a debug-log warning (gated by `debug-logging`).

---

### `border-thickness`

| Attribute | Value |
|-----------|-------|
| Type | `u` (unsigned integer) |
| Default | `2` |
| Range | `0` – `32` (enforced by schema `<range>`) |
| Summary | Window border thickness in logical pixels |
| Description | Thickness of the decorative border drawn around each managed window's outer edge. A value of 0 renders no visible border while keeping the title-bar toggle and other features active. |
| Related FRs | FR-005, FR-008, FR-014 |

**Validation**: the schema `<range>` element rejects values outside `[0, 32]` at the GSettings layer. The extension additionally clamps on read as defence in depth (FR-014).

---

### `border-color`

| Attribute | Value |
|-----------|-------|
| Type | `s` (string) |
| Default | `"rgba(128,128,128,0.80)"` |
| Format | `"rgba(<0–255>,<0–255>,<0–255>,<0.00–1.00>)"` — matching CSS / Gdk RGBA notation |
| Summary | Border color for unfocused (background) windows |
| Description | RGBA color of the border drawn around windows that are not currently focused. The alpha component allows semi-transparent borders; a fully transparent value (alpha = 0.0) produces no visible border regardless of thickness. |
| Related FRs | FR-005, FR-007, FR-020 |

**Validation**: parsed via `Gdk.RGBA.parse()` on read. Unparseable string → extension falls back to the schema default value and logs a debug warning.

---

### `focused-border-color`

| Attribute | Value |
|-----------|-------|
| Type | `s` (string) |
| Default | `"rgba(53,132,228,1.00)"` |
| Format | Same as `border-color` |
| Summary | Border color for the focused window |
| Description | RGBA color of the border drawn around the currently focused window. Allows the user to visually distinguish the active window from the others. When set to the same value as `border-color`, all windows appear identical. |
| Related FRs | FR-006, FR-007, FR-020 |

**Validation**: same as `border-color`.

---

### `toggle-titlebar-shortcut`

| Attribute | Value |
|-----------|-------|
| Type | `as` (array of strings) |
| Default | `["<Super><Alt>d"]` |
| Format | Array of accelerator strings accepted by `Gtk.accelerator_parse()` |
| Summary | Keyboard shortcut to toggle the focused window's title bar |
| Description | Configurable accelerator for the per-window title bar toggle action (FR-001). The default `<Super><Alt>d` is chosen to avoid conflicts with GNOME Shell's built-in `<Super>d` ("Show desktop") and all shortcuts registered by the sibling extensions. Stored as an array so the extension can pass it directly to `Main.wm.addKeybinding()`. |
| Related FRs | FR-001, FR-012 |

**Validation**: if the array is empty or contains an unparseable accelerator, the keybinding is silently not registered. The preferences UI warns the user in this case.

---

### `debug-logging`

| Attribute | Value |
|-----------|-------|
| Type | `b` (boolean) |
| Default | `false` |
| Summary | Enable debug logging |
| Description | When `true`, the extension emits structured debug output via `console.log` / `console.warn` for decoration decisions (window accepted/rejected by filter, title bar toggled, border actor created/destroyed, settings change applied). Output is visible via `journalctl /usr/bin/gnome-shell -f`. Has zero performance overhead when `false`. |
| Related FRs | FR-015 (diagnostics) |

---

## Canonical access patterns

### From shell scripts / manual testing

```bash
# Schema must be on the compiled schemas path; install extension first.
SCHEMA="org.gnome.shell.extensions.advanced-window-decoration"
SDIR="$HOME/.local/share/glib-2.0/schemas"

# Read defaults
gsettings --schemadir "$SDIR" get "$SCHEMA" border-thickness
gsettings --schemadir "$SDIR" get "$SCHEMA" border-color

# Enable "hide on new windows" default
gsettings --schemadir "$SDIR" set "$SCHEMA" default-titlebar-policy "'hidden'"

# Change border to a 3 px translucent red
gsettings --schemadir "$SDIR" set "$SCHEMA" border-thickness 3
gsettings --schemadir "$SDIR" set "$SCHEMA" border-color "'rgba(220,50,50,0.75)'"

# Enable debug output
gsettings --schemadir "$SDIR" set "$SCHEMA" debug-logging true
```

### From the extension itself (GJS)

```js
const settings = this.getSettings();   // inside Extension or ExtensionPreferences

// Read
const policy = settings.get_string('default-titlebar-policy');
const thickness = settings.get_uint('border-thickness');

// Write (preferences only)
settings.set_string('border-color', 'rgba(53,132,228,0.90)');

// React to changes
settings.connect('changed::border-thickness', () => { /* update actors */ });
```

---

## Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-04-18 | Initial schema — six keys as specified in `data-model.md` |
