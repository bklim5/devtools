// StoreToolUpsell (MAS-IAP-07, Phase 28-05, D-02/D-14, user-approved Option A) —
// the INLINE locked-tool upsell panel for the `appstore` build. A tree-shakeable
// sibling of the Keygen UpsellPanel: ToolRoute renders it (via the build-time
// IS_APPSTORE lazy switch) IN PLACE of a locked tool's UI — the same "buy to unlock"
// UX shape as the direct build's UpsellPanel route placement, but StoreKit-native.
//
// It reuses the SHARED StoreUpsellBody (pitch + Buy + Restore) WITHOUT the modal
// chrome — it is an in-place page panel, NOT a dialog (no role=dialog, no scrim, no
// focus-trap; the element-level entitlement gate re-renders the route to the
// unlocked tool on the live flip, so there is no modal to dismiss). Because it pulls
// only StoreUpsellBody (platform.iap + refreshEntitlements), it carries NONE of the
// Keygen D-03 markers: no license-key field, no license.tinkerdev.io, no $9, no ⌘K,
// no "I have a license key", no tinkerdev.io/buy.
//
// The heading is the body's own h2 — matching UpsellPanel's "panel" variant, which
// keeps h2 for route placement (top-level page chrome with no pane heading above it,
// so a lower level would be a heading-order skip).
import type { ComponentType } from "react";
import { StoreUpsellBody } from "./StoreUpsellBody";

export interface StoreToolUpsellProps {
  /** The locked tool's icon (lucide-react component), rendered in the medallion. */
  icon: ComponentType<{ className?: string }>;
  /** Stable heading id (parity with UpsellPanel's route placement). */
  headingId?: string;
}

/** The inline store upsell panel placed by ToolRoute in place of a locked tool's
 *  UI. Renders the shared StoreUpsellBody with NO dialog wrapper — the entitlement
 *  flip re-renders the route to the unlocked tool, so no dismiss is needed
 *  (onPurchased intentionally omitted). */
export function StoreToolUpsell({ icon, headingId }: StoreToolUpsellProps) {
  return <StoreUpsellBody icon={icon} headingId={headingId} />;
}
