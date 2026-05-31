# Phase 02 — Deferred / Out-of-Scope Items

Discoveries logged during execution that are NOT in the current plan's scope.
Do NOT fix here; route to the owning plan/phase.

- **[02-01] eslint warning in `test/e2e/skeleton.e2e.ts:56`** — "Unused eslint-disable
  directive (no problems were reported from 'no-console')". Pre-existing (Phase 1
  e2e spike file), unrelated to the platform/store/registry changes in plan 02-01.
  0 errors; lint gate passes. Leave to whoever next touches the e2e harness.
  **RESOLVED (03-03):** the stale `skeleton.e2e.ts` was removed (its skeleton UI was
  deleted at Phase-1 close, D-05) and replaced by `test/e2e/base64.e2e.ts`, which has
  no unused eslint-disable. The warning is gone.
