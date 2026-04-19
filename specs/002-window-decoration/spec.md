# Feature Specification: Advanced Window Decoration

**Feature Branch**: `002-window-decoration`
**Created**: 2026-04-18
**Status**: Draft
**Input**: User description: "new extension for advance window decoration (turn off/on windows bars, add border with a configurable size and color)"

## Clarifications

### Session 2026-04-18

- Q: When `workspace-tiling-window-manager` is active, should borders count against the tile gap budget (tiles shrink to make room for borders) or overlay the gap (borders sit on top of existing tile geometry)? → A: Borders overlay the tile gap — tile geometry is unchanged; each window paints its border inside the gap. If the gap is smaller than twice the border thickness, adjacent borders touch or overlap (cosmetic only).
- Q: How long does a per-window title bar toggle (via shortcut) persist? → A: Live-only — the toggle affects the current window only and is lost when the window closes; newly opened windows always follow the global default title bar policy.
- Q: How should the extension behave when asked to hide the title bar of a client-side-decorated (CSD) application that paints its own title bar inside the window content? → A: Silent graceful fallback — attempt the hide, and if the window still shows its own in-content title bar, do nothing more; no notification, no error, no log message visible to the user.
- Q: Should the border color support transparency (alpha channel)? → A: Full RGBA for both the default and the focused-window color — the preferences color pickers expose an opacity slider so users can create solid or semi-transparent borders.
- Q: When the user changes the default title bar policy in preferences, does it apply to already-open windows or only to newly opened ones? → A: Retroactive — the new default is immediately applied to every currently open regular window, except windows that are under an active per-window shortcut override (FR-018), which keep their current state until they close.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Toggle window title bars on demand (Priority: P1)

A user wants to reclaim vertical screen space and achieve a minimalist look by hiding the title bar (header bar) of a window. They also want a quick way to bring the title bar back when they need the usual window controls (close, minimize, maximize, drag handle).

**Why this priority**: This is the first capability called out in the feature description ("turn off/on windows bars"). Without it the extension has no reason to exist. Delivering this alone already gives users a useful, demonstrable product, independent of the border feature.

**Independent Test**: Install the extension, focus any regular application window with a visible title bar, press the configured shortcut, confirm the title bar disappears and the content area grows into the reclaimed space. Press the shortcut again and confirm the title bar returns to its original appearance without the window jumping on screen. No other features required.

**Acceptance Scenarios**:

1. **Given** a focused window with a visible title bar, **When** the user presses the configured "toggle title bar" shortcut, **Then** the title bar is hidden and the window's content area grows into the reclaimed space.
2. **Given** a focused window whose title bar is currently hidden by the extension, **When** the user presses the same shortcut, **Then** the title bar reappears and the window's outer screen position does not jump.
3. **Given** the extension has been configured to hide title bars by default on new windows, **When** a new window is opened, **Then** it appears without a title bar from the moment it is mapped on screen.
4. **Given** one or more windows currently have hidden title bars due to the extension, **When** the user disables or uninstalls the extension, **Then** every affected window regains its original title bar before the extension stops managing it.

---

### User Story 2 - Configurable window border (Priority: P2)

A user wants each window to be surrounded by a visible border whose thickness and color they control, so that windows are easier to tell apart — especially after title bars have been hidden or when windows are tiled edge-to-edge.

**Why this priority**: Borders are the second capability in the feature description and become especially useful once Story 1 is in place. They also deliver value on their own for users who keep title bars but want a custom accent color around every window.

**Independent Test**: With the extension enabled, set a non-zero border size and a distinctive color in preferences. Open any regular window and verify a border of the chosen thickness and color surrounds it. Change the thickness and color; verify the border updates on every open window without needing to close and reopen them.

**Acceptance Scenarios**:

1. **Given** the default decoration settings, **When** the user opens a regular application window, **Then** a border of the configured thickness and color is drawn around the window's outer edge.
2. **Given** a window with a border drawn around it, **When** the user changes the border thickness in preferences, **Then** the border on every affected window updates to the new thickness within one second.
3. **Given** a window with a border drawn around it, **When** the user changes the border color in preferences, **Then** the new color is applied to every affected window within one second.
4. **Given** the border thickness is set to zero, **When** the user applies the setting, **Then** no visible border is drawn while the rest of the extension (title bar toggle) continues to work.
5. **Given** a window with a border, **When** the window is moved or resized, **Then** the border follows the window edge and keeps its configured thickness.
6. **Given** the focused window and a background window both have borders, **When** the user has configured a separate focused-window color, **Then** the focused window's border uses that color and the others use the default color, and the colors switch correctly when focus moves between windows.

---

### User Story 3 - Configure every option from a preferences window (Priority: P3)

A user wants to configure all of the extension's behavior — default title bar visibility, border thickness, border color, focused-window border color, and the toggle shortcut — from a single graphical preferences window, without editing config files or running command-line tools.

**Why this priority**: This is a polish layer on top of Stories 1 and 2. The core behavior is usable via reasonable defaults and a keyboard shortcut even before the preferences window is fully polished, so this is valuable but not blocking for a first release.

**Independent Test**: Open the extension's preferences via the GNOME Extensions app or `gnome-extensions prefs`. Change each exposed setting, confirm each change takes effect on open windows, close the preferences window, reopen it, and confirm the values are still the ones the user set. Restart the GNOME Shell session and confirm the values are still preserved.

**Acceptance Scenarios**:

1. **Given** the extension is installed, **When** the user opens its preferences window, **Then** labelled controls are visible for: default title bar behavior (on/off), border thickness (numeric in pixels), default border color (color picker), focused-window border color (color picker), and the keyboard shortcut for the title bar toggle.
2. **Given** the user has changed one or more preferences and closed the panel, **When** the user re-opens preferences at a later time or after a session restart, **Then** the values they set previously are still displayed and applied.
3. **Given** the user enters an invalid border thickness (e.g. negative, or larger than a documented sensible maximum), **When** they try to apply it, **Then** the value is rejected or clamped and the currently applied thickness does not change without a valid replacement.
4. **Given** the user assigns a keyboard shortcut that is already used elsewhere in the system, **When** they try to save it, **Then** the user is informed that the shortcut conflicts and given the option to change it or pick a different one.

---

### Edge Cases

- **Dialog, popup, and menu windows**: Secondary windows (dialogs, right-click menus, tooltips, utility popups) retain their original decorations; hiding their title bars or framing them in a thick border would break standard interaction patterns.
- **Fullscreen windows**: Borders must not be drawn over fullscreen surfaces (videos, games, presentations); fullscreen state must override the extension's border and title bar behavior for the duration of the fullscreen session.
- **Client-side-decorated (CSD) applications**: Some applications paint their own title bar inside the window content. The extension documents a limitation that these windows may not be fully controllable for title bar hiding, and continues to work for the rest.
- **Extension disable / uninstall while modifications are active**: Every window the extension ever modified returns to its original title bar state and loses any added border when the extension is disabled or uninstalled. No window is left permanently title-less or borderless.
- **Multi-monitor with mixed HiDPI scaling**: Border thickness should look visually consistent across monitors with different scale factors.
- **Coexistence with the tiling window manager already in this repository**: When the sibling extension `workspace-tiling-window-manager` is enabled and tiles windows edge-to-edge, the new border must not cause visible gaps, overlap, or clipping between tiles.
- **Maximized and tiled-to-screen-edge windows**: The border must still be drawn on the visible side(s) of the window and must not be obscured by the panel or clipped by the screen edge.
- **Keyboard shortcut conflict**: The title-bar-toggle shortcut must not silently collide with GNOME Shell's built-in shortcuts or with shortcuts owned by the other two extensions in this repository.
- **Extension preferences window**: The preferences window itself is excluded from the extension's own title bar hiding and border drawing, so the user can always see and use standard window controls to close it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extension MUST let the user toggle the visibility of the focused window's title bar via a configurable keyboard shortcut.
- **FR-002**: The extension MUST preserve the focused window's outer on-screen position when a title bar toggle changes the window's decoration (the visible content area grows or shrinks; the window's outer bounding rectangle does not jump).
- **FR-003**: The extension MUST expose a "default title bar policy" setting with at least two values: *visible on new windows* and *hidden on new windows*.
- **FR-004**: The extension MUST apply the default title bar policy to newly created regular windows at the time they are mapped on screen, so windows do not flash a title bar before it is hidden.
- **FR-005**: The extension MUST draw a border of the user-configured thickness and the user-configured color around the outer edge of each regular top-level window it manages.
- **FR-006**: The extension MUST expose a separate configurable color that is used for the border of the currently focused window, so focus is visually distinguishable.
- **FR-007**: The extension MUST update the rendered border on every affected window when any of the border-related settings (thickness, default color, focused color) change, without the user having to close and reopen windows.
- **FR-008**: The extension MUST render no visible border when the border thickness is set to zero, while keeping every other feature operational.
- **FR-009**: The extension MUST exclude dialogs, menu popups, tooltips, utility windows, panel surfaces, lock-screen surfaces, and fullscreen windows from title bar and border modifications.
- **FR-010**: The extension MUST exclude its own preferences window from its title bar and border modifications.
- **FR-011**: When the extension is disabled or uninstalled, it MUST restore every window it modified to that window's original title bar state and remove every border it added, before ceasing to manage the window.
- **FR-012**: The extension MUST provide a preferences window (accessible via `gnome-extensions prefs`) that exposes all user-facing options: default title bar policy, border thickness, default border color, focused-window border color, and the title bar toggle keyboard shortcut.
- **FR-013**: The extension MUST persist every user-facing setting across GNOME Shell sessions so that user changes are not lost after logout or reboot.
- **FR-014**: The extension MUST reject or clamp invalid border thickness values (negative numbers, or numbers above a documented sensible maximum) and MUST NOT corrupt stored settings when an invalid value is entered.
- **FR-015**: The extension MUST NOT block the GNOME Shell main loop, freeze the UI, or log user-visible errors during normal operation (opening, focusing, moving, resizing, closing windows; toggling the title bar; changing preferences).
- **FR-016**: The extension MUST coexist with the `workspace-tiling-window-manager` and `spatial-window-navigator` extensions already present in the repository: enabling any combination of the three MUST NOT cause window decorations, borders, tile geometry, or keyboard shortcuts to interfere with each other.
- **FR-017**: When `workspace-tiling-window-manager` is active, the extension MUST draw borders **inside the existing tile gap**: it MUST NOT alter the tile rectangles the tiler computed, MUST NOT request geometry changes from the tiler, and MUST accept that, when the configured tile gap is smaller than twice the configured border thickness, the borders of adjacent tiled windows will visually touch or overlap.
- **FR-018**: A per-window title bar toggle invoked via the keyboard shortcut (FR-001) MUST affect only the currently focused window and MUST NOT be remembered once that window is closed. Newly opened windows MUST always follow the global default title bar policy (FR-003/FR-004), regardless of any shortcut-driven toggles applied to prior windows of the same application.
- **FR-019**: When the user asks the extension to hide the title bar of a client-side-decorated (CSD) application whose title bar is painted inside its own content, the extension MUST attempt the hide and MUST fall back silently if the in-content title bar remains visible: it MUST NOT emit a GNOME notification, MUST NOT open a dialog, MUST NOT log a user-visible error, and MUST leave the rest of the extension (borders, other windows) fully functional.
- **FR-020**: Both the default border color and the focused-window border color MUST carry a user-configurable alpha (opacity) channel in addition to red, green, and blue components, and the preferences window MUST expose an opacity control alongside each color picker.
- **FR-021**: When the user changes the default title bar policy (FR-003) via the preferences window, the extension MUST apply the new policy immediately to every currently open regular window that is **not** currently held under an active per-window shortcut override (FR-018). Windows under an active per-window override MUST keep their current title bar state until they are closed, after which the new default applies to any future window they spawn.

### Key Entities *(include if feature involves data)*

- **Decoration Profile**: The complete user-facing configuration — default title bar policy, border thickness, default border color, focused-window border color, and keyboard shortcut binding. Stored so that it survives session restarts and is edited through the preferences window.
- **Managed Window**: A regular top-level window that the extension has evaluated and (possibly) modified. Carries enough state for the extension to restore the window to its original appearance on disable or uninstall: the window's original title bar state and its original outer geometry.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can hide or show the focused window's title bar within 1 second of pressing the configured shortcut, with no perceptible flicker and no change to the window's outer on-screen position.
- **SC-002**: Changes to border thickness or any border color, made from the preferences window, take visible effect on every open managed window within 1 second of the user confirming the change.
- **SC-003**: After the extension is disabled, 100% of the windows it previously modified return to their original title bar state and have no residual border drawn around them.
- **SC-004**: During a 10-minute continuous usage session (opening, focusing, moving, resizing, and closing a mix of windows) the extension produces zero user-visible errors in the GNOME Shell journal and does not measurably grow its own memory usage beyond baseline.
- **SC-005**: Effectively all regular application windows opened while the extension is enabled receive the configured border and respect the configured title bar policy; the only windows that do not are the explicitly excluded categories (dialogs, popups, fullscreen, system UI, preferences window), which retain their original decorations.
- **SC-006**: A first-time user can locate and change every exposed preference from the preferences window in under 2 minutes, without consulting external documentation.
- **SC-007**: Enabling the extension alongside the existing `workspace-tiling-window-manager` and `spatial-window-navigator` extensions produces no regression in the acceptance scenarios of either existing extension.

## Assumptions

- The extension targets GNOME Shell 50 on Wayland only, matching the rest of this repository.
- A GNOME Extensions preferences window is an acceptable configuration surface; no command-line-only configuration is required.
- Only regular top-level application windows are in scope. System UI surfaces (panel, overview, dash, notifications, lock screen) are out of scope and untouched.
- Dialogs, popup menus, tooltips, and utility windows keep their original decorations by default; they are not considered "regular" windows for the purpose of FR-005 and FR-009.
- Fullscreen state always overrides the extension's behavior: while a window is fullscreen, no border is drawn over it and no title bar modifications are visible.
- Client-side-decorated applications that paint their own title bar inside the content area may not be fully controllable via standard window manager protocols; any reduced functionality for these applications is documented as a known limitation, not a failure.
- The default border thickness is small enough (on the order of 1–2 logical pixels) that a freshly installed extension does not visually dominate existing windows, and the default border colors are chosen to be visible on both light and dark GNOME themes.
- By default, the "default title bar policy" is *visible* so that a fresh install is visually close to stock GNOME; users opt into hiding.
- The extension is installed alongside, not in place of, the existing `workspace-tiling-window-manager` and `spatial-window-navigator` extensions.
- A per-application title bar override (allow-list / deny-list) is intentionally **out of scope** for this initial feature; if introduced later, it will be scoped as a separate feature on top of this one.
