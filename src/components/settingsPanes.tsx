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

import type { ComponentType, ReactNode } from "react";
import { Contrast, Keyboard, Settings, SlidersHorizontal } from "lucide-react";
import { LicenseSettings } from "./LicenseSettings";
import { AppearanceSettings } from "./AppearanceSettings";
import { HotkeysSettings } from "./HotkeysSettings";
import { GeneralSettings } from "./GeneralSettings";

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
    id: "license",
    label: "License",
    icon: Settings,
    render: () => <LicenseSettings />,
  },
];
