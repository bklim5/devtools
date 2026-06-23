// StoreLicenseSettings (MAS-IAP-03/06/07, Phase 28-03, D-11/D-12/D-14) — the
// App-Store-managed License pane for the `appstore` build variant. A SEPARATE
// module from LicenseSettings (NOT an `if (IS_APPSTORE)` branch inside it) so
// Plan 05's static IS_APPSTORE switch in settingsPanes.tsx can tree-shake the
// Keygen/license-key subtree OUT of the store bundle and pass the D-03 grep gate.
//
// Two mutually-exclusive layouts gated on isPro(useEntitlements()):
//   • Pro-active — the green Pro banner (reused verbatim from LicenseSettings).
//     NO Restore (an already-Pro user has nothing to restore; Apple's restore
//     requirement is satisfied on the Free pitch for a not-yet-Pro user). NO
//     details table, NO masked-key field, NO email, NO deactivate (Keygen — D-11).
//   • Free — the FULL shared store pitch (StoreUpsellBody: thank-you + the Pro
//     unlocks + live StoreKit price + Buy + Restore) rendered IN PLACE of a status
//     card, mirroring LicenseSettings' free-state inline upsell (D-22.1-6). The Buy
//     CTA is in-app StoreKit (never a Lemon Squeezy link); the entitlement flip
//     re-renders this pane to Pro-active on success.
//
// Class constants are COPIED VERBATIM from LicenseSettings (CARD/HEADING/BODY/
// SECONDARY) as LOCAL constants — NOT imported, which would re-pull the Keygen
// import subtree and break the tree-shake.

import { Lock } from "lucide-react";
import { usePreferences } from "@/shell/usePreferences";
import { useEntitlements } from "@/shell/useEntitlements";
import { isPro } from "@/lib/entitlements/entitlements";
import { StoreUpsellBody } from "./StoreUpsellBody";

// Copied verbatim from LicenseSettings (do not drift — 21-UI-SPEC reuse mandate).
const CARD_CLASS =
  "flex max-w-[420px] flex-col gap-4 rounded-[7px] border border-bd bg-panel p-6";
const HEADING_CLASS = "text-[16px] font-semibold leading-[1.2] text-tx";
const BODY_CLASS = "flex flex-col gap-2 text-[12px] leading-[1.5] text-tx-2";
const SECONDARY_BTN_CLASS =
  "cursor-pointer rounded-[7px] border border-bd bg-input-bg px-3 py-1 text-[12px] text-tx-2 outline-none transition-colors hover:border-bd-2 hover:text-tx focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default";

export function StoreLicenseSettings() {
  const pro = isPro(useEntitlements());
  const { preferences, prefsLoaded, ackLicenseDropNotice } = usePreferences();

  // D-07 one-time drop notice (MAS-IAP-05): after a live Pro→free drop (a refund
  // or revoke detected by refreshEntitlements) the gate flips this pane to the Free
  // layout AND fires the notice. Calm, dismissable, inline — never a toast/red
  // banner. Wait for prefsLoaded so the default `true` never flashes it off (mirrors
  // LicenseSettings; uses the SAME licenseDropNoticeAck flag, store-flavoured copy).
  const showDropNotice =
    prefsLoaded && preferences.licenseDropNoticeAck === false;
  const dropNotice = showDropNotice ? (
    <div className={CARD_CLASS}>
      <div className="flex items-center gap-2">
        <Lock className="h-5 w-5 flex-none text-tx-2" aria-hidden="true" />
        <h4 className={HEADING_CLASS}>Your Pro features turned off</h4>
      </div>
      <div className={BODY_CLASS}>
        <p>
          Your themes and tool order are saved — buy Pro again any time to bring
          them back.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => ackLicenseDropNotice()}
          className={SECONDARY_BTN_CLASS}
        >
          Got it
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-6 overflow-auto p-8">
      <div className="flex flex-col gap-1">
        <h3 className="text-[20px] font-semibold leading-[1.2] text-tx">
          License
        </h3>
        <p className="text-[12px] leading-[1.5] text-tx-3">
          Manage your Pro purchase.
        </p>
      </div>

      {dropNotice}

      {pro ? (
        // Pro-active — the green banner (reused verbatim). NO Restore button (an
        // already-Pro user has nothing to restore); NO details/key/deactivate (D-11).
        <div className="flex max-w-[420px] flex-col gap-4">
          <div className="flex w-full items-start gap-3 rounded-[7px] border border-ok-line bg-ok-soft p-5">
            {/* Green dot — the calm success glyph (text-ok on bg-ok-soft is AA). */}
            <span
              aria-hidden="true"
              className="mt-1.5 h-2 w-2 flex-none rounded-full bg-ok"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className={HEADING_CLASS}>Pro</h4>
                {/* Green Pro pill — the Pro-active badge. */}
                <span className="rounded-full border border-ok-line bg-ok-soft px-2 py-0.5 font-mono text-[10px] font-semibold uppercase leading-none tracking-wide text-ok">
                  Pro
                </span>
              </div>
              <p className="text-[12px] leading-[1.5] text-tx-2">
                Pro is active — managed through the App Store.
              </p>
            </div>
          </div>
        </div>
      ) : (
        // Free — the FULL shared store pitch IN PLACE of a status card (D-22.1-6).
        // Its own heading is the surface; Buy + Restore + the live price live inside
        // it. Constrained so it reads as a card, not a full-bleed pane.
        <div className="max-w-[480px]">
          <StoreUpsellBody icon={Lock} />
        </div>
      )}
    </div>
  );
}
