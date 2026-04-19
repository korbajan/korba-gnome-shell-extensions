# Developer Quickstart: Advanced Window Decoration

**Feature**: `002-window-decoration`
**Branch**: `002-window-decoration`
**Extension UUID**: `advanced-window-decoration@korbajan.github.com`

---

## Prerequisites

- GNOME Shell 50 on Wayland.
- Node.js (for `npm test` — Jasmine).
- Meson + Ninja (`meson` ≥ 1.1.0).
- The repo cloned and the meson build already configured (shared with sibling extensions).

---

## 1. Build & install

```bash
# From the repo root — installs all three extensions (no sudo needed)
meson setup build --prefix="$HOME/.local"   # first time only
meson install -C build
```

The new extension installs to:
```
~/.local/share/gnome-shell/extensions/advanced-window-decoration@korbajan.github.com/
```

The GSettings schema is compiled automatically by `gnome.post_install(glib_compile_schemas: true)`.

---

## 2. Enable the extension

```bash
gnome-extensions enable advanced-window-decoration@korbajan.github.com
gnome-extensions info   advanced-window-decoration@korbajan.github.com
```

Expected state output: `State: ENABLED`.

---

## 3. Reload after JS changes

```bash
# Soft reload (module cache may persist — prefer logout/login for JS changes)
gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell \
  --method org.gnome.Shell.Extensions.DisableExtension \
  "advanced-window-decoration@korbajan.github.com"

gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell \
  --method org.gnome.Shell.Extensions.EnableExtension \
  "advanced-window-decoration@korbajan.github.com"
```

For schema or source changes: **log out and back in** (module cache in GNOME Shell is not reloaded on disable/enable — see CLAUDE.md).

---

## 4. Run unit tests

```bash
cd advanced-window-decoration
npm install   # first time only
npm test      # runs Jasmine — windowFilter, settingsClamp, windowRegistry specs
```

All specs must be green before implementation is considered mergeable (Constitution III).

---

## 5. Open preferences

```bash
gnome-extensions prefs advanced-window-decoration@korbajan.github.com
```

---

## 6. Smoke test (minimum acceptance coverage)

Run these after every `meson install` cycle. For each scenario, observe the result live on the Wayland session.

### Scenario 1.1 — Title bar toggle (spec User Story 1, acceptance scenario 1)

1. Open any server-side-decorated application (e.g. a terminal emulator or file manager opened via XWayland, or a GTK3 app).
2. Focus the window.
3. Press **`<Super><Alt>d`** (default shortcut).
4. **Expected**: title bar disappears; window content expands into the reclaimed space; window outer position does not jump.
5. Press **`<Super><Alt>d`** again.
6. **Expected**: title bar reappears; outer position unchanged.

### Scenario 2.1 — Border visible on new window (spec User Story 2, acceptance scenario 1)

1. With `border-thickness` set to `4` (via preferences or `gsettings set`), open any regular window.
2. **Expected**: a border of the configured color and thickness is drawn around the window's outer edge.

### Scenario 2.3 — Border color updates live (spec User Story 2, acceptance scenario 3)

1. Open the preferences window (`gnome-extensions prefs …`).
2. Change the default border color to a bright red using the color picker.
3. **Expected**: the border of every currently open managed window updates to red within 1 second, without any window being closed and reopened.

### Scenario 3.2 — Settings persist across sessions (spec User Story 3, acceptance scenario 2)

1. Change the border thickness to `6` and the border color to blue in preferences.
2. Log out and log back in.
3. Open the preferences window.
4. **Expected**: thickness shows `6`, color shows blue.
5. Open any regular window.
6. **Expected**: border is 6 px and blue.

### Scenario — Lifecycle integrity (Constitution III, FR-011, FR-015)

1. Enable the extension; open five windows; toggle two title bars; set a non-default border color.
2. Disable: `gnome-extensions disable advanced-window-decoration@korbajan.github.com`.
3. Re-enable: `gnome-extensions enable advanced-window-decoration@korbajan.github.com`.
4. **Expected**: no journal errors, no orphaned border actors (`global.window_group` child count matches the pre-enable baseline), no duplicate keybinding (`<Super><Alt>d` triggers the toggle exactly once, not twice).

### Disable-restore invariant (FR-011, SC-003)

1. Toggle the title bar off on two different windows using the shortcut.
2. Change the border color to bright green.
3. Disable the extension: `gnome-extensions disable advanced-window-decoration@korbajan.github.com`.
4. **Expected**: every window that had a hidden title bar regains its title bar. Every window loses its green border. No residual visual artefacts remain.

---

## 7. Debug logging

```bash
# Enable structured debug output
gsettings --schemadir "$HOME/.local/share/glib-2.0/schemas" \
  set org.gnome.shell.extensions.advanced-window-decoration debug-logging true

# Watch live
journalctl /usr/bin/gnome-shell -f --no-pager | grep advanced-window-decoration
```

---

## 8. Lint & format

```bash
# From repo root
npm run lint          # ESLint — must be zero errors
npm run format:check  # Prettier — must be zero drift
```

---

## 9. Key file locations

| File | Purpose |
|------|---------|
| `advanced-window-decoration/extension.js` | Entry point — `enable()` / `disable()` |
| `advanced-window-decoration/prefs.js` | Adw preferences window |
| `advanced-window-decoration/lib/decorationManager.js` | Top-level controller |
| `advanced-window-decoration/lib/titlebarController.js` | Hide/show title bar per window |
| `advanced-window-decoration/lib/borderController.js` | Border actor lifecycle |
| `advanced-window-decoration/lib/windowRegistry.js` | `Map<MetaWindow, ManagedWindow>` |
| `advanced-window-decoration/lib/windowFilter.js` | `shouldManage(window)` predicate |
| `advanced-window-decoration/lib/settingsClamp.js` | Thickness clamp + RGBA helpers |
| `advanced-window-decoration/org.gnome.shell.extensions.advanced-window-decoration.gschema.xml` | GSettings schema (source of truth) |
| `specs/002-window-decoration/contracts/gsettings-schema.md` | Schema contract documentation |
