// The extensible Settings pane registry (D-S3). The locked array shape — one
// entry per pane `{ id, label, icon, render }` — is what lets Phases 23-25 append
// their Appearance / Hotkeys / General / Updates panes with NO shell change: the
// SettingsModal's left nav and right content both derive 1:1 from this array
// (the modal is app chrome, NOT a tool — the tool registry stays untouched).
//
// Order here IS the left-nav order AND drives the default landing pane: generic
// Settings openers (sidebar gear, app-menu/tray, ⌘K "Settings") open the FIRST
// entry — General (Phase 24) — while License-specific openers (Unlock-Pro, the
// #/settings/license deep-link, the ⌘K "License" command) pass "license". The
// License pane still renders <LicenseSettings/> UNCHANGED (SET-06; it owns its own
// `overflow-auto p-8 gap-12`, so the modal hosts it directly — no extra padding).
//
// The `Settings` gear is the entry-point/title glyph per the UI-SPEC; each pane
// picks its own per-pane glyph in its entry below.

import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import {
  Contrast,
  Keyboard,
  RefreshCw,
  Settings,
  SlidersHorizontal,
} from "lucide-react";
import { IS_APPSTORE } from "@/lib/platform/channel";
import { AppearanceSettings } from "./AppearanceSettings";
import { HotkeysSettings } from "./HotkeysSettings";
import { GeneralSettings } from "./GeneralSettings";

// D-01/D-04: the static IS_APPSTORE switch picks the License + Updates pane at the
// single registry control point. Each arm is a `lazy(() => import(...))` DYNAMIC
// import so the dead arm's module subtree is statically unreachable in the other
// build and Rollup tree-shakes it out — a plain `IS_APPSTORE ? <A/> : <B/>` over
// STATIC imports does NOT drop the dead arm (the panes live inside an exported,
// runtime-iterated SETTINGS_PANES array Rollup cannot DCE, so both static imports
// survive — the exact licenseUi fold-in the appstore generateBundle guard caught).
// The store arms (StoreLicenseSettings/StoreUpdatesSettings) carry NO Keygen/updater
// subtree; the direct arms keep the Keygen LicenseSettings + the updater machinery.
const LicensePane = IS_APPSTORE
  ? lazy(() =>
      import("./StoreLicenseSettings").then((m) => ({
        default: m.StoreLicenseSettings,
      })),
    )
  : lazy(() =>
      import("./LicenseSettings").then((m) => ({ default: m.LicenseSettings })),
    );
const UpdatesPane = IS_APPSTORE
  ? lazy(() =>
      import("./StoreUpdatesSettings").then((m) => ({
        default: m.StoreUpdatesSettings,
      })),
    )
  : lazy(() =>
      import("./UpdatesSettings").then((m) => ({ default: m.UpdatesSettings })),
    );

export interface SettingsPane {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  render: () => ReactNode;
}

export const SETTINGS_PANES: SettingsPane[] = [
  {
    id: "general",
    label: "General",
    icon: SlidersHorizontal,
    render: () => <GeneralSettings />,
  },
  {
    id: "hotkeys",
    label: "Hotkeys",
    icon: Keyboard,
    render: () => <HotkeysSettings />,
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: Contrast,
    render: () => <AppearanceSettings />,
  },
  {
    // Updates pane (SET-10) — ungated; every user sees it. Appended append-only
    // (the modal shell derives 1:1 from this array, so no SettingsModal change).
    id: "updates",
    label: "Updates",
    icon: RefreshCw,
    render: () => (
      <Suspense fallback={null}>
        <UpdatesPane />
      </Suspense>
    ),
  },
  {
    id: "license",
    label: "License",
    icon: Settings,
    render: () => (
      <Suspense fallback={null}>
        <LicensePane />
      </Suspense>
    ),
  },
];
