// UpsellPanel (D-19..D-22 + Phase 19 D-33..D-39/D-44) — the ONE shared upsell
// surface for every locked feature: rendered in place of a locked tool's UI
// (route placement, D-30) and inside UpsellModal for app-level locks (D-28
// affordances + the D-29 footer row). Phase 19 wired the license-key
// activation form into the D-22 slot; Phase 20 swaps in the real checkout link.
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
// all controls Tab-reachable (the input is caught by UpsellModal's focus-trap
// selector), neutral tokens everywhere — accent appears ONLY on the primary
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
import { platform, type LicenseErrorCode } from "@/lib/platform";
import { refreshEntitlements } from "@/lib/entitlements/store";
import { refreshLicenseUi } from "@/lib/license/licenseUi";
import { useLicenseUi } from "@/shell/useLicenseUi";

/** Stub — Phase 20 swaps in the real MoR checkout link. The CTA is a no-op
 *  until then (D-21): ONE constant so the swap is a single edit. */
export const BUY_LICENSE_URL = "https://example.invalid/devtools/buy";

/** Locked error copy (D-36/D-37/D-38; 19-CONTEXT) keyed on the typed codes the
 *  Rust commands reject with — Rust never sends prose. Calm tone throughout;
 *  seatLimit names the resolution path (D-36 — support link deferred to Phase
 *  21); offline vs serviceUnreachable are DISTINCT messages (D-38). */
const ERROR_COPY: Record<LicenseErrorCode, string> = {
  seatLimit:
    "This key is already active on another Mac. Deactivate it on the other Mac first, then activate here.",
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

const CARD_CLASS =
  "flex max-w-[420px] flex-col gap-4 rounded-[7px] border border-bd bg-panel p-6";
const HEADING_CLASS = "text-[16px] font-semibold leading-[1.2] text-tx";
const BODY_CLASS = "flex flex-col gap-2 text-[12px] leading-[1.5] text-tx-2";
const PRIMARY_BTN_CLASS =
  "cursor-pointer rounded-[7px] border border-accent-line bg-accent-soft px-3 py-1 text-[12px] text-accent outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default disabled:border-bd disabled:bg-input-bg disabled:text-tx-2";
const SECONDARY_BTN_CLASS =
  "cursor-pointer rounded-[7px] border border-bd bg-input-bg px-3 py-1 text-[12px] text-tx-2 outline-none transition-colors hover:border-bd-2 hover:text-tx focus-visible:ring-2 focus-visible:ring-accent";

export interface UpsellPanelProps {
  /** Feature icon (lucide-react component), rendered neutral beside the heading. */
  icon: ComponentType<{ className?: string }>;
  /** Optional heading id so a wrapping dialog can point aria-labelledby at it. */
  headingId?: string;
  /** Optional dismiss (the "Done" button after activation, D-35). UpsellModal
   *  passes its onClose; in route placement the live entitlement flip re-renders
   *  the route anyway, so the button is a calm no-op there. */
  onDismiss?: () => void;
}

export function UpsellPanel({
  icon: Icon,
  headingId,
  onDismiss,
}: UpsellPanelProps) {
  const ui = useLicenseUi();
  const problem = ui.state === "problem";
  // Both notActivated and problem carry hasStoredKey (the ONLY Keychain-derived
  // value JS ever sees — T-19-10/LIC-04).
  const hasStoredKey = ui.state !== "licensed" && ui.hasStoredKey;

  const [formRevealed, setFormRevealed] = useState(false);
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

  // D-44: the problem state pre-reveals the form with the key field focused.
  // queueMicrotask defers past UpsellModal's mount effect (the parent focuses
  // the dialog AFTER child effects run — a plain .focus() here would be stolen).
  useEffect(() => {
    if (problem && !activated) {
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [problem, activated]);

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
      // D-35: refresh BOTH snapshots so the unlock is live behind the panel —
      // no restart. refreshEntitlements is the proven D-32 live-flip path.
      await refreshLicenseUi();
      await refreshEntitlements();
      setValue(""); // T-19-21: drop the key from component state on success
      setActivated(true);
    } catch (err) {
      // D-37: every error renders inline below the field; the field keeps its
      // value for correction (we never clear it on failure).
      setError(toErrorCode(err));
    } finally {
      setPending(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault(); // Enter in the input submits; Esc stays UpsellModal's
    void submit();
  };

  // ONE aria-live region carries the in-flight status AND the inline error
  // (D-34/D-37) — a single calm line under the field, no spinner chrome.
  const statusLine = pending ? "Activating…" : error ? ERROR_COPY[error] : "";
  const keyForm = (
    <form className="flex flex-col gap-2" onSubmit={onSubmit}>
      <label htmlFor={inputId} className="text-[12px] text-tx-2">
        License key
      </label>
      <input
        id={inputId}
        ref={inputRef}
        type="text"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={pending}
        placeholder={
          hasStoredKey
            ? "Your saved key will be used — paste a new key to replace it"
            : undefined
        }
        className="w-full rounded-[7px] border border-bd bg-input-bg px-2.5 py-1.5 font-mono text-[12px] text-tx outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent"
      />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={PRIMARY_BTN_CLASS}>
          Activate
        </button>
      </div>
      <p
        aria-live="polite"
        className={`min-h-[18px] text-[12px] leading-[1.5] ${error ? "text-bad" : "text-tx-2"}`}
      >
        {statusLine}
      </p>
    </form>
  );

  // D-35: the dismissible licensed state — entitlements already refreshed, so
  // everything behind the panel is unlocked live.
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
          <p>This Mac is activated. Your Pro features are unlocked.</p>
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

  // D-44: the distinct license-problem state — heading + one calm body line +
  // the form pre-revealed. NEVER the sales pitch (a paying customer must not
  // see the upsell copy because their file went bad).
  if (problem) {
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

  return (
    <div className={CARD_CLASS}>
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 flex-none text-tx-2" aria-hidden="true" />
        <h2 id={headingId} className={HEADING_CLASS}>
          Thank you for using TinkerDev ❤️
        </h2>
      </div>
      <div className={BODY_CLASS}>
        <p>
          Most of TinkerDev is free — built to make your everyday dev tasks
          faster.
        </p>
        <p>
          If TinkerDev has earned a spot in your toolkit, consider supporting
          it with a lifetime license. You&apos;ll unlock extras like custom
          themes and tool reordering, and fund ongoing maintenance and new
          features.
        </p>
      </div>
      {formRevealed ? (
        // D-33: the form is revealed IN PLACE of the button row — same panel,
        // no new modal/route.
        keyForm
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              // D-21 stub: the CTA reads the single URL constant but stays a
              // no-op this phase — Phase 20 wires the real checkout open.
              void BUY_LICENSE_URL;
            }}
            className="cursor-pointer rounded-[7px] border border-accent-line bg-accent-soft px-3 py-1 text-[12px] text-accent outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent"
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
    </div>
  );
}

const MODAL_HEADING_ID = "upsell-heading";

export interface UpsellModalProps {
  icon: ComponentType<{ className?: string }>;
  onClose: () => void;
}

/** Modal wrapper for app-level locks (D-28/D-29 surfaces). Reuses the ⌘K
 *  palette's scrim/dismiss pattern: Esc + scrim-click dismiss, focus moves into
 *  the dialog on mount and returns to the invoking control on unmount. */
export function UpsellModal({ icon, onClose }: UpsellModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Keep the latest onClose visible to the mount-once effect without re-running
  // it (re-running would re-steal and re-return focus on every prop change).
  // Synced in an effect, not during render (react-hooks/refs).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const invoker = document.activeElement;
    dialogRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      // Focus trap: aria-modal promises the background is inert, so Tab must
      // cycle within the dialog (WCAG-AA) — wrap at both ends, and pull focus
      // back in if it ever lands outside.
      if (e.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusables = dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey) {
          if (active === first || !dialog.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else if (active === last || !dialog.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // Return focus to the invoking control (UI-SPEC interaction contract).
      if (invoker instanceof HTMLElement && invoker.isConnected) {
        invoker.focus();
      }
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={MODAL_HEADING_ID}
        tabIndex={-1}
        className="outline-none"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <UpsellPanel
          icon={icon}
          headingId={MODAL_HEADING_ID}
          onDismiss={onClose}
        />
      </div>
    </div>
  );
}
