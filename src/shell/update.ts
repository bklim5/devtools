// update.ts — the auto-updater orchestration state machine (DST-02,
// D-09/D-10/D-11/D-12). It owns the check→prompt→install flow ENTIRELY through the
// `src/lib/platform/` seam (`platform.updater`) — it must NOT import the native
// runtime packages directly (D-12).
// The seam already routes to the real plugin impl (tauri.ts) inside the WKWebView
// and to a hard no-op (check→null, no network) in the browser/jsdom fallback, so
// unit tests and `vite preview` never touch the network. The grep audit asserts
// zero native-package imports in this file (mirrors shell/summon.ts).
//
// Error discipline mirrors decodeInput: a network/endpoint failure in check() is
// returned as a typed error VALUE, never thrown past the boundary, so a failed
// check can never crash the shell (threat T-06-13). An install failure (e.g. a
// minisign signature mismatch) is the one thing that DOES propagate — the caller
// surfaces it as a banner error state, which is exactly DST-02 working
// (verify-before-apply: a forged update throws instead of installing, T-06-12).

import { initPlatform, platform, type UpdateInfo } from "@/lib/platform";

/** The result of a single update check. Discriminated so the caller can render a
 *  banner (`update`), a quiet "you're up to date" for a MANUAL check (`current`),
 *  or a transient error (`error`) — without ever catching a throw. */
export type UpdateCheckResult =
  | { kind: "update"; info: UpdateInfo }
  | { kind: "current" }
  | { kind: "error"; message: string };

/**
 * Run an update check through the seam. Error-as-value: a rejected check (offline,
 * endpoint unreachable, malformed latest.json) resolves to `{ kind: "error" }` and
 * NEVER throws past this boundary (threat T-06-13). `await initPlatform()` first so
 * the real Tauri impl is installed before we call check() (memoised — cheap).
 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  await initPlatform();
  try {
    const info = await platform.updater.check();
    return info ? { kind: "update", info } : { kind: "current" };
  } catch (e) {
    return { kind: "error", message: String(e) };
  }
}

/**
 * Download, VERIFY, and install the pending update via the seam, then relaunch
 * (all inside the plugin's `downloadAndInstall`). The minisign verify is the
 * plugin's mandatory, non-disableable step — this IS DST-02's verify-before-apply.
 * Unlike checkForUpdate, install failures (signature mismatch, write error) are
 * allowed to PROPAGATE so the caller can surface an explicit error state — a
 * forged update must never silently install (threat T-06-12).
 */
export async function installUpdate(
  onProgress?: (pct: number) => void,
): Promise<void> {
  await initPlatform();
  await platform.updater.downloadAndInstall(onProgress);
}

/**
 * Launch-time opt-in predicate (D-09). The silent launch check runs ONLY when the
 * user has explicitly opted in (pref === true); false (opted out) and null (never
 * asked) both mean NO automatic network call — offline-by-design holds (threat
 * T-06-11). A manual check (tray "Check for Updates…") is always available
 * regardless of this value.
 */
export function shouldAutoCheck(pref: boolean | null): boolean {
  return pref === true;
}

/** True only on first launch (pref === null = never asked), gating the one-time
 *  opt-in prompt. Once the user answers (true/false) the prompt never re-appears. */
export function needsOptInPrompt(pref: boolean | null): boolean {
  return pref === null;
}
