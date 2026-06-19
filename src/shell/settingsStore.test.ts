// Settings-modal open-state store — the ONE channel every Settings entry point
// flips to open the single <SettingsModal> (D-S1). A module-singleton
// useSyncExternalStore store with the activePane state (D-S3) layered on.
import { afterEach, expect, it, vi } from "vitest";
import {
  closeSettings,
  getActivePane,
  getSettingsInvoker,
  getSettingsOpen,
  openSettings,
  setActivePane,
  subscribeSettings,
} from "./settingsStore";

afterEach(() => {
  closeSettings(); // restore the module singleton between tests
});

it("starts closed on the default general pane", () => {
  expect(getSettingsOpen()).toBe(false);
  expect(getActivePane()).toBe("general");
});

it("openSettings flips the flag, defaults the pane to general, and notifies", () => {
  const fn = vi.fn();
  const unsub = subscribeSettings(fn);
  openSettings();
  expect(getSettingsOpen()).toBe(true);
  expect(getActivePane()).toBe("general");
  expect(fn).toHaveBeenCalledTimes(1);
  unsub();
});

it("openSettings(pane) records the explicit pane", () => {
  openSettings("license");
  expect(getActivePane()).toBe("license");
});

it("openSettings is a no-op when already open (no extra notify, pane/invoker untouched)", () => {
  const explicit = { tagName: "BUTTON" } as unknown as HTMLElement;
  openSettings("license", explicit);
  const fn = vi.fn();
  const unsub = subscribeSettings(fn);
  // A second open must NOT overwrite the active pane or the captured invoker.
  openSettings("appearance");
  expect(fn).not.toHaveBeenCalled();
  expect(getActivePane()).toBe("license");
  expect(getSettingsInvoker()).toBe(explicit);
  unsub();
});

it("closeSettings flips back, resets the pane to general, and notifies; no-op when already closed", () => {
  openSettings();
  setActivePane("appearance");
  expect(getActivePane()).toBe("appearance");
  const fn = vi.fn();
  const unsub = subscribeSettings(fn);
  closeSettings();
  expect(getSettingsOpen()).toBe(false);
  expect(getActivePane()).toBe("general"); // reset to default on close
  expect(fn).toHaveBeenCalledTimes(1);
  closeSettings(); // already closed — no extra notify
  expect(fn).toHaveBeenCalledTimes(1);
  unsub();
});

it("setActivePane updates the pane and notifies; no-op when unchanged", () => {
  openSettings();
  const fn = vi.fn();
  const unsub = subscribeSettings(fn);
  setActivePane("appearance");
  expect(getActivePane()).toBe("appearance");
  expect(fn).toHaveBeenCalledTimes(1);
  setActivePane("appearance"); // unchanged — no notify
  expect(fn).toHaveBeenCalledTimes(1);
  unsub();
});

it("unsubscribed listeners stop receiving updates", () => {
  const fn = vi.fn();
  const unsub = subscribeSettings(fn);
  unsub();
  openSettings();
  expect(fn).not.toHaveBeenCalled();
});

// D-S2 invoker capture seam. The store captures the focused element SYNCHRONOUSLY
// at openSettings() time so the modal can restore focus there on close. In the
// node env `document` is absent, so the default capture safely no-ops to null
// (the modal then falls back to its own document.activeElement read, exercised in
// the jsdom SettingsModal test).
it("captures no invoker in a DOM-less env and clears it on close", () => {
  expect(getSettingsInvoker()).toBeNull();
  openSettings();
  expect(getSettingsInvoker()).toBeNull(); // no `document` to read in node env
  closeSettings();
  expect(getSettingsInvoker()).toBeNull();
});

// TRANSIENT openers (the ⌘K command, the native menu/tray event, the deep-link
// element) unmount on open, so their captured element is about to detach. Those
// callers pass an EXPLICIT return-focus element which the store records VERBATIM
// — bypassing the document.activeElement capture entirely (works even DOM-less).
it("openSettings(pane, invoker) records the explicit return target verbatim", () => {
  const explicit = { tagName: "BUTTON" } as unknown as HTMLElement;
  openSettings("license", explicit);
  expect(getSettingsInvoker()).toBe(explicit);
  closeSettings();
  expect(getSettingsInvoker()).toBeNull();
});

it("openSettings(pane, null) records null explicitly (no implicit activeElement capture)", () => {
  openSettings("license", null);
  expect(getSettingsInvoker()).toBeNull();
  closeSettings();
});
