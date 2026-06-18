// GeneralSettings (SET-09, D-24-7..11) — the Settings ▸ General pane. Four
// app-behavior controls, each persisted via the single-writer prefs seam
// (usePreferences setters → updatePreferences; NEVER a second prefs writer —
// memory prefs-blob-single-writer) and each taking effect:
//   1. Launch at login — the autostart capability (D-24-7). On mount (gated on
//      prefsLoaded, T-24-06) it reconciles the OS truth from
//      platform.autostart.isEnabled() (the OS is the source of truth, RESEARCH
//      §7). On flip it calls enable/disable AND persists the intent so the UI is
//      correct before the async OS read settles (D-24-12). The OS is reached ONLY
//      through the platform.autostart seam (FND-04 — no native plugin import here).
//   2. Start in the menu bar — pure persist; revealOnStartup reads startInTray at
//      the next launch (Plan 02).
//   3. Open to (default tool) — a keyboard-operable native <select>: first option
//      literal "Last used", then each ENABLED_TOOLS name (D-24-10). null = last-used.
//   4. Show license status in sidebar — pure persist; the Sidebar gates its
//      license/upgrade affordance on this (D-24-11).
//
// The pane wrapper/header clone AppearanceSettings verbatim (reuse over
// reinvention; h3 one level under the dialog h2 preserves the Phase-22.1 heading
// order). Every token resolves in both themes (Phase-23 light/dark).

import { useEffect } from "react";
import { platform } from "@/lib/platform";
import { usePreferences } from "@/shell/usePreferences";
import { ENABLED_TOOLS } from "@/lib/tools/registry";
import { SettingToggle } from "./SettingToggle";

const LAST_USED_VALUE = "last-used";

export function GeneralSettings() {
  const {
    preferences,
    prefsLoaded,
    setLaunchAtLogin,
    setStartInTray,
    setDefaultToolId,
    setShowLicenseInSidebar,
  } = usePreferences();

  // Reconcile the launch-at-login toggle with the OS truth once prefs have
  // loaded (T-24-06 — a pre-load read would seed against the default). The OS is
  // the source of truth (RESEARCH §7): if the plist disagrees with the persisted
  // intent, adopt the OS value. browser/test arms resolve false (no-op there).
  useEffect(() => {
    if (!prefsLoaded) return;
    let cancelled = false;
    void platform.autostart.isEnabled().then((on) => {
      if (!cancelled && on !== preferences.launchAtLogin) setLaunchAtLogin(on);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsLoaded]);

  async function onToggleLaunchAtLogin(next: boolean) {
    // Call the seam AND persist the intent: the persisted value keeps the UI
    // correct before the next isEnabled() read, and the native plist round-trip
    // is what actually registers/removes the login item (D-24-12).
    if (next) await platform.autostart.enable();
    else await platform.autostart.disable();
    setLaunchAtLogin(next);
  }

  const defaultToolValue = preferences.defaultToolId ?? LAST_USED_VALUE;

  return (
    <div className="flex flex-col gap-6 overflow-auto p-8">
      <header className="flex flex-col gap-1">
        {/* h3 — one level under the dialog h2 (preserves the Phase-22.1 heading
            order); never h2. */}
        <h3 className="text-[15px] font-semibold text-tx">General</h3>
        <p className="text-[13px] text-tx-2">App behavior and startup.</p>
      </header>

      <section className="flex flex-col gap-4">
        <SettingToggle
          label="Launch at login"
          helper="Start TinkerDev automatically when you log in."
          checked={preferences.launchAtLogin}
          onChange={(next) => void onToggleLaunchAtLogin(next)}
        />

        <SettingToggle
          label="Start in the menu bar"
          helper="Launch hidden; summon or click the tray icon to show."
          checked={preferences.startInTray}
          onChange={setStartInTray}
        />

        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <label htmlFor="general-default-tool" className="text-[13px] font-medium text-tx">
              Open to
            </label>
            <span className="text-[12px] text-tx-3">
              The tool TinkerDev opens to on launch.
            </span>
          </div>
          <select
            id="general-default-tool"
            value={defaultToolValue}
            onChange={(e) =>
              setDefaultToolId(
                e.target.value === LAST_USED_VALUE ? null : e.target.value,
              )
            }
            className="rounded-[7px] border border-bd bg-input-bg px-4 py-2 text-[13px] text-tx outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <option value={LAST_USED_VALUE}>Last used</option>
            {ENABLED_TOOLS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <SettingToggle
          label="Show license status in sidebar"
          checked={preferences.showLicenseInSidebar}
          onChange={setShowLicenseInSidebar}
        />
      </section>
    </div>
  );
}
