import { lazy, Suspense, useEffect } from "react";
import { Lock } from "lucide-react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { CommandPalette } from "./components/CommandPalette";
import { SettingsModal } from "./components/SettingsModal";
import { useTrackActiveTool } from "./shell/useTrackActiveTool";
import { useAppearance } from "./shell/useAppearance";
import { usePreferences } from "./shell/usePreferences";
import {
  acceleratorToKeyboardInit,
  formatAccelerator,
} from "./shell/hotkeyAccelerator";
import { useSettingsOpen } from "./shell/useSettings";
import { useUpsellOpen } from "./shell/useUpsell";
import { openSettings } from "./shell/settingsStore";
import { closeUpsell } from "./shell/upsellStore";
import { initPlatform, platform } from "@/lib/platform";
import { IS_APPSTORE } from "@/lib/platform/channel";

// D-01/D-02/D-04: the static IS_APPSTORE switch picks the upsell surface at the
// single mount point. Each arm is a `lazy(() => import(...))` DYNAMIC import so the
// dead arm's subtree is statically unreachable in the other build and Rollup
// tree-shakes it out — a plain `IS_APPSTORE ? <A/> : <B/>` over STATIC imports
// keeps BOTH (the JSX is retained at runtime, so neither static import can be
// DCE'd), which would fold the Keygen UpsellPanel/licenseUi subtree into the store
// bundle. The store arm (StoreUpsell) carries NO Keygen activation form / key field.
const UpsellSurface = IS_APPSTORE
  ? lazy(() =>
      import("./components/StoreUpsell").then((m) => ({ default: m.StoreUpsell })),
    )
  : lazy(() =>
      import("./components/UpsellPanel").then((m) => ({ default: m.UpsellModal })),
    );

// Phase 29 (MAS-NATIVE-02/03): the whole updater overlay is DIRECT-channel only.
// The store build compiles out the updater plugin COMMAND (Phase 27) + gates its tray
// item (29-01 Task 3); shipping the overlay there would render the forbidden first-run
// "automatic update checks?" opt-in prompt and wire menu://check-updates → an invoke
// against an unregistered command. Gating via a build-time IS_APPSTORE switch over a
// DYNAMIC import (NOT a static `{!IS_APPSTORE && <UpdaterOverlay/>}` over a static import
// — that retains the JSX so the static import can't be DCE'd, per the UpsellSurface
// comment) tree-shakes the entire UI subtree (UpdaterOverlay → useUpdater → shell/update
// → UpdateBanner) OUT of the store bundle by construction. (The plugin-updater plugin JS
// itself rides along inert via the shared tauri.ts seam — D-05, like plugin-autostart;
// proven safe by the runtime updater.check===0 boot-path assertion, not bundle exclusion.)
const UpdaterOverlay = IS_APPSTORE
  ? null
  : lazy(() => import("./components/UpdaterOverlay"));

// The registry-driven application shell (SHL-01/02). All layout chrome lives
// HERE — tools stay layout-agnostic and render inside <main>'s <Outlet/> with no
// fixed widths of their own (UX-05). The compact <Sidebar/> (268px) is a pure
// projection of ENABLED_TOOLS; <CommandPalette/> is mounted once and overlays
// everything, owning its own ⌘K open state (it never auto-opens — D-07).
//
// Phase 29: the DST-02 updater UX overlay (opt-in prompt + dismissible UpdateBanner
// + the launch/tray/auto-clear/injector effects) was EXTRACTED into <UpdaterOverlay/>,
// mounted below ONLY in the direct build via the IS_APPSTORE lazy switch (so the store
// build ships none of it). App.tsx still imports NO native runtime package (D-12).

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

  const { preferences } = usePreferences();

  // Phase 29: the whole updater overlay (useUpdater state machine + the launch
  // auto-check, the menu://check-updates listener, the status auto-clear timer, the
  // DEV __injectUpdate injector, the first-run opt-in, and the UpdateBanner) lives in
  // <UpdaterOverlay/>, mounted ONLY in the direct build via the IS_APPSTORE lazy switch
  // above — so the store build ships none of it (no opt-in prompt, no banner, 0
  // updater.check calls, 0 menu://check-updates listeners).

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
      {/* D-01/D-02/D-04: the static IS_APPSTORE switch selects the upsell surface
          (StoreUpsell store / UpsellModal direct) via a build-time-resolved lazy
          import, so the dead arm's subtree tree-shakes out of each bundle. */}
      {upsellOpen ? (
        <Suspense fallback={null}>
          <UpsellSurface icon={Lock} onClose={closeUpsell} />
        </Suspense>
      ) : null}

      {/* Phase 29 (MAS-NATIVE-02/03): the updater overlay (opt-in + UpdateBanner +
          status toast + the launch/tray/auto-clear/injector effects) is DIRECT-channel
          only — mounted here via the build-time IS_APPSTORE lazy switch so the store
          build ships none of it (the whole subtree tree-shakes out). */}
      {!IS_APPSTORE && UpdaterOverlay ? (
        <Suspense fallback={null}>
          <UpdaterOverlay />
        </Suspense>
      ) : null}
    </div>
  );
}
