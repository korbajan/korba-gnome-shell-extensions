# Feature Specification: Dynamic Window Tiling

**Feature Branch**: `001-dynamic-window-tiling`
**Created**: 2026-04-14
**Status**: Draft
**Input**: User description: "Build an extension that allow turning on and configure a window
tilling on one or more workspaces. It should be dynamic tiling mechanism inspired by i3 wm.
Tiling is activated via extension settings per workspace. Start with Dwindle layout;
implementation must be open for adding further layouts in the future. Minimum GNOME Shell
version: 50."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Enable Tiling on One or More Workspaces (Priority: P1)

A user wants to designate specific workspaces as tiling workspaces from the extension's
preferences panel. Once enabled, all windows on those workspaces are automatically arranged
in the Dwindle layout — no keyboard shortcut or manual action is needed to activate tiling.

**Why this priority**: This is the entry point to the entire feature. Everything else depends
on at least one workspace being in tiling mode.

**Independent Test**: Open the extension preferences, enable tiling for Workspace 1, then
open several application windows on that workspace and verify they are arranged in the Dwindle
spiral pattern. Open a window on Workspace 2 (not enabled) and confirm it is unaffected.

**Acceptance Scenarios**:

1. **Given** the extension preferences panel, **When** the user enables tiling for Workspace 1,
   **Then** all currently open windows on Workspace 1 are immediately rearranged into the
   Dwindle layout filling the usable screen area.
2. **Given** Workspace 1 in tiling mode, **When** the user opens a new application window,
   **Then** the window is inserted at the next Dwindle position within 300ms.
3. **Given** Workspace 1 in tiling mode, **When** a window is closed, **Then** the remaining
   tiles reflow to fill the vacated space within 300ms.
4. **Given** tiling enabled on Workspace 1, **When** the user disables tiling for Workspace 1
   in preferences, **Then** all windows are restored to the positions and sizes they had before
   tiling was activated.
5. **Given** multiple workspaces, **When** tiling is enabled for Workspace 2 only, **Then**
   Workspace 1 remains completely unaffected.

---

### User Story 2 — Dwindle Layout Behaviour (Priority: P1)

A user expects newly opened windows to be placed following the Dwindle (spiral) algorithm:
the first window fills the screen, each subsequent window takes half the space of the last
tile, splitting in alternating directions to form a recursive spiral.

**Why this priority**: The Dwindle layout is the sole layout in v1 and defines the visual
contract of the entire extension.

**Independent Test**: Open four windows sequentially on a tiled workspace and verify they
appear in the Dwindle spiral pattern — window 1 on the left half, window 2 on the top-right
quarter, window 3 on the bottom-right half of the right column, and so on.

**Acceptance Scenarios**:

1. **Given** a tiled workspace with no windows, **When** the first window opens, **Then** it
   fills the entire usable screen area.
2. **Given** one window filling the screen, **When** a second window opens, **Then** the
   screen is split along the initial split axis (configurable in preferences, default:
   horizontal), the existing window occupies one half and the new window the other.
3. **Given** two windows, **When** a third window opens, **Then** the most-recently-added
   tile is split along the perpendicular axis, giving the third window one quarter of the
   screen.
4. **Given** N windows in the Dwindle pattern, **When** one is closed, **Then** the layout
   reflows so remaining windows maintain valid Dwindle positions with no gap or overlap.
5. **Given** the layout engine, **When** a different layout type is registered by a future
   addition to this codebase, **Then** it can be selected per workspace without modifying
   the core tiling logic.

---

### User Story 3 — Navigate and Move Windows with the Keyboard (Priority: P2)

A user wants to move keyboard focus between tiles and reorder tiles within the Dwindle layout
using only keyboard shortcuts.

**Why this priority**: Keyboard-driven navigation is the defining UX characteristic of
i3-style tiling. Without it the extension merely automates placement but not workflow.

**Independent Test**: With three or more tiled windows, navigate focus to each using
directional shortcuts, then swap two windows and verify the layout updates correctly.

**Acceptance Scenarios**:

1. **Given** focus is on a tile, **When** the user presses focus-left/right/up/down,
   **Then** focus moves to the nearest tile in that direction within 100ms.
2. **Given** focus is on a tile, **When** the user presses move-left/right/up/down,
   **Then** the focused window swaps position with its nearest neighbour and the Dwindle
   structure updates accordingly.
3. **Given** only one window in the tile tree, **When** any directional shortcut is pressed,
   **Then** nothing happens and no error is shown.

---

### User Story 4 — Resize Tile Splits with the Keyboard (Priority: P3)

A user wants to grow or shrink a tile relative to its sibling to adjust screen space at a
split boundary.

**Why this priority**: Fixed 50/50 splits are impractical for real work; adjustable splits
are essential for asymmetric content (e.g., a wide editor next to a narrow terminal).

**Independent Test**: With two side-by-side tiles, use resize shortcuts to grow the focused
tile to approximately 70% width, then shrink it back to 50%.

**Acceptance Scenarios**:

1. **Given** two adjacent tiles sharing a split boundary, **When** the user presses
   resize-grow, **Then** the focused tile grows by a configurable step (default 5%) and its
   sibling shrinks by the same amount.
2. **Given** a tile at the configurable maximum ratio (default 90%), **When** the user
   presses resize-grow, **Then** the tile stays at maximum with no overflow or overlap.
3. **Given** a nested Dwindle split, **When** resize shortcuts are pressed, **Then** the
   resize applies only to the immediate split boundary of the focused tile.

---

### User Story 5 — Float or Sink Individual Windows (Priority: P3)

A user wants a specific window (e.g., a calculator, dialog, or picture-in-picture player)
to float freely over the tiling layout rather than be managed as a tile.

**Why this priority**: Not every window suits tiling; floating mode prevents the layout from
being disrupted by transient or utility windows.

**Independent Test**: Enable tiling, toggle floating on one window, confirm free movement
and resize, then re-sink it and confirm it rejoins the Dwindle layout.

**Acceptance Scenarios**:

1. **Given** a tiled workspace, **When** the user presses the float-toggle shortcut,
   **Then** the focused window is removed from the tile tree, centred on screen, and can
   be freely moved and resized without affecting other tiles.
2. **Given** a floating window, **When** the user presses float-toggle again, **Then** the
   window is re-inserted into the Dwindle tree at the next available position.
3. **Given** window-class rules configured in preferences, **When** a matching window opens
   on a tiled workspace, **Then** it automatically starts in floating mode.

---

### User Story 6 — Configure the Extension via Preferences UI (Priority: P4)

A user wants to manage all settings — which workspaces use tiling, keyboard shortcuts, gap
sizes, initial split axis, and floating-window rules — from a single graphical preferences
panel.

**Why this priority**: Preferences are essential for long-term usability without editing
config files.

**Independent Test**: Open preferences, change a keyboard shortcut and the gap size, close
the panel, and verify both changes take effect immediately on the active tiling workspace.

**Acceptance Scenarios**:

1. **Given** the GNOME Extensions entry point, **When** the user opens the extension settings,
   **Then** a preferences window opens with sections: Workspaces, Keyboard Shortcuts,
   Appearance, and Floating Rules.
2. **Given** the Workspaces section, **When** the user toggles a workspace's tiling switch,
   **Then** tiling activates or deactivates on that workspace immediately without a shell
   restart.
3. **Given** the Keyboard Shortcuts section, **When** the user assigns a new binding and
   closes the window, **Then** the new binding takes effect immediately.
4. **Given** the Appearance section, **When** the user changes the gap size, **Then** all
   active tiling layouts update within 500ms.
5. **Given** the Appearance section, **When** the user selects the initial split axis
   (horizontal / vertical), **Then** the Dwindle layout uses that axis for the first split
   on newly arranged workspaces.

---

### Edge Cases

- What happens when a window is too small to occupy any tile without violating a minimum
  usable dimension? (Window is automatically placed in floating mode.)
- What happens after GNOME Shell restarts with tiling active?
  (Tiling-enabled workspaces and all settings are restored from persisted preferences.)
- What happens when `tiling-enabled-workspaces` contains an index for a workspace that
  no longer exists? (The stale index is silently ignored at runtime; it is automatically
  removed from the setting the next time the preferences panel is opened.)
- What happens when a window enters full-screen mode on a tiled workspace?
  (The window temporarily exits the tile tree; it re-enters when full-screen is exited.)
- What happens when all windows on a tiled workspace are closed?
  (The workspace remains in tiling mode, ready to tile the next window that opens.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to enable or disable tiling per workspace exclusively from
  the extension preferences panel; no runtime keyboard shortcut is provided for this action.
- **FR-002**: When tiling is enabled for a workspace, all currently open windows on that
  workspace MUST be rearranged into the Dwindle layout immediately.
- **FR-003**: When tiling is enabled, every newly opened window on a tiled workspace MUST be
  inserted into the Dwindle layout within 300ms of becoming visible.
- **FR-004**: When a tiled window is closed, the layout MUST reflow within 300ms to fill the
  vacated space according to the Dwindle algorithm.
- **FR-005**: The Dwindle layout engine MUST be implemented behind a layout-provider
  interface so that additional layout types can be added in future without modifying core
  tiling logic.
- **FR-006**: Users MUST be able to move keyboard focus to an adjacent tile using directional
  keyboard shortcuts (left, right, up, down). The extension MUST call
  `window.activate(global.get_current_time())` on the target window to raise and focus it;
  `global.display.focus_window` is the authoritative source of which window is currently
  focused (no separate extension-tracked cursor).
- **FR-007**: Users MUST be able to move a window to an adjacent tile position using
  directional keyboard shortcuts. The target tile MUST be determined by geometry-based
  neighbour detection (nearest window centre-point in the requested direction, consistent
  with FR-006 focus navigation). When two windows swap positions, only the window
  references in their leaf nodes are exchanged — the screen regions (rects and split
  ratios) remain unchanged. The neighbour-finding algorithm MUST be encapsulated inside
  the `LayoutProvider` interface (`getNeighbour` / `moveWindow` methods) so that a future
  tree-topology-based implementation can replace it without changing calling code.
- **FR-008**: Users MUST be able to resize the split ratio at a tile boundary incrementally
  via keyboard shortcuts.
- **FR-009**: Users MUST be able to toggle floating mode on any window via a keyboard
  shortcut.
- **FR-010**: Users MUST be able to define window-class rules in preferences so that matching
  windows always open in floating mode on a tiled workspace.
- **FR-011**: The extension MUST provide a GNOME preferences panel containing: workspace
  tiling toggles, initial split axis for Dwindle, all keyboard shortcuts, gap size, and
  floating-window class rules.
- **FR-012**: All keyboard shortcuts MUST be rebindable from the preferences panel without
  requiring a GNOME Shell restart.
- **FR-013**: The extension MUST persist all settings and the set of tiling-enabled workspaces
  across GNOME Shell restarts.
- **FR-014**: Full-screen windows on a tiled workspace MUST temporarily exit the tile tree
  and re-enter it when full-screen mode is exited.
- **FR-015**: Windows smaller than a configurable minimum tile dimension MUST automatically
  be placed in floating mode.
- **FR-016**: The extension MUST support a configurable pixel gap between tiles, including
  zero-gap mode.
- **FR-017**: Workspace indices in `tiling-enabled-workspaces` that no longer correspond to
  an existing workspace MUST be silently ignored at runtime. When the preferences panel is
  opened, the extension MUST automatically remove stale indices from the setting.
- **FR-018**: The extension MUST emit structured debug output via `console.log` /
  `console.warn` (visible in `journalctl`) for tiling decisions (window inserted/removed,
  reflow triggered, float override applied, keybinding fired). All debug output MUST be
  gated behind a `debug-logging` GSettings boolean key (default `false`) so there is zero
  overhead when disabled.

### Key Entities

- **Workspace**: A GNOME virtual desktop independently designated as tiling or non-tiling
  via preferences.
- **Layout Provider**: An interface that encapsulates a tiling algorithm. v1 ships one
  implementation: Dwindle. Future layouts implement the same interface without touching
  core tiling logic.
- **Dwindle Layout**: A recursive spiral layout where the first window fills the screen and
  each subsequent window splits the last tile along the alternating perpendicular axis,
  producing a Fibonacci-like arrangement.
- **Tile Tree**: The binary split-tree maintained by the active layout provider, representing
  the hierarchical arrangement of windows on a tiled workspace.
- **Tile Node**: A leaf in the tile tree — a single managed window with its assigned screen
  region.
- **Split Container**: An internal node grouping two child nodes at a horizontal or vertical
  split boundary.
- **Floating Window**: A window on a tiled workspace excluded from the tile tree and
  positioned freely by the user.
- **Layout State**: The persisted configuration of tiling-enabled workspaces, gap size,
  initial split axis, and floating-window rules.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Enabling or disabling tiling for a workspace from preferences takes effect
  within 500ms of the toggle being changed.
- **SC-002**: Newly opened windows appear at their correct Dwindle position within 300ms of
  becoming visible.
- **SC-003**: Focus navigation and window-move operations respond within 100ms of the
  keyboard shortcut being pressed.
- **SC-004**: The tiling layout contains zero pixel gaps or overlaps between tiles when gap
  size is configured to zero.
- **SC-005**: Disabling tiling for a workspace restores all windows to their pre-tiling
  positions and sizes with no positional drift.
- **SC-006**: After a GNOME Shell restart, all tiling-enabled workspaces and settings are
  fully restored within 1 second of the shell becoming ready.
- **SC-007**: The extension introduces no measurable latency on non-tiling workspaces
  (focus-switch latency with extension enabled is within ±10ms of baseline).
- **SC-008**: A second layout type can be added by implementing the Layout Provider interface
  and registering it, without modifying any existing layout or core tiling code.

## Assumptions

- GNOME Shell 50 or later is the minimum supported version; versions below 50 are
  explicitly out of scope and will not be tested or handled.
- Multi-monitor setups are supported: each workspace on each physical monitor is managed
  independently — enabling tiling on Workspace 1 of Monitor A does not affect Workspace 1
  of Monitor B.
- The Wayland session is the primary target; X11 support is a future consideration and out
  of scope for v1.
- Default keyboard shortcuts use the Super key as modifier, with sensible i3-inspired
  defaults shipped out of the box.
- The extension runs entirely inside the GNOME Shell process; no external daemon or service
  is required.
- Only one tiling extension should be active at a time; conflicts with other tiling solutions
  (e.g., Pop Shell) are out of scope.
- Debug logging is off by default; users and developers enable it via the `debug-logging`
  GSettings key to observe tiling decisions in `journalctl`.

## Clarifications

### Session 2026-04-14

- Q: Should the extension control window focus itself or delegate to GNOME Shell's focus policy? → A: Extension calls `window.activate(global.get_current_time())` directly (Option A), reading current focus from `global.display.focus_window`. Consistent with `spatial-window-navigator` pattern in this repo.
- Q: How should move-window determine the swap target in the Dwindle tree? → A: Geometry-based neighbour detection (Option A, centre-point distance in requested direction), consistent with focus navigation. Algorithm encapsulated in `LayoutProvider.getNeighbour()` / `moveWindow()` to allow future replacement with tree-topology-based approach (Option B) without changing calling code.
- Q: How should stale workspace indices in `tiling-enabled-workspaces` be handled? → A: Silently ignored at runtime; automatically removed from the setting when the preferences panel is opened (Option A).
- Q: When moveWindow swaps two windows, what happens to split ratios? → A: Screen regions (rects and split ratios) stay fixed; only the window references in the leaf nodes are swapped (Option A). Regions are stable, windows move between them.
- Q: Should the extension emit structured debug logging? → A: Yes — `console.log`/`console.warn` gated behind a `debug-logging` GSettings boolean (default `false`), visible via `journalctl` (Option A).
