---
phase: 20-purchase-pipeline
plan: 02
subsystem: payments-backend
tags: [lemon-squeezy, keygen-ce, resend, webhook, hmac, idempotency, node, D-56]

# Dependency graph
requires:
  - phase: 18-entitlements-seam
    provides: "entitlement vocabulary pro.theming + pro.ordering (the exact strings the policy carries / the license inherits)"
  - phase: 20-purchase-pipeline (plan 01)
    provides: "Buy CTA -> https://tinkerdev.io/buy opener seam; cfg-split licensing constants (the app side of the pipeline)"
provides:
  - "server/webhook/ TypeScript/Node backend: LS order_created -> Keygen CE license create -> Resend key email (PAY-02/PAY-03)"
  - "mor.ts thin MoR swap seam (Lemon Squeezy adapter only this phase, D-61)"
  - "verify.ts HMAC-SHA256-over-raw-body + timingSafeEqual signature verify (D-60)"
  - "keygen.ts CE admin client: searchByOrderId (D-58 idempotency) + createLicense (policy rel, metadata.orderId)"
  - "fulfill.ts orchestrator with 5xx-on-failure (D-59) + alert hook (D-72)"
  - "server/ joined to the per-commit tsc+eslint+vitest gate via a CHANGED gate command + node-globals eslint block (D-56)"
affects: [20-03-setup-and-e2e, 21-lifecycle-ship-gate]

# Tech tracking
tech-stack:
  added:
    - "resend 6.12.4 (npm — BACKEND dep on server/webhook only, NOT the webview; never imported by src/)"
    - "@types/node 22 (devDep — Node globals for the server tsconfig typecheck)"
    - "pnpm-workspace.yaml packages: [\".\", \"server/webhook\"] — server/webhook is now a workspace member"
  patterns:
    - "MoR swap seam: ALL Lemon-Squeezy-payload-specific parsing lives in mor.ts so a future MoR change is a single-module swap; the orchestrator only sees a neutral OrderEvent union"
    - "Injectable collaborators: fetch (keygen), Resend client (email), and {verify,parse,search,create,email,alert} (fulfill) are all passed in — unit tests mock all I/O, zero live calls"
    - "5xx-on-failure fulfillment: never 2xx when a side effect failed, so LS auto-retries; search-before-create makes the retry idempotent (single source of truth = Keygen, no second datastore)"

key-files:
  created:
    - "server/webhook/package.json — @devtools/webhook, type:module, resend dep"
    - "server/webhook/tsconfig.json — node-targeted, types:[node], noEmit, allowImportingTsExtensions"
    - "server/webhook/.env.example — committed secret TEMPLATE (admin token, LS secret, Resend key — placeholders only)"
    - "server/webhook/src/config.ts — env load + validate (throws on a missing var)"
    - "server/webhook/src/verify.ts — LS HMAC-SHA256 raw-body verify + length-guarded timingSafeEqual"
    - "server/webhook/src/mor.ts — Lemon Squeezy order_created -> {orderId, customerEmail}|ignore|invalid"
    - "server/webhook/src/keygen.ts — CE admin client (searchByOrderId + createLicense)"
    - "server/webhook/src/email.ts — Resend plain-text key email (buildKeyEmailText + sendKeyEmail)"
    - "server/webhook/src/fulfill.ts — orchestrator (verify->parse->search->create->email)"
    - "server/webhook/src/index.ts — http server: GET /health + POST /webhooks/lemonsqueezy (raw body)"
    - "server/webhook/src/{verify,mor,keygen,email,fulfill}.test.ts — 30 unit tests, mocked I/O"
  modified:
    - "lefthook.yml — typecheck command now ALSO runs `tsc --noEmit -p server/webhook/tsconfig.json` (D-56, the actual gate command changed)"
    - "eslint.config.js — added `files:[server/**/*.ts]` node-globals block (D-56)"
    - "tsconfig.json — comment documenting why server/webhook is NOT a composite reference (TS6310)"
    - ".gitignore — server/webhook/.env (gitignored) + !.env.example (re-included) + *.tsbuildinfo"
    - "pnpm-workspace.yaml — packages: [\".\", \"server/webhook\"]"
    - "package.json / pnpm-lock.yaml — @types/node devDep; resend declared on the webhook package"

key-decisions:
  - "server/webhook joined as a pnpm WORKSPACE MEMBER (not a root dep) so resend is the webhook package's dependency and never pollutes the app/webview manifest"
  - "Project reference to server/webhook DROPPED from root tsconfig: a composite reference forces noEmit:false (TS6310) and broke `tsc --noEmit`; the explicit `-p` gate command is the required mechanism anyway (D-56), reference is superfluous"
  - "Resend resolves with {data,error} rather than throwing; email.ts re-throws on error so fulfill can 5xx + alert (D-59/D-72)"
  - "Idempotency uses Keygen as the single source of truth (search metadata[orderId] before create) — no second datastore (D-58)"

requirements-completed: [PAY-02, PAY-03]

# Metrics
duration: 65min
completed: 2026-06-13
---

# Phase 20 Plan 02: Webhook Backend (LS → Keygen → Resend) Summary

**A TypeScript/Node `server/webhook/` backend that verifies the Lemon Squeezy `order_created` HMAC over the raw body (D-60), idempotently creates a perpetual/node-locked Keygen CE license carrying `pro.theming`+`pro.ordering` via the policy + `metadata.orderId` (D-58/D-54), and emails the buyer the plain-text key via Resend (D-64/D-66) — all unit-tested with mocked CE HTTP + Resend, and joined to the repo's tsc+eslint+vitest gate (D-56).**

## Performance

- **Duration:** ~65 min
- **Started:** 2026-06-13T18:13:31Z
- **Completed:** 2026-06-13T19:21:00Z
- **Tasks:** 3 (all TDD)
- **Files:** 16 created, 6 modified

## Accomplishments

- **Task 1 — verify + MoR seam:** `verify.ts` HMAC-SHA256 over the RAW body with a length-guarded `crypto.timingSafeEqual` (never `===`, never re-serialized JSON — T-20-09/T-20-10); `mor.ts` the ONE Lemon-Squeezy swap seam mapping `order_created` → `{orderId: data.id, customerEmail: data.attributes.user_email}` (non-order → ignore, malformed → invalid). `config.ts` validates required env and throws on a missing var. `.env.example` is the committed placeholder-only template; the real `.env` is gitignored.
- **Task 2 — Keygen client + email:** `keygen.ts` searches `metadata[orderId]` before create (D-58 idempotency) and POSTs the JSON:API license body (type `licenses`, `attributes.metadata.orderId`, `relationships.policy` → `KEYGEN_POLICY_ID`) — entitlements inherited from the policy (D-54), non-2xx throws (D-59). `email.ts` sends the Resend plain-text key + 3 activation steps + releases download link (D-66), re-throwing on a Resend `{error}` so fulfill can 5xx.
- **Task 3 — orchestrator + server + gate:** `fulfill.ts` enforces verify(401)→ignore(200)→invalid(400)→idempotent-skip(200)→create(5xx-on-fail)→email(5xx+alert-on-fail)→200, never returning 2xx after a side-effect failure. `index.ts` is a built-in-`http` server with `GET /health` (D-72) and `POST /webhooks/lemonsqueezy` capturing the RAW body before any parse (Pitfall 5). The D-56 gate is genuinely wired: the lefthook typecheck **command** now also runs `tsc --noEmit -p server/webhook/tsconfig.json` (proven to catch a server-only type error that the old root-only command missed), and eslint gained a `files:["server/**/*.ts"]` node-globals block.

## Task Commits

1. **Task 1: LS signature verify + order_created MoR parser** — `4c7e9ed1` (feat, TDD — 12 tests GREEN with impl)
2. **Task 2: Keygen CE admin client + Resend key email** — `ec6bc6f0` (feat, TDD — 10 tests GREEN with impl)
3. **Task 3: fulfillment orchestrator + HTTP server + D-56 gate wiring** — `b8dff9a5` (feat, TDD — 8 tests GREEN with impl)

## Decisions Made

- **server/webhook is a pnpm workspace member**, not a root dependency — keeps `resend` on the webhook package and out of the app/webview manifest (the "zero new webview runtime deps" wedge holds; `resend` is backend-only and never imported by `src/`).
- **No composite project reference from the root tsconfig** — it forced `noEmit:false` (TS6310) and broke `pnpm tsc --noEmit`. The explicit `-p server/webhook/tsconfig.json` invocation in the lefthook command is the required D-56 mechanism regardless, so the reference was dropped (documented inline in tsconfig.json).
- **Resend `{data,error}` re-thrown** in `email.ts` so a failed send surfaces to `fulfill` as a throw → 5xx + alert (D-59/D-72).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed `@types/node` + made `server/webhook` a workspace member so the server typechecks and `resend` resolves**
- **Found during:** Task 1 (package scaffolding)
- **Issue:** `@types/node` was absent (server uses `process`/`Buffer`/`crypto`/`http`); and `resend` could not resolve from `server/` because `server/webhook` was not a workspace member, so its `package.json` dep was inert.
- **Fix:** Added `@types/node@22` devDep; added `packages: [".", "server/webhook"]` to `pnpm-workspace.yaml` so the webhook package installs `resend` and links it; removed the stray root `resend` dep that `pnpm add -w` had created (keeps the app manifest clean).
- **Files modified:** `pnpm-workspace.yaml`, `package.json`, `pnpm-lock.yaml`
- **Verification:** `tsc --noEmit -p server/webhook/tsconfig.json` exits 0; `resend` linked into `server/webhook/node_modules`.
- **Committed in:** `4c7e9ed1` (Task 1)

**2. [Rule 3 - Blocking] Added `allowImportingTsExtensions` to the server tsconfig**
- **Found during:** Task 1 (server tsc)
- **Issue:** Test files import sibling modules with explicit `.ts` extensions (mirroring the repo's root config); the server tsconfig lacked `allowImportingTsExtensions`, so `tsc` errored TS5097.
- **Fix:** Added `"allowImportingTsExtensions": true` (safe under `noEmit:true`).
- **Files modified:** `server/webhook/tsconfig.json`
- **Committed in:** `4c7e9ed1` (Task 1)

**3. [Rule 3 - Blocking] Dropped the optional root tsconfig project reference (TS6310)**
- **Found during:** Task 3 (root tsc after adding the reference)
- **Issue:** The plan offered the `{ "path": "./server/webhook" }` reference as an OPTIONAL ergonomics add. Adding it broke `pnpm tsc --noEmit` with TS6310 (a referenced composite project may not disable emit) — the server config is intentionally `noEmit:true`.
- **Fix:** Removed the reference; documented inline why. The REQUIRED mechanism — the explicit `-p` invocation in the lefthook command — is unaffected and proven to catch server type errors.
- **Files modified:** `tsconfig.json`
- **Committed in:** `b8dff9a5` (Task 3)

---

**Total deviations:** 3 auto-fixed (all Rule 3 blocking — required for the server to typecheck/install and the root gate to stay green). No scope creep; the gate-command change (the load-bearing D-56 requirement) landed as specified.

## Threat Surface

All six STRIDE mitigations in the plan's threat register are implemented and unit-pinned:
- **T-20-05** (forged webhook) — `verify.ts` HMAC over raw body BEFORE any side effect; invalid ⇒ 401, zero calls (`fulfill.test.ts`).
- **T-20-06** (admin token leak) — token only in gitignored `.env`; `.env.example` placeholders; no hardcoded `Bearer [16+ alnum]` in the repo (verified).
- **T-20-07** (double-mint on retry) — `search metadata[orderId]` before create; existing ⇒ 200 skip (`fulfill.test.ts` idempotency case).
- **T-20-08** (CE/email down) — 5xx-on-failure ⇒ LS retries; email failure fires the alert hook; `/health` endpoint present.
- **T-20-09** (timing attack) — `crypto.timingSafeEqual`, length-guarded, never `===`.
- **T-20-10** (raw body re-serialized) — `index.ts` reads the raw body before any `JSON.parse`; `verify.test.ts` pins that a re-serialized body fails.

No new threat surface beyond the plan's register.

## Known Stubs

None. The backend is functionally complete at the unit layer. Live wiring (real LS test-mode payload field-path confirmation A5, real CE create, real Resend send, Caddy fronting, env values) is Plan 03's D-63 e2e + setup — by design, not a stub. The plan's interfaces note that the exact LS field paths (`data.id`, `data.attributes.user_email`) must be confirmed against a real test-mode payload in Plan 03; the MoR seam isolates that to one module.

## Verification Evidence

- Full vitest suite **871/871** (was 841; +30 new server tests across verify/mor/keygen/email/fulfill).
- `pnpm tsc --noEmit` (root) clean; `pnpm tsc --noEmit -p server/webhook/tsconfig.json` clean.
- `pnpm lint` exits 0 (server files lint under the new node-globals block; only 2 pre-existing unrelated warnings).
- D-56 gate proven: injecting a server-only type error makes the exact lefthook command (`pnpm tsc --noEmit && pnpm tsc --noEmit -p server/webhook/tsconfig.json`) exit 2 — the old root-only command would have passed.
- No hardcoded secrets: `grep` for `re_…`/`sk_…`/`whsec_`/`Bearer [16+ alnum]` in `server/webhook/src` returns nothing; `git ls-files server/webhook/` shows only `.env.example` for env.
- `decoder.ts` + its 19 tests byte-for-byte untouched (no changes under `src/lib/protobuf/`).
- All 3 task commits passed the lefthook pre-commit gate (typecheck+test+lint) on commit.

## User Setup Required

None this plan. Plan 03 fills the real `.env` (admin token, `KEYGEN_POLICY_ID`, `LS_WEBHOOK_SECRET`, `RESEND_API_KEY`), attaches `pro.theming`+`pro.ordering` to the policy via `setup.sh`, and runs the D-63 live e2e confirming the LS payload field paths.

## Next Plan Readiness

- The webhook backend (PAY-02/PAY-03) is unit-complete and gate-wired. Plan 03 must: stand up production CE + the policy (entitlements attached), fill `server/webhook/.env`, deploy behind Caddy, and run the D-63 e2e (log one raw LS `order_created` to confirm `data.id` / `data.attributes.user_email`, then a real purchase→license→email round-trip).
- The MoR seam (`mor.ts`) is the single swap point if the payout-country/MoR choice ever changes.

## Self-Check: PASSED

- Files verified present: `server/webhook/src/{verify,mor,keygen,email,fulfill,index,config}.ts`, all 5 `*.test.ts`, `server/webhook/.env.example`, `server/webhook/package.json`, `server/webhook/tsconfig.json`, this SUMMARY.
- Commits verified: `4c7e9ed1`, `ec6bc6f0`, `b8dff9a5` (all in `git log`).
- Gate files verified: `lefthook.yml` names `server/webhook/tsconfig.json`; `eslint.config.js` has the `server/**/*.ts` block.
- Suite 871/871, tsc (root+server) clean, lint clean, decoder untouched.

---
*Phase: 20-purchase-pipeline*
*Completed: 2026-06-13*
