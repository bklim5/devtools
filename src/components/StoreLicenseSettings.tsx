// StoreLicenseSettings (MAS-IAP-03/06/07, Phase 28-03, D-11/D-12/D-14) — the
// App-Store-managed License pane for the `appstore` build variant. A SEPARATE
// module from LicenseSettings (NOT an `if (IS_APPSTORE)` branch inside it) so
// Plan 05's static IS_APPSTORE switch in settingsPanes.tsx can tree-shake the
// Keygen/license-key subtree OUT of the store bundle and pass the D-03 grep gate.
//
// Two mutually-exclusive layouts gated on isPro(useEntitlements()):
//   • Pro-active — the green Pro banner (reused verbatim from LicenseSettings) +
//     an always-visible Restore button. NO details table, NO masked-key field, NO
//     Licensee email, NO device-deactivate (those are Keygen concepts — D-11).
//   • Free — a calm status card + the lifetime Buy primary CTA (NO in-app price —
//     the App Store sheet carries it, D-12) + an always-visible Restore.
//
// Restore is reachable in BOTH layouts (Apple-mandatory always-available restore).
//
// Buy/Restore run through the shared useStoreCheckout hook — the platform.iap seam
// ONLY (never the native Tauri API directly, never a locally-fabricated grant),
// refreshing the gate directly on success while granting nothing client-side so it
// stays baseFromStoreKit-only (fall-closed invariant intact). The boot listener is
// KEPT for refunds / Ask-to-Buy approvals / revokes (D-09). See useStoreCheckout
// for the full belt-and-suspenders rationale.
//
// Calm tone (D-15): ONE aria-live="polite" readout region carries in-flight +
// result strings as plain text — no spinners, no toasts. A no-op/error arm renders
// the calm "App Store isn't available" line, never a red/amber banner or an
// uncaught throw. There are ZERO amber `warn` / red `bad` states (D-11) — StoreKit
// has no attention/refresh-needed/problem states.
//
// Class constants are COPIED VERBATIM from LicenseSettings (CARD/HEADING/BODY/
// SECONDARY) + UpsellPanel (PRIMARY) as LOCAL constants — NOT imported from those
// modules, which would re-pull the Keygen import subtree and break the tree-shake.

import { useStoreCheckout } from "@/shell/useStoreCheckout";
import { useEntitlements } from "@/shell/useEntitlements";
import { isPro } from "@/lib/entitlements/entitlements";

// Copied verbatim from LicenseSettings (do not drift — 21-UI-SPEC reuse mandate).
const CARD_CLASS =
  "flex max-w-[420px] flex-col gap-4 rounded-[7px] border border-bd bg-panel p-6";
const HEADING_CLASS = "text-[16px] font-semibold leading-[1.2] text-tx";
const BODY_CLASS = "flex flex-col gap-2 text-[12px] leading-[1.5] text-tx-2";
const SECONDARY_BTN_CLASS =
  "cursor-pointer rounded-[7px] border border-bd bg-input-bg px-3 py-1 text-[12px] text-tx-2 outline-none transition-colors hover:border-bd-2 hover:text-tx focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default";
// Copied verbatim from UpsellPanel (the accent CTA) — NOT imported (tree-shake).
const PRIMARY_BTN_CLASS =
  "cursor-pointer rounded-[7px] border border-accent-line bg-accent-soft px-3 py-1 text-[12px] text-accent outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default disabled:border-bd disabled:bg-input-bg disabled:text-tx-2";

export function StoreLicenseSettings() {
  const pro = isPro(useEntitlements());

  // Buy/Restore handlers + the calm aria-live readout + the `busy` debounce, all
  // owned by the shared checkout hook. No onUnlocked: the live entitlement flip
  // re-renders this pane to Pro-active (a dismiss would be a dead control).
  const { readout, busy, onBuy, onRestore } = useStoreCheckout();

  // ONE calm readout region (shared by both layouts) — plain text, no spinner.
  const readoutRegion = (
    <p
      role="status"
      aria-live="polite"
      className="min-h-[18px] break-words text-[12px] leading-[1.5] text-tx-2"
    >
      {readout ?? ""}
    </p>
  );

  const restoreButton = (
    <button
      type="button"
      onClick={onRestore}
      disabled={busy}
      className={SECONDARY_BTN_CLASS}
    >
      Restore Purchases
    </button>
  );

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

      {pro ? (
        // Pro-active — the green banner (reused verbatim) + always-visible Restore.
        // NO details table, NO masked-key field, NO device-deactivate (D-11).
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

          <p className="text-[12px] leading-[1.5] text-tx-3">
            Already bought Pro on another device? Restore to unlock it here.
          </p>
          <div className="flex flex-wrap gap-2">{restoreButton}</div>
          {readoutRegion}
        </div>
      ) : (
        // Free — a calm status card + Buy (NO in-app price, D-12) + Restore.
        <div className={CARD_CLASS}>
          <h4 className={HEADING_CLASS}>Free</h4>
          <div className={BODY_CLASS}>
            <p>
              Most of TinkerDev is free. Unlock custom themes, tool reordering,
              and the Command Palette with a one-time Pro purchase.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onBuy}
              disabled={busy}
              className={PRIMARY_BTN_CLASS}
            >
              Buy Pro — Lifetime
            </button>
            {restoreButton}
          </div>
          <p className="text-[12px] leading-[1.5] text-tx-3">
            One-time purchase. The App Store shows the price when you tap Buy.
          </p>
          {readoutRegion}
        </div>
      )}
    </div>
  );
}
