// UpsellPanel (D-19..D-22 + Phase 19 D-33..D-39/D-44) — the ONE shared upsell
// surface for every locked feature. Phase 19 wired the license-key activation
// form into the D-22 slot; Phase 20 swaps in the real checkout link.
//
// Phase 22.1 (D-22.1-4): the activation surface (state + submit chain + key
// form + success/problem views + the panel-mount refreshLicenseUi effect + the
// D-44 focus effect) lives ONCE in the internal `ActivationSurface` component.
// BOTH the standalone `UpsellPanel` (still rendered in place of a locked tool's
// UI — route placement, D-30, dormant per D-18) AND the inline License pane
// (`InlineActivation`) consume it. No activation logic is duplicated; LIC-04 +
// T-19-21 are preserved byte-for-byte.
//
// Phase 22.1-04 (user-approved 2026-06-16, reverses D-22.1-5/D-28/D-29): the
// standalone "Unlock Pro" UpsellModal was REMOVED. Every former opener (sidebar
// footer + locked-customization affordances + the ⌘K free "License" command)
// now routes to Settings ▸ License, whose pane renders `InlineActivation` — the
// SAME shared surface. There is exactly one upsell surface in the app.
//
// Views (D-33: everything inline in this one panel — no new modal/route):
//   sales      — the Phase-18 copy, byte-for-byte (D-19 override: fully static)
//   form       — revealed in place by the D-22 button (key input + Activate)
//   activating — submit disabled + calm aria-live status line (D-34)
//   licensed   — dismissible "Licensed — thank you" (D-35; entitlements refresh
//                live behind the panel, no restart)
//   problem    — D-44: a corrupt/tampered/foreign machine.lic shows a distinct
//                license-problem state (form pre-revealed, field focused) — a
//                paying customer NEVER sees the sales pitch
//
// D-44/LIC-04 reconciliation (decided at planning): "pre-filled from Keychain"
// is implemented as Rust-side stored-key reactivation — JS sees only
// `hasStoredKey: boolean`. When true, the field shows a saved-key placeholder
// and an EMPTY submit calls platform.license.activate(null); pasting a key
// overrides. The raw key NEVER reaches JS (LIC-04 is architecturally prior).
//
// T-19-21: the pasted key lives ONLY in transient component state for the one
// activate call — never persisted, never logged, cleared on success.
//
// WCAG-AA (per 18-UI-SPEC): real heading element, visible focus-visible rings,
// all controls Tab-reachable (the input is caught by the wrapping SettingsModal's
// focus-trap selector when inline), neutral tokens everywhere — accent appears ONLY on the primary
// CTA's accent-soft fill + focus rings. Errors render in the calm text-bad
// token (the app's established role=alert tint), inside the SAME
// aria-live="polite" region as the in-flight status (D-34/D-37).

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type FormEvent,
} from "react";
import { Check, Heart, Key, ListOrdered, Lock, Palette } from "lucide-react";
import { platform, type LicenseErrorCode } from "@/lib/platform";
import {
  clearEntitlementsOverride,
  refreshEntitlements,
} from "@/lib/entitlements/store";
import { refreshLicenseUi } from "@/lib/license/licenseUi";
import { useLicenseUi } from "@/shell/useLicenseUi";

/** D-68: the own-domain redirect the user controls (Cloudflare/Caddy) forwards
 *  to the live MoR checkout. ONE https constant so a store/MoR change never
 *  requires an app release; the Buy CTA opens it via the platform opener seam. */
export const BUY_LICENSE_URL = "https://tinkerdev.io/buy";

/** Locked error copy (D-36/D-37/D-38; 19-CONTEXT) keyed on the typed codes the
 *  Rust commands reject with — Rust never sends prose. Calm tone throughout;
 *  seatLimit names the resolution path (D-36 — support link deferred to Phase
 *  21); offline vs serviceUnreachable are DISTINCT messages (D-38).
 *  Walkthrough 2026-06-12 (user decision, overrides the D-36/D-44 drafts):
 *  "device", never "Mac" — the copy must survive the cross-platform future. */
const ERROR_COPY: Record<LicenseErrorCode, string> = {
  seatLimit:
    "This key is already active on another device. Deactivate it on the other device first, then activate here.",
  offline: "You're offline — connect and try again.",
  serviceUnreachable:
    "Can't reach the licensing service — try again shortly.",
  invalidKey: "That key wasn't recognized — check it and try again.",
  suspended: "This license isn't active anymore.",
  noStoredKey: "Activation didn't complete — try again.",
  activationFailed: "Activation didn't complete — try again.",
  licenseProblem: "Activation didn't complete — try again.",
};

/** Map a command rejection to its copy key — unknown shapes fail calm to the
 *  activationFailed fallback line (never a raw error string in the UI). */
function toErrorCode(err: unknown): LicenseErrorCode {
  const code = (err as { code?: string } | null)?.code;
  return code && code in ERROR_COPY
    ? (code as LicenseErrorCode)
    : "activationFailed";
}

// Layout-agnostic (Phase 22.1): the surface FILLS its container — `w-full`, NO
// fixed max-width — so it has no dead space in the wide License pane AND looks
// right inside any narrower container (D-22.1). The card chrome is shared by the
// pitch + the success/problem
// states.
const CARD_CLASS =
  "flex w-full flex-col gap-4 rounded-[7px] border border-bd bg-panel p-6";
const HEADING_CLASS = "text-[16px] font-semibold leading-[1.2] text-tx";
const BODY_CLASS = "flex flex-col gap-2 text-[12px] leading-[1.5] text-tx-2";
const PRIMARY_BTN_CLASS =
  "cursor-pointer rounded-[7px] border border-accent-line bg-accent-soft px-3 py-1 text-[12px] text-accent outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default disabled:border-bd disabled:bg-input-bg disabled:text-tx-2";
const SECONDARY_BTN_CLASS =
  "cursor-pointer rounded-[7px] border border-bd bg-input-bg px-3 py-1 text-[12px] text-tx-2 outline-none transition-colors hover:border-bd-2 hover:text-tx focus-visible:ring-2 focus-visible:ring-accent";
// Phase 22.1 walkthrough (2026-06-16): the pitch is the hero — a soft accent
// glow from the top fading into the panel, a borderless accent medallion above a
// LARGER title, and greyer (tx-3) secondary copy. The glow is a CSS background
// layered over --color-panel (inline so the token stays the source of truth).
const PITCH_CARD_CLASS =
  "relative flex w-full flex-col gap-5 overflow-hidden rounded-[7px] border border-bd p-6";
const PITCH_GLOW_STYLE = {
  background:
    "radial-gradient(125% 85% at 50% 0%, color-mix(in srgb, var(--color-accent) 13%, transparent) 0%, transparent 58%), var(--color-panel)",
};
// Borderless accent medallion (no blue outline — walkthrough): accent-soft fill
// only, the AA-bright accent glyph reads on it. Bigger for the hero pitch.
const MEDALLION_CLASS =
  "flex h-11 w-11 flex-none items-center justify-center rounded-[10px] bg-accent-soft";
const PITCH_TITLE_CLASS = "text-[24px] font-semibold leading-[1.2] text-tx";
// Pitch secondary copy sits on the panel (not the amber card) so tx-3 #868b95 is
// AA-safe here (~5:1); greyer than the tx-2 used on the amber attention card.
const PITCH_BODY_CLASS = "text-[13px] leading-[1.5] text-tx-3";

/** The masked key shape shown as the input placeholder when no key is saved —
 *  a hint of the format, NEVER a label (the <label> stays the a11y name). */
const KEY_PLACEHOLDER = "XXXX-XXXX-XXXX-XXXX";

/** Phase 22.1 pitch feature list (walkthrough 2026-06-15) — the three Pro
 *  unlocks, each a fitting lucide icon + bold label + one-line muted sub. */
const PITCH_FEATURES: ReadonlyArray<{
  icon: ComponentType<{ className?: string }>;
  label: string;
  sub: string;
}> = [
  {
    icon: Palette,
    label: "Custom themes",
    sub: "Recolor the whole app to taste.",
  },
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

/**
 * The ONE activation surface (D-22.1-4). Owns the activation state, the verbatim
 * submit chain, the key-input form, the success ("Licensed — thank you") state,
 * the panel-mount refreshLicenseUi re-query, and the D-44 problem-state focus —
 * with NO logic duplicated anywhere else in the app.
 *
 * `variant` controls ONLY the surrounding chrome (which heading/body/CTA wraps
 * the form); the form + submit are identical across all variants:
 *   - "panel"     — the standalone UpsellPanel behavior (route placement in
 *                   place of a locked tool's UI, D-30, dormant per D-18): sales
 *                   pitch + Buy CTA + "I have a license key" reveal for
 *                   free/notActivated, the distinct D-44 problem card for problem,
 *                   success on activate. (Output is byte-for-byte the pre-22.1
 *                   UpsellPanel.)
 *   - "upsell"    — the FULL pitch inline (License pane free/notActivated, D-22.1-6):
 *                   same pitch + Buy + reveal-form as "panel" sales, but NO problem
 *                   card branch (the License pane renders its own status above).
 *   - "form-only" — ONLY the key-input + Activate form, NO pitch (License pane
 *                   problem/refreshNeeded, D-22.1-7); the field is pre-revealed +
 *                   focused for parity with today's D-44 behavior.
 */
type ActivationVariant = "panel" | "upsell" | "form-only";

interface ActivationSurfaceProps {
  variant: ActivationVariant;
  icon: ComponentType<{ className?: string }>;
  /** Optional heading id so a wrapping dialog can point aria-labelledby at it. */
  headingId?: string;
  /** Optional dismiss (the "Done" button after activation, D-35). */
  onDismiss?: () => void;
}

function ActivationSurface({
  variant,
  icon: Icon,
  headingId,
  onDismiss,
}: ActivationSurfaceProps) {
  const ui = useLicenseUi();
  const problem = ui.state === "problem";
  // notActivated, problem, and refreshNeeded carry hasStoredKey (the ONLY
  // Keychain-derived value JS ever sees — T-19-10/LIC-04). licensed and
  // offlineGrace carry expiry+entitlements instead (Pro is active), so they
  // never expose the stored-key flag.
  const hasStoredKey =
    (ui.state === "notActivated" ||
      ui.state === "problem" ||
      ui.state === "refreshNeeded") &&
    ui.hasStoredKey;

  // "form-only" pre-reveals the field (D-22.1-7) — the License pane's
  // problem/refreshNeeded states render their own status card and want the form
  // immediately, consistent with today's D-44 problem behavior.
  const [formRevealed, setFormRevealed] = useState(variant === "form-only");
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<LicenseErrorCode | null>(null);
  const [activated, setActivated] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  // Panel-mount re-query (still PURE-LOCAL, D-45) so opening the panel always
  // shows fresh status — this is what makes the D-44 problem state appear
  // without a relaunch after a machine.lic goes bad mid-session.
  useEffect(() => {
    void refreshLicenseUi().catch((err) => {
      console.error("[license] status refresh failed:", err);
    });
  }, []);

  // D-44 (panel) + D-22.1-7 (form-only): pre-reveal the form with the key field
  // focused. queueMicrotask defers past a wrapping modal's mount effect (the
  // parent focuses the dialog AFTER child effects run — a plain .focus() here
  // would be stolen). For "form-only" the field is always revealed, so focus it
  // on mount.
  const focusOnMount =
    !activated && (variant === "form-only" || (variant === "panel" && problem));
  useEffect(() => {
    if (focusOnMount) {
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [focusOnMount]);

  const submit = async () => {
    if (pending) return;
    // D-39: trim-only client validation — whitespace around a pasted key is
    // stripped, anything non-empty goes to the server (Keygen is the
    // validator). Empty is a no-op unless a stored key can be reused (D-44).
    const trimmed = value.trim();
    if (!trimmed && !hasStoredKey) return;
    setPending(true);
    setError(null);
    try {
      // Empty + stored key => activate(null): Rust reuses the Keychain key
      // (stored-key reactivation — the raw key never round-trips through JS).
      await platform.license.activate(trimmed || null);
      // Walkthrough 2026-06-12 (user decision): a SUCCESSFUL activation clears
      // the persisted D-31 dev free-tier override BEFORE the entitlement
      // refresh, so the Pro unlock is visible immediately behind the panel.
      // The override stays downgrade-only everywhere else.
      await clearEntitlementsOverride();
      // D-35: refresh BOTH snapshots so the unlock is live behind the panel —
      // no restart. refreshEntitlements is the proven D-32 live-flip path.
      await refreshLicenseUi();
      await refreshEntitlements();
      setValue(""); // T-19-21: drop the key from component state on success
      setActivated(true);
    } catch (err) {
      // D-37: every error renders inline below the field; the field keeps its
      // value for correction (we never clear it on failure) — and focus is
      // restored to it so keyboard/SR users land exactly where the fix goes.
      setError(toErrorCode(err));
      inputRef.current?.focus();
    } finally {
      setPending(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault(); // Enter in the input submits; Esc stays the wrapping modal's
    void submit();
  };

  // ONE aria-live region carries the in-flight status AND the inline error
  // (D-34/D-37) — a single calm line under the field, no spinner chrome.
  const statusLine = pending ? "Activating…" : error ? ERROR_COPY[error] : "";
  // Saved-key affordance (19-UI-REVIEW fix 3): a PERSISTENT helper line — a
  // placeholder alone is not a label (WCAG 3.3.2) and vanishes on typing. The
  // line shows whenever the empty-submit-uses-saved-key behavior applies.
  const storedKeyHintId = `${inputId}-stored-key-hint`;
  const showStoredKeyHint = hasStoredKey && !value;
  const keyForm = (
    <form className="flex flex-col gap-2" onSubmit={onSubmit}>
      <label htmlFor={inputId} className="text-[12px] text-tx-2">
        License key
      </label>
      {/* Phase 22.1: a Key-icon prefix sits inside the field; the input keeps
          left padding clear of it. The icon is decorative (aria-hidden) — the
          <label> above is the accessible name (WCAG 3.3.2). */}
      <div className="relative">
        <Key
          aria-hidden="true"
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-tx-3"
        />
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          // readOnly, NOT disabled (19-UI-REVIEW fix 2): disabling the focused
          // element drops keyboard focus to <body> mid-activation; readOnly
          // freezes edits while keeping focus (the submit button is disabled,
          // and submit() re-entry is guarded on `pending`).
          readOnly={pending}
          // Phase 22.1: the masked key shape when empty; the saved-key affordance
          // (D-44) still wins when a key is stored (an empty submit reuses it).
          placeholder={
            hasStoredKey ? "Your saved key will be used" : KEY_PLACEHOLDER
          }
          aria-describedby={showStoredKeyHint ? storedKeyHintId : undefined}
          // placeholder:text-tx-3 — #868b95 on bg-input-bg #0d0f13 ≈ 5.6:1 (AA);
          // the WebKit default placeholder gray was unverified (19-UI-REVIEW).
          // pl-8 clears the Key-icon prefix.
          className="w-full rounded-[7px] border border-bd bg-input-bg py-1.5 pl-8 pr-2.5 font-mono text-[12px] text-tx outline-none transition-colors placeholder:text-tx-3 focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>
      {showStoredKeyHint ? (
        <p
          id={storedKeyHintId}
          className="text-[12px] leading-[1.5] text-tx-2"
        >
          Leave the field empty to use your saved key, or paste a new one to
          replace it.
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className={`inline-flex items-center gap-1.5 ${PRIMARY_BTN_CLASS}`}
        >
          <Check className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
          Activate
        </button>
      </div>
      {/* Walkthrough 2026-06-16: pre-empt the macOS Keychain prompt that fires
          when activation writes the key, so it isn't a surprise. Static muted
          guidance (not the aria-live status line below). */}
      <p className="flex items-start gap-1.5 text-[12px] leading-[1.5] text-tx-3">
        <Lock aria-hidden="true" className="mt-0.5 h-3 w-3 flex-none" />
        <span>
          Your key is stored securely in your macOS Keychain — you may see a
          system prompt to allow access.
        </span>
      </p>
      <p
        aria-live="polite"
        className={`min-h-[18px] text-[12px] leading-[1.5] ${error ? "text-bad" : "text-tx-2"}`}
      >
        {statusLine}
      </p>
    </form>
  );

  // D-35: the dismissible licensed state — entitlements already refreshed, so
  // everything behind the panel is unlocked live. Shared by every variant.
  if (activated) {
    return (
      <div className={CARD_CLASS}>
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 flex-none text-tx-2" aria-hidden="true" />
          <h2 id={headingId} className={HEADING_CLASS}>
            Licensed — thank you
          </h2>
        </div>
        <div className={BODY_CLASS}>
          <p>This device is activated. Your Pro features are unlocked.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onDismiss?.()}
            className={SECONDARY_BTN_CLASS}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // "form-only" (D-22.1-7): just the key-input + Activate form, no card chrome
  // and NO pitch — the License pane renders its own calm status card above this.
  if (variant === "form-only") {
    return keyForm;
  }

  // D-44 (panel only): the distinct license-problem state — heading + one calm
  // body line + the form pre-revealed. NEVER the sales pitch (a paying customer
  // must not see the upsell copy because their file went bad). The "upsell"
  // variant skips this branch: the License pane never routes problem/refreshNeeded
  // through InlineActivation("upsell") — those render "form-only" beneath a status
  // card (D-22.1-7), so a paying customer still never sees the pitch.
  if (variant === "panel" && problem) {
    return (
      <div className={CARD_CLASS}>
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 flex-none text-tx-2" aria-hidden="true" />
          <h2 id={headingId} className={HEADING_CLASS}>
            Your license file couldn&apos;t be verified
          </h2>
        </div>
        <div className={BODY_CLASS}>
          <p>
            Your tools keep working — activate again below to restore your
            license.
          </p>
        </div>
        {keyForm}
      </div>
    );
  }

  // The sales pitch (free/notActivated) — shared by the standalone panel and the
  // inline "upsell" variant byte-for-byte (D-22.1-6). Redesigned Phase 22.1
  // (walkthrough 2026-06-15): lock badge, feature list, $9 price block, claims
  // footer. The "Thank you for using TinkerDev ❤️" heading text is LOCKED (e2e
  // asserts the pitch heading) and the Buy/key-reveal behavior is unchanged.
  return (
    <div className={PITCH_CARD_CLASS} style={PITCH_GLOW_STYLE}>
      {/* Medallion ABOVE a larger title (walkthrough 2026-06-16) — borderless
          accent-soft tile, then the hero heading on its own line. */}
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
        A lifetime license unlocks the extras and funds what&apos;s next.
      </p>

      {/* Feature list — 3 rows, each a borderless accent-soft icon square + a
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

      {/* Price block — large $9 + a greyer "once · lifetime license" sub.
          (Phase 22.1 reverses the old D-20 "no pricing in-app", per the
          2026-06-15 walkthrough; price = $9.) */}
      <div className="flex items-baseline gap-2">
        <span className="text-[28px] font-semibold leading-none text-tx">
          $9
        </span>
        <span className="text-[12px] leading-[1.5] text-tx-3">
          once · lifetime license
        </span>
      </div>

      {formRevealed ? (
        // D-33: the form is revealed IN PLACE of the button row — same panel,
        // no new modal/route.
        keyForm
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              // PAY-01/D-67: open the checkout in the OS default browser via the
              // platform opener seam (https-only, capability-scoped). Best-effort:
              // a failed open is calm — log, never throw at the user. Outside
              // Tauri the seam is a no-op (never navigates jsdom/vite-preview).
              const open = platform.opener.openUrl(BUY_LICENSE_URL);
              void open.catch((err) =>
                console.error("[buy] open failed:", err),
              );
            }}
            className={PRIMARY_BTN_CLASS}
          >
            Buy license
          </button>
          <button
            type="button"
            onClick={() => {
              // D-22 -> D-33: reveal the inline key form; focus lands on the
              // field (after this click re-render commits).
              setFormRevealed(true);
              queueMicrotask(() => inputRef.current?.focus());
            }}
            className={SECONDARY_BTN_CLASS}
          >
            I have a license key
          </button>
        </div>
      )}

      {/* Claims footer — all true (one-time / free updates / 14-day refund).
          Muted; mono reads fine here for the · separators. */}
      <p className="font-mono text-[11px] leading-[1.5] text-tx-3">
        One-time payment · Free updates forever · 14-day refund
      </p>
    </div>
  );
}

export interface UpsellPanelProps {
  /** Feature icon (lucide-react component), rendered neutral beside the heading. */
  icon: ComponentType<{ className?: string }>;
  /** Optional heading id so a wrapping dialog can point aria-labelledby at it. */
  headingId?: string;
  /** Optional dismiss (the "Done" button after activation, D-35). In route
   *  placement (ToolRoute) the live entitlement flip re-renders the route anyway,
   *  so the button is a calm no-op there. */
  onDismiss?: () => void;
}

/** The standalone upsell panel (the modal/route surface) — unchanged behavior.
 *  Thin wrapper over the shared ActivationSurface "panel" variant (D-22.1-4/5). */
export function UpsellPanel({ icon, headingId, onDismiss }: UpsellPanelProps) {
  return (
    <ActivationSurface
      variant="panel"
      icon={icon}
      headingId={headingId}
      onDismiss={onDismiss}
    />
  );
}

export interface InlineActivationProps {
  /** "upsell" = full pitch inline (free/notActivated, D-22.1-6); "form-only" =
   *  just the key-input + Activate form (problem/refreshNeeded, D-22.1-7). */
  variant: "upsell" | "form-only";
  icon: ComponentType<{ className?: string }>;
  /** Optional dismiss for the post-activation "Done" button (D-35). */
  onDismiss?: () => void;
}

/** Inline activation surface for the Settings ▸ License pane (D-22.1-6/7) — the
 *  SAME shared ActivationSurface the modal uses, rendered without a dialog
 *  wrapper (the SettingsModal owns the focus trap, so none is needed here —
 *  D-22.1-9). No activation logic is duplicated. */
export function InlineActivation({
  variant,
  icon,
  onDismiss,
}: InlineActivationProps) {
  return (
    <ActivationSurface variant={variant} icon={icon} onDismiss={onDismiss} />
  );
}
