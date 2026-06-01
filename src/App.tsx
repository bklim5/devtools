import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { CommandPalette } from "./components/CommandPalette";
import { UpdateBanner } from "./components/UpdateBanner";
import { useTrackActiveTool } from "./shell/useTrackActiveTool";
import { usePreferences } from "./shell/usePreferences";
import {
  checkForUpdate,
  installUpdate,
  needsOptInPrompt,
  shouldAutoCheck,
} from "./shell/update";
import { platform, type UpdateInfo } from "@/lib/platform";

// The registry-driven application shell (SHL-01/02). All layout chrome lives
// HERE — tools stay layout-agnostic and render inside <main>'s <Outlet/> with no
// fixed widths of their own (UX-05). The compact <Sidebar/> (268px) is a pure
// projection of ENABLED_TOOLS; <CommandPalette/> is mounted once and overlays
// everything, owning its own ⌘K open state (it never auto-opens — D-07).
//
// Phase 6 (DST-02) adds the updater UX overlay alongside the palette: the first-run
// opt-in prompt (D-09), the re-appearing dismissible UpdateBanner (D-11c/D-13), and
// the manual tray-check listener. Every updater call routes through shell/update.ts
// → the platform seam — App.tsx imports NO native runtime package (D-12). The
// launch auto-check is co-located here (gated on prefsLoaded + shouldAutoCheck) so
// it shares the banner state and never fires a network call when the user has not
// opted in (offline-by-design, T-06-11).

// Dispatch a synthetic ⌘K so the header pill opens the same palette the global
// keydown handler does — the palette stays the single owner of its open state.
function openPalette() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
}

export function App() {
  // Persist the open tool as last-used on every route change (sidebar, palette,
  // deep-link) so the app reopens to it next launch — see useTrackActiveTool.
  useTrackActiveTool();

  const { preferences, prefsLoaded, setAutoUpdateCheck } = usePreferences();

  // The detected update (banner shown only when set), install progress/error, and
  // a transient "you're up to date" surfaced after a MANUAL check with no update.
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<string | null>(null);
  // Guards the launch auto-check so it runs at most once per app session.
  const launchChecked = useRef(false);

  // Run a check and reflect the result into shell state. `manual` decides whether a
  // no-update / error result is surfaced (manual checks give feedback; the silent
  // launch check stays quiet on "current"/"error").
  const runCheck = useCallback(async (manual: boolean) => {
    const result = await checkForUpdate();
    if (result.kind === "update") {
      setUpdateInfo(result.info); // re-show the banner on every detection (D-11c)
    } else if (manual && result.kind === "current") {
      setStatus("You're up to date");
    } else if (manual && result.kind === "error") {
      setStatus("Update check failed");
    }
  }, []);

  // Silent launch check — ONLY when the user has explicitly opted in (D-09). false
  // (opted out) and null (never asked) make NO automatic network call (T-06-11).
  // The check is dispatched on a microtask (Promise.resolve().then) so its setState
  // never runs synchronously inside the effect body (React Compiler
  // set-state-in-effect lint) — and so first paint is never blocked (it returns
  // immediately; the async check resolves later, mirroring the tray-listener path).
  useEffect(() => {
    if (!prefsLoaded || launchChecked.current) return;
    launchChecked.current = true;
    if (shouldAutoCheck(preferences.autoUpdateCheck)) {
      void Promise.resolve().then(() => runCheck(false));
    }
  }, [prefsLoaded, preferences.autoUpdateCheck, runCheck]);

  // Manual check via the tray's `menu://check-updates` event (06-03), subscribed
  // through the platform seam so App.tsx never imports a native runtime package.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let alive = true;
    void platform.events.onMenuCheckUpdates(() => void runCheck(true)).then((u) => {
      if (alive) unlisten = u;
      else u();
    });
    return () => {
      alive = false;
      unlisten?.();
    };
  }, [runCheck]);

  // A resolving "up to date"/error toast auto-clears so it never lingers.
  useEffect(() => {
    if (!status) return;
    const id = setTimeout(() => setStatus(null), 3000);
    return () => clearTimeout(id);
  }, [status]);

  // DEV/E2E-ONLY hook: the real download/verify round-trip can't be driven by
  // WebDriver (Manual-Only, Plan 05), so the real-WKWebView e2e renders the banner
  // deterministically via this guarded injector. It is stripped from production
  // bundles (import.meta.env.DEV is false there), so it adds NO shippable surface.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __injectUpdate?: (info: UpdateInfo) => void };
    w.__injectUpdate = (info: UpdateInfo) => setUpdateInfo(info);
    return () => {
      delete w.__injectUpdate;
    };
  }, []);

  const handleInstall = useCallback(async () => {
    setInstalling(true);
    setStatus(null);
    try {
      await installUpdate((pct) => setProgress(pct));
      // On success the app relaunches; nothing more to do here.
    } catch {
      // A signature mismatch / install failure surfaces as an error, never a crash
      // (T-06-12/T-06-13). The banner stays so the user can retry or dismiss.
      setInstalling(false);
      setProgress(undefined);
      setStatus("Update failed to install");
    }
  }, []);

  const showOptIn = prefsLoaded && needsOptInPrompt(preferences.autoUpdateCheck);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-app font-sans text-tx">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col bg-pane">
        <header className="flex h-11 flex-none items-center justify-end border-b border-bd px-4">
          <button
            type="button"
            onClick={openPalette}
            aria-label="Open command palette"
            className="flex items-center gap-2 rounded-[8px] border border-bd bg-panel px-2.5 py-1.5 text-tx-2 outline-none transition-colors hover:text-tx focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="text-[11.5px]">Search tools</span>
            <kbd className="font-mono text-[11px] text-tx-2">⌘K</kbd>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
      <CommandPalette />

      {/* Updater UX overlay (DST-02). Bottom-right, layout-agnostic, above content. */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-md flex-col items-end gap-2">
        {showOptIn ? (
          <UpdateOptIn
            onChoose={(v) => setAutoUpdateCheck(v)}
          />
        ) : null}
        {updateInfo ? (
          <UpdateBanner
            info={updateInfo}
            onInstall={() => void handleInstall()}
            onDismiss={() => {
              setUpdateInfo(null);
              setProgress(undefined);
            }}
            installing={installing}
            progress={progress}
          />
        ) : null}
        {status ? (
          <div
            id="update-status"
            role="status"
            aria-live="polite"
            className="pointer-events-auto rounded-[8px] border border-bd bg-panel px-3 py-2 text-[12px] text-tx-2 shadow-lg"
          >
            {status}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// One-time first-run opt-in (D-09). WCAG-AA, reuses the banner token system; both
// choices are real keyboard-reachable buttons with a visible focus ring. Choosing
// either value persists it (setAutoUpdateCheck) so this prompt never re-appears.
function UpdateOptIn({ onChoose }: { onChoose: (v: boolean) => void }) {
  return (
    <div
      id="update-optin"
      role="dialog"
      aria-label="Automatic update checks"
      className="pointer-events-auto flex w-full max-w-md flex-col gap-2 rounded-[10px] border border-bd bg-panel px-4 py-3 text-tx shadow-lg"
    >
      <p className="text-[13px] font-medium text-tx">
        Enable automatic update checks?
      </p>
      <p className="text-[12px] leading-5 text-tx-2">
        DevTools can check for new versions at launch over the network. You can
        always check manually from the tray menu.
      </p>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          id="update-optin-yes"
          onClick={() => onChoose(true)}
          className="cursor-pointer rounded-[7px] border border-accent-line bg-accent-soft px-3 py-1 text-[12px] font-medium text-accent outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent"
        >
          Yes, check at launch
        </button>
        <button
          type="button"
          id="update-optin-no"
          onClick={() => onChoose(false)}
          className="cursor-pointer rounded-[7px] border border-bd bg-input-bg px-3 py-1 text-[12px] text-tx-2 outline-none transition-colors hover:border-bd-2 hover:text-tx focus-visible:ring-2 focus-visible:ring-accent"
        >
          No thanks
        </button>
      </div>
    </div>
  );
}
