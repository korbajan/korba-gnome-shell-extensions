# Phase 0 Research: Advanced Window Decoration

**Feature**: `002-window-decoration`
**Date**: 2026-04-18
**Purpose**: Record the technical decisions that underpin the implementation plan. Each topic follows the *Decision / Rationale / Alternatives considered* format. No `[NEEDS CLARIFICATION]` markers remain in the spec; the items below are **technical** choices, not missing requirements.

---

## 1. Title-bar hide/show mechanism on GNOME Shell 50 Wayland

### Decision

Use Meta's `Meta.Window.set_decorated(bool)` (available on Wayland via Mutter's compositor-side frame handling) as the **attempt** path, combined with a `client_decorated` / `get_frame_type()` check to detect when a window is CSD and cannot be server-controlled. The flow is:

1. On toggle, resolve the focused `Meta.Window`.
2. If `window.is_client_decorated()` returns `true`, treat the window as CSD and take the silent-fallback path (FR-019): attempt the call anyway (future Mutter versions may gain broader support), record no user-visible output, and leave the window untouched if the call has no visible effect.
3. If the window is SSD, toggle `set_decorated(!current)` and then call `move_resize_frame(false, x, y, w, h)` with the saved outer rectangle to keep the outer on-screen position stable (FR-002).
4. Store the original `get_decorated()` value inside the `ManagedWindow` record so `disable()` can restore it (FR-011).

For newly mapped windows covered by the "hide on new windows" default (FR-004): wait for the `first-frame` signal on the `MetaWindowActor` before calling `set_decorated(false)` — CLAUDE.md documents that Wayland ignores geometry calls before the first frame is drawn, and this applies to frame/decoration changes as well.

### Rationale

- `Meta.Window.set_decorated()` is the only compositor-side, version-stable API for asking Mutter to drop the server-side frame on GNOME Shell 50 without forking Mutter or poking X properties through XWayland.
- `is_client_decorated()` is a clean discriminator for the silent-fallback path required by FR-019: no notifications, no logs.
- The `first-frame` guard matches the pattern already used in `workspace-tiling-window-manager` (see CLAUDE.md Wayland Gotchas), so the new extension stays consistent with existing code.

### Alternatives considered

- **`_GTK_HIDE_TITLEBAR_WHEN_MAXIMIZED` property** (Pixel Saver style): maximized-only; does not satisfy FR-001 which requires on-demand toggling of any focused window regardless of maximization state.
- **Poking `_MOTIF_WM_HINTS` through XWayland**: works only for X11 apps running under XWayland, forces an X11 dependency, and breaks cleanly on Wayland-native apps. Rejected — violates the Wayland-only constraint (CLAUDE.md).
- **Overlaying an opaque actor on top of the title bar region**: visually hides the bar but does not reclaim content space (the window's client rectangle doesn't change). Fails acceptance scenario 1.1 ("content area grows into the reclaimed space"). Rejected.
- **Patching each GTK app via `gtk-decoration-layout` GSettings**: global, not per-window, and outside a shell extension's remit. Rejected.

---

## 2. Per-window border actor

### Decision

Draw each border as a single `St.Widget` with a transparent center and a colored stroke implemented as four child `Clutter.Actor` rectangles (top, bottom, left, right). Parent every border actor to `global.window_group` and position each one to track the associated `MetaWindow`'s `get_frame_rect()`:

- Compute `{x, y, width, height}` from `window.get_frame_rect()` on creation.
- On `position-changed` and `size-changed` signals of the `MetaWindow`, recompute and apply the new geometry to the border actor in the same main-loop tick.
- On `notify::focus-window` on `global.display`, swap the fill color of every tracked border between the *default* and *focused* RGBA values (FR-006, FR-020). Exactly one window carries the focused color at any time.
- Use `St.Widget` with inline style `background-color: rgba(...)` — Clutter + St support 32-bit RGBA natively.
- z-order: `raise_child_above_sibling(borderActor, windowActor)` so the border sits on top of the client without occluding it (four thin rects around the edge). When the window raises, Mutter re-parents its actor; re-raise the border on `raised` / `focus-window`.

### Rationale

- `global.window_group` is the standard overlay point used by compositor-level extensions; it participates in workspace transitions and monitor-hotplug geometry automatically.
- Four edge rectangles (instead of one CSS border on a big transparent rect) avoid the cost of full-window repaints and keep the overlay click-transparent by default.
- `St.Widget` gives CSS-style color parsing for free and matches the GNOME HIG widget stack (Constitution IV).
- Signal set (`position-changed`, `size-changed`, `notify::focus-window`) is the minimum that covers acceptance scenarios 2.2, 2.3, 2.5, 2.6; no additional polling required.

### Alternatives considered

- **Single `Clutter.Actor` with a custom paint vfunc drawing a stroked rectangle**: more code, no real gain over four edge rects; harder to hit-test if we ever need events. Rejected.
- **CSS box-shadow on the window actor itself**: GNOME Shell's `MetaWindowActor` is not a `St.Widget` and does not honor arbitrary CSS. Rejected.
- **Drop-shadow ClutterEffect**: produces a soft shadow, not the crisp accent border the spec requires (FR-005). Rejected.

---

## 3. Outer-position preservation when toggling the title bar (FR-002)

### Decision

Before toggling decoration, capture `window.get_frame_rect()` (outer rect including current title bar). Toggle decoration. Immediately call `move_resize_frame(false, x, y, newW, newH)` where `newW/newH = frame.width / frame.height` so Mutter keeps the outer rectangle fixed; the client area absorbs the reclaimed / restored title-bar height. If the window is maximized, unmaximize it first (CLAUDE.md Wayland Gotcha — maximized windows silently ignore `move_resize_frame`), then re-maximize with the same flags.

### Rationale

- Empirically on Mutter, `set_decorated(false)` on an already-mapped window shrinks the outer rect by the title-bar height unless the caller re-issues `move_resize_frame` with the original outer dimensions. Mirroring the pattern documented in `workspace-tiling-window-manager/lib/utils.js` (unmaximize-before-resize) keeps the toggle side-effect-free for tiling.
- Explicit re-issue is cheaper than waiting for an internal relayout and avoids the visible "jump" that SC-001 forbids.

### Alternatives considered

- **Trust Mutter to preserve outer rect**: fails on live toggles of already-mapped windows in current GNOME Shell 50 builds; rejected.
- **Animate the change**: adds complexity, violates SC-001's "no perceptible flicker" bar under reduced-motion sessions. Rejected — changes are snapped instantly and documented in the plan.

---

## 4. Coexistence with `workspace-tiling-window-manager` and `spatial-window-navigator`

### Decision

The new extension listens to an **independent** set of signals — no callback attached to any object the tiling extension owns. Specifically:

- `global.display.connect('window-created', …)` — shared signal but each listener is independent; no conflict.
- `global.display.connect('notify::focus-window', …)` — same.
- `Main.layoutManager.connect('monitors-changed', …)` — only if the border geometry tracking needs monitor-level triggers; expected not required because `size-changed` on the window covers monitor scale changes.
- `Main.wm.addKeybinding('keybind-toggle-titlebar', …)` — the extension registers exactly one keybinding; we verify at research time that the default chosen binding does not collide with any binding registered by the sibling extensions (see §6).

Crucially, the border actor is **additive** on top of the window actor and does **not** call `move_resize_frame` on the window (only title-bar toggling does, and only on the single focused window at toggle time). Borders therefore do not compete with the tiler's geometry ownership. FR-017 is satisfied by construction: borders sit inside the tile gap; if gap < 2×thickness, the adjacent borders visually touch or overlap — no functional problem.

### Rationale

- GObject signals are multicast; multiple extensions can listen to `window-created` without stepping on each other.
- The only mutation this extension performs is `set_decorated()` + a one-shot `move_resize_frame()` during a title-bar toggle; the tiler reacts to `size-changed` and will re-lay-out the window if needed — no conflicting writes.

### Alternatives considered

- **Explicit handshake / IPC with the tiling extension** (e.g., reading its GSettings or calling into its JS): couples the extensions tightly, violates Constitution Principle VII (Simplicity). Rejected.
- **Conditionally skip border on tiled windows**: loses the exact feature the user will want when tiling (focus indication on edge-to-edge tiles). Rejected (matches Q1/A1 from `/speckit.clarify`).

---

## 5. Alpha-capable color picker in Adw/Gtk 4 preferences

### Decision

Use `Gtk.ColorDialogButton` (available since GTK 4.10; GNOME Shell 50 ships with GTK 4.14+) with a `Gtk.ColorDialog` instance whose `with_alpha` property is `true`. One button per color key (default, focused). Bind the button's `rgba` property to the GSettings key via `Gio.Settings.bind_with_mapping()` with a serializer that converts `Gdk.RGBA ↔ "rgba(r,g,b,a)"` string (the schema stores colors as strings; see `contracts/gsettings-schema.md`).

### Rationale

- `Gtk.ColorDialogButton` is the non-deprecated successor to `Gtk.ColorButton` and is the Adw-idiomatic choice for GNOME 44+.
- Alpha support is a first-class toggle on `Gtk.ColorDialog`, making FR-020 a one-line property set.
- Storing colors as `"rgba(r,g,b,a)"` strings in the schema means the preferences window, the St CSS (via `set_style('background-color: ' + str)`), and any user who edits `gsettings` directly all see the same canonical form.

### Alternatives considered

- **Store colors as four `d` (double) keys per color**: doubles the schema key count, loses the single-string convenience for CSS. Rejected.
- **Store as `#RRGGBBAA`**: less forgiving for gsettings CLI editing; `rgba(...)` maps 1:1 onto St's CSS parser. Rejected.
- **`Gtk.ColorButton` (deprecated)**: works but triggers deprecation warnings in GTK 4.14+. Rejected.

---

## 6. Inline shortcut-capture row

### Decision

Build a small inline widget in `prefs.js` (≈40 LOC, no new `lib/` file) that renders an `Adw.ActionRow` with:

- A `Gtk.ShortcutLabel` suffix that displays the current accelerator parsed from the GSettings key.
- A `Gtk.Button` (label "Set shortcut…") that, when clicked, opens a small modal dialog with a keyboard-capture area; on first non-modifier keypress, it serializes the accelerator via `Gtk.accelerator_name(keyval, state)` and writes it back to GSettings.

**Default shortcut**: `<Super>d` ("decoration") — verified against the bindings in `workspace-tiling-window-manager` (`<Super>h/j/k/l` navigation, `<Super><Shift>h/j/k/l` move, `<Super><Ctrl>h/l` resize, `<Super><Shift>space` float) and the stock GNOME Shell bindings. `<Super>d` maps to "Show desktop" by default in GNOME; we choose `<Super><Alt>d` instead to avoid that collision. Final default: **`<Super><Alt>d`**.

### Rationale

- Avoids importing `workspace-tiling-window-manager/lib/keybindingRow.js`, which would trigger Constitution VI's "MUST extract shared logic" clause and inflate scope into a repo-wide refactor.
- `Gtk.ShortcutLabel` renders cleanly on every GNOME theme and respects accessibility.
- One shortcut is all this extension needs (FR-001); the tiling extension's heavier `KeybindingRow` is overkill for a single row.

### Alternatives considered

- **Import `keybindingRow.js` from the sibling**: violates extension boundary / install independence; triggers shared-lib extraction requirement. Rejected.
- **Fork-and-simplify `keybindingRow.js` into this extension's `lib/`**: duplicates logic across extensions, violates Constitution VI. Rejected.
- **Use GNOME Settings' keyboard panel for the shortcut**: cannot preload the user's shortcut from our schema cleanly; poor discoverability. Rejected.

---

## 7. Per-window override state machine (FR-018, FR-021)

### Decision

Each `ManagedWindow` record carries a boolean `userOverrode: bool` that starts `false`. The state machine is:

- **Window mapped, policy = Visible**: `userOverrode=false`, title bar visible.
- **Window mapped, policy = Hidden**: `userOverrode=false`, title bar hidden.
- **User presses shortcut**: `userOverrode` flips to `true`; title bar toggles to the opposite of its current state.
- **User changes default policy in prefs (FR-021)**: iterate every `ManagedWindow` whose `userOverrode === false` and apply the new default; windows with `userOverrode === true` are skipped.
- **Window closes**: the `ManagedWindow` record (including `userOverrode`) is dropped — no cross-session persistence (FR-018).

No cross-session persistence is ever stored; when the extension is disabled, every `ManagedWindow` is restored to its captured `originalDecorated` state and the in-memory record discarded (FR-011).

### Rationale

- A single boolean is sufficient; FR-018 ties override scope to window lifetime and FR-021 ties retroactive-policy behavior to "no active override". The two-state flag encodes both cleanly.
- Keeps `lib/windowRegistry.js` trivially testable via Jasmine — state transitions are pure.

### Alternatives considered

- **Record an enum (`Inherit | ForcedVisible | ForcedHidden`)**: adds a state for no benefit — the current decorated state of the window already tells us which the user chose, so a boolean "is this state due to user action" is all that's needed. Rejected.
- **Store per-application override instead of per-window**: explicitly out of scope per spec Assumptions. Rejected.

---

## Summary of decisions

| # | Topic | Decision |
|---|-------|----------|
| 1 | Title-bar hide mechanism | `Meta.Window.set_decorated()` + `is_client_decorated()` discriminator + silent fallback + `first-frame` guard for new windows |
| 2 | Border actor | `St.Widget` wrapper with four child edge rectangles, parented to `global.window_group`, tracked via `position-changed`/`size-changed`/`notify::focus-window` |
| 3 | Outer-position preservation | Capture frame rect, toggle decoration, re-issue `move_resize_frame` with original outer dimensions (unmaximize first if needed) |
| 4 | Sibling-extension coexistence | Independent signal set, additive overlay only; no writes competing with the tiler |
| 5 | Color picker | `Gtk.ColorDialogButton` with `Gtk.ColorDialog(with_alpha = true)`; store as `"rgba(r,g,b,a)"` strings |
| 6 | Shortcut capture | Inline ≈40 LOC Adw row with `Gtk.ShortcutLabel`; default `<Super><Alt>d` |
| 7 | Per-window override flag | Single boolean `userOverrode`, live-only, reset on window close / extension disable |
