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
//   Reactivate — opens the shared Unlock Pro upsell modal (the activation surface
//                owns the form, D-88). The old navigate("/") landed the user on a
//                TOOL (since "/" redirects to the hero) with no activation surface —
//                it read as "does nothing / bounces to a tool" (21-04 walkthrough
//                fix, same root cause as the ⌘K free-tier fix). openUpsell() opens
//                the SAME modal the footer + ⌘K open (shell/upsellStore — no
//                duplicate UI). UpsellPanel adapts on hasStoredKey: an empty submit
//                reuses the Keychain key, a pasted key replaces it — so the upsell
//                is the unified entry for BOTH Reactivate and Activate.
//
// The masked key + licensee email come from verified cert data (D-89); the RAW
// key NEVER round-trips through JS (LIC-04) — there is no raw-key field on the
// payload. A CopyButton (no hover-only copy) is offered for each.
//
// Class constants are copied VERBATIM from UpsellPanel (21-UI-SPEC reuse mandate)
// — do NOT introduce new sizes/tokens.

import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { platform, type LicenseErrorCode } from "@/lib/platform";
import { refreshEntitlements } from "@/lib/entitlements/store";
import { refreshLicenseUi } from "@/lib/license/licenseUi";
import { openUpsell } from "@/shell/upsellStore";
import { useLicenseUi } from "@/shell/useLicenseUi";
import { usePreferences } from "@/shell/usePreferences";
import { CopyButton } from "./CopyButton";

// Copied verbatim from UpsellPanel (do not drift — 21-UI-SPEC reuse mandate).
const CARD_CLASS =
  "flex max-w-[420px] flex-col gap-4 rounded-[7px] border border-bd bg-panel p-6";
const HEADING_CLASS = "text-[16px] font-semibold leading-[1.2] text-tx";
const BODY_CLASS = "flex flex-col gap-2 text-[12px] leading-[1.5] text-tx-2";
const PRIMARY_BTN_CLASS =
  "cursor-pointer rounded-[7px] border border-accent-line bg-accent-soft px-3 py-1 text-[12px] text-accent outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default disabled:border-bd disabled:bg-input-bg disabled:text-tx-2";
const SECONDARY_BTN_CLASS =
  "cursor-pointer rounded-[7px] border border-bd bg-input-bg px-3 py-1 text-[12px] text-tx-2 outline-none transition-colors hover:border-bd-2 hover:text-tx focus-visible:ring-2 focus-visible:ring-accent";

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

/** Human "Renews around {date}" from an RFC3339 expiry (D-89). null/unparseable
 *  -> null (the row is then omitted). */
function renewsLine(expiry: string | null): string | null {
  if (!expiry) return null;
  const d = new Date(expiry);
  if (Number.isNaN(d.getTime())) return null;
  return `Renews around ${d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  })}`;
}

export function LicenseSettings() {
  const ui = useLicenseUi();
  const { preferences, prefsLoaded, ackLicenseDropNotice } = usePreferences();

  // D-76 status-open trigger: re-query the local status on mount so the route
  // always shows fresh state (pure-local file read + verify — never network).
  useEffect(() => {
    void refreshLicenseUi().catch((err) => {
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
      await refreshLicenseUi().catch(() => {});
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
  const renews = isProActive ? renewsLine(ui.expiry) : null;
  // refreshNeeded lands here too: it is the ONE calm "no longer active" state,
  // shared with a suspended/revoked drop (D-83).
  const canReactivate = ui.state === "refreshNeeded" || ui.state === "problem";

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
      case "notActivated":
      default:
        return "Free";
    }
  })();

  const statusBody = ((): string => {
    switch (ui.state) {
      case "licensed":
        return "Pro is active on this device.";
      case "offlineGrace":
        return "Pro is active. We'll refresh your license automatically the next time you're online.";
      case "refreshNeeded":
        return "Connect to the internet and refresh to restore Pro. Your themes and tool order are saved and will come right back.";
      case "problem":
        return "Your license file couldn't be verified. Your tools keep working — activate again to restore your license.";
      case "notActivated":
      default:
        return "Most of TinkerDev is free. Activate a license to unlock custom themes and tool reordering.";
    }
  })();

  return (
    <div className="flex flex-col gap-12 overflow-auto p-8">
      <h1 className="sr-only">License</h1>

      {/* D-84 one-time drop notice — calm, dismissable, inline (never a toast). */}
      {showDropNotice ? (
        <div className={CARD_CLASS}>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 flex-none text-tx-2" aria-hidden="true" />
            <h2 className={HEADING_CLASS}>Your Pro features turned off</h2>
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
      ) : null}

      {/* Status block. */}
      <div className={CARD_CLASS}>
        {/* 21-04 FLAG P6: the status-label transition (e.g. a silent refresh-drop
            "Licensed" → "Pro is no longer active", D-82) must be ANNOUNCED, or a
            screen-reader user hears "Refreshing…" then silence. Wrap the heading
            row in an aria-live="polite" region so the new resting state is read
            out calmly — polite, NEVER role=alert/assertive (D-77/D-83 calm tone). */}
        <div className="flex items-center gap-2" aria-live="polite">
          {/* OK dot (text-ok) ONLY for Pro-active states — the only semantic
              accent-adjacent glyph (D-24); never accent. Other states stay
              neutral, no alarm color (D-77/D-83). */}
          {isProActive ? (
            <span
              aria-hidden="true"
              className="h-2 w-2 flex-none rounded-full bg-ok"
            />
          ) : (
            <Lock aria-hidden="true" className="h-4 w-4 flex-none text-tx-2" />
          )}
          <h2 className={HEADING_CLASS}>{statusLabel}</h2>
        </div>
        <div className={BODY_CLASS}>
          <p>{statusBody}</p>
          {ui.state === "licensed" || ui.state === "offlineGrace" ? (
            <p className="text-[12px] leading-[1.5] text-tx-3">
              Your license refreshes automatically.
            </p>
          ) : null}
        </div>

        {/* Fields — only when Pro data is present (D-89: em-dash, never empty). */}
        {isProActive ? (
          <dl className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <dt className={LABEL_CLASS}>Licensee</dt>
                <dd className={VALUE_CLASS}>{email ?? "—"}</dd>
              </div>
              {email ? <CopyButton value={email} label="licensee email" /> : null}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <dt className={LABEL_CLASS}>License key</dt>
                <dd className={VALUE_CLASS}>{maskedKey ?? "—"}</dd>
              </div>
              {maskedKey ? (
                <CopyButton value={maskedKey} label="masked license key" />
              ) : null}
            </div>
            {renews ? (
              <div className="flex flex-col gap-0.5">
                <dt className={LABEL_CLASS}>Renews</dt>
                <dd className="font-mono text-[12px] text-tx-3">{renews}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </div>

      {/* Management block — 48px (gap-12) below the status block. */}
      <div className="flex max-w-[420px] flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {/* Refresh — present whenever there is a license to manage (every state
              except the pure free notActivated, where there is nothing to refresh). */}
          {ui.state !== "notActivated" ? (
            <button
              type="button"
              onClick={() => void onRefresh()}
              disabled={refreshing}
              // 21-04 FLAG P3b: convey the busy state on the control itself, in
              // parity with the separate aria-live "Refreshing…" line — the
              // disabled recolor is otherwise a color-only affordance.
              aria-busy={refreshing}
              className={PRIMARY_BTN_CLASS}
            >
              Refresh
            </button>
          ) : null}

          {/* Reactivate (refreshNeeded / problem) — same action regardless of
              cause (D-83); opens the shared Unlock Pro upsell modal, which owns
              the activation form (D-88). NOT navigate("/") — that bounced to the
              hero TOOL with no activation surface (21-04 walkthrough fix). */}
          {canReactivate ? (
            <button
              type="button"
              onClick={() => openUpsell()}
              className={PRIMARY_BTN_CLASS}
            >
              Reactivate
            </button>
          ) : null}

          {/* Activate (free) — opens the SAME shared Unlock Pro upsell modal the
              footer + ⌘K open (D-88); the panel adapts on hasStoredKey. */}
          {ui.state === "notActivated" ? (
            <button
              type="button"
              onClick={() => openUpsell()}
              className={PRIMARY_BTN_CLASS}
            >
              Activate a license
            </button>
          ) : null}
        </div>

        {/* Refresh in-flight / calm error line — ONE aria-live region. */}
        <p
          aria-live="polite"
          className="min-h-[18px] text-[12px] leading-[1.5] text-tx-2"
        >
          {refreshing ? "Refreshing…" : (refreshError ?? "")}
        </p>

        {/* Deactivate (confirm-first inline, D-78) — only when Pro is active. */}
        {isProActive ? (
          confirming ? (
            <div className="flex flex-col gap-2">
              <p className={BODY_CLASS}>
                This frees your seat so you can activate another device. Pro turns
                off here until you reactivate.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  ref={confirmBtnRef}
                  onClick={() => void onDeactivate()}
                  disabled={deactivating}
                  className={SECONDARY_BTN_CLASS}
                >
                  Deactivate
                </button>
                <button
                  type="button"
                  onClick={cancelConfirm}
                  disabled={deactivating}
                  className={SECONDARY_BTN_CLASS}
                >
                  Keep Pro here
                </button>
              </div>
              {/* D-79: offline guidance lands in this calm region (tx-2, NOT
                  text-bad) AND the in-flight "Deactivating…" line. */}
              <p
                aria-live="polite"
                className="min-h-[18px] text-[12px] leading-[1.5] text-tx-2"
              >
                {deactivateMsg ?? ""}
              </p>
            </div>
          ) : (
            <div>
              <button
                type="button"
                ref={deactivateBtnRef}
                onClick={revealConfirm}
                className={SECONDARY_BTN_CLASS}
              >
                Deactivate this device
              </button>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
