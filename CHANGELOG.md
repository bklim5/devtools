# Changelog

All notable changes to DevTools are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to
adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The maintainer edits the section for the next version BEFORE running
`pnpm release:bump` / `pnpm release:publish`; those commands stamp the matching
section's body into the annotated tag, the in-app updater banner, and the GitHub
release body (falling back to the bare tag when a section is absent).

## [Unreleased]

- _Nothing yet._

## [1.0.3] - 2026-09-28

- App Store edition: TinkerDev may occasionally invite you to rate it on the App Store after repeated successful use — never while you're typing, at most rarely, and entirely handled by macOS (users who already reviewed see nothing).
- More reliable settings persistence: preferences now save durably on quit, fixing rare cases where a change made just before closing the app could be lost.

## [1.0.2] - 2026-08-07

- Internal: pinned time in the license-refresh tests via an injectable clock
  seam, so a dated test fixture can no longer fail the release gate. No
  user-facing change.

## [1.0.1] - 2026-08-07

- **Two new tools, taking the set to 13** — an **HTML** formatter and a combined
  **JS/TS/JSX/TSX** formatter (one tool, no language picker). Each does both
  **Prettify** (Prettier-identical output) and **Minify**, entirely offline.
- The JS/TS tool adds **Semicolons** and **Single quotes** toggles in Prettify mode.
- The **JSON and XML** formatters gained the same **Prettify | Minify** mode
  selector and a **line-width** control.
- The **Protobuf Decoder now leads the tool list** — sidebar, command palette and
  the default landing tool all put the hero first. Your saved order and last-used
  tool are unaffected.
- Fixed: the sidebar tool list now scrolls at short window heights instead of
  clipping.
- Fixed: the native window titlebar follows the in-app theme, so light mode no
  longer leaves a dark, hard-to-read titlebar.
- **A Mac App Store edition of TinkerDev shipped** *(App Store edition)* — Pro is
  unlocked there by a one-time in-app purchase instead of a licence key. The
  direct download is unchanged and keeps its licence-key activation and
  self-updater.

## [0.4.1] - 2026-06-21

- Add updates pane in settings

## [0.4.0] - 2026-06-21

- _Nothing yet._

## [0.3.3] - 2026-06-20

- Add general pane in settings
- Add hotkey pane in settings

## [0.3.2] - 2026-06-18

- Add preferences pane
- Add license deactivation flow
- Fix/standardize padding across the app
- License purchase redirection URL

## [0.3.1] - 2026-06-12

- Sidebar update
- Sidebar update

## [0.3.0] - 2026-06-08

- Schema-less Protobuf decoder (the hero) with cards/rows toggle and computed
  LEN chips — paste an unknown blob, get an explorable interpretation offline.
- Ten more high-frequency tools alongside the hero: Base64/Hex/Bytes, Unix Time,
  JWT, Hash, UUID/ULID, JSON + XML formatters, and URL / Regex / Cron.
- Reorderable, pinnable sidebar persisted across launches; the registry stays the
  single control plane for the sidebar, command palette, and router.
- Fast, offline, keyboard-driven macOS desktop app (Tauri 2) with a self-updating,
  signed universal build.
