// useUpdater — the ONE shared updater state machine (D-25-3). Lifts App.tsx's
// component-local updater state (updateInfo / status / checking / installing /
// progress + the check + install actions) into a module singleton so the Updates
// pane (Plan 04), the tray, and the silent launch check are all SECOND entry
// points to the SAME action, with no divergent check state.
//
// Mirrors the usePreferences / settingsStore module-singleton + listener pattern:
// module-scoped state + a `listeners` Set + per-field setters that `notify()`, and
// a `useUpdater()` hook that subscribes via a forceRender.
//
// Two invariants this module enforces (both grep/test-verifiable, not assumptions):
//   1. IN-FLIGHT DE-DUPE — overlapping triggers (silent launch + tray + pane) reuse
//      ONE shared in-flight promise so `platform.updater.check` fires EXACTLY once
//      (D-25-3 / T-25-18; Plan 04's T-25-13 relies on this).
//   2. LOAD-SAFE STAMP — lastUpdateCheck is stamped on EVERY completed check, but
//      only AFTER `whenPreferencesLoaded()` resolves, so the stamp can never persist
//      DEFAULT_PREFERENCES+timestamp over the user's real blob during the async-init
//      race (memory tauri-store-async-init-race + prefs-blob-single-writer; T-25-17).
//
// Like shell/update.ts, this file imports NO native runtime package — every check /
// install routes through update.ts -> the platform seam (D-12).

import { useEffect, useState } from "react";
import { checkForUpdate, installUpdate } from "./update";
import { updatePreferences, whenPreferencesLoaded } from "./usePreferences";
import type { UpdateInfo } from "@/lib/platform";

// --- Module singleton: the single source of updater UX state -----------------
let updateInfo: UpdateInfo | null = null;
let status: string | null = null;
let checking = false;
let installing = false;
let progress: number | undefined = undefined;

// The de-dupe guard: while a check runs, every caller gets THIS promise back and
// nobody re-invokes checkForUpdate() (one network call). Cleared in the finally.
let inFlight: Promise<void> | null = null;

const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

function setUpdateInfo(info: UpdateInfo | null): void {
  updateInfo = info;
  notify();
}

function setStatus(next: string | null): void {
  status = next;
  notify();
}

function setChecking(next: boolean): void {
  checking = next;
  notify();
}

function setInstalling(next: boolean): void {
  installing = next;
  notify();
}

function setProgress(next: number | undefined): void {
  progress = next;
  notify();
}

/** Run a check through the shared state machine. DE-DUPES concurrent calls: if a
 *  check is already in flight, RETURN the same in-flight promise (do NOT call
 *  checkForUpdate again) so overlapping triggers (silent launch + tray + pane) hit
 *  platform.updater.check EXACTLY once and the final checking/status/updateInfo
 *  state is deterministic (D-25-3, T-25-18). Stamps lastUpdateCheck on EVERY
 *  resolution (manual OR silent) AFTER the real prefs load lands (load-safe — no
 *  defaults clobber, T-25-17). `manual` controls whether a no-update/error result
 *  surfaces a status string; the silent launch check stays quiet on current/error.
 *
 *  `manual` is captured by the FIRST caller: a silent launch racing a manual tray
 *  click resolves to the first caller's manual flag (acceptable — both stamp, both
 *  share the one network call; D-25-3 in-flight decision). */
export function runUpdateCheck(manual: boolean): Promise<void> {
  if (inFlight) return inFlight; // reuse the running check — one network call
  inFlight = (async () => {
    setChecking(true);
    // Reset any stale transient status to a clean baseline for THIS check (mirrors
    // installPendingUpdate). Without this a prior "You're up to date"/"Update check
    // failed" toast can still be on screen (inside its 3s auto-clear window) when a
    // re-check detects an update — the App overlay would then render that stale toast
    // AND the UpdateBanner with contradictory copy at the same time.
    setStatus(null);
    try {
      const result = await checkForUpdate();
      // Wait for the REAL persisted blob before merging the stamp so the merge can
      // never clobber the user's theme/pins/license with DEFAULT_PREFERENCES during
      // the async-init race (T-25-17). updatePreferences is the single-writer fn.
      await whenPreferencesLoaded();
      updatePreferences({ lastUpdateCheck: Date.now() }); // every check, single writer
      if (result.kind === "update") {
        setUpdateInfo(result.info); // re-show the banner on every detection (D-11c)
      } else if (manual && result.kind === "current") {
        setStatus("You're up to date");
      } else if (manual && result.kind === "error") {
        setStatus("Update check failed");
      }
    } finally {
      setChecking(false);
      inFlight = null; // clear so the NEXT (non-overlapping) check can run
    }
  })();
  return inFlight;
}

/** Download, VERIFY, and install the pending update via the seam (lifts App.tsx's
 *  handleInstall). On success the app relaunches; an install failure (signature
 *  mismatch, write error) surfaces an error status and clears progress so the
 *  banner can be retried/dismissed (T-06-12/T-06-13) — never a crash. */
export async function installPendingUpdate(): Promise<void> {
  setInstalling(true);
  setStatus(null);
  try {
    await installUpdate((pct) => setProgress(pct));
    // On success the app relaunches; nothing more to do here.
  } catch {
    setInstalling(false);
    setProgress(undefined);
    setStatus("Update failed to install");
  }
}

/** Dismiss the detected update (clears the banner + any install progress). */
export function dismissUpdate(): void {
  setUpdateInfo(null);
  setProgress(undefined);
}

/** Clear a transient "up to date" / error status (the auto-clear timer driver). */
export function clearUpdateStatus(): void {
  setStatus(null);
}

/** DEV/E2E inject seam: the real download/verify round-trip can't be driven by
 *  WebDriver (Plan 05 is Manual-Only), so the real-WKWebView e2e renders the banner
 *  deterministically through this. App.tsx guards the wiring on import.meta.env.DEV
 *  so it is stripped from production bundles. */
export function setUpdateInfoForTest(info: UpdateInfo | null): void {
  setUpdateInfo(info);
}

// --- Test-only getters + reset ----------------------------------------------
/** TEST-ONLY: read the current detected update (banner driver). */
export function getUpdateInfo(): UpdateInfo | null {
  return updateInfo;
}

/** TEST-ONLY: read the current transient status string. */
export function getUpdateStatus(): string | null {
  return status;
}

/** TEST-ONLY: whether a check is currently in flight. */
export function getChecking(): boolean {
  return checking;
}

/** TEST-ONLY: reset the singleton between tests so the updater state, the
 *  in-flight guard, and the listeners never leak across cases. Not used in app
 *  code. */
export function resetUpdaterForTest(): void {
  updateInfo = null;
  status = null;
  checking = false;
  installing = false;
  progress = undefined;
  inFlight = null;
  listeners.clear();
}

export interface UseUpdater {
  updateInfo: UpdateInfo | null;
  status: string | null;
  checking: boolean;
  installing: boolean;
  progress: number | undefined;
  /** Run a (de-duped) check; `manual` surfaces no-update/error feedback. */
  runCheck: (manual: boolean) => Promise<void>;
  /** Download + verify + install the pending update (relaunches on success). */
  install: () => Promise<void>;
  /** Dismiss the banner (clears updateInfo + progress). */
  dismiss: () => void;
  /** Clear the transient status toast. */
  clearStatus: () => void;
}

/** Hook: subscribes to the shared singleton and returns its values + stable bound
 *  actions. The actions are the module fns (stable references), so consumers can
 *  use them in effect deps without re-subscribing churn. */
export function useUpdater(): UseUpdater {
  const [, forceRender] = useState(0);
  useEffect(() => {
    const rerender = () => forceRender((n) => n + 1);
    listeners.add(rerender);
    return () => {
      listeners.delete(rerender);
    };
  }, []);

  return {
    updateInfo,
    status,
    checking,
    installing,
    progress,
    runCheck: runUpdateCheck,
    install: installPendingUpdate,
    dismiss: dismissUpdate,
    clearStatus: clearUpdateStatus,
  };
}
