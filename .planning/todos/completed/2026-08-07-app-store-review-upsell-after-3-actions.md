---
created: 2026-08-07T09:30:00.000Z
title: App Store review upsell after ~3 successful actions
area: ui
files:
  - src/shell/usePreferences.ts
  - src/lib/platform/tauri.ts
  - src-tauri/capabilities/default.json
---

## Problem

No in-app prompt asks happy users to rate/review, so App Store (and direct-channel word-of-mouth) reviews accumulate slowly. User asked (2026-08-07): once a user has completed ~3 successful actions (e.g. 3 protobuf decodes / formats / parses — i.e. real value delivered, not just app opens), show a review upsell.

## Solution sketch (decisions to make at planning time)

- **Counter**: a `successfulActionCount` (or per-tool map) in the single-writer prefs blob (route through the shared `usePreferences` singleton — see `prefs-blob-single-writer` memory). Count only *successful* outputs (decode succeeded, format succeeded), not keystrokes/opens. Persist a `reviewPromptShown`/`reviewPromptDismissedAt` so it never nags twice (or re-asks only after a long cooldown + more actions).
- **Channel-aware action**:
  - **appstore build**: native `SKStoreReviewController.requestReview` via a small Rust command (Apple rate-limits it to 3/yr automatically; no custom UI needed) — or a custom card linking `macappstore://apps.apple.com/app/id<APPID>?action=write-review`.
  - **direct build**: no MAS review possible — either hide entirely or point to the site/testimonial email. Respect the Phase-27 build-variant seam (no MAS code in direct chunks and vice versa; see `store-updater-surface-multilayer` / D-04 purity sentinels — the gating must survive the chunk-inventory guards).
- **UX constraints**: non-modal, dismissible, keyboard-reachable, WCAG-AA; never interrupts an in-progress paste→decode flow (offline wedge: the prompt itself must not require network; the write-review deep link is a user-initiated handoff like the D-71 mailto posture).
- **Trigger point**: a single counting seam in the tool-output success path (registry-driven, not per-tool copy-paste).

## Notes

- Apple guideline 5.6.1: must use the OS-provided mechanism or a non-incentivized link; never gate features on reviewing.
- e2e: count increments + one-shot behavior are prefs-observable via the `readPrefsBlob()` e2e helper; the native SKStoreReview sheet itself is a human-gate item (WebDriver can't see it).

## Resolved by quick task 260808-up5

What shipped (see
`.planning/quick/260808-up5-app-store-review-upsell-native-requestre/260808-up5-SUMMARY.md`):

- **Appstore-only native OS sheet, no custom UI.** StoreKit 2
  `AppStore.requestReview(in:)` through a small Swift static archive
  (`src-tauri/src/review/review.swift`) behind the appstore-gated Rust command
  `request_app_store_review` — not the deprecated `SKStoreReviewController`, and no card,
  banner, modal or pre-prompt anywhere (Apple 5.6.1: OS mechanism, non-incentivized, nothing
  feature-gated on reviewing).
- **Trigger keyed on OUTPUT CONTENT, through one seam.** `src/shell/useToolSuccess.ts` is the
  single settled-success seam — 10 call sites covering all 13 tools, zero per-tool counting
  logic. An episode counts only after a *successful* output has sat UNCHANGED for 3 s (the
  "natural pause"), identified by tool id + a full-output FNV-1a-32 digest computed at settle
  time, so the same output re-rendered is one episode and two equal-length outputs differing
  only in the middle are two.
- **Recurring cadence, not one-shot** (user revision 2026-08-09): fires at EVERY 3rd settled
  success (`toolSuccessCount` 3, 6, 9, …) with a MINIMUM 7-day gap since the last successful
  request (`lastReviewRequestAt`), read through an injectable clock. The stamp is persisted
  only AFTER the native request resolves, so a failed request retries at the next boundary
  instead of burning the window. "Only if they never reviewed" is delegated to the OS — no
  API exposes it, and macOS caps real prompts at 3/365 days.
- **Direct build gets nothing, proven mechanically** (the D-04-style purity requirement this
  todo flagged): `scripts/reviewPromptFoldInGuard.mjs` fails the direct build on any
  `reviewPrompt` fold-in and emits a `reviewprompt-inventory.json` sentinel (non-vacuous via a
  three-case real-build selftest); `#[cfg(feature = "appstore")]` plus the
  `CARGO_FEATURE_APPSTORE` swiftc gate keep the command and the Swift out of the direct binary
  (`strings`/`nm`/`otool -L` all zero); and `test/e2e/review-prompt.e2e.ts` proves it at
  runtime on the real WKWebView (three settled decodes → counter still 0).
- The prefs fields live in the single-writer blob via `updatePreferences` (the
  `prefs-blob-single-writer` rule), and both are untrusted-coerced.
