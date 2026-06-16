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
// owns Esc/scrim dismiss + focus trap/return (UpsellModal, Plan 01); the
// upsell COPY lives in UpsellPanel (D-19). Closing is also routed here so the
// shell mount stays a pure projection of this flag.
//
// 21-04 FLAG E1 — focus-return-to-invoker via the store path. The modal mounts
// ONCE at the shell and is decoupled from the trigger (openUpsell flips a flag;
// the modal mounts a tick later). Relying on document.activeElement INSIDE the
// modal's mount effect is fragile across that gap (any focus churn between the
// click and the mount commit loses the invoker). So we capture the invoker
// SYNCHRONOUSLY here, at openUpsell() time — the exact moment the trigger's
// click handler runs and it is still the focused element — and hand it to the
// modal to restore on close. The modal still falls back to its own capture when
// no invoker was recorded (e.g. a keyboard chord with focus already elsewhere).

let open = false;
let invoker: HTMLElement | null = null;
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

/** The element to return focus to on close — captured synchronously at
 *  openUpsell() time (the trigger is still focused inside its click handler). */
export function getUpsellInvoker(): HTMLElement | null {
  return invoker;
}

/** Open the shared Unlock Pro upsell modal (no-op if already open). Records the
 *  element focus should return to on close — for ALL openers (footer, ⌘K
 *  License, LicenseSettings Reactivate/Activate, Sidebar reset menu).
 *
 *  Most openers (a persistent footer/route button) are focused when their click
 *  handler runs, so the default capture of `document.activeElement` is the right
 *  return target. But TRANSIENT openers — the ⌘K palette command and the Sidebar
 *  reset MENU item — unmount before/while opening, so their captured element is
 *  about to detach (codex finding 3). Those callers pass an EXPLICIT `invokerEl`
 *  (a persistent element that survives the close, e.g. the pre-palette focus or
 *  the sidebar row) so focus returns to a still-connected control, not <body>. */
export function openUpsell(invokerEl?: HTMLElement | null): void {
  if (open) return;
  if (invokerEl !== undefined) {
    // Explicit return target from a transient opener — use it verbatim.
    invoker = invokerEl;
  } else {
    // Default: the currently-focused (persistent) opener. Guard the DOM read so
    // the store stays importable/testable in the node env (vite.config default)
    // where `document`/`HTMLElement` are absent.
    const active =
      typeof document === "undefined" ? null : document.activeElement;
    invoker =
      typeof HTMLElement !== "undefined" && active instanceof HTMLElement
        ? active
        : null;
  }
  open = true;
  notify();
}

/** Close the shared upsell modal (no-op if already closed). The modal restores
 *  focus to the captured invoker before this clears it. */
export function closeUpsell(): void {
  if (!open) return;
  open = false;
  invoker = null;
  notify();
}
