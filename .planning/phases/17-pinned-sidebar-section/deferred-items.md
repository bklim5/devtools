# Deferred Items — Phase 17

Out-of-scope discoveries logged during the sidebar gap-closure fix (not fixed here).

## base64.e2e.ts first-worker flake

- **Discovered during:** sidebar gap-closure e2e gate (run 2 of 3).
- **Symptom:** `base64.e2e.ts` worker `0-0` intermittently fails with
  `element ("#base64-pane-text") still not existing after 15000ms` — the first
  WebDriver worker can race the app's initial mount on a cold WKWebView session.
- **Scope:** UNRELATED to the sidebar changes (no base64 file touched). Passed
  GREEN in run 1 and run 3 (exit 0); failed only in run 2. Pre-existing
  first-worker timing flake, not a regression.
- **Action:** Not fixed (out of scope for the sidebar fix). Candidate for the
  Phase 6 hardening pass — e.g. a longer first-worker warmup / retry on the cold
  session, or ordering base64 off worker 0.
