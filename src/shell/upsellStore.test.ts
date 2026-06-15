// Shared upsell-modal open-state store — the ONE channel both the sidebar
// footer/affordances and the ⌘K free-tier "License" command flip to open the
// single UpsellModal surface (21-04 walkthrough fix). Mirrors the
// licenseUi/entitlements snapshot-store test discipline.
import { afterEach, expect, it, vi } from "vitest";
import {
  closeUpsell,
  getUpsellOpen,
  openUpsell,
  subscribeUpsell,
} from "./upsellStore";

afterEach(() => {
  closeUpsell(); // restore the module singleton between tests
});

it("starts closed", () => {
  expect(getUpsellOpen()).toBe(false);
});

it("openUpsell flips the flag and notifies subscribers", () => {
  const fn = vi.fn();
  const unsub = subscribeUpsell(fn);
  openUpsell();
  expect(getUpsellOpen()).toBe(true);
  expect(fn).toHaveBeenCalledTimes(1);
  unsub();
});

it("openUpsell is a no-op (no extra notify) when already open", () => {
  const fn = vi.fn();
  const unsub = subscribeUpsell(fn);
  openUpsell();
  openUpsell();
  expect(fn).toHaveBeenCalledTimes(1);
  unsub();
});

it("closeUpsell flips back and notifies; is a no-op when already closed", () => {
  openUpsell();
  const fn = vi.fn();
  const unsub = subscribeUpsell(fn);
  closeUpsell();
  expect(getUpsellOpen()).toBe(false);
  expect(fn).toHaveBeenCalledTimes(1);
  closeUpsell(); // already closed — no extra notify
  expect(fn).toHaveBeenCalledTimes(1);
  unsub();
});

it("unsubscribed listeners stop receiving updates", () => {
  const fn = vi.fn();
  const unsub = subscribeUpsell(fn);
  unsub();
  openUpsell();
  expect(fn).not.toHaveBeenCalled();
});
