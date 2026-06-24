// UpdaterOverlay — the DIRECT-channel updater surface (Phase 29, MAS-NATIVE-02/03).
//
// The whole App-shell updater UI was EXTRACTED out of App.tsx into this component so
// the store build can drop it WHOLESALE: the updater plugin COMMAND is compiled out
// of the store binary (Phase 27) and its surviving tray item is gated out (29-01
// Task 3). App.tsx mounts this component ONLY in the direct build via a build-time
// `IS_APPSTORE ? null : lazy(() => import("./components/UpdaterOverlay"))` switch, so
// the entire UI subtree (this → useUpdater → shell/update → UpdateBanner) tree-shakes
// OUT of the store bundle by construction — no forbidden first-run "automatic update
// checks?" opt-in prompt, no UpdateBanner, no menu://check-updates listener, and 0
// platform.updater.check() calls in the store frontend.
//
// NOTE: the @tauri-apps/plugin-updater plugin JS itself is NOT removed by this
// extraction — tauri.ts imports it at top level and BOTH builds load tauri.ts via the
// one shared `import("./tauri")` seam, so the inert plugin JS rides along (D-05, like
// plugin-autostart). Its safety is the RUNTIME no-invoke proof (updater.check === 0 on
// the store boot path, main.test.tsx), NOT bundle exclusion of the plugin package —
// mirroring the keygen-compileout-d04-proof idiom (a string/package-absence grep is
// insufficient; the load-bearing proof is the 0-call assertion).

import { useEffect, useRef } from "react";
import { setUpdateInfoForTest, useUpdater } from "@/shell/useUpdater";
import { needsOptInPrompt, shouldAutoCheck } from "@/shell/update";
import { usePreferences } from "@/shell/usePreferences";
import { initPlatform, platform, type UpdateInfo } from "@/lib/platform";
import { UpdateBanner } from "./UpdateBanner";

export default function UpdaterOverlay() {
  const { preferences, prefsLoaded, setAutoUpdateCheck } = usePreferences();

  // D-25-3: ALL updater UX state (detected update / install progress / transient
  // status / checking) lives in the shared useUpdater singleton, so the Updates
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
  // through the platform seam so this component never imports a native runtime package.
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
  // After the 29-02 extraction the injector registers when THIS lazy overlay mounts
  // (which can resolve after navigateToTool returns on the real WKWebView), so the
  // update.e2e.ts spec WAITS for window.__injectUpdate before invoking it.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __injectUpdate?: (info: UpdateInfo) => void };
    w.__injectUpdate = (info: UpdateInfo) => setUpdateInfoForTest(info);
    return () => {
      delete w.__injectUpdate;
    };
  }, []);

  const showOptIn = prefsLoaded && needsOptInPrompt(preferences.autoUpdateCheck);

  return (
    // Updater UX overlay (DST-02). Bottom-right, layout-agnostic, above content.
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-md flex-col items-end gap-2">
      {showOptIn ? <UpdateOptIn onChoose={(v) => setAutoUpdateCheck(v)} /> : null}
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
