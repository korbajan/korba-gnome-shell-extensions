---
description: "Manual smoke test checklist for workspace-tiling-window-manager"
---

# Smoke Test: Workspace Tiling Window Manager

**Environment**: GNOME Shell 50, Wayland  
**Extension**: `workspace-tiling-window-manager@korbajan.github.com`

---

## Setup

- [ ] Log in to a fresh GNOME session
- [ ] Verify extension is active: `gnome-extensions info workspace-tiling-window-manager@korbajan.github.com` → State: ACTIVE
- [ ] Open preferences: `gnome-extensions prefs workspace-tiling-window-manager@korbajan.github.com`
- [ ] Enable tiling for **Workspace 1** (index 0) via the Workspaces toggle

---

## T055-A: Dwindle Layout — New Windows

- [ ] Open window 1 → fills the entire work area
- [ ] Open window 2 → window 1 takes left half, window 2 takes right half
- [ ] Open window 3 → window 2 splits vertically: window 2 top-right, window 3 bottom-right
- [ ] Open window 4 → window 3 splits horizontally: window 3 left-quarter, window 4 right-quarter (of right half)

## T055-B: Dwindle Layout — Existing Windows

- [ ] With 1+ windows already open, toggle Workspace 1 tiling off then on in prefs
- [ ] Existing windows are immediately repositioned into the Dwindle layout
- [ ] Previously maximized windows are unmaximized and tiled correctly

## T055-C: Reflow on Close

- [ ] With 3 tiled windows, close the middle window
- [ ] Remaining 2 windows reflow to fill the work area correctly

## T055-D: Focus Navigation (SC-003)

- [ ] With 3+ tiled windows, press `Super+h` → focus moves left
- [ ] Press `Super+l` → focus moves right
- [ ] Press `Super+k` → focus moves up
- [ ] Press `Super+j` → focus moves down
- [ ] No focus change when no neighbour in that direction (returns gracefully)
- [ ] **Latency**: subjective response < 100 ms (T060 / SC-003)

## T055-E: Window Swap ("Swap Window" keybindings)

Swap exchanges which app lives in each tile slot — tile boundaries never move.

- [ ] With 3 tiled windows, focus the rightmost window
- [ ] Press `Super+Shift+h` → focused window swaps position with left neighbour
- [ ] Tile rects are unchanged; only the window contents exchanged
- [ ] Press `Super+Shift+l` → swap back, layout restored

## T055-F: Resize Split (SC-007)

- [ ] With 2 side-by-side windows, press `Super+Ctrl+l` five times
- [ ] Focused tile grows to ~75% of work area width
- [ ] Press `Super+Ctrl+h` five times → returns to ~50%
- [ ] Press 9× more in one direction → ratio clamps, does not exceed 90% or fall below 10%

## T055-G: Float Toggle

- [ ] With 3 tiled windows, focus the middle window
- [ ] Press `Super+Shift+Space` → window detaches, centred on screen, moves freely
- [ ] Remaining 2 windows reflow to fill the space
- [ ] Press `Super+Shift+Space` again → window rejoins the tile layout
- [ ] Layout reflows correctly with 3 windows again

## T055-H: Float Rules (window class)

- [ ] Open Preferences → Floating Rules page
- [ ] Add `org.gnome.Calculator` (or another small app's WM class)
- [ ] Open that application → it appears floating (centred), not tiled

## T055-I: Disable Tiling / Restore

- [ ] With 3 tiled windows, note their current positions
- [ ] Toggle Workspace 1 off in prefs
- [ ] All windows restore to their **original** pre-tiling positions and sizes

## T055-J: Non-tiling Workspace (SC-007 baseline)

- [ ] Switch to Workspace 2 (tiling disabled)
- [ ] Open and close windows normally — no tiling interference
- [ ] Switch between WS1 (tiled) and WS2 (free) repeatedly — no errors in journal

## T055-K: Preferences UI

- [ ] Change `Gap Size` to 16px → active tiled layout updates live
- [ ] Change `Gap Size` back to 8px → layout updates live
- [ ] Change a keybinding (e.g. focus-left) → new binding works, old does not
- [ ] All controls have visible labels (accessibility)

## T055-L: Debug Logging (FR-018)

- [ ] Enable Debug Logging toggle in prefs → Appearance page
- [ ] Press a focus/move/resize keybinding
- [ ] `journalctl /usr/bin/gnome-shell -f` shows `[workspace-tiling-window-manager] keybinding fired: keybind-focus-*`
- [ ] Disable Debug Logging → no further log output from extension

---

## T060: Timing Verification

- [ ] **SC-003**: Focus navigation (`Super+h/j/k/l`) across 4 tiles — subjective response < 100 ms
- [ ] **SC-007**: On a non-tiling workspace with extension enabled, no perceptible overhead vs extension disabled

---

## Known Issues / Fixes Applied

| Issue | Fix |
|-------|-----|
| `fullscreen-changed` signal doesn't exist on Wayland | Changed to `notify::fullscreen` |
| `window.get_maximized()` not a function | Changed to `window.maximized_horizontally \|\| window.maximized_vertically` |
| Existing windows not tiled if maximized | Added `unmaximize(Meta.MaximizeFlags.BOTH)` before `move_resize_frame` in `applyRects` |
| `enable()` throw prevented tiler registration in `_tilers` map | Root cause was `fullscreen-changed` throw; fixed by signal rename |
