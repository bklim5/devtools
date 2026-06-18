// startupReveal.ts — the SOLE normal-launch window reveal (D-24-8/9).
//
// The window launches hidden (tauri.conf.json app.windows[0].visible = false) AND
// the window-state plugin no longer native-auto-shows it (lib.rs drops
// StateFlags::VISIBLE, Plan 02 Task 2a). So this webview reveal — gated on the
// persisted start-in-tray preference — is the ONLY thing that shows the window on
// a normal launch. With start-in-tray ON the window is simply NEVER shown (no
// show-then-hide flash, RESEARCH Pitfall 1): the user reaches it via summon / the
// tray "Show" item, which use the native unminimize→show→set_focus reveal.
//
// SEAM DISCIPLINE (FND-04 / threat T-05-04): reaches the OS ONLY through
// `src/lib/platform/` (`platform.window`). It must NOT import the native runtime
// packages directly; the grep audit asserts zero native-package imports here.

import { initPlatform, platform } from "@/lib/platform";
import type { Preferences } from "./preferences";

/**
 * Reveal the window on a normal launch UNLESS start-in-tray is on (D-24-8/9).
 *
 * start-in-tray = the window is simply never shown — there is NO show-then-conceal
 * pair (that would flash, Pitfall 1). Idempotent: the window launches hidden and is
 * shown at most once. With the native window-state auto-show neutralized
 * (lib.rs), this is the sole reveal on a normal launch.
 */
export async function revealOnStartup(
  prefs: Pick<Preferences, "startInTray">,
): Promise<void> {
  if (prefs.startInTray) return; // start hidden — reached via summon/tray, never shown-then-hidden
  await initPlatform();
  await platform.window.show();
}
