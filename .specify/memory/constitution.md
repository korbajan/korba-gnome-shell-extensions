<!--
SYNC IMPACT REPORT
==================
Version change: [TEMPLATE] → 1.0.0 (initial constitution)
Modified principles: N/A (initial authoring)
Added sections:
  - Core Principles (7 principles)
  - Extension Architecture Standards
  - Development Workflow & Quality Gates
  - Governance
Removed sections: N/A
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ aligned (Constitution Check gates match principles)
  - .specify/templates/spec-template.md ✅ aligned (no structural changes required)
  - .specify/templates/tasks-template.md ✅ aligned (task categories reflect GJS/GNOME conventions)
Follow-up TODOs:
  - None — all placeholders resolved.
-->

# korba-gnome-extensions Constitution

## Core Principles

### I. GNOME Shell Extension Patterns (NON-NEGOTIABLE)

All extensions MUST follow the conventions and patterns established by the upstream
[gnome-shell-extensions](https://gitlab.gnome.org/GNOME/gnome-shell-extensions.git) project.
This includes:

- Extension entry points MUST use `extension.js` with `enable()` / `disable()` exports.
- Metadata MUST be declared in `metadata.json` (uuid, name, description, shell-version array,
  version integer).
- Extensions MUST NOT import or depend on modules outside of GJS built-ins, GNOME platform
  libraries (St, Clutter, GLib, Gio, GObject, Shell, etc.), and explicitly declared peer
  dependencies.
- Preferences UI MUST live in `prefs.js` and use `Adw` / `Gtk` 4 widgets, matching the style
  of upstream extensions.
- Resource paths, icon names, and schema IDs MUST follow the `org.gnome.shell.extensions.<uuid>`
  namespace convention.

**Rationale**: Aligning with upstream patterns ensures compatibility with GNOME Shell updates,
simplifies community contribution, and avoids extension-manager rejections.

### II. Code Quality Standards

All JavaScript/GJS source code MUST meet the following standards before merge:

- ESLint MUST pass with zero errors using the project-level `.eslintrc.yml` configuration
  (based on the upstream gnome-shell-extensions lint rules).
- Code MUST be formatted with Prettier (or the project-level formatter config) — no unformatted
  diffs are accepted.
- Variables MUST use `const` / `let`; `var` is forbidden.
- Classes MUST extend `GObject.Object` (or a subclass) when registered with the GObject type
  system; plain ES6 classes are permitted only for non-GObject helpers.
- Dead code, commented-out blocks, and debug `log()` calls MUST be removed before merge.
- File length SHOULD stay under 400 lines; any file exceeding this requires an explicit
  justification comment at the top.

**Rationale**: Consistent style reduces review friction and prevents common GJS pitfalls
(memory leaks from undestroyed GObjects, prototype chain errors, etc.).

### III. Test-First Development

Tests MUST be written and confirmed to fail before implementation code is written (Red phase),
then implementation is added to make them pass (Green phase), followed by refactoring (Refactor).

- Unit tests MUST cover all pure helper functions and GObject signal handlers.
- Integration tests MUST cover the `enable()` / `disable()` lifecycle under a mocked GNOME
  Shell environment (using `@gnome-shell/mock` or equivalent).
- Acceptance tests described in the feature specification MUST have a corresponding automated
  or documented manual test case before the feature is considered done.
- A failing CI test blocks merge — no exceptions.
- Test coverage MUST NOT decrease between commits on the `main` branch.

**Rationale**: GNOME Shell extensions run inside the compositor process; untested regressions
can freeze or crash the desktop session for end users.

### IV. User Experience Consistency

Every extension MUST follow the [GNOME Human Interface Guidelines (HIG)](https://developer.gnome.org/hig/).

- UI strings MUST be wrapped in `_()` for gettext internationalisation from day one,
  even if translations are not yet provided.
- Visual elements (icons, spacing, typography) MUST use GNOME's system tokens — no
  hard-coded pixel values or hex colours unless technically unavoidable.
- Preferences dialogs MUST use `AdwPreferencesWindow` → `AdwPreferencesPage` →
  `AdwPreferencesGroup` hierarchy.
- All interactive controls MUST be keyboard-accessible and MUST include accessible names
  (`accessible-name` or label association).
- Animations and transitions MUST respect the `gtk-enable-animations` GSettings key
  (i.e., skip animation when the user has reduced-motion enabled).

**Rationale**: Inconsistent UX breaks the feel of the GNOME desktop and excludes users
with accessibility needs. Extensions represent the korbajan brand to GNOME users.

### V. Performance Requirements

Extensions MUST NOT measurably degrade GNOME Shell performance:

- `enable()` execution time MUST complete within **50 ms** measured on reference hardware
  (a mid-range laptop, not a workstation).
- Idle CPU usage attributable to any extension MUST stay below **0.5 %** when no user
  interaction is occurring.
- Memory footprint of a single extension (JS heap + GObject allocations) MUST NOT exceed
  **8 MB** at steady state.
- Extensions MUST release all signal connections, timeouts, and GObject references inside
  `disable()` — verified by the lifecycle integration test.
- Heavy operations (file I/O, network requests, D-Bus calls) MUST be performed
  asynchronously (Gio async APIs or GLib MainLoop callbacks) and MUST NOT block the
  compositor main loop.

**Rationale**: GNOME Shell is single-threaded; a slow or leaky extension degrades the
entire desktop session.

### VI. Extension Lifecycle & Compatibility

- Each extension MUST declare the minimum and maximum GNOME Shell versions it supports
  in `metadata.json`'s `shell-version` array.
- Breaking changes MUST increment the `version` integer in `metadata.json` and be
  accompanied by a `CHANGELOG.md` entry.
- Extensions MUST remain functional after `disable()` + `enable()` cycles without
  restarting GNOME Shell — lifecycle tests enforce this.
- Deprecated GNOME Shell APIs MUST be replaced within one GNOME major release cycle
  after the deprecation is announced upstream.
- Multi-extension interactions: if two extensions in this repo share logic, the shared
  logic MUST be extracted into a dedicated `lib/` module rather than duplicated.

**Rationale**: Users upgrade GNOME Shell frequently; broken extensions erode trust and
generate support burden.

### VII. Simplicity & YAGNI

- Each extension MUST solve exactly one clearly scoped problem — scope creep requires
  a new extension, not an expanded one.
- Features not required by an accepted user story MUST NOT be implemented speculatively.
- Third-party npm / non-GJS dependencies MUST NOT be bundled; use platform libraries first.
- Configuration options MUST be justified by a real user need — no "just in case" settings.

**Rationale**: Complexity is the root cause of most extension bugs and maintenance burden.
Keeping extensions focused and minimal makes them easier to audit, update, and maintain.

## Extension Architecture Standards

- **Repository layout**: Each extension lives under `<extension-name>/` at the repository
  root (e.g. `spatial-window-navigator/`, `workspace-tiling-window-manager/`). Shared
  utilities live in the extension's own `lib/` subdirectory; build configuration lives in
  each extension's `meson.build` and the root `meson.build`.
- **Schemas**: GSettings schemas are placed at the extension root as
  `org.gnome.shell.extensions.<uuid>.gschema.xml` and compiled as part of the build step
  (via Meson `gnome.post_install(glib_compile_schemas: true)`).
- **Translations**: `.pot` template files MUST be generated via `xgettext` and committed.
  `.po` files live under `<extension-name>/po/`.
- **Build target**: The `Makefile` (or `meson.build`) MUST provide `make install` /
  `ninja install` targets that install to `~/.local/share/gnome-shell/extensions/<uuid>/`
  without requiring root.
- **Packaging**: Each extension MUST be packageable as a standalone `.zip` compatible
  with [extensions.gnome.org](https://extensions.gnome.org) submission requirements.

## Development Workflow & Quality Gates

**Branch strategy**: All work happens on feature branches (`###-short-description`).
Direct commits to `main` are forbidden.

**Quality gates (all MUST pass before merge)**:

1. `eslint` — zero errors.
2. `prettier --check` — no formatting drift.
3. Unit + integration tests — 100 % pass, coverage non-decreasing.
4. Manual smoke test on the target GNOME Shell version — documented in PR description.
5. Constitution Check in plan.md — reviewer confirms no principle violations.

**PR process**: PRs MUST reference a spec (`specs/###-feature-name/spec.md`). PRs without
a linked spec are rejected unless they are `chore:` or `docs:` scope.

**Commit messages**: Follow Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`,
`test:`, `refactor:`). Breaking changes MUST include `BREAKING CHANGE:` footer.

## Governance

This constitution supersedes all other development practices for the korba-gnome-extensions
project. Any practice not covered here defers to the GNOME Shell Extensions contributor
guide and upstream coding conventions.

**Amendment procedure**:

1. Open a PR titled `docs: amend constitution to vX.Y.Z — <summary>`.
2. PR description MUST explain the motivation and list affected principles/sections.
3. PR MUST include updates to any templates or docs impacted by the change
   (per the consistency propagation checklist in the speckit-constitution skill).
4. Approval from the project maintainer (korbajan) is required before merge.

**Versioning policy**: Semantic versioning applies (MAJOR.MINOR.PATCH) as defined in
the speckit-constitution versioning rules.

**Compliance review**: Every implementation plan (`plan.md`) MUST include a
"Constitution Check" section confirming no violations. Reviewers are responsible for
flagging undocumented violations before approving a PR.

**Runtime guidance**: See `.specify/memory/` for living agent-guidance documents.

**Version**: 1.0.1 | **Ratified**: 2026-04-14 | **Last Amended**: 2026-04-15
