// React hooks over the shared Settings-modal open-state store. The shell mount
// (App.tsx) reads useSettingsOpen() to project the single <SettingsModal>; the
// modal reads useActivePane() to render the active pane. Openers (sidebar row,
// ⌘K command, native menu/tray seam, the deep-link element) call the store's
// openSettings() directly. Follows the established useSyncExternalStore hook
// placement convention (useLicenseUi / useEntitlements).
import { useSyncExternalStore } from "react";
import {
  getActivePane,
  getSettingsOpen,
  subscribeSettings,
} from "./settingsStore";

export function useSettingsOpen(): boolean {
  return useSyncExternalStore(subscribeSettings, getSettingsOpen);
}

export function useActivePane(): string {
  return useSyncExternalStore(subscribeSettings, getActivePane);
}
