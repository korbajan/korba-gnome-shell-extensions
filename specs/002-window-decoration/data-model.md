# Phase 1 Data Model: Advanced Window Decoration

**Feature**: `002-window-decoration`
**Date**: 2026-04-18
**Source**: Entities distilled from [spec.md](./spec.md) §Key Entities, cross-referenced with [research.md](./research.md) decisions.

The extension has no on-disk data model beyond GSettings. This document captures:

- The **settings model** (`DecorationProfile`) — the user-facing configuration surface.
- The **in-memory model** (`ManagedWindow`, `PerWindowOverrideFlag`) — transient records the extension holds while enabled.

No databases, no files, no RPC. Every record's lifecycle is bounded by either the GNOME session (settings) or the window lifetime (in-memory records).

---

## 1. `DecorationProfile` (settings-backed)

Backed by GSettings schema `org.gnome.shell.extensions.advanced-window-decoration`. Each field below is a schema key; the full canonical contract lives in [contracts/gsettings-schema.md](./contracts/gsettings-schema.md).

| Field | Type | Default | Range / Validation | Source FR | Notes |
|-------|------|---------|--------------------|-----------|-------|
| `default-titlebar-policy` | string (enum: `"visible"` / `"hidden"`) | `"visible"` | must be one of the two values | FR-003, FR-004, FR-021 | `"visible"` keeps fresh installs visually close to stock GNOME (spec Assumptions). |
| `border-thickness` | uint | `2` | 0 ≤ n ≤ 32 | FR-005, FR-008, FR-014 | `0` renders no border (FR-008); upper cap of 32 px chosen as a sensible ceiling — documented in schema `<range>`. |
| `border-color` | string (`"rgba(r,g,b,a)"`) | `"rgba(128,128,128,0.80)"` | must match `rgba(<0-255>,<0-255>,<0-255>,<0.0-1.0>)` | FR-005, FR-020 | Neutral grey at 80 % opacity visible on both light and dark themes. |
| `focused-border-color` | string (`"rgba(r,g,b,a)"`) | `"rgba(53,132,228,1.00)"` | same regex as `border-color` | FR-006, FR-020 | GNOME accent blue at full opacity. |
| `toggle-titlebar-shortcut` | array of string (GSettings `as`) | `["<Super><Alt>d"]` | at least one valid accelerator string | FR-001, FR-012 | Array form matches `Main.wm.addKeybinding` expectation. |
| `debug-logging` | boolean | `false` | n/a | FR-015 (implied; parallels sibling extensions) | Gates `console.log` / `console.warn` emissions — zero overhead when false. |

### Validation rules

- `border-thickness`: clamp to `[0, 32]` on read and on settings change. If the GSettings layer enforces `<range>`, the clamp is a defence in depth for older dconf versions. (FR-014)
- `border-color` / `focused-border-color`: parsed via `Gdk.RGBA.parse()` on read. Unparseable value → fall back to the schema default and log at `debug-logging = true`. (FR-014)
- `default-titlebar-policy`: unknown enum value → fall back to `"visible"`.

### State transitions

The profile itself has no intrinsic state — it is a bag of key/value fields. The consuming controllers (titlebarController, borderController) react to `Gio.Settings::changed::<key>` signals:

- `changed::default-titlebar-policy` → iterate managed windows where `userOverrode === false`, apply the new policy (FR-021).
- `changed::border-thickness` / `border-color` / `focused-border-color` → border controller updates every live border actor (FR-007).
- `changed::toggle-titlebar-shortcut` → `Main.wm.removeKeybinding()` + re-register with new binding.

---

## 2. `ManagedWindow` (in-memory per-window record)

One record per live `Meta.Window` the extension has accepted (passed the `windowFilter.shouldManage()` predicate — see §3). Keyed by the `Meta.Window` object identity inside `lib/windowRegistry.js`:

```text
Map<Meta.Window, ManagedWindow>
```

### Fields

| Field | Type | Purpose | Lifecycle |
|-------|------|---------|-----------|
| `window` | `Meta.Window` (reference) | The window this record tracks | Set at map; never re-assigned. |
| `originalDecorated` | boolean | The value `window.get_decorated()` returned when the extension first saw this window. Needed to restore on `disable()` / uninstall (FR-011). | Captured once, read-only thereafter. |
| `originalFrameRect` | `{x,y,width,height}` | Captured frame rect at first-management time. Used if an error path requires a rollback; not the same as the live outer rect. | Captured once. |
| `currentDecorated` | boolean | Last value the extension wrote via `set_decorated()`. Used to know whether the extension needs to undo its change in `disable()`. | Updated on every toggle or default-policy application. |
| `userOverrode` | boolean | `true` iff the user has invoked the title-bar toggle shortcut on this window (FR-018). If `true`, default-policy changes in preferences do **not** affect this window (FR-021). | Starts `false`; may flip to `true` once; never flips back (since flipping back is itself the user choosing to reset — and there is no UI for that in v1). Discarded at window close. |
| `borderActor` | `St.Widget` (reference, nullable) | The per-window border wrapper. `null` when `border-thickness === 0` or the window is fullscreen. | Created lazily; destroyed on window close or extension disable. |
| `signalHandles` | `Array<{obj, id}>` | Every GObject signal this record owns: `position-changed`, `size-changed`, `notify::fullscreen` on the window; any per-actor signals. Released on window close (per CLAUDE.md per-window signal pattern). | Append on connect; drain in `window-removed` handler. |

### Invariants

- **I1 — exclusivity**: at most one `ManagedWindow` exists per `Meta.Window` at any time.
- **I2 — restorability**: at any moment, `disable()` can call `window.set_decorated(originalDecorated)` + destroy `borderActor` to return the window to pre-management appearance (FR-011).
- **I3 — override scope**: changes to `DecorationProfile.default-titlebar-policy` never touch records where `userOverrode === true` (FR-021).
- **I4 — fullscreen exclusion**: while `window.fullscreen === true`, `borderActor` is hidden (or null) and `set_decorated()` is not invoked by this extension (FR-009; research §2). On `notify::fullscreen` returning to `false`, the border is re-created and the current policy re-applied.
- **I5 — signal hygiene**: `signalHandles` is fully drained in the `window-removed` path; no entry may outlive the `Meta.Window`.

### State diagram (simplified)

```text
                +---------------+
                | Unmanaged     |    (window existed but filtered out)
                +---------------+
                        |
                        | window-created/window-added + windowFilter.shouldManage() == true
                        v
+-----------------+    default policy    +----------------+
|  Managed:       |<-------------------->|  Managed:      |
|  Decorated      |   user shortcut /    |  Undecorated   |
|  (title visible)|   default policy     |  (title hidden)|
+-----------------+   changes            +----------------+
         |                                        |
         |                 window-removed         |
         +----------------> destroyed <-----------+
```

### Lifecycle hooks

- **Create**: `windowRegistry.attach(metaWindow)` — capture `originalDecorated` + `originalFrameRect`, set `userOverrode = false`, apply default policy, create border actor if `border-thickness > 0`.
- **Destroy on window close**: `windowRegistry.detach(metaWindow)` — drain `signalHandles`, destroy `borderActor`, remove from the Map. No restoration of `set_decorated()` is needed because the window is going away.
- **Destroy on `disable()`**: iterate every entry, restore `set_decorated(originalDecorated)`, destroy `borderActor`, drain signals, clear the Map. (FR-011)

---

## 3. `PerWindowOverrideFlag` (conceptual)

Not a separate object — implemented as `ManagedWindow.userOverrode`. Called out here because the spec's Key Entities section mentions per-window overrides and because FR-018 + FR-021 together define its only state machine:

- Initial: `false`.
- Transition: `false → true` on shortcut invocation for this window.
- Sink state: `true` persists until `ManagedWindow` is destroyed.

No UI exists in v1 to reset this to `false` without closing the window; if the user wants the window back under default control, closing and reopening it is the documented path (matches FR-018's "live-only" intent).

---

## 4. Relationships

```text
DecorationProfile (singleton, settings-backed)
    |
    | read by
    v
DecorationManager (top-level controller, owned by extension.js)
    |
    | owns 1..N
    v
ManagedWindow (one per live Meta.Window that passes the filter)
    |
    | owns 0..1
    v
borderActor (St.Widget)
```

- `DecorationProfile` has no foreign-key into `ManagedWindow` and vice versa; the controller mediates.
- `ManagedWindow` → `borderActor` is a composition (actor destroyed with the record).
- No relation between `ManagedWindow` instances — each is independent.

---

## 5. Data volume & scale

- `DecorationProfile`: exactly one instance per user, ≤ 1 KB.
- `ManagedWindow`: bounded by the number of concurrently open regular windows; typical ≤ 50, worst-case heavy-user ≤ 200. Each record is a few hundred bytes + one `St.Widget`. Well under the 8 MB JS-heap ceiling (Constitution V).

---

## 6. Traceability matrix (entity ↔ FR)

| Entity field | FRs satisfied |
|--------------|---------------|
| `DecorationProfile.default-titlebar-policy` | FR-003, FR-004, FR-021 |
| `DecorationProfile.border-thickness` | FR-005, FR-008, FR-014 |
| `DecorationProfile.border-color` / `focused-border-color` | FR-005, FR-006, FR-007, FR-020 |
| `DecorationProfile.toggle-titlebar-shortcut` | FR-001, FR-012 |
| `DecorationProfile.debug-logging` | FR-015 (diagnostics) |
| `ManagedWindow.originalDecorated` / `originalFrameRect` | FR-002, FR-011 |
| `ManagedWindow.currentDecorated` | FR-001, FR-004, FR-018, FR-021 |
| `ManagedWindow.userOverrode` | FR-018, FR-021 |
| `ManagedWindow.borderActor` | FR-005, FR-006, FR-007, FR-008, FR-009 |
| `ManagedWindow.signalHandles` | FR-011, FR-015 (no leaks) |
