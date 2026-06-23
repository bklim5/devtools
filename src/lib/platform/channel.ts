// The build-variant channel constant (D-07, MAS-BUILD-01). Derived from
// VITE_CHANNEL, bound in the package.json appstore build script (D-08) so the
// frontend channel can never desync from the native cargo flags. Mirrors the
// `import.meta.env.DEV` static-tree-shaking idiom (resolve.ts): Vite inlines
// `import.meta.env.VITE_CHANNEL` at build time, so `IS_APPSTORE` is a static
// boolean — the direct bundle tree-shakes every `if (IS_APPSTORE)` branch out,
// the appstore bundle bakes it in. This is the SINGLE import point Phase 28
// uses to gate the store License pane / upsell flows / Updates pane.
//
// `src/lib/platform/` is the only allowed Tauri-boundary module (project
// constraint) — the channel constant belongs here, never as scattered inline
// `import.meta.env.VITE_CHANNEL === "appstore"` checks across the codebase.
export const IS_APPSTORE: boolean =
  import.meta.env.VITE_CHANNEL === "appstore";
