// The ONLY file in the codebase allowed to import @tauri-apps/*. It is reached
// EXCLUSIVELY through a dynamic `import("./tauri")` inside index.ts, gated on a
// runtime `__TAURI_INTERNALS__` check — never via a top-level import in index.ts.
// This keeps the Tauri impl out of the vite-preview fallback bundle and out of
// jsdom/node test runs (so tests need no @tauri-apps mock).
//
// Capabilities reached here: clipboard (plugin-clipboard-manager), store
// (plugin-store), window summon/focus (api/window), OS-level global shortcuts
// (plugin-global-shortcut, NAT-01), and the auto-updater (plugin-updater +
// plugin-process, DST-02). All of these are JS-reachable native surfaces — and
// ALL of them live behind this single seam file.

import { writeText, readText } from "@tauri-apps/plugin-clipboard-manager";
import { load } from "@tauri-apps/plugin-store";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  register,
  unregister,
  isRegistered,
} from "@tauri-apps/plugin-global-shortcut";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import type { LicenseStatusPayload, Platform } from "./index";
import type { Store } from "./stub";
import {
  initialDownloadProgress,
  reduceDownloadProgress,
} from "../update/downloadProgress";

/**
 * Real on-disk Store impl (SHL-05, D-09), backed by @tauri-apps/plugin-store.
 * `load()` returns a LazyStore that resolves the underlying store on first use;
 * we resolve it ONCE at module scope and delegate get/set behind the unchanged
 * `Store` interface. Gated at runtime by the `store:default` capability (Pitfall
 * 2). This is the ONLY file allowed to import @tauri-apps/*.
 *
 * DURABILITY FIX (theme/pins/last-used data loss): `autoSave: true` DEBOUNCES
 * disk writes (~100ms), so a pending write is LOST if the app quits before the
 * debounce flushes — especially after several quick changes right before quit —
 * and a stale-disk read (e.g. clearEntitlementsOverride) could clobber newer
 * in-memory values. We set `autoSave: false` and call `save()` AFTER every
 * `set()`, so each write is durably on disk before the call resolves. This is
 * off the hot path: usePreferences already writes user-paced (one set per change,
 * NOT per render — Pitfall 5), so the per-set fsync cost is unobservable.
 */
function createTauriStore(): Store {
  // `defaults: {}` is required by this plugin version's StoreOptions; an empty
  // map means "no seeded keys" (unset keys read back as undefined, matching the
  // Store contract). `autoSave: false`: we flush explicitly per set (see below).
  const ready = load("prefs.json", { defaults: {}, autoSave: false });
  return {
    async get(key: string): Promise<unknown> {
      return (await ready).get(key);
    },
    async set(key: string, value: unknown): Promise<void> {
      const store = await ready;
      await store.set(key, value);
      // Flush to disk before resolving so a quit immediately after never loses
      // the write (the autoSave debounce window is the data-loss bug we fix here).
      await store.save();
    },
  };
}

export const tauriPlatform: Platform = {
  clipboard: {
    writeText: (text: string) => writeText(text),
    readText: () => readText(),
  },
  store: createTauriStore(),
  window: {
    // macOS focus regression (RESEARCH Pitfall 1 / tauri issue #12834): order
    // matters. The shell summon flow (Plan 03) calls unminimize() → show() →
    // setFocus() in that order so a minimized/hidden window reliably comes to
    // the foreground (mirrors the Rust summon path in Plan 01, D-03).
    show: () => getCurrentWindow().show(),
    setFocus: () => getCurrentWindow().setFocus(),
    unminimize: () => getCurrentWindow().unminimize(),
    minimize: () => getCurrentWindow().minimize(),
    isVisible: () => getCurrentWindow().isVisible(),
  },
  nativeShortcut: {
    // Filter to Pressed so the handler fires once per chord, not on key-up too
    // (RESEARCH Pitfall 2 — the plugin emits both Pressed and Released states).
    register: (accelerator, handler) =>
      register(accelerator, (event) => {
        if (event.state === "Pressed") handler();
      }),
    unregister: (accelerator) => unregister(accelerator),
    isRegistered: (accelerator) => isRegistered(accelerator),
  },
  // DST-02: check() compares latest.json.version to the app version;
  // downloadAndInstall downloads the .app.tar.gz, VERIFIES the minisign signature
  // against the committed pubkey (mandatory, non-disableable — this IS
  // verify-before-apply), then relaunch()s into the new bundle (plugin-process).
  // A signature mismatch throws inside downloadAndInstall.
  updater: {
    async check() {
      const u = await check();
      return u ? { version: u.version, notes: u.body ?? null, date: u.date ?? null } : null;
    },
    async downloadAndInstall(onProgress) {
      const u = await check();
      if (!u) return;
      // Fold the plugin's Started/Progress/Finished events into a 0-100 percent
      // via the pure reducer. `chunkLength` is per-chunk BYTES, not a percent —
      // forwarding it raw showed "8000%". Progress is best-effort/non-load-bearing
      // for DST-02 (the minisign verify + install is the load-bearing part).
      let progress = initialDownloadProgress;
      await u.downloadAndInstall((event) => {
        const next = reduceDownloadProgress(progress, event);
        progress = next.state;
        if (onProgress && next.pct !== undefined) onProgress(next.pct);
      });
      await relaunch();
    },
  },
  // DST-02: subscribe to the tray's `menu://check-updates` event (emitted by the
  // Rust side, 06-03) so the shell can run a MANUAL update check. The `listen`
  // import lives ONLY here (D-12) — App.tsx calls platform.events, never @tauri-apps.
  // Tauri's listen() resolves an UnlistenFn; we return it as the unsubscribe.
  events: {
    onMenuCheckUpdates: (handler) =>
      listen("menu://check-updates", () => handler()),
    // SET-01/02: subscribe to the app-menu (⌘,) + tray `Settings…` event the Rust
    // side emits (lib.rs). Same no-payload `listen` shape as check-updates — the
    // listener ignores any data and just calls openSettings() (T-22-08). This
    // `listen` import lives ONLY here (D-12); App.tsx reaches it via platform.events.
    onOpenSettings: (handler) =>
      listen("menu://open-settings", () => handler()),
  },
  // LIC-01..04: the locked 4-command surface, reached ONLY through this seam.
  // Tauri rejects command errors with the serialized `{ code }` object — pass
  // rejections through untransformed (the webview copy layer in Plan 04 maps
  // codes to messages). Key material flows IN via activate(key) and never out.
  license: {
    status: () => invoke<LicenseStatusPayload>("license_status"),
    // Route-only masked-key path (D-89) — the ONLY licensed status that reads
    // the Keychain; called solely from the license settings route (finding 2).
    statusDetail: () => invoke<LicenseStatusPayload>("license_status_detail"),
    activate: (key) => invoke<LicenseStatusPayload>("activate_license", { key }),
    refresh: () => invoke<LicenseStatusPayload>("refresh_license"),
    deactivate: () => invoke<LicenseStatusPayload>("deactivate_machine"),
  },
  // PAY-01 / D-67: hand a fixed https URL to the OS default browser via the
  // opener plugin. Gated at runtime by the https-only `opener:allow-open-url`
  // capability — a non-https scheme is rejected by the capability scope, never
  // reaching the OS. The `@tauri-apps/plugin-opener` import lives ONLY here.
  opener: {
    openUrl: (url: string) => openUrl(url),
  },
  // SET-09 / D-24-7: launch-at-login via the autostart plugin (per-user LaunchAgent
  // plist; no network, no UI). The ONLY new webview dep of v1.7, the recorded scoped
  // exception. The native autostart plugin import (top of THIS file) lives ONLY here.
  autostart: {
    enable: () => enable(),
    disable: () => disable(),
    isEnabled: () => isEnabled(),
  },
};
