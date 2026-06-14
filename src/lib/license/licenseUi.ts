// License-status snapshot store (LIC-01/06, D-43/D-44) — the ONE source the
// footer hint and the upsell panel both read, mirroring the entitlements
// snapshot-store pattern (src/lib/entitlements/store.ts) so consumers go
// through useSyncExternalStore and a flip propagates everywhere at once.
//
// refreshLicenseUi() is PURE-LOCAL (D-45): platform.license.status() is a file
// read + Ed25519 verify inside Rust — it never touches the network, so calling
// it at startup (main.tsx) and on panel mount is launch-safe under the v1.6
// "never per-launch network" amendment. The phase's only network call is the
// user-initiated activate, which lives in the panel, not here.

import {
  initPlatform,
  platform,
  type LicenseStatusPayload,
} from "@/lib/platform";

/** The pre-resolution default — matches the Rust payload for a machine with no
 *  machine.lic and no stored key, so a fresh install never flashes a state. */
function defaultSnapshot(): LicenseStatusPayload {
  return { state: "notActivated", hasStoredKey: false };
}

let current: LicenseStatusPayload = defaultSnapshot();
const listeners = new Set<() => void>();

/** Structural equality over the payload union — the change-detection
 *  short-circuit so a no-op refresh never re-renders every consumer. */
function payloadsEqual(
  a: LicenseStatusPayload,
  b: LicenseStatusPayload,
): boolean {
  if (a.state !== b.state) return false;
  if (a.state === "notActivated" && b.state === "notActivated") {
    return a.hasStoredKey === b.hasStoredKey;
  }
  if (a.state === "licensed" && b.state === "licensed") {
    return (
      a.expiry === b.expiry &&
      a.entitlements.length === b.entitlements.length &&
      a.entitlements.every((e, i) => e === b.entitlements[i])
    );
  }
  // offlineGrace carries the same payload shape as licensed (D-73).
  if (a.state === "offlineGrace" && b.state === "offlineGrace") {
    return (
      a.expiry === b.expiry &&
      a.entitlements.length === b.entitlements.length &&
      a.entitlements.every((e, i) => e === b.entitlements[i])
    );
  }
  // refreshNeeded compares hasStoredKey, like notActivated.
  if (a.state === "refreshNeeded" && b.state === "refreshNeeded") {
    return a.hasStoredKey === b.hasStoredKey;
  }
  if (a.state === "problem" && b.state === "problem") {
    return a.problem === b.problem && a.hasStoredKey === b.hasStoredKey;
  }
  return false;
}

function notify(): void {
  for (const fn of listeners) fn();
}

export function getLicenseUiSnapshot(): LicenseStatusPayload {
  return current;
}

export function subscribeLicenseUi(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Re-query platform.license.status() (LOCAL file read + verify only — zero
 *  network, D-45) and propagate to subscribers ONLY when the payload actually
 *  changed. Awaits initPlatform() so the read can never race the seam's lazy
 *  Tauri-impl swap (the prefs split-brain lesson). */
export async function refreshLicenseUi(): Promise<void> {
  await initPlatform();
  const next = await platform.license.status();
  if (payloadsEqual(next, current)) return;
  current = next;
  notify();
}

/** True under vitest or a dev build — never in a production bundle. Same guard
 *  as setPlatformForTest (src/lib/platform/index.ts). */
function isTestOrDev(): boolean {
  const env = (import.meta as { env?: { MODE?: string; DEV?: boolean } }).env;
  return env?.MODE === "test" || env?.DEV === true;
}

/** Test seam: force a specific snapshot and notify. No-op in production. */
export function setLicenseUiForTest(payload: LicenseStatusPayload): void {
  if (!isTestOrDev()) return;
  if (payloadsEqual(payload, current)) return;
  current = payload;
  notify();
}

/** Test cleanup: restore the default snapshot and notify. No-op in production. */
export function resetLicenseUiForTest(): void {
  if (!isTestOrDev()) return;
  const next = defaultSnapshot();
  if (payloadsEqual(next, current)) return;
  current = next;
  notify();
}
