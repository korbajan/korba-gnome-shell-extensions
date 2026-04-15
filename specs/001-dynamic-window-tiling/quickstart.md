# Quickstart: Dynamic Window Tiling (Dwindle)

**Feature**: `001-dynamic-window-tiling`
**Date**: 2026-04-14

---

## Prerequisites

- GNOME Shell 50 or later (`gnome-shell --version`)
- Meson ≥ 1.1.0 (`meson --version`)
- `glib-compile-schemas` (part of `glib2` / `libglib2.0-dev`)
- A Wayland GNOME session (X11 not supported)

---

## Build & Install

```bash
# 1. Clone and enter the repository
git clone https://github.com/korbajan/korba-gnome-extensions.git
cd korba-gnome-extensions

# 2. Configure Meson build
meson setup build

# 3. Install to user extensions directory (no root required)
meson install -C build --destdir ~/.local

# 4. Compile GSettings schemas (required after first install)
glib-compile-schemas ~/.local/usr/local/share/glib-2.0/schemas/
# Or, if installed to the standard prefix:
glib-compile-schemas ~/.local/share/glib-2.0/schemas/
```

> **Tip**: Run `gnome-extensions list` to confirm
> `workspace-tiling-window-manager@korbajan.github.com` appears after installation.

---

## Enable the Extension

```bash
gnome-extensions enable workspace-tiling-window-manager@korbajan.github.com
```

Or open **GNOME Extensions** app and toggle **Workspace Tiling Window Manager** on.

---

## Enable Tiling on a Workspace

1. Open **GNOME Extensions** → **Workspace Tiling Window Manager** → **Settings**
   (or run `gnome-extensions prefs workspace-tiling-window-manager@korbajan.github.com`).
2. On the **Workspaces** page, toggle on the workspaces you want tiled.
3. Switch to a tiled workspace — open windows are immediately arranged.

---

## Default Keyboard Shortcuts

| Action | Shortcut |
|---|---|
| Focus left / down / up / right | `Super+h/j/k/l` |
| Move window left / down / up / right | `Super+Shift+h/j/k/l` |
| Resize tile (shrink / grow) | `Super+Ctrl+h/l` |
| Toggle floating mode | `Super+Shift+Space` |

All shortcuts are rebindable from **Settings → Keyboard Shortcuts**.

---

## Development Workflow

### Run the extension without installing

```bash
# Build and stage to a local directory
meson setup build --prefix=/usr
meson install -C build --destdir /tmp/ext-stage

# Symlink into the user extension directory (fast iteration)
ln -sf /tmp/ext-stage/usr/share/gnome-shell/extensions/workspace-tiling-window-manager@korbajan.github.com \
    ~/.local/share/gnome-shell/extensions/

# Reload GNOME Shell (Wayland — must restart the session or use a nested shell)
dbus-run-session -- gnome-shell --nested --wayland
```

### Nested GNOME Shell for safe testing

```bash
# Launch a nested Wayland compositor at 1280×800
dbus-run-session -- gnome-shell --nested --wayland &
# In the nested session, enable the extension and test
```

### Watch GJS logs

```bash
journalctl -f -o cat GNOME_SHELL_COMPONENT=extensions
# Or:
journalctl /usr/bin/gnome-shell -f | grep -i dwindle
```

---

## Linting & Tests

```bash
# Lint (ESLint — config inherited from repo root)
npx eslint workspace-tiling-window-manager/

# Format check (Prettier)
npx prettier --check "workspace-tiling-window-manager/**/*.js"

# Unit tests (lib/ modules are pure JS, testable with Node/Jasmine)
npm test
```

---

## Uninstall

```bash
gnome-extensions disable workspace-tiling-window-manager@korbajan.github.com
meson install -C build --destdir ~/.local --tags runtime --strip
# Or simply delete the extension directory:
rm -rf ~/.local/share/gnome-shell/extensions/workspace-tiling-window-manager@korbajan.github.com
```
