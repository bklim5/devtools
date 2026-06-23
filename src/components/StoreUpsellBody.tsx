// StoreUpsellBody (MAS-IAP-07, Phase 28-04/05, D-02/D-14) — the SHARED store-pitch
// + Buy + Restore body, with NO dialog chrome. Rendered by BOTH:
//   • StoreUpsell      (Phase 28-04) — wraps this in the a11y modal dialog (scrim +
//                        focus-trap + Esc + return-focus) for the App.tsx upsell mount.
//   • StoreToolUpsell  (Phase 28-05, user Option A) — renders this IN PLACE of a
//                        locked tool's UI (ToolRoute), as an inline panel with NO
//                        modal chrome.
//
// Extracting the body into ONE module keeps the pitch/Buy/Restore logic + copy in a
// single place (both surfaces stay byte-identical in behaviour) and is fully
// tree-shakeable: it imports ONLY the platform.iap seam + refreshEntitlements — NO
// Keygen activation form, NO license-key field, NO @/lib/license subtree — so the
// store build that pulls it carries none of the D-03 forbidden copy markers.
//
// Buy/Restore run through the shared useStoreCheckout hook, which wires the
// platform.iap seam ONLY (never the native Tauri API directly, never a
// locally-fabricated grant) and refreshes the gate directly on success. On Buy
// success / a re-granting Restore the hook calls the optional onUnlocked — here
// the body's onPurchased() — so a modal host can dismiss (the inline ToolRoute
// host passes none; the entitlement flip re-renders the route to the unlocked
// tool). See useStoreCheckout for the full belt-and-suspenders / fall-closed
// rationale (T-28-15/24).
//
// Calm tone (D-15): ONE aria-live="polite" role="status" readout region carries
// in-flight + result strings as plain text — no spinners, no toasts. The store
// build has NO Keygen recovery states.

import { type ComponentType } from "react";
import { Command, Heart, ListOrdered, Palette } from "lucide-react";

import { useProDisplayPrice, useStoreCheckout } from "@/shell/useStoreCheckout";

// Pitch chrome — COPIED VERBATIM from UpsellPanel (do not drift). The accent glow
// card + borderless medallion + larger hero title. The glow is a CSS background
// layered over --color-panel (inline so the token stays the source of truth).
const PITCH_CARD_CLASS =
  "relative flex w-full flex-col gap-5 overflow-hidden rounded-[7px] border border-bd p-6";
const PITCH_GLOW_STYLE = {
  background:
    "radial-gradient(125% 85% at 50% 0%, color-mix(in srgb, var(--color-accent) 13%, transparent) 0%, transparent 58%), var(--color-panel)",
};
const MEDALLION_CLASS =
  "flex h-11 w-11 flex-none items-center justify-center rounded-[10px] bg-accent-soft";
const PITCH_TITLE_CLASS = "text-[24px] font-semibold leading-[1.2] text-tx";
const PITCH_BODY_CLASS = "text-[13px] leading-[1.5] text-tx-3";
// Accent CTA — copied verbatim from UpsellPanel.
const PRIMARY_BTN_CLASS =
  "cursor-pointer rounded-[7px] border border-accent-line bg-accent-soft px-3 py-1 text-[12px] text-accent outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default disabled:border-bd disabled:bg-input-bg disabled:text-tx-2";
const SECONDARY_BTN_CLASS =
  "cursor-pointer rounded-[7px] border border-bd bg-input-bg px-3 py-1 text-[12px] text-tx-2 outline-none transition-colors hover:border-bd-2 hover:text-tx focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default";

/** Pitch feature list — each a fitting lucide icon + bold label + one-line muted
 *  sub (mirrors UpsellPanel verbatim). The Command-Palette sub uses the "Command
 *  Palette" wording, never the command-key glyph (Keygen-pitch copy compiled out
 *  of the store build). */
const PITCH_FEATURES: ReadonlyArray<{
  icon: ComponentType<{ className?: string }>;
  label: string;
  sub: string;
}> = [
  {
    icon: Command,
    label: "Command palette",
    sub: "Jump to any tool from the Command Palette — no mouse.",
  },
  { icon: Palette, label: "Custom themes", sub: "Recolor the whole app to taste." },
  {
    icon: ListOrdered,
    label: "Reorder & pin tools",
    sub: "Arrange the sidebar around your workflow.",
  },
  {
    icon: Heart,
    label: "Fund what's next",
    sub: "Directly support maintenance and new tools.",
  },
];

export interface StoreUpsellBodyProps {
  /** Feature icon (lucide-react component), rendered in the accent medallion. */
  icon: ComponentType<{ className?: string }>;
  /** Optional heading id so a wrapping dialog can point aria-labelledby at it. */
  headingId?: string;
  /** Called after a successful Buy / a Restore that re-grants Pro — so a modal host
   *  can dismiss. The inline ToolRoute host passes none (the entitlement flip
   *  re-renders the route to the unlocked tool — a dismiss would be a dead control). */
  onPurchased?: () => void;
}

/** The shared store pitch + Buy + Restore body. No dialog chrome — the host
 *  (StoreUpsell modal / StoreToolUpsell inline panel) owns its own wrapper. No
 *  Keygen activation logic is reachable. */
export function StoreUpsellBody({
  icon: Icon,
  headingId,
  onPurchased,
}: StoreUpsellBodyProps) {
  // ONE calm aria-live readout + a `busy` debounce, both owned by the shared
  // checkout hook. onPurchased fires after a successful Buy / re-granting Restore
  // so a modal host can dismiss (the inline ToolRoute host passes none).
  const { readout, busy, onBuy, onRestore } = useStoreCheckout(onPurchased);
  // The live, OS-localized StoreKit price (e.g. "$9.99") — null until products()
  // resolves and on the no-op/direct arm, where we fall back to the "price shown
  // on the App Store" copy. Never a hardcoded number (keeps the D-03 grep clean).
  const displayPrice = useProDisplayPrice();

  return (
    <div className={PITCH_CARD_CLASS} style={PITCH_GLOW_STYLE}>
      {/* Medallion ABOVE a larger title — borderless accent-soft tile, then
          the hero heading on its own line. */}
      <div className="flex flex-col gap-4">
        <span className={MEDALLION_CLASS}>
          <Icon className="h-5 w-5 flex-none text-accent" aria-hidden="true" />
        </span>
        <h2 id={headingId} className={PITCH_TITLE_CLASS}>
          Thank you for using TinkerDev ❤️
        </h2>
      </div>
      <p className={PITCH_BODY_CLASS}>
        Most of TinkerDev is free — built to make your everyday dev tasks faster.
        A one-time, lifetime Pro purchase unlocks the extras and funds
        what&apos;s next.
      </p>

      {/* Feature list — 4 rows, each a borderless accent-soft icon square + a
          bold label + a one-line greyer sub. */}
      <ul className="flex flex-col gap-3">
        {PITCH_FEATURES.map(({ icon: FeatureIcon, label, sub }) => (
          <li key={label} className="flex items-start gap-3">
            <span className="flex h-7 w-7 flex-none items-center justify-center rounded-[6px] bg-accent-soft">
              <FeatureIcon
                aria-hidden="true"
                className="h-3.5 w-3.5 text-accent"
              />
            </span>
            <div className="flex flex-col gap-0.5">
              <p className="text-[12px] font-semibold leading-[1.3] text-tx">
                {label}
              </p>
              <p className="text-[12px] leading-[1.4] text-tx-3">{sub}</p>
            </div>
          </li>
        ))}
      </ul>

      {/* Neutral divider. */}
      <hr className="border-t border-bd" />

      {/* Price block — shows the live StoreKit displayPrice once loaded (the real
          OS-localized price, never a hardcoded number). Falls back to the
          "price shown on the App Store" copy until it resolves / off StoreKit. */}
      <div className="flex flex-col gap-0.5">
        <span className="text-[16px] font-semibold text-tx">
          {displayPrice ? `Lifetime Pro · ${displayPrice}` : "Lifetime Pro"}
        </span>
        <span className="text-[12px] text-tx-3">
          {displayPrice
            ? "One-time purchase"
            : "One-time purchase · price shown on the App Store"}
        </span>
      </div>

      {/* CTA row — Buy + the Apple-mandatory always-available Restore. */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onBuy}
          disabled={busy}
          className={PRIMARY_BTN_CLASS}
        >
          Buy Pro — Lifetime
        </button>
        <button
          type="button"
          onClick={onRestore}
          disabled={busy}
          className={SECONDARY_BTN_CLASS}
        >
          Restore Purchases
        </button>
      </div>

      {/* Claims footer — all true (one-time / lifetime / store-managed). */}
      <p className="font-mono text-[11px] text-tx-3">
        One-time payment · Lifetime · Managed by the App Store
      </p>

      {/* ONE calm readout region — plain text, no spinner, never red/amber. */}
      <p
        role="status"
        aria-live="polite"
        className="min-h-[18px] break-words text-[12px] leading-[1.5] text-tx-2"
      >
        {readout ?? ""}
      </p>
    </div>
  );
}
