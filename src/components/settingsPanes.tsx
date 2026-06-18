// The extensible Settings pane registry (D-S3). The locked array shape — one
// entry per pane `{ id, label, icon, render }` — is what lets Phases 23-25 append
// their Appearance / Hotkeys / General / Updates panes with NO shell change: the
// SettingsModal's left nav and right content both derive 1:1 from this array
// (the modal is app chrome, NOT a tool — the tool registry stays untouched).
//
// Phase 22 ships ONLY the License pane: it renders <LicenseSettings/> UNCHANGED
// (SET-06) — LicenseSettings owns its own `overflow-auto p-8 gap-12`, so the modal
// hosts it directly as the pane child (no extra padding, Pitfall 5).
//
// The `Settings` gear is the entry-point/title glyph per the UI-SPEC; a per-pane
// glyph can be chosen by each later phase when it adds its entry.

import type { ComponentType, ReactNode } from "react";
import { Contrast, Keyboard, Settings } from "lucide-react";
import { LicenseSettings } from "./LicenseSettings";
import { AppearanceSettings } from "./AppearanceSettings";
import { HotkeysSettings } from "./HotkeysSettings";

export interface SettingsPane {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  render: () => ReactNode;
}

export const SETTINGS_PANES: SettingsPane[] = [
  {
    id: "appearance",
    label: "Appearance",
    icon: Contrast,
    render: () => <AppearanceSettings />,
  },
  {
    id: "hotkeys",
    label: "Hotkeys",
    icon: Keyboard,
    render: () => <HotkeysSettings />,
  },
  {
    id: "license",
    label: "License",
    icon: Settings,
    render: () => <LicenseSettings />,
  },
];
