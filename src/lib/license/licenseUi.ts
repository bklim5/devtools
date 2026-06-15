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
      a.maskedKey === b.maskedKey &&
      a.email === b.email &&
      a.entitlements.length === b.entitlements.length &&
      a.entitlements.every((e, i) => e === b.entitlements[i])
    );
  }
  // offlineGrace carries the same payload shape as licensed (D-73/D-89:
  // maskedKey + email too).
  if (a.state === "offlineGrace" && b.state === "offlineGrace") {
    return (
      a.expiry === b.expiry &&
      a.maskedKey === b.maskedKey &&
      a.email === b.email &&
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
 *  Tauri-impl swap (the prefs split-brain lesson).
 *
 *  KEYCHAIN-FREE (T-19-10, codex finding 2): uses the `status()` seam, which
 *  leaves `maskedKey` null on a licensed launch — so the startup refresh
 *  (main.tsx) and the footer/upsell-panel refresh never prompt the Keychain.
 *  The license settings route uses `refreshLicenseUiDetailed()` for the key. */
export async function refreshLicenseUi(): Promise<void> {
  await refresh(false);
}

/** ROUTE-ONLY refresh (D-89): like `refreshLicenseUi()` but reads the masked
 *  key via the `statusDetail()` seam. Called ONLY from the user-initiated
 *  license settings route — the ONLY licensed path allowed to read the Keychain
 *  (LIC-04: only the masked form crosses to JS). */
export async function refreshLicenseUiDetailed(): Promise<void> {
  await refresh(true);
}

/** Carry the masked key + email forward from `current` into an incoming
 *  NON-DETAILED payload (Phase 22.1 bug fix). The keychain-free `status()` seam
 *  resolves maskedKey/email as null for a licensed machine (T-19-10), so a plain
 *  refreshLicenseUi() (footer/panel/startup) would otherwise BLANK the values a
 *  prior route `statusDetail()` read populated — making the License key vanish on
 *  the licensed route. When the incoming payload is the SAME Pro-active state
 *  (licensed/offlineGrace) and `current` already holds those values, keep them:
 *  a keychain-free refresh never DOWNGRADES a value to null. A user-initiated
 *  detailed read (statusDetail) is authoritative and is never passed through here. */
function carryForwardKeyEmail(
  next: LicenseStatusPayload,
  cur: LicenseStatusPayload,
): LicenseStatusPayload {
  if (
    (next.state === "licensed" && cur.state === "licensed") ||
    (next.state === "offlineGrace" && cur.state === "offlineGrace")
  ) {
    return {
      ...next,
      maskedKey: next.maskedKey ?? cur.maskedKey,
      email: next.email ?? cur.email,
    };
  }
  return next;
}

async function refresh(detailed: boolean): Promise<void> {
  await initPlatform();
  // The detailed (route) read is authoritative — it reads the Keychain on a
  // user action, so its key/email replace whatever is stored. A non-detailed
  // read is keychain-free and must never downgrade a populated key/email to
  // null (carry the current values forward when the Pro-active state is unchanged).
  const fetched = detailed
    ? await platform.license.statusDetail()
    : await platform.license.status();
  const next = detailed ? fetched : carryForwardKeyEmail(fetched, current);
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
