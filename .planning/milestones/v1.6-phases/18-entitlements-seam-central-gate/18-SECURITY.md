---
phase: 18
slug: entitlements-seam-central-gate
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-11
---

# Phase 18 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| prefs.json → resolver | Hand-editable on-disk file feeds `entitlementsOverride` into the central gate | untrusted string |
| environment detection → tier | `__TAURI_INTERNALS__` presence decides FULL vs FREE base | env signal |
| test seam → store | `setEntitlementsForTest` can rewrite the resolved set | test-only mutation |
| entitlement set → chunk loading | Gate decides whether pro-tool code is even fetched | code/IP |
| route URL → tool render | Deep links (hash routes) can target locked tools directly | navigation intent |
| DEV toggle → prefs + store | Palette command writes the override and re-resolves the gate | dev-only control |
| stored overlay strings → DOM | toolOrder/pinnedToolIds come from hand-editable prefs.json | untrusted strings |
| dev bundle → production bundle | DEV-only tooling must not cross into dist | build artifact |
| docs → future phases | Stale free-tier claims would mis-scope Phase 21's flip | documentation |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-18-01 | Tampering | coerceEntitlementsOverride | mitigate | Accepts exactly `"free"`, else null (`prefsStore.ts:41-43`, wired :124); tests `prefsStore.test.ts:191-229` | closed |
| T-18-02 | Elevation | resolveEntitlements | mitigate | Downgrade-only: sole branch `=== "free" → FREE_SET` (`resolve.ts:19-23`); tests `resolve.test.ts:58-76` | closed |
| T-18-03 | Tampering | setEntitlementsForTest | mitigate | No-op unless `MODE === "test" \|\| DEV` (`store.ts:53-64,68-74`) | closed |
| T-18-04 | Spoofing | FULL default vs Phase-21 licensed path | mitigate | Single flip point with explicit Phase-21 comment (`resolve.ts:14-18`); see Phase-21 handoff note below | closed |
| T-18-05 | Tampering | BUY_LICENSE_URL bundle patch | accept | See Accepted Risks Log | closed |
| T-18-06 | Info Disclosure | ToolRoute locked-chunk fetch | mitigate | UpsellPanel returned before loader invoked (`ToolRoute.tsx:26-32`); 0-calls loader-spy test (`ToolRoute.test.tsx:54-77`) | closed |
| T-18-07 | Tampering | Deep-link to locked tool route | mitigate | Element-level gate on every tool route (`router.tsx:39-42`); no redirect bypass; locked-route tests on both surfaces | closed |
| T-18-08 | DoS | React.lazy identity churn | mitigate | Module `lazyCache` keyed by tool.id (`ToolRoute.tsx:10-18`); loader-once test (`ToolRoute.test.tsx:111-126`) | closed |
| T-18-09 | Elevation | Dev toggle palette command | mitigate | Exists only under `import.meta.env.DEV` (`CommandPalette.tsx:58-76`); prod-simulation test (`CommandPalette.prod.test.tsx`); dist-grep green at gate | closed |
| T-18-10 | Elevation | Toggle attempting to unlock | mitigate | Writes only `"free" ⇄ null` (`CommandPalette.tsx:67-69`); bounded by T-18-01 coercer + T-18-02 resolver | closed |
| T-18-11 | Tampering | Stored strings rendered to DOM | mitigate | Registry names via `getToolById` only (`Sidebar.tsx:177-184,536`; `CommandPalette.tsx:103,268`) | closed |
| T-18-12 | Tampering | Locked-state prefs writes | mitigate | Write-site guards on togglePin/drag/Alt-chords/resetOrder (`Sidebar.tsx:209,235,347,485`); store-set spies prove zero writes; `unpinAll` structurally unreachable while locked (sole call site renders only when `pinned.length > 0`; locked partition forces `pinned = []` — `Sidebar.tsx:70-74,802,806`); WR-01 hardening recommended (see notes) | closed |
| T-18-13 | Elevation | Dev toggle leaking into dist | mitigate | `scripts/check-dev-strip.sh` run green at gate against a verified 22-chunk build + two corroborating layers (static DEV strip, prod-simulation test); WR-02 hardening before Phase-21 reuse (see notes) | closed |
| T-18-14 | Repudiation | Unlocked default mistaken for licensed | mitigate | Docs reconciled (D-18 grep-clean); human walkthrough explicitly certified unlocked default as PRE-licensing baseline (approved 2026-06-10); Phase 21 8-case ship-gate re-proves flipped state | closed |
| T-18-15 | Tampering | e2e leaves "free" override behind | mitigate | Toggle-back in `finally` + restoration asserted (`entitlements.e2e.ts:404-434`); leftover-override hygiene at spec start (:299-307) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-18-01 | T-18-05 | A patched bundle can swap `BUY_LICENSE_URL`; webview gating is UX-gating, not DRM (locked v1.6 architecture). Purchase integrity lives server-side (Phase 20: MoR checkout + webhook + Keygen, privileged tokens server-side only). | User (v1.6 architecture sign-off) | 2026-06-11 |

*Accepted risks do not resurface in future audit runs.*

---

## Phase-21 Handoff Notes (non-blocking hardening)

1. **WR-01:** `unpinAll` (`Sidebar.tsx:495-499`) relies on a render-condition guard, not the write-site guard every sibling path uses. Land `orderingUnlocked` check + `openOrderingUpsell()` at the top of `unpinAll` before the Phase 21 flip (defense-in-depth; any future caller silently breaks D-26 otherwise).
2. **WR-02:** `check-dev-strip.sh` passes vacuously if `dist/assets` holds zero `.js` files. Add a non-empty pre-check (`find ... -name '*.js' -print -quit`) before relying on it at the Phase 21 flip gate.
3. **T-18-04 corollary:** `store.ts:13-15` `defaultSet()` duplicates the env→tier mapping as the synchronous pre-resolution default. The Phase 21 flip must revisit this default too (and IN-02's duplicated Tauri detection) or an unlicensed install would flash FULL until `refreshEntitlements()` resolves.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-11 | 15 | 15 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-11
