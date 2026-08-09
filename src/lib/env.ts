// THE build-environment predicate every test/dev-only seam gates on.
//
// One definition, not five: this exact four-line function had been copy-pasted
// into src/lib/platform/index.ts, src/lib/license/licenseUi.ts,
// src/lib/entitlements/store.ts, src/shell/prefsStore.ts and
// src/shell/reviewPrompt.ts. Five copies of a SECURITY gate is five places for
// one to drift open, so it lives here and they import it.
//
// This module imports nothing, so it can be imported from ANY layer (shell,
// lib, appstore-only modules) without dragging a subtree into a chunk graph —
// which is why the appstore-only src/shell/reviewPrompt.ts may safely use it.

/** True under vitest or a dev build — never in a production bundle.
 *
 *  `import.meta.env` is defined by Vite/vitest: MODE is "test" under vitest,
 *  "development" under `vite dev`, and "production" in the shipped bundle. The
 *  optional chaining keeps it safe in a plain-node context where `import.meta`
 *  carries no `env` at all. */
export function isTestOrDev(): boolean {
  const env = (import.meta as { env?: { MODE?: string; DEV?: boolean } }).env;
  return env?.MODE === "test" || env?.DEV === true;
}
