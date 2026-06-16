// Phase 22.2: the ONE routing point for a Pro-locked action triggered by a
// not-Pro user (a free ⌘K, or a locked customization affordance — pin/drag/Alt+P/
// Reset). The right surface depends on WHY they aren't Pro:
//
//   • notActivated (genuinely free, never paid) → the focused Unlock-Pro MODAL
//     (the sales pitch + Buy + activate), a quick interruption that dismisses back.
//   • refreshNeeded / problem (a PAYING customer whose license lapsed or went bad)
//     → Settings ▸ License, which renders the calm recovery/reactivation form.
//     A paying customer must NEVER see the sales pitch (D-44) — so these states
//     are routed to the recovery surface, not the pitch modal.
//
// licensed / offlineGrace never reach here (they are Pro — the caller's isPro /
// entitlement gate passes, so the real feature runs instead of an upsell).
import { getLicenseUiSnapshot } from "@/lib/license/licenseUi";
import { openSettings } from "./settingsStore";
import { openUpsell } from "./upsellStore";

export function openProUpsell(invokerEl?: HTMLElement | null): void {
  const state = getLicenseUiSnapshot().state;
  if (state === "refreshNeeded" || state === "problem") {
    // Lapsed/attention paying customer — the recovery form, NOT the pitch (D-44).
    openSettings("license", invokerEl);
  } else {
    // Genuinely free (notActivated) — the focused Unlock-Pro pitch modal.
    openUpsell(invokerEl);
  }
}
