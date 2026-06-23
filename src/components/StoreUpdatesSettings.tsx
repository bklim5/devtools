// StoreUpdatesSettings (MAS-BUILD-07, Phase 28-03, D-13) — the App-Store-managed
// Updates pane for the `appstore` build variant. A SEPARATE module from
// UpdatesSettings (NOT an `if (IS_APPSTORE)` branch inside it) so Plan 05's static
// IS_APPSTORE switch in settingsPanes.tsx tree-shakes the updater seam (the
// shared updater hook, the toggle component, and the time formatters) OUT of the
// store bundle — Apple forbids self-updating apps, and the store handles updates.
//
// KEEPS the running-version readout (the existing app-version seam + the
// text-[15px] treatment, byte-unchanged from UpdatesSettings). REPLACES the entire
// action block — the re-check button, the install button, the aria-live result
// region, the auto-check-on-launch toggle, and the last-checked line (all
// updater-driven) — with a single calm line.
//
// Imports ONLY useEffect/useState + the platform seam (FND-04 — never @tauri-apps
// directly). No updater machinery appears, so the store Updates branch is clean.

import { useEffect, useState } from "react";
import { platform } from "@/lib/platform";

export function StoreUpdatesSettings() {
  // Read the running app version once on mount via the Plan 01 seam (copied
  // verbatim from UpdatesSettings). null until it resolves; the `alive` latch
  // drops a late resolve after unmount so we never setState on an unmounted pane.
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void platform.app.getVersion().then((v) => {
      if (alive) setVersion(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6 overflow-auto p-8">
      <header className="flex flex-col gap-1">
        {/* h3 — one level under the dialog h2 (preserves the Phase-22.1 heading
            order); never h2. */}
        <h3 className="text-[15px] font-semibold text-tx">Updates</h3>
        <p className="text-[13px] text-tx-2">
          TinkerDev keeps itself current through the App Store.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <span className="text-[15px] font-semibold text-tx">
          {/* The dash holds the line steady until getVersion() resolves (no
              flicker); in the packaged app this is the real tauri.conf version. */}
          TinkerDev v{version ?? "—"}
        </span>
        <p className="text-[13px] text-tx-2">
          Your app updates are managed by the App Store.
        </p>
      </section>
    </div>
  );
}
