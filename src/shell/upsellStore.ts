// Shared "Unlock Pro" upsell-modal open-state store — the ONE channel that lets
// any app-level affordance open the single UpsellModal surface (D-28/D-29).
//
// The modal was previously Sidebar-local state, so only the sidebar footer +
// locked customization affordances could open it. The ⌘K palette's free-tier
// "License" command needs the SAME surface (walkthrough 21-04 fix: a free-tier
// navigate("/") was a silent no-op when already on "/"). Lifting the boolean to
// a tiny module store — mirroring src/lib/license/licenseUi.ts and
// src/lib/entitlements/store.ts (useSyncExternalStore over a module singleton)
// — keeps it a single shared surface with no duplicate UI: the modal mounts
// ONCE at the shell (App.tsx) and every opener flips this one flag.
//
// This is open-state ONLY — no entitlement logic, no copy. The modal itself
// owns Esc/scrim dismiss + focus capture/return (UpsellModal, Plan 01); the
// upsell COPY lives in UpsellPanel (D-19). Closing is also routed here so the
// shell mount stays a pure projection of this flag.

let open = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

export function getUpsellOpen(): boolean {
  return open;
}

export function subscribeUpsell(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Open the shared Unlock Pro upsell modal (no-op if already open). */
export function openUpsell(): void {
  if (open) return;
  open = true;
  notify();
}

/** Close the shared upsell modal (no-op if already closed). */
export function closeUpsell(): void {
  if (!open) return;
  open = false;
  notify();
}
