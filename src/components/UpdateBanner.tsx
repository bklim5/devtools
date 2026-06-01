// UpdateBanner (DST-02, D-11c/D-13) — a CONTROLLED, layout-agnostic, WCAG-AA
// banner announcing a newer version. The PARENT owns visibility: it mounts this
// with an `info` whenever a detection happens and unmounts it on dismiss, so a
// later detection re-shows it (no internal "dismissed forever" state, D-11c).
//
// WCAG-AA (UX-04 / D-13): reuses the @theme AA tokens (bg-panel, border-bd,
// text-tx/tx-2, ring-accent); every interactive control is a real keyboard-
// reachable <button> with `focus-visible:ring-2 focus-visible:ring-accent` and a
// visible label / accessible name. The installing state is signalled by an
// aria-disabled attribute AND a text/label change (+ progress), never by opacity
// alone. Layout-agnostic: responsive Tailwind only (w-full / max-w-*, flex) — NO
// fixed pixel widths (UX-05). It owns no updater logic: Install/Later just call
// the props the shell wires to update.ts (installUpdate / dismiss).

import { X } from "lucide-react";
import type { UpdateInfo } from "@/lib/platform";

export interface UpdateBannerProps {
  /** The detected newer version (DST-02). Headline + notes are read from here. */
  info: UpdateInfo;
  /** Verify-then-relaunch install (shell wires this to update.ts installUpdate). */
  onInstall: () => void;
  /** Dismiss this detection (parent unmounts; re-shows on the next detection). */
  onDismiss: () => void;
  /** True while a download/verify/install is in flight — disables Install and
   *  shows progress, without an opacity-only signal. */
  installing?: boolean;
  /** Best-effort download progress percent (non-load-bearing; shown when present). */
  progress?: number;
}

export function UpdateBanner({
  info,
  onInstall,
  onDismiss,
  installing = false,
  progress,
}: UpdateBannerProps) {
  const installLabel = installing
    ? typeof progress === "number"
      ? `Installing… ${Math.round(progress)}%`
      : "Installing…"
    : "Install";

  return (
    <div
      id="update-banner"
      role="status"
      aria-live="polite"
      className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-[10px] border border-bd bg-panel px-4 py-3 text-tx shadow-lg"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-[13px] font-medium text-tx">
          v{info.version} available
        </p>
        {info.notes ? (
          <p className="text-[12px] leading-5 text-tx-2">{info.notes}</p>
        ) : null}
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={installing ? undefined : onInstall}
            aria-disabled={installing}
            className={[
              "rounded-[7px] border border-accent-line bg-accent-soft px-3 py-1 text-[12px] font-medium text-accent outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
              installing
                ? "cursor-default"
                : "cursor-pointer hover:bg-accent-soft hover:text-accent",
            ].join(" ")}
          >
            {installLabel}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="cursor-pointer rounded-[7px] border border-bd bg-input-bg px-3 py-1 text-[12px] text-tx-2 outline-none transition-colors hover:border-bd-2 hover:text-tx focus-visible:ring-2 focus-visible:ring-accent"
          >
            Later
          </button>
        </div>
      </div>
      <button
        type="button"
        id="update-dismiss"
        onClick={onDismiss}
        // A native <button> already activates on Enter/Space, but we handle the
        // keys explicitly so the keyboard-dismiss path is deterministic on the
        // embedded WKWebView WebDriver (which does not synthesize the implicit
        // button activation from a synthetic keypress). Harmless for real users.
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onDismiss();
          }
        }}
        aria-label="Dismiss update notification"
        className="flex-none cursor-pointer rounded-[6px] border border-transparent p-1 text-tx-2 outline-none transition-colors hover:text-tx focus-visible:ring-2 focus-visible:ring-accent"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
