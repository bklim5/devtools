// LicenseSettings (LIC-09, D-87/D-88) — the dedicated #/settings/license app-chrome
// route hosting the license status + management UI. NOT a tool (not in
// ENABLED_TOOLS, registry stays the single control plane for the eleven tools);
// registered as a non-tool child route under <App/> in router.tsx.
//
// Renders the five resolve_status states (D-73) with the verbatim 21-UI-SPEC
// copy: free / licensed / offlineGrace / refreshNeeded / problem. offlineGrace,
// refreshNeeded and problem are CALM neutral (tx-2/tx-3) — NO text-bad, no red,
// no banner (D-77/D-83/ENT-04); the OK dot (text-ok) shows ONLY for
// licensed/offlineGrace (Pro active). Accent is reserved for the primary action
// fill + focus rings (D-24) — never for status glyphs.
//
// Actions (all live-flip, no restart — D-76):
//   Refresh    — platform.license.refresh() then refreshLicenseUi() +
//                refreshEntitlements(); a refresh that drops entitlements
//                transitions silently to refreshNeeded (no error dialog — D-82).
//   Deactivate — confirm-FIRST inline (D-78): "Deactivate this device" reveals a
//                calm in-place confirm; focus moves to the confirm control on
//                reveal and returns on cancel. On confirm -> deactivate() ->
//                drop to free. Offline (D-79): the call rejects `offline` BEFORE
//                any local clear (server-delete-first, Rust-pinned) — we surface
//                calm guidance, NEVER text-bad, and local state is untouched.
//   Activate   — INLINE (Phase 22.1, D-22.1-6/7; revises SET-06). The not-Pro
//                states render the shared activation surface (InlineActivation)
//                directly in the pane instead of opening the standalone UpsellModal
//                STACKED above the Settings modal (the old modal-on-modal path):
//                  • free/notActivated → the FULL pitch inline ("Thank you ❤️" +
//                    Buy license + "I have a license key" reveal → key input +
//                    Activate) — variant="upsell" (D-22.1-6).
//                  • refreshNeeded/problem → the calm status card + Refresh KEPT,
//                    with ONLY the key-input + Activate form inline below (NO sales
//                    pitch — a lapsed/attention paying customer never sees it),
//                    variant="form-only" (D-22.1-7). Replaces the old modal-opening
//                    Reactivate button.
//                InlineActivation is the SAME shared surface UpsellModal uses — no
//                duplicate UI, no duplicated activation logic (D-22.1-4). It adapts
//                on hasStoredKey: an empty submit reuses the Keychain key, a pasted
//                key replaces it. The standalone UpsellModal still opens from the
//                sidebar "Unlock Pro" + ⌘K free-tier entries (D-22.1-5).
//
// The masked key + licensee email come from verified cert data (D-89); the RAW
// key NEVER round-trips through JS (LIC-04) — there is no raw-key field on the
// payload. Phase 22.1 walkthrough (2026-06-16): the masked License key is now
// DISPLAY-ONLY — no CopyButton (copying the masked dots is useless) and no
// reveal/eye toggle (the raw key must never cross into JS). The compact details
// show ONLY Licensee (email) + License key (masked); Plan/Renews/Activated are
// dropped (a lifetime license has no subscription renewal, and neither a plan
// nor an activated-date is in the verified payload — we don't invent them).
//
// Class constants are copied VERBATIM from UpsellPanel (21-UI-SPEC reuse mandate)
// — do NOT introduce new sizes/tokens.

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Lock, RefreshCw } from "lucide-react";
import { platform, type LicenseErrorCode } from "@/lib/platform";
import { refreshEntitlements } from "@/lib/entitlements/store";
import {
  refreshLicenseUi,
  refreshLicenseUiDetailed,
} from "@/lib/license/licenseUi";
import { useLicenseUi } from "@/shell/useLicenseUi";
import { usePreferences } from "@/shell/usePreferences";
import { InlineActivation } from "./UpsellPanel";

// Copied verbatim from UpsellPanel (do not drift — 21-UI-SPEC reuse mandate).
const CARD_CLASS =
  "flex max-w-[420px] flex-col gap-4 rounded-[7px] border border-bd bg-panel p-6";
const HEADING_CLASS = "text-[16px] font-semibold leading-[1.2] text-tx";
const BODY_CLASS = "flex flex-col gap-2 text-[12px] leading-[1.5] text-tx-2";
const SECONDARY_BTN_CLASS =
  "cursor-pointer rounded-[7px] border border-bd bg-input-bg px-3 py-1 text-[12px] text-tx-2 outline-none transition-colors hover:border-bd-2 hover:text-tx focus-visible:ring-2 focus-visible:ring-accent";
// Destructive button (Phase 22.1 walkthrough 2026-06-16) — the confirm card's
// real "Deactivate". Mirrors the primary/secondary triad SHAPE (soft fill + line
// border + colored text) but in the existing red --color-bad token: bg-bad/10 +
// border-bad/75 + text-bad reads ~5.7:1 (AA) on the bad-tinted card, and the
// focus ring is the bad token (not accent) so the destructive intent is explicit.
const DESTRUCTIVE_BTN_CLASS =
  "cursor-pointer rounded-[7px] border border-bad/75 bg-bad/10 px-3 py-1 text-[12px] font-medium text-bad outline-none transition-colors hover:bg-bad/20 focus-visible:ring-2 focus-visible:ring-bad disabled:cursor-default disabled:border-bd disabled:bg-input-bg disabled:text-tx-2";

const LABEL_CLASS = "text-[12px] text-tx-2";
const VALUE_CLASS = "font-mono text-[12px] text-tx";

/** Calm copy for a deactivate/refresh rejection (D-79/D-82). Offline guidance is
 *  NOT an error — it renders in the calm tx-2 region, not text-bad. */
const DEACTIVATE_OFFLINE_COPY = "Connect to the internet to free this seat.";
const REFRESH_ERROR_COPY: Partial<Record<LicenseErrorCode, string>> = {
  offline: "You're offline — connect and try again.",
  serviceUnreachable: "Can't reach the licensing service — try again shortly.",
};

function errorCode(err: unknown): LicenseErrorCode | null {
  const code = (err as { code?: string } | null)?.code;
  return (code ?? null) as LicenseErrorCode | null;
}

export function LicenseSettings() {
  const ui = useLicenseUi();
  const { preferences, prefsLoaded, ackLicenseDropNotice } = usePreferences();

  // D-76 status-open trigger: re-query the local status on mount so the route
  // always shows fresh state (pure-local file read + verify — never network).
  // ROUTE path (D-89, codex finding 2): use the DETAILED refresh so the masked
  // key + email are populated — this is the ONLY licensed path that reads the
  // Keychain, and it is user-initiated (visiting this route), so it never
  // contributes to the licensed-launch prompt (T-19-10 restored).
  useEffect(() => {
    void refreshLicenseUiDetailed().catch((err) => {
      console.error("[license] status refresh failed:", err);
    });
  }, []);

  // --- Refresh -------------------------------------------------------------
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const onRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshError(null);
    try {
      await platform.license.refresh();
    } catch (err) {
      // D-82: a refresh that drops entitlements is NOT an error dialog — the
      // status simply transitions (refreshLicenseUi below picks up the new
      // state). Only a transport failure (offline/service) surfaces a calm line.
      const code = errorCode(err);
      if (code && REFRESH_ERROR_COPY[code]) {
        setRefreshError(REFRESH_ERROR_COPY[code]!);
      }
    } finally {
      // Always re-read local status + re-resolve entitlements: the cert on disk
      // may have changed (renewed OR dropped) — live flip, no restart (D-76).
      // DETAILED on the route so the masked key/email stay populated after a
      // user-initiated Refresh (D-89; this is still a user action, not launch).
      await refreshLicenseUiDetailed().catch(() => {});
      await refreshEntitlements().catch(() => {});
      setRefreshing(false);
    }
  };

  // --- Deactivate (confirm-first inline, D-78/D-79) ------------------------
  const [confirming, setConfirming] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  // ONE calm aria-live line carries "Deactivating…" AND the D-79 offline guidance.
  const [deactivateMsg, setDeactivateMsg] = useState<string | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const deactivateBtnRef = useRef<HTMLButtonElement>(null);
  // Which control to focus AFTER the confirm reveal/collapse commits — the target
  // button only exists in the DOM once `confirming` flips, so focus moves in an
  // effect keyed on `confirming` (mirrors UpsellModal's focus-capture/return
  // contract + the Sidebar focus-after-move pattern), not synchronously.
  const focusAfter = useRef<"confirm" | "trigger" | null>(null);

  useEffect(() => {
    const target = focusAfter.current;
    if (!target) return;
    focusAfter.current = null;
    (target === "confirm" ? confirmBtnRef : deactivateBtnRef).current?.focus();
  }, [confirming]);

  const revealConfirm = () => {
    setDeactivateMsg(null);
    focusAfter.current = "confirm"; // move focus to the confirm control on reveal
    setConfirming(true);
  };
  const cancelConfirm = () => {
    focusAfter.current = "trigger"; // return focus to the trigger on cancel
    setConfirming(false);
  };
  const onDeactivate = async () => {
    if (deactivating) return;
    setDeactivating(true);
    setDeactivateMsg("Deactivating…");
    try {
      await platform.license.deactivate();
      // D-78: dropped to free — live flip both snapshots, no restart.
      await refreshLicenseUi();
      await refreshEntitlements();
      setConfirming(false);
      setDeactivateMsg(null);
    } catch {
      // D-79: any deactivate rejection (offline / service-unreachable) is
      // BLOCKED — the Rust deactivate does server-delete-first, so local state
      // is never cleared. Surface calm guidance in the SAME aria-live region
      // (tx-2, NOT text-bad — it's guidance, not an error); the seat is intact.
      setDeactivateMsg(DEACTIVATE_OFFLINE_COPY);
    } finally {
      setDeactivating(false);
    }
  };

  // --- D-84 one-time drop notice ------------------------------------------
  // Surfaced inline ONLY when a drop is pending acknowledgement (the flag was
  // set false when entitlements dropped). Dismiss -> ack (sets it true). Never a
  // toast/dialog. Wait for prefsLoaded so the default `true` never flashes it off.
  const showDropNotice = prefsLoaded && preferences.licenseDropNoticeAck === false;

  const isProActive = ui.state === "licensed" || ui.state === "offlineGrace";
  const maskedKey = isProActive ? ui.maskedKey : null;
  const email = isProActive ? ui.email : null;
  // refreshNeeded + problem keep their calm status card + Refresh and render the
  // INLINE form-only activation surface below (D-22.1-7) — it is the ONE calm
  // "no longer active" path, shared with a suspended/revoked drop (D-83).
  const showInlineForm = ui.state === "refreshNeeded" || ui.state === "problem";
  // free/notActivated renders the FULL inline upsell INSTEAD of a status card
  // (D-22.1-6) — its own pitch heading is the surface (no duplicated "Free"
  // heading + pitch). The drop notice (D-84) still renders above it.
  const isFree = ui.state === "notActivated";

  // Status copy for the MANAGED states only — free/notActivated early-returns to
  // the inline upsell below and never renders a status card (D-22.1-6), so the
  // notActivated arm is intentionally absent; "Free" falls through the default.
  const statusLabel = ((): string => {
    switch (ui.state) {
      case "licensed":
        return "Licensed";
      case "offlineGrace":
        return "Licensed (offline)";
      case "refreshNeeded":
        return "Pro is no longer active";
      case "problem":
        return "License needs attention";
      default:
        return "Free";
    }
  })();

  // Attention-card body (refreshNeeded/problem only). The Pro-active banner uses
  // its own fixed success copy below (walkthrough 2026-06-16), so the
  // licensed/offlineGrace arms are intentionally absent here.
  const statusBody = ((): string => {
    switch (ui.state) {
      case "refreshNeeded":
        return "Connect to the internet and refresh to restore Pro. Your themes and tool order are saved and will come right back.";
      case "problem":
        return "Your license file couldn't be verified. Your tools keep working — activate again to restore your license.";
      default:
        return "Most of TinkerDev is free.";
    }
  })();

  // D-84 one-time drop notice — calm, dismissable, inline (never a toast).
  // Shared by the free-state branch and the managed-state branch below.
  const dropNotice = showDropNotice ? (
    <div className={CARD_CLASS}>
      <div className="flex items-center gap-2">
        <Lock className="h-5 w-5 flex-none text-tx-2" aria-hidden="true" />
        <h4 className={HEADING_CLASS}>Your Pro features turned off</h4>
      </div>
      <div className={BODY_CLASS}>
        <p>
          Your themes and tool order are saved — reactivate any time to bring
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

  // free/notActivated (D-22.1-6): render the FULL upsell/activation surface INLINE
  // ("Thank you ❤️" + Buy + "I have a license key" → key input + Activate) — the
  // SAME shared surface UpsellModal uses, no stacked modal-on-modal. The inline
  // pitch heading IS the surface, so there is no separate "Free" status card here
  // (no duplicated heading). The drop notice (if pending) still renders above.
  if (isFree) {
    return (
      <div className="flex flex-col gap-12 overflow-auto p-8">
        <h3 className="sr-only">License</h3>
        {dropNotice}
        <InlineActivation variant="upsell" icon={Lock} />
      </div>
    );
  }

  // Phase 22.1: problem/refreshNeeded render an AMBER "attention" card (warn
  // triad), not the neutral card — a calm WARNING with the Refresh action moved
  // to the card's top-right, and (problem only) an UNVERIFIED amber pill badge.
  // licensed/offlineGrace keep the neutral card UNCHANGED (Pro is active).
  const isAttention = ui.state === "problem" || ui.state === "refreshNeeded";

  return (
    <div className="flex flex-col gap-6 overflow-auto p-8">
      {/* Phase 22.1: a visible, prominent pane header + subtitle for the managed
          states. It is an <h3> — one level under the SettingsModal dialog title
          ("Settings", an <h2>) so heading-order never inverts (the prior sr-only
          <h1> sat ABOVE the dialog's h2). The status block headings below are
          <h4> (22.1 a11y fix — one level under THIS h3; the prior <h2> was a
          level INCREASE under the h3, which axe heading-order flags). The e2e
          statusHeading() probe reads the first status <h4> inside the dialog. */}
      <div className="flex flex-col gap-1">
        <h3 className="text-[20px] font-semibold leading-[1.2] text-tx">
          License
        </h3>
        <p className="text-[12px] leading-[1.5] text-tx-3">
          Manage your activation and license key.
        </p>
      </div>

      {dropNotice}

      {/* Status block. Phase 22.1 walkthrough (2026-06-16): the attention states
          (problem/refreshNeeded) render a 3-COLUMN amber banner —
          [AlertTriangle | content | SECONDARY Refresh] — so the icon spans the
          heading+body and Refresh reads as the calm secondary re-check. Pro-active
          states keep the neutral card + license fields. */}
      {isAttention ? (
        <div className="flex w-full items-start gap-3 rounded-[7px] border border-warn-line bg-warn-soft p-5">
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 flex-none text-warn"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            {/* 21-04 FLAG P6: announce the status-label transition (e.g. a silent
                refresh-drop "Licensed" → "Pro is no longer active", D-82) — polite,
                NEVER assertive (D-77/D-83 calm tone). */}
            <div
              className="flex flex-wrap items-center gap-2"
              aria-live="polite"
            >
              <h4 className={HEADING_CLASS}>{statusLabel}</h4>
              {/* UNVERIFIED amber pill — problem state ONLY (a tampered/foreign
                  file). The amber-on-warn-soft text clears AA (warn ~10:1). */}
              {ui.state === "problem" ? (
                <span className="rounded-full border border-warn-line bg-warn-soft px-2 py-0.5 font-mono text-[10px] font-semibold uppercase leading-none tracking-wide text-warn">
                  Unverified
                </span>
              ) : null}
            </div>
            <p className="text-[12px] leading-[1.5] text-tx-2">{statusBody}</p>
            {/* Calm in-flight / error line — its own aria-live region. */}
            <p
              aria-live="polite"
              className="min-h-[18px] text-[12px] leading-[1.5] text-tx-2"
            >
              {refreshing ? "Refreshing…" : (refreshError ?? "")}
            </p>
          </div>
          {/* Refresh is the SECONDARY re-check here (panel-toned, not accent) with
              a spin-on-busy icon — secondary to Activate below. */}
          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={refreshing}
            aria-busy={refreshing}
            className={`inline-flex flex-none items-center gap-1.5 ${SECONDARY_BTN_CLASS}`}
          >
            <RefreshCw
              aria-hidden="true"
              className={`h-3.5 w-3.5 flex-none ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      ) : (
        // Pro-active (licensed/offlineGrace) — Phase 22.1 walkthrough (2026-06-16):
        // a GREEN success banner (parallels the amber attention banner's 3-column
        // structure exactly, but green) over a separator + a compact details card.
        // The GREEN tint is on the STATUS BANNER ONLY (walkthrough 2026-06-16);
        // the Licensee/key details sit BELOW it as a neutral label↔value table.
        <>
          <div className="flex w-full items-start gap-3 rounded-[7px] border border-ok-line bg-ok-soft p-5">
            {/* Green dot — the calm success glyph (text-ok on bg-ok-soft is AA). */}
            <span
              aria-hidden="true"
              className="mt-1.5 h-2 w-2 flex-none rounded-full bg-ok"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              {/* P6: announce the status-label transition (D-82) — polite. */}
              <div
                className="flex flex-wrap items-center gap-2"
                aria-live="polite"
              >
                <h4 className={HEADING_CLASS}>{statusLabel}</h4>
                {/* Green PRO pill — the Pro-active badge (mirrors the amber
                    UNVERIFIED pill, but in the ok token). */}
                <span className="rounded-full border border-ok-line bg-ok-soft px-2 py-0.5 font-mono text-[10px] font-semibold uppercase leading-none tracking-wide text-ok">
                  Pro
                </span>
              </div>
              <p className="text-[12px] leading-[1.5] text-tx-2">
                Pro is active on this device — your license refreshes
                automatically.
              </p>
              {/* Calm in-flight / error line — its own aria-live region. */}
              <p
                aria-live="polite"
                className="min-h-[18px] text-[12px] leading-[1.5] text-tx-2"
              >
                {refreshing ? "Refreshing…" : (refreshError ?? "")}
              </p>
            </div>
            {/* Refresh is SECONDARY here (panel-toned, not accent) with a
                spin-on-busy icon — same as the attention banner's Refresh. */}
            <button
              type="button"
              onClick={() => void onRefresh()}
              disabled={refreshing}
              aria-busy={refreshing}
              className={`inline-flex flex-none items-center gap-1.5 ${SECONDARY_BTN_CLASS}`}
            >
              <RefreshCw
                aria-hidden="true"
                className={`h-3.5 w-3.5 flex-none ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>

          {/* Details table — Licensee + masked License key ONLY (Plan/Renews/
              Activated dropped). label↔value rows on a neutral card, hairline
              dividers, mono values. The masked key is DISPLAY-ONLY: no CopyButton
              (the dots are useless), no reveal toggle (the raw key never crosses
              into JS — LIC-04). em-dash when null (D-89). */}
          <dl className="flex w-full flex-col rounded-[7px] border border-bd bg-panel">
            <div className="flex items-center gap-4 border-b border-bd px-4 py-3">
              <dt className={`w-28 flex-none ${LABEL_CLASS}`}>Licensee</dt>
              <dd className={`min-w-0 truncate ${VALUE_CLASS}`}>{email ?? "—"}</dd>
            </div>
            <div className="flex items-center gap-4 px-4 py-3">
              <dt className={`w-28 flex-none ${LABEL_CLASS}`}>License key</dt>
              <dd className={VALUE_CLASS}>{maskedKey ?? "—"}</dd>
            </div>
          </dl>
        </>
      )}

      {/* Separator between the attention banner and the Activate section
          (walkthrough 2026-06-16). */}
      {showInlineForm ? <hr className="border-t border-bd" /> : null}

      {/* "Activate a license" section (Phase 22.1) — attention states only;
          clamped narrow (forms read better). Wraps the shared form-only surface
          (D-22.1-7) with a header + subtitle + the muted recovery hint. NO sales
          pitch. There is no account portal, so "Lost your key?" is a plain line. */}
      {showInlineForm ? (
        <div className="flex max-w-[420px] flex-col gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-[14px] font-semibold leading-[1.3] text-tx">
              Activate a license
            </p>
            <p className="text-[12px] leading-[1.5] text-tx-3">
              Paste the key from your purchase confirmation email to re-verify
              this device.
            </p>
          </div>
          <InlineActivation variant="form-only" icon={Lock} />
          <p className="text-[12px] leading-[1.5] text-tx-3">
            Lost your key? Check your purchase email
          </p>
        </div>
      ) : null}

      {/* Deactivate (confirm-first inline, D-78) — only when Pro is active.
          Walkthrough 2026-06-16: the trigger is LEFT-aligned; confirming swaps in
          a FULL-WIDTH reddish WARNING card laid out [icon | content | buttons] —
          Cancel (secondary) + a DESTRUCTIVE Deactivate (red --color-bad), the
          button group in the right column (parallel to the status banners). The
          confirm-first focus contract (focus → confirm on reveal, → trigger on
          cancel) and the D-79 offline aria-live line are preserved. */}
      {isProActive ? (
        confirming ? (
          <div className="flex w-full items-start gap-3 rounded-[7px] border border-bad/75 bg-bad/10 p-5">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 flex-none text-bad"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <h4 className={HEADING_CLASS}>Deactivate Pro on this device?</h4>
              <p className="text-[12px] leading-[1.5] text-tx-2">
                You&apos;ll drop back to the free tier here. Your seat is freed
                for another device — reactivate anytime with your key.
              </p>
              {/* D-79: offline guidance lands in this calm region (tx-2, NOT
                  text-bad) AND the in-flight "Deactivating…" line. */}
              <p
                aria-live="polite"
                className="min-h-[18px] text-[12px] leading-[1.5] text-tx-2"
              >
                {deactivateMsg ?? ""}
              </p>
            </div>
            <div className="flex flex-none items-center gap-2 self-center">
              <button
                type="button"
                onClick={cancelConfirm}
                disabled={deactivating}
                className={SECONDARY_BTN_CLASS}
              >
                Cancel
              </button>
              <button
                type="button"
                ref={confirmBtnRef}
                onClick={() => void onDeactivate()}
                disabled={deactivating}
                aria-busy={deactivating}
                className={DESTRUCTIVE_BTN_CLASS}
              >
                Deactivate
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-[12px] leading-[1.5] text-tx-3">
              Deactivating frees this seat so you can activate TinkerDev on
              another device.
            </p>
            <div className="flex justify-start">
              <button
                type="button"
                ref={deactivateBtnRef}
                onClick={revealConfirm}
                className={SECONDARY_BTN_CLASS}
              >
                Deactivate this device
              </button>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}
