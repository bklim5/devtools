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
