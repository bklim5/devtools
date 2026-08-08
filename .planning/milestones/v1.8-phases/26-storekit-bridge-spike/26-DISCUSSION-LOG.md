# Phase 26: StoreKit Bridge Spike - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-22
**Phase:** 26-storekit-bridge-spike
**Areas discussed:** Bridge strategy & exit criteria, ASC prerequisite sequencing, Local dev test harness, Spike artifact scope

---

## Gray Area Selection

| Option | Selected |
|--------|----------|
| Bridge strategy & exit criteria | ✓ |
| Local dev test harness | ✓ |
| Spike artifact scope | ✓ |
| ASC prerequisite sequencing | ✓ |

All four selected.

---

## Bridge strategy & exit criteria

**Q: How should the spike approach the StoreKit bridge?**

| Option | Selected |
|--------|----------|
| Plugin-first, swift-rs fallback | ✓ |
| Hand-roll (swift-rs) from start | |
| Vendor the plugin's Swift | |

**Q: What concretely triggers abandoning the plugin and switching to the swift-rs fallback?** (multi)

| Option | Selected |
|--------|----------|
| Universal-sandboxed compile fail | ✓ |
| JS-API / seam mismatch | ✓ |
| JWS verify needs a server | |
| Purchase sheet won't present | ✓ |

**Notes:** "JWS verify needs a server" was deliberately NOT treated as a plugin-only fallback trigger — serverless on-device verify is a HARD constraint both the plugin and the swift-rs path must meet (milestone-level blocker if neither can).

---

## ASC prerequisite sequencing

**Q: How much ASC groundwork happens during this spike vs deferred to Phase 30?**

| Option | Selected |
|--------|----------|
| Minimum to unblock the gate now | ✓ |
| Local .storekit only this phase | |
| Full ASC record now | |

**Q: Who drives the Apple-side setup?**

| Option | Selected |
|--------|----------|
| I'll drive ASC, agent guides | ✓ |
| Flag as external blocker | |

**Notes:** User does the ASC clicks using `docs/appstore/ASC-SETUP.md`; agent sequences and supplies values. Paid-Apps Agreement to be started early (propagation delay). Metadata deferred to Phase 30.

---

## Local dev test harness

**Q: Build a synthetic .storekit config for `tauri dev`, alongside the real sandbox-tester gate?**

| Option | Selected |
|--------|----------|
| Both: .storekit + real gate | ✓ |
| Sandbox-tester only | |
| .storekit only this phase | |

**User free-text:** "Both, when I create the sandbox tester, can you navigate using the tester?"

**Agent answer (recorded as D-06):** No — the native StoreKit sheet is out-of-process system UI and Sandbox-tester sign-in happens there; WebDriver/automation cannot drive it. The real round-trip is a manual human walkthrough. The agent only drives the `.storekit` inner loop and guides the manual steps.

**Q: Which StoreKit states must the spike exercise?** (multi)

| Option | Selected |
|--------|----------|
| .success + on-device verify | ✓ |
| .userCancelled | ✓ |
| .pending | (dropped by user) |
| .unverified → fail closed | ✓ |

**Notes:** `.pending` was not selected, but the agent flagged it as required by MAS-IAP-01 and recorded that the handler must exist + be exercised via the `.storekit` Ask-to-Buy toggle (calm pending state). User did not object.

---

## Spike artifact scope

**Q: How permanent is the code this spike lands?**

| Option | Selected |
|--------|----------|
| Production-shaped, lands on master | ✓ |
| Throwaway proof branch | |

**Q: Where does this phase's purchase trigger live?**

| Option | Selected |
|--------|----------|
| Dev-only hidden trigger | |
| Temporary button in Settings | ✓ |
| Unit/integration only | |

**Notes:** Temporary visible button in Settings ▸ License during the spike, superseded/removed when Phase 28's `StoreLicenseSettings` lands. Agent added a planner note (D-12): Phase 26 needs a minimal sandbox-enabled build harness (entitlements + `network.client` + plugin registration) even though Phase 27 owns the formal variant seam.

## Claude's Discretion

- `iap_*` command names + `storekit://updated` event channel naming
- `.storekit` fixture product/price values
- Temporary dev-button placement/label

## Deferred Ideas

- Restore Purchases UI (Phase 28), Buy + `displayPrice` (Phase 28), refund/revoke listener (Phase 28)
- ASC submission metadata (Phase 30)
- Family Sharing, promo codes, Manage-Purchases deep link (v1.x+)
</content>
