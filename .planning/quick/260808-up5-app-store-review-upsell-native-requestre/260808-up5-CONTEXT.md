# Quick Task 260808-up5: App Store review upsell - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning

<domain>
## Task Boundary

After a user has gotten real value from the app — 3 successful tool outputs — ask for an App Store review via the OS-native mechanism, on the appstore build only. Origin: todo `2026-08-07-app-store-review-upsell-after-3-actions.md` (now superseded by these locked decisions).

</domain>

<decisions>
## Implementation Decisions (user-locked 2026-08-08)

### Trigger
- **3 successful outputs, any tools** — one global counter; a tool producing a successful result (decode ok / format ok / parse ok / generate ok) increments it; errors, empty input, and mere navigation do not. One counting seam in the shared tool-output success path (registry-driven, not per-tool copy-paste).

### UX form (appstore build)
- **Native sheet only** — `SKStoreReviewController.requestReview` (macOS `requestReview(in:)` / `SKStoreReviewController.requestReview()` as appropriate for AppKit), called at the **next natural pause** after the 3rd success: output visible and stable for a few seconds, never mid-paste/mid-typing. No custom pre-prompt UI, no card. OS handles rate limiting (max 3/yr) and whether the sheet actually shows.
- RECURRING cadence (user revision 2026-08-09, supersedes one-shot): a request fires at every 3rd-success boundary (count 3, 6, 9, …) but only if ≥7 days have passed since the last successful request (or none ever made). Persist `lastReviewRequestAt` (stamp-after-success semantics retained). "Only if the user never submitted a review" is enforced by the OS — StoreKit exposes no submitted-a-review signal; `requestReview` silently no-ops for users who already reviewed, and macOS caps actual prompts at 3/365 days regardless of how often we call.
- The 7-day gap comparison MUST be clock-injectable for tests (same seam discipline as the license `_with_clock` fix — no wall-clock time bombs).

### Direct build
- **Nothing** — feature entirely absent: Rust command compiled only under the `appstore` feature; webview trigger code gated so it does not ride into direct chunks. Absence must be proven the same way updater-absence is proven on appstore (chunk/module inventory + runtime no-invoke), just in the reverse direction.

### Claude's Discretion
- Exact "natural pause" heuristic (e.g. N seconds of idle after render, or next successful action boundary), counter naming, where the seam hooks the tool success path, StoreKit API variant for macOS, test structure.

</decisions>

<specifics>
## Specific Ideas

- Counter + one-shot flag live in the single-writer prefs blob via the shared `usePreferences` singleton (memory: `prefs-blob-single-writer`).
- Apple guideline 5.6.1: OS mechanism only, non-incentivized, never gate features on reviewing.
- e2e: counter increment + one-shot persistence are prefs-observable via `readPrefsBlob()`; the native sheet itself is a human-gate item (WebDriver cannot see it). Sandbox/dev builds: `requestReview` may show nothing — verification is "command invoked once, no error", not "sheet visible".
- docs/CHANNELS.md gains a row (appstore-only feature, enforcing artifact = the feature gate + chunk sentinel).

</specifics>

<canonical_refs>
## Canonical References

- `docs/CHANNELS.md` (channel gating patterns), `src-tauri/` appstore feature seam (Phase 27), D-04 purity-sentinel pattern (`keygen-compileout-d04-proof` memory — reversed direction here), StoreKit bridge from Phase 26 (`src-tauri` iap plugin/commands).

</canonical_refs>
