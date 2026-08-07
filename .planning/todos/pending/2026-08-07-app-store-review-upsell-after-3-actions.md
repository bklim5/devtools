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
