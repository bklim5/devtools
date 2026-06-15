// Shared Settings-modal open-state store — the ONE channel that lets every
// Settings entry point (app menu ⌘, · tray · sidebar row · ⌘K · the
// #/settings/license deep-link) open the single <SettingsModal> surface (D-S1).
//
// This is a near-verbatim clone of src/shell/upsellStore.ts, extended with an
// `activePane` so the paned modal (D-S3) knows which pane to show. The modal
// mounts ONCE at the shell (App.tsx) and every opener flips this one flag —
// exactly the upsell pattern, so there is no duplicate UI and the focus-return
// fix (sync invoker capture) is inherited unchanged.
//
// D-S2 invoker capture: the modal mounts a tick AFTER the opener's click handler
// runs; reading document.activeElement inside the modal's mount effect is fragile
// across that gap. So the invoker is captured SYNCHRONOUSLY here, at
// openSettings() time. Transient openers (⌘K command, tray/menu event, the
// deep-link element which unmounts immediately) pass an EXPLICIT persistent
// return target (e.g. the pre-palette focus or document.body) so focus returns to
// a still-connected element, never <body> becoming detached.
//
// This is open-state ONLY — no entitlement logic, no copy. The modal owns
// Esc/scrim/× dismiss + focus trap/return (SettingsModal); closing is routed here
// so the shell mount stays a pure projection of this state.

let open = false;
let invoker: HTMLElement | null = null;
let activePane = "license"; // default + only pane this phase (D-S3)
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

export function getSettingsOpen(): boolean {
  return open;
}

export function subscribeSettings(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** The element to return focus to on close — captured synchronously at
 *  openSettings() time (the trigger is still focused inside its click handler). */
export function getSettingsInvoker(): HTMLElement | null {
  return invoker;
}

/** The active pane id (drives the left-nav selection + the right content). */
export function getActivePane(): string {
  return activePane;
}

/** Switch the active pane and notify (used by the modal's arrow/Home/End nav).
 *  No-op if unchanged so the subscribers are not churned needlessly. */
export function setActivePane(pane: string): void {
  if (activePane === pane) return;
  activePane = pane;
  notify();
}

/** Open the Settings modal on `pane` (no-op if already open — does NOT overwrite
 *  the active pane or invoker). Records the element focus should return to on
 *  close.
 *
 *  Most openers (a persistent footer/sidebar button) are focused when their
 *  click handler runs, so the default capture of `document.activeElement` is the
 *  right return target. TRANSIENT openers (the ⌘K command, the native menu/tray
 *  event, the deep-link element) unmount before/while opening, so they pass an
 *  EXPLICIT `invokerEl` (a persistent element that survives the close, e.g. the
 *  pre-palette focus or document.body) used verbatim. */
export function openSettings(
  pane = "license",
  invokerEl?: HTMLElement | null,
): void {
  if (open) return;
  activePane = pane;
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

/** Close the Settings modal (no-op if already closed). Clears the invoker and
 *  resets the active pane to the default. The modal restores focus to the
 *  captured invoker before this clears it. */
export function closeSettings(): void {
  if (!open) return;
  open = false;
  invoker = null;
  activePane = "license";
  notify();
}
