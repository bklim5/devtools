# Phase 22.1 — Deferred Items

## Out-of-scope pre-existing issues (NOT introduced by 22.1-02)

- `vite.config.ts(7,1): error TS2578: Unused '@ts-expect-error' directive` — surfaced by
  `tsc --noEmit -p tsconfig.node.json`. Pre-existing; vite.config.ts is byte-unchanged by
  this plan (`git diff --quiet -- vite.config.ts` clean). The webview gate (`tsc --noEmit`
  over `src`) is clean. Logged per the executor scope-boundary; do not fix here.
