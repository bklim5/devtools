// scripts/reviewPromptFoldInGuard.mjs
// SINGLE source of truth for the UP5-03 direct-build fold-in guard. Imported by
// BOTH vite.config.ts (the production DIRECT-build plugin) AND
// scripts/reviewPromptFoldInGuard.selftest.mjs, so the self-test exercises the
// EXACT production guard (same regex, same emitFile, same throw) — a divergent
// test guard is impossible by construction.
//
// THE INVERSION. scripts/licenseUiFoldInGuard.mjs runs on the APPSTORE build to
// keep the Keygen licence UI (and the direct-only updater subtree) OUT of the
// store bundle. This guard is its mirror image: it runs on the DIRECT build to
// keep the App Store review prompt OUT of the direct bundle. Same mechanism —
// inspect the REAL per-chunk module inventory (chunk.modules, the absolute module
// IDs Rollup ACTUALLY folded into each chunk), emit a load-bearing sentinel, and
// FAIL the build on any hit — opposite channel.
//
// WHY chunk.modules and not the Vite manifest: the manifest is keyed by ENTRY,
// so a reviewPrompt module statically folded into the main entry chunk still
// shows up as `src/main.tsx` while the shipped JS carries the review-prompt code
// (the same false-GREEN the D-04 guard was built to close, and the
// `keygen-compileout-d04-proof` lesson: a manifest is not a module inventory).
//
// The module-ID regex matches the RESOLVED absolute Rollup module id, which ends
// in the repo-relative path src/shell/reviewPrompt.{ts,tsx,js,jsx}. It lives ONLY
// here — vite.config.ts and the self-test reference the guard via import and
// never re-declare it.
//
// DELIBERATELY EXCLUDED — two surfaces that legitimately ship in BOTH channels
// and whose absence would be UNSATISFIABLE (adding them here would false-RED
// every real direct build):
//
//   1. src/shell/useToolSuccess.ts — the ONE shared settled-success seam that all
//      13 tools call. It ships in both channels by design; its channel gate is a
//      module-scope ternary whose DIRECT arm is an empty function
//      (`IS_APPSTORE ? () => void import("./reviewPrompt")… : () => {}`), so the
//      seam is present and inert. What must be absent is the module the appstore
//      arm imports — which is exactly what this guard asserts.
//   2. the `invoke("request_app_store_review")` literal inside the SHARED
//      src/lib/platform/tauri.ts. index.ts loads tauri.ts through ONE shared
//      dynamic import that BOTH builds evaluate, so that string rides along in
//      the direct bundle exactly as the plugin-updater / plugin-autostart
//      imports do (the accepted D-05 ride-along posture). It is inert: the
//      direct binary registers no such command, so the invoke is unreachable —
//      nothing on the direct side ever calls platform.review.request().
//
// The LOAD-BEARING direct-absence proofs are therefore four, not one:
//   (a) this chunk-module inventory (no reviewPrompt module in ANY direct chunk),
//   (b) the Rust `#[cfg(feature = "appstore")]` on src-tauri/src/review/ plus the
//       CARGO_FEATURE_APPSTORE swiftc gate in src-tauri/build.rs — checked on the
//       BUILT binary with `nm` / `otool -L` / `strings`,
//   (c) the jsdom runtime no-invoke test (useToolSuccess Test 9: three settled
//       successes on the direct channel call review.request 0 times and never
//       even EVALUATE ./reviewPrompt), and
//   (d) the real-WKWebView runtime no-invoke + prefs proof in
//       test/e2e/review-prompt.e2e.ts.
export const REVIEW_PROMPT_MODULES = [/src\/shell\/reviewPrompt\.[tj]sx?$/];

export function reviewPromptFoldInGuard() {
  return {
    name: "direct-reviewprompt-foldin-guard",
    generateBundle(_options, bundle) {
      const hits = [];
      for (const file of Object.values(bundle)) {
        if (file.type !== "chunk" || !file.modules) continue;
        for (const id of Object.keys(file.modules)) {
          if (REVIEW_PROMPT_MODULES.some((re) => re.test(id)))
            hits.push(`${file.fileName}: ${id}`);
        }
      }
      const reviewPromptInChunks = hits.length > 0;
      // Emit the load-bearing sentinel REGARDLESS of the outcome (so the verifier
      // has a POSITIVE artifact to read; a MISSING sentinel is itself a failure
      // signal, not a pass). Same contract as licenseui-inventory.json.
      this.emitFile({
        type: "asset",
        fileName: "reviewprompt-inventory.json",
        source: JSON.stringify({ reviewPromptInChunks, hits }, null, 2),
      });
      if (reviewPromptInChunks) {
        throw new Error(
          `[UP5-03] src/shell/reviewPrompt was folded into the DIRECT bundle:\n  ${hits.join("\n  ")}`,
        );
      }
    },
  };
}
