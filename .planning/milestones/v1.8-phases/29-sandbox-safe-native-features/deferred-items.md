# Phase 29 deferred items

## 29-02 — e2e environmental flake (NOT a regression; out of scope)

- **settings.e2e.ts "Updates pane … Check button surfaces a result (SET-10)"** fails
  in the current environment with `got "Update check failed"` instead of `"up to date"`.
  - **Proven environmental, not caused by 29-02:** the SAME spec fails identically on the
    CLEAN BASELINE with all 29-02 source changes stashed (App.tsx reverted to its original
    inline overlay). Baseline run: `/tmp/e2e-baseline-29-02.log` (1 passed [update.e2e], 1
    failed [settings.e2e]). The dev-build `@tauri-apps/plugin-updater` `check()` cannot reach
    `https://github.com/bklim5/devtools-releases/releases/latest/download/latest.json` from
    inside the WKWebView right now (shell `curl` to the same URL returns HTTP 200 — the app's
    network path differs). The `runUpdateCheck` flow itself executes correctly end-to-end
    (it reaches the error branch + sets the status), so this is a network-reachability flake,
    not a logic bug. Historical full runs (gate-p25d / gate-run7 / e2e-22.2) resolved
    "up to date" cleanly; the Jun-22 e2e-spike-run.log shows the expected "You're up to date".
  - **Action:** re-run at the Phase-29 human-verify boundary when the updater endpoint is
    reachable from the app; do NOT gate 29-02 on it.

- **iap-spike.e2e.ts** fails (`expected the [data-testid="iap-spike"] block`) because the
  IapSpikeBlock removal is Phase 28-05 Task work that is NOT landed (28-05 is paused at its
  human sandbox checkpoint). Out of scope for 29-02 (which touches no IAP surface).
