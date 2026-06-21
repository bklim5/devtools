// UpdatesSettings (SET-10, D-25-1/4/5/7/8/9) — the Settings ▸ Updates pane. UNGATED:
// every user (free + Pro) sees it (D-25-1 — updates are core infrastructure, not a
// Pro feature), so this pane runs NO entitlement check (no prefs gating, no
// entitlements hook) the way Appearance does. It shows four things, each over an
// existing seam (zero new state):
//   1. The current app version via platform.app.getVersion() (Plan 01 seam, read once
//      on mount; never the native plugin directly — FND-04). Tolerates the pre-resolve
//      null (renders a dash) so there is no flicker.
//   2. "Last checked" — preferences.lastUpdateCheck (Plan 02). null = literal "Never"
//      (D-25-7); otherwise relativeTime() primary (reused from timeFormat.ts — NOT a
//      new formatter) with the absolute timestamp on hover (title=formatTimestamp().local).
//   3. A "Check for updates" button → useUpdater().runCheck(true) (Plan 03 shared
//      flow). While checking, the button is DISABLED and a NON-opacity "Checking for
//      updates…" line shows; the result (up-to-date / "vX available" / failed) surfaces
//      inline in a polite aria-live region (WCAG-AA — never an opacity-only signal).
//   4. An "Automatically check for updates on launch" toggle (SettingToggle) bound to
//      autoUpdateCheck/setAutoUpdateCheck (D-25-8; tri-state null renders OFF).
//
// Install IS offered here (D-25-5, revised at the Phase-25 human checkpoint): when an
// update is detected the pane shows an Install button as a SECOND entry point to the
// SAME shared install() action (mirrors how Check is a second entry point to the same
// check). Because useUpdater (D-25-3) is the one source of install state, the pane
// button and the bottom-right UpdateBanner share `installing`/`progress` — they can't
// diverge. The banner stays as the ambient affordance when Settings is closed.
//
// The wrapper/header clone GeneralSettings verbatim (reuse over reinvention; h3 one
// level under the dialog h2 preserves the Phase-22.1 heading order). Every token
// resolves in both themes (Phase-23 light/dark).

import { useEffect, useState } from "react";
import { platform } from "@/lib/platform";
import { usePreferences } from "@/shell/usePreferences";
import { useUpdater } from "@/shell/useUpdater";
import { relativeTime, formatTimestamp } from "@/lib/timeFormat";
import { SettingToggle } from "./SettingToggle";

/** Map the shared updater state (checking / updateInfo / status) to the pane's
 *  inline result copy (D-25-4). updateInfo wins (an available update is the most
 *  important signal); otherwise the manual-check status is surfaced verbatim
 *  ("You're up to date" / "Update check failed"), or null when idle. */
function resultLine(
  checking: boolean,
  updateInfo: { version: string } | null,
  status: string | null,
): string | null {
  if (checking) return "Checking for updates…";
  if (updateInfo) return `Version ${updateInfo.version} available`;
  return status;
}

export function UpdatesSettings() {
  const { preferences, setAutoUpdateCheck } = usePreferences();
  const { updateInfo, status, checking, installing, progress, runCheck, install } =
    useUpdater();

  // Install button copy mirrors the UpdateBanner: while installing, the label
  // carries the state (+ best-effort percent) so the in-flight signal is text,
  // never opacity-only (WCAG-AA).
  const installLabel = installing
    ? typeof progress === "number"
      ? `Installing… ${Math.round(progress)}%`
      : "Installing…"
    : `Install version ${updateInfo?.version ?? ""}`.trimEnd();

  // Read the running app version once on mount via the Plan 01 seam (never
  // the native plugin directly — FND-04). null until it resolves; the `alive` latch
  // drops a late resolve after unmount so we never setState on an unmounted pane.
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void platform.app.getVersion().then((v) => {
      if (alive) setVersion(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Last-checked node (D-25-7): null → literal "Never"; otherwise the relative
  // string (falling back to the absolute when Intl.RelativeTimeFormat is absent —
  // relativeTime returns "" then). The absolute timestamp rides the title attr.
  const lastChecked = preferences.lastUpdateCheck;
  const lastCheckedText =
    lastChecked === null
      ? "Never"
      : relativeTime(lastChecked) || formatTimestamp(lastChecked).local;
  const lastCheckedTitle =
    lastChecked === null ? undefined : formatTimestamp(lastChecked).local;

  const result = resultLine(checking, updateInfo, status);

  return (
    <div className="flex flex-col gap-6 overflow-auto p-8">
      <header className="flex flex-col gap-1">
        {/* h3 — one level under the dialog h2 (preserves the Phase-22.1 heading
            order); never h2. */}
        <h3 className="text-[15px] font-semibold text-tx">Updates</h3>
        <p className="text-[13px] text-tx-2">
          Keep TinkerDev current with the latest version.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-medium text-tx">
            {/* The dash holds the line steady until getVersion() resolves (no
                flicker); in the packaged app this is the real tauri.conf version. */}
            TinkerDev v{version ?? "—"}
          </span>
          <span className="text-[12px] text-tx-3">
            Last checked:{" "}
            <span title={lastCheckedTitle}>{lastCheckedText}</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void runCheck(true)}
            disabled={checking}
            className={[
              "flex items-center gap-1.5 rounded-[7px] border px-4 py-2 text-[13px] font-medium outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-accent",
              // Disabled = neutral surface + not-allowed cursor (NOT opacity-only —
              // the "Checking…" line below is the visible in-flight signal, WCAG-AA).
              checking
                ? "cursor-not-allowed border-bd bg-input-bg text-tx-3"
                : "border-accent-line bg-accent-soft text-accent hover:opacity-90",
            ].join(" ")}
          >
            Check for updates
          </button>
        </div>

        {/* Inline result — polite live region (WCAG-AA). Carries the checking /
            up-to-date / "vX available" / failed copy as plain text (never an
            opacity-only or hover-only signal). Empty + hidden when idle. */}
        <div role="status" aria-live="polite" className="min-h-[1rem]">
          {result ? (
            <span className="text-[13px] text-tx-2">{result}</span>
          ) : null}
        </div>

        {/* Install — a SECOND entry point to the shared install() (D-25-5 revised),
            shown only when an update is detected. Disabled-while-installing is an
            aria-disabled + label change (progress in text), never opacity-only. */}
        {updateInfo ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={installing ? undefined : () => void install()}
              aria-disabled={installing}
              className={[
                "flex items-center gap-1.5 rounded-[7px] border border-accent-line bg-accent-soft px-4 py-2 text-[13px] font-medium text-accent outline-none transition-colors",
                "focus-visible:ring-2 focus-visible:ring-accent",
                installing ? "cursor-default" : "cursor-pointer hover:opacity-90",
              ].join(" ")}
            >
              {installLabel}
            </button>
          </div>
        ) : null}

        <SettingToggle
          label="Automatically check for updates on launch"
          helper="Check for new versions over the network when TinkerDev starts."
          // Tri-state null renders OFF (D-25-8); only an explicit true is ON.
          checked={preferences.autoUpdateCheck === true}
          onChange={setAutoUpdateCheck}
        />
      </section>
    </div>
  );
}
