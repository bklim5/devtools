import { useEffect, useRef } from "react";
import { Lock } from "lucide-react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { CommandPalette } from "./components/CommandPalette";
import { UpdateBanner } from "./components/UpdateBanner";
import { SettingsModal } from "./components/SettingsModal";
import { UpsellModal } from "./components/UpsellPanel";
import { useTrackActiveTool } from "./shell/useTrackActiveTool";
import { useAppearance } from "./shell/useAppearance";
import { usePreferences } from "./shell/usePreferences";
import { setUpdateInfoForTest, useUpdater } from "./shell/useUpdater";
import {
  acceleratorToKeyboardInit,
  formatAccelerator,
} from "./shell/hotkeyAccelerator";
import { useSettingsOpen } from "./shell/useSettings";
import { useUpsellOpen } from "./shell/useUpsell";
import { openSettings } from "./shell/settingsStore";
import { closeUpsell } from "./shell/upsellStore";
import { needsOptInPrompt, shouldAutoCheck } from "./shell/update";
import { initPlatform, platform, type UpdateInfo } from "@/lib/platform";

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

// Dispatch a synthetic keydown for the CONFIGURED palette chord so the header pill
// opens the same palette the global keydown handler does — the palette stays the
// single owner of its open state. Synthesizing the configured chord (not a
// hard-coded ⌘K) keeps the click in sync with the rebound chord the pill displays.
function openPalette(paletteChord: string) {
  const init = acceleratorToKeyboardInit(paletteChord);
  if (init) window.dispatchEvent(new KeyboardEvent("keydown", init));
}

export function App() {
  // Persist the open tool as last-used on every route change (sidebar, palette,
  // deep-link) so the app reopens to it next launch — see useTrackActiveTool.
  useTrackActiveTool();

  // D-23-9/D-23-5: apply the GATED whole-app theme+accent to documentElement on
  // every prefs/ents change (free → dark + #5b9bf8), once prefs are loaded AND
  // entitlements resolved (no Pro launch dark-flash). Reads the same prefs/ents
  // this body does, so no prop drilling; the index.html pre-paint script owns the
  // launch frame until then.
  useAppearance();

  const { preferences, prefsLoaded, setAutoUpdateCheck } = usePreferences();

  // D-25-3: ALL updater UX state (detected update / install progress / transient
  // status / checking) now lives in the shared useUpdater singleton, so the Updates
  // pane (Plan 04), the tray, and the silent launch check are SECOND entry points to
  // the SAME check — no divergent state machine, no direct check/install path here.
  // `runCheck` de-dupes concurrent triggers behind one in-flight promise and stamps
  // lastUpdateCheck (load-safe) on every resolution; `clearStatus` drives the
  // auto-clear timer below.
  const {
    updateInfo,
    status,
    installing,
    progress,
    runCheck,
    install,
    dismiss,
    clearStatus,
  } = useUpdater();
  // Guards the launch auto-check so it runs at most once per app session.
  const launchChecked = useRef(false);

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
    // `platform.events` is a getter over the CURRENT impl, which is the browser
    // stub until initPlatform() resolves the real Tauri impl (HIGH-22-01). Await
    // it FIRST so the listener binds to the real platform — otherwise the native
    // tray `menu://check-updates` event reaches the no-op browser stub and the
    // manual-check tray item is dead in the packaged app. initPlatform is
    // memoised/idempotent.
    void (async () => {
      await initPlatform();
      if (!alive) return;
      const u = await platform.events.onMenuCheckUpdates(() => void runCheck(true));
      if (alive) unlisten = u;
      else u();
    })();
    return () => {
      alive = false;
      unlisten?.();
    };
  }, [runCheck]);

  // SET-01/02: the native app-menu (⌘,) + tray "Settings…" items open the shell
  // Settings modal through the platform event seam (menu://open-settings →
  // platform.events.onOpenSettings), so App.tsx imports no @tauri-apps package
  // (D-12). Mirrors the onMenuCheckUpdates effect above. Registered at mount so
  // the listener is live before any user clicks a native item (Pitfall 2 — no
  // startup emit, no race). The native opener is not a DOM element, so pass an
  // explicit persistent return target (document.body) for the modal's
  // focus-return path. The callback closes over nothing reactive (no extra deps).
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let alive = true;
    // Same race as onMenuCheckUpdates (HIGH-22-01): await initPlatform() so the
    // listener binds to the REAL Tauri impl, not the browser stub `platform.events`
    // returns before init resolves — otherwise the native menu/tray
    // `menu://open-settings` event never reaches this handler and the native
    // Settings entry is dead in the packaged app.
    void (async () => {
      await initPlatform();
      if (!alive) return;
      const u = await platform.events.onOpenSettings(() =>
        openSettings("general", document.body),
      );
      if (alive) unlisten = u;
      else u();
    })();
    return () => {
      alive = false;
      unlisten?.();
    };
  }, []);

  // A resolving "up to date"/error toast auto-clears so it never lingers. The
  // status lives in the shared hook now, so the timer clears it through the hook's
  // action (clearStatus is a stable module reference).
  useEffect(() => {
    if (!status) return;
    const id = setTimeout(() => clearStatus(), 3000);
    return () => clearTimeout(id);
  }, [status, clearStatus]);

  // DEV/E2E-ONLY hook: the real download/verify round-trip can't be driven by
  // WebDriver (Manual-Only, Plan 05), so the real-WKWebView e2e renders the banner
  // deterministically via this guarded injector. It is stripped from production
  // bundles (import.meta.env.DEV is false there), so it adds NO shippable surface.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __injectUpdate?: (info: UpdateInfo) => void };
    w.__injectUpdate = (info: UpdateInfo) => setUpdateInfoForTest(info);
    return () => {
      delete w.__injectUpdate;
    };
  }, []);

  const showOptIn = prefsLoaded && needsOptInPrompt(preferences.autoUpdateCheck);

  // D-S1: the ONE shell-level Settings modal, mounted once and driven by the
  // settingsStore so every entry point (app menu ⌘, · tray · sidebar row · ⌘K ·
  // the #/settings/license deep-link) opens the SAME surface. SettingsModal owns
  // Esc/backdrop/× dismiss + focus capture/return. 22.1-04: the standalone
  // "Unlock Pro" upsell modal is gone — every former opener now routes here to
  // the License pane, which renders the inline upsell itself (one upsell surface).
  const settingsOpen = useSettingsOpen();
  // Phase 22.2: the focused "Unlock Pro" modal — ONE shell mount, a pure
  // projection of the shared upsellStore. Opened by a free user's ⌘K and the
  // contextual locked customization triggers (pin/drag/Alt+P/Reset); it owns its
  // own Esc/scrim dismiss + focus trap/return.
  const upsellOpen = useUpsellOpen();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-app font-sans text-tx">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col bg-pane">
        <header className="flex h-11 flex-none items-center justify-end border-b border-bd px-4">
          <button
            type="button"
            onClick={() => openPalette(preferences.paletteChord)}
            aria-label="Open command palette"
            className="flex items-center gap-2 rounded-[8px] border border-bd bg-panel px-2.5 py-1.5 text-tx-2 outline-none transition-colors hover:text-tx focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="text-[11.5px]">Search tools</span>
            <kbd className="font-mono text-[11px] tracking-[0.15em] text-tx-2">
              {formatAccelerator(preferences.paletteChord)}
            </kbd>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
      <CommandPalette />

      {/* D-S1: shell-level Settings modal — ONE mount for every entry point.
          22.1-04: the only app-level modal now (the standalone Unlock Pro modal
          was removed); the License pane renders the inline upsell in-place. */}
      {settingsOpen ? <SettingsModal /> : null}

      {/* Phase 22.2: the focused "Unlock Pro" modal — mounted BELOW SettingsModal
          but they never co-open (the contextual triggers + free ⌘K fire from the
          main UI, with Settings closed). Reuses the shared ActivationSurface. */}
      {upsellOpen ? <UpsellModal icon={Lock} onClose={closeUpsell} /> : null}

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
            onInstall={() => void install()}
            onDismiss={dismiss}
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
        TinkerDev can check for new versions at launch over the network. You can
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
