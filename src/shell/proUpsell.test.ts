// @vitest-environment jsdom
// Phase 22.2: openProUpsell routes a Pro-locked action by license state — a free
// (notActivated) user gets the focused pitch modal (openUpsell); a lapsed/attention
// PAYING customer (refreshNeeded/problem) gets Settings ▸ License recovery
// (openSettings), never the sales pitch (D-44).
import { afterEach, describe, expect, it, vi } from "vitest";

const openSettingsSpy = vi.fn();
vi.mock("./settingsStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./settingsStore")>();
  return { ...actual, openSettings: (...a: unknown[]) => openSettingsSpy(...a) };
});
const openUpsellSpy = vi.fn();
vi.mock("./upsellStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./upsellStore")>();
  return { ...actual, openUpsell: (...a: unknown[]) => openUpsellSpy(...a) };
});

import { openProUpsell } from "./proUpsell";
import {
  resetLicenseUiForTest,
  setLicenseUiForTest,
} from "@/lib/license/licenseUi";

afterEach(() => {
  resetLicenseUiForTest();
  openSettingsSpy.mockClear();
  openUpsellSpy.mockClear();
});

describe("openProUpsell", () => {
  it("notActivated (genuinely free) → the focused Unlock-Pro modal, threading the invoker", () => {
    const invoker = document.createElement("button");
    setLicenseUiForTest({ state: "notActivated", hasStoredKey: false });
    openProUpsell(invoker);
    expect(openUpsellSpy).toHaveBeenCalledWith(invoker);
    expect(openSettingsSpy).not.toHaveBeenCalled();
  });

  it("refreshNeeded (lapsed paying customer) → Settings ▸ License recovery, NOT the pitch (D-44)", () => {
    const invoker = document.createElement("button");
    setLicenseUiForTest({ state: "refreshNeeded", hasStoredKey: true });
    openProUpsell(invoker);
    expect(openSettingsSpy).toHaveBeenCalledWith("license", invoker);
    expect(openUpsellSpy).not.toHaveBeenCalled();
  });

  it("problem (attention paying customer) → Settings ▸ License recovery, NOT the pitch (D-44)", () => {
    setLicenseUiForTest({ state: "problem", problem: "corrupt", hasStoredKey: false });
    openProUpsell(null);
    expect(openSettingsSpy).toHaveBeenCalledWith("license", null);
    expect(openUpsellSpy).not.toHaveBeenCalled();
  });
});
