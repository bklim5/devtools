// storeProUpsell (MAS-IAP-07, Phase 28-04, D-02/D-14) — the store-build upsell
// router. Unlike the Keygen proUpsell (which branches on the license state to
// route a lapsed/problem paying customer to the recovery form), the store build
// has NO Keygen license states, so EVERY not-Pro trigger opens the SAME StoreKit
// Buy/Restore upsell surface. These tests pin: (1) unconditional openUpsell, (2)
// invoker passthrough, (3) no Keygen recovery-path import.
import { afterEach, describe, expect, it, vi } from "vitest";

const openUpsellSpy = vi.fn();
vi.mock("./upsellStore", () => ({
  openUpsell: (el?: HTMLElement | null) => openUpsellSpy(el),
}));

// The Keygen recovery path. If storeProUpsell ever imported these, mounting the
// router would pull them in; the store router must NEVER reach them (it has no
// recovery branch — D-02/D-14). Spying here proves the recovery surface is never
// invoked for any not-Pro trigger.
const openSettingsSpy = vi.fn();
vi.mock("./settingsStore", () => ({
  openSettings: (...args: unknown[]) => openSettingsSpy(...args),
}));
const getLicenseUiSnapshotSpy = vi.fn(() => ({ state: "notActivated" }));
vi.mock("@/lib/license/licenseUi", () => ({
  getLicenseUiSnapshot: () => getLicenseUiSnapshotSpy(),
}));

afterEach(() => {
  openUpsellSpy.mockClear();
  openSettingsSpy.mockClear();
  getLicenseUiSnapshotSpy.mockClear();
});

describe("storeProUpsell", () => {
  it("Test 1 — routes EVERY not-Pro trigger to openUpsell unconditionally", async () => {
    const { storeOpenProUpsell } = await import("./storeProUpsell");
    storeOpenProUpsell();
    expect(openUpsellSpy).toHaveBeenCalledTimes(1);
  });

  it("Test 2 — forwards the invoker element verbatim (return-focus contract)", async () => {
    const { storeOpenProUpsell } = await import("./storeProUpsell");
    const el = { tagName: "BUTTON" } as unknown as HTMLElement;
    storeOpenProUpsell(el);
    expect(openUpsellSpy).toHaveBeenCalledWith(el);
  });

  it("Test 3 — never touches the Keygen recovery path (no openSettings / license snapshot)", async () => {
    const { storeOpenProUpsell } = await import("./storeProUpsell");
    const el = { tagName: "BUTTON" } as unknown as HTMLElement;
    // Drive it for the genuinely-free trigger AND with an invoker — under BOTH,
    // the store router must route ONLY to openUpsell, never the recovery surface,
    // and must never read the license state (there is no branch on it).
    storeOpenProUpsell();
    storeOpenProUpsell(el);
    expect(openUpsellSpy).toHaveBeenCalledTimes(2);
    expect(openSettingsSpy).not.toHaveBeenCalled();
    expect(getLicenseUiSnapshotSpy).not.toHaveBeenCalled();
  });
});
