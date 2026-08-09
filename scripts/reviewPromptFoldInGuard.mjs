// scripts/reviewPromptFoldInGuard.mjs
// SINGLE source of truth for the UP5-03 direct-build fold-in guard. Imported by
// BOTH vite.config.ts (the production DIRECT-build plugin) AND
// scripts/reviewPromptFoldInGuard.selftest.mjs, so the self-test exercises the
// EXACT production guard (same regex, same emitFile, same throw) — a divergent
// test guard is impossible by construction. The shared mechanism (chunk.modules
// inventory + sentinel + throw) lives in scripts/lib/chunkModuleGuard.mjs; this
// file is the UP5-03 POLICY: which modules, which sentinel, which message.
//
// THE INVERSION. scripts/licenseUiFoldInGuard.mjs runs on the APPSTORE build to
// keep the Keygen licence UI (and the direct-only updater subtree) OUT of the
// store bundle. This guard is its mirror image: it runs on the DIRECT build to
// keep the App Store review prompt OUT of the direct bundle — same factory,
// opposite channel.
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
import { makeChunkModuleGuard } from "./lib/chunkModuleGuard.mjs";

export const REVIEW_PROMPT_MODULES = [/src\/shell\/reviewPrompt\.[tj]sx?$/];

/** The emitted sentinel — asserted by the direct release preflight
 *  (scripts/build-and-publish.mjs), which FAILS if it is missing or dirty. */
export const REVIEW_PROMPT_SENTINEL = "reviewprompt-inventory.json";

export function reviewPromptFoldInGuard() {
  return makeChunkModuleGuard({
    name: "direct-reviewprompt-foldin-guard",
    sentinelFile: REVIEW_PROMPT_SENTINEL,
    // No `scopeChunks`: this module may not ship in ANY chunk of a direct build,
    // lazily loaded or not.
    groups: [
      {
        flagKey: "reviewPromptInChunks",
        hitsKey: "hits",
        patterns: REVIEW_PROMPT_MODULES,
        message: (hits) =>
          `[UP5-03] src/shell/reviewPrompt was folded into the DIRECT bundle:\n  ${hits.join("\n  ")}`,
      },
    ],
  });
}
