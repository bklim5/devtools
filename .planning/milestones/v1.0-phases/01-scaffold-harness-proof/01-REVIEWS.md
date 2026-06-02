---
phase: 1
reviewers: [codex]
reviewed_at: 2026-05-30
plans_reviewed: [01-01-PLAN.md, 01-02-PLAN.md, 01-03-PLAN.md, 01-04-PLAN.md]
note: claude skipped (self/host runtime); gemini, coderabbit, opencode not installed
---

# Cross-AI Plan Review — Phase 1 (Scaffold + Harness Proof)

Reviewer: **Codex** (gpt, via codex CLI). Independent of the GSD plan-checker.

## Codex Review

**Summary**

The plans are unusually thorough and mostly aligned with the Phase 1 intent: prove the scaffold, immutable decoder port, HashRouter, platform seam, build path, and real UI gate before real product tools. The main issue is that several acceptance checks are weaker than they claim, and a few ordering/dependency mistakes mean the phase could “pass” while not actually proving the final harness. As written, I would not execute these unchanged.

**Strengths**

- Strong traceability from requirements to plans: FND/HRN coverage is explicit and mostly complete.
- Good handling of the `registry.ts` import trap: stubbing Phase 3 tools, then registering the skeleton, is a pragmatic solution.
- Correct emphasis on HashRouter and avoiding BrowserRouter.
- Good separation of the throwaway skeleton from real Protobuf/Base64 work.
- Platform seam is introduced early and tested, which supports later native capability work.
- WebDriver fallback is preplanned instead of being discovered under deadline pressure.
- The plans repeatedly guard the decoder/tests from accidental edits, which is appropriate for the hero feature.

**Concerns**

- **[HIGH] Plan 02 and Plan 03 both modify `package.json` while claiming they can run in parallel.**  
  Plan 02 may add `@testing-library/react`/`jsdom`; Plan 03 adds `lefthook` and `prepare`. That is direct file overlap and can cause lockfile/package merge conflicts. Wave 2 is not actually conflict-free.

- **[HIGH] `react-router-dom` is never explicitly installed.**  
  Plan 02 ports `createHashRouter`, `Navigate`, and `RouterProvider`, but neither Plan 01 nor Plan 02 has a clear `pnpm add react-router-dom@...` step. `create-tauri-app` will not reliably include React Router.

- **[HIGH] `pnpm vite build` does not prove `firstTool = ENABLED_TOOLS[0]` is safe at runtime.**  
  The plan repeatedly says a successful build proves `firstTool.id` does not throw. Vite bundles modules; it does not necessarily execute the app/router path in the same way a browser/webview does. This needs a runtime smoke test or a targeted router import/render test.

- **[HIGH] The release-build proof is stale after Plan 04.**  
  Plan 03 builds before the WebDriver plugin is added. Plan 04 then adds a debug-only WebDriver dependency but only “cross-checks against Plan 03’s release bundle,” which proves nothing about the final code state. A final `pnpm tauri build` after Plan 04 is required.

- **[HIGH] The phase requires `human sign-off + gsd-ui-review audit`, but Plan 04 only says “ready for” the audit.**  
  The project constraints say the phase ends with human sign-off plus `gsd-ui-review`. The plan should run and record the audit, not merely prepare for it.

- **[HIGH] The fallback UI path may not work with the current platform seam.**  
  If `src/lib/platform/index.ts` always imports the Tauri implementation, the static `vite preview` fallback may fail outside Tauri when the skeleton imports `platform`. The fallback needs a browser-safe platform implementation or conditional/lazy Tauri loading.

- **[MEDIUM] The platform seam test design risks importing Tauri APIs in node/jsdom tests.**  
  `index.ts` selecting `tauriPlatform` directly can make tests brittle unless `@tauri-apps/plugin-clipboard-manager` is mocked before import or the implementation is injected lazily.

- **[MEDIUM] The WebDriver spike orchestration is underspecified.**  
  The plan says run `pnpm tauri dev` in one process and `pnpm e2e` in another, but the e2e script does not own startup, waiting for port `4445`, teardown, or failure cleanup. That is acceptable for a spike, but weak as “the UI gate driver for all later phases.”

- **[MEDIUM] WebDriver localhost binding is assumed, not enforced.**  
  Targeting `127.0.0.1:4445` from WebdriverIO does not prove the embedded server binds only to localhost. The plan should verify or force the bind address if the plugin supports it.

- **[MEDIUM] The `ToolDefinition` contract may reject `_skeleton`.**  
  If `ToolDefinition.id` is a closed union from the byte-frozen `types.ts`, adding `_skeleton` could force a forbidden type edit. The plan should explicitly verify this before committing to `_skeleton` as the id.

- **[MEDIUM] The lefthook “bad commit” proof is risky in a dirty/parallel worktree.**  
  Attempting real commits during a plan can accidentally commit unrelated changes or interfere with plan-level commits. Use `pnpm lefthook run pre-commit` with a temporary file, or isolate the proof carefully.

- **[MEDIUM] `corepack prepare pnpm@latest` undermines reproducibility.**  
  The research records a concrete pnpm version. Use that exact version and then set `packageManager`, instead of activating whatever `latest` means on execution day.

- **[LOW] ESLint/Prettier are a locked tooling decision but not implemented.**  
  D-09 says eslint + prettier, but the plans only implement tsc/vitest/lefthook. Either add them or explicitly defer them.

- **[LOW] “No CDN fonts anywhere” is narrower than the offline runtime requirement.**  
  Grepping for Google font domains is good, but the offline constraint would benefit from a broader `http://`/`https://` scan of built assets.

**Suggestions**

- Serialize Plan 03 after Plan 02, or move all dependency installation into Plan 01 so Wave 2 has no `package.json`/lockfile overlap.

- Add `react-router-dom` explicitly, preferably in Plan 01:
  ```bash
  pnpm add react-router-dom@7.16.0
  ```

- Replace the “vite build proves firstTool resolves” claim with a real check:
  - render `<RouterProvider router={router} />` in a jsdom smoke test, or
  - run the app in `tauri dev`/browser preview and assert `#/tools/bad` redirects to `#/tools/_skeleton`.

- Add a final Phase 1 release build after Plan 04:
  ```bash
  pnpm vitest run
  pnpm tsc --noEmit
  pnpm tauri build
  ```
  Then verify the WebDriver server is absent from that final release artifact.

- Make the platform seam environment-safe:
  - expose `createPlatform()` or `setPlatformForTest()`;
  - lazy-load the Tauri implementation;
  - provide a browser/static fallback for `vite preview` UI verification.

- Add an actual audit step to Plan 04:
  - run `gsd-ui-review`;
  - record findings and fixes;
  - only then request human sign-off.

- Define the WebDriver gate as a reproducible command, not a manual two-terminal recipe. At minimum add wait/teardown instructions; ideally use a small script that starts `tauri dev`, waits for `4445`, runs WDIO, and kills the child process.

- Verify the `ToolDefinition` id type before using `_skeleton`. If closed, use an existing temporary stub id or add a sanctioned temporary type workaround without touching byte-frozen files.

- For lefthook proof, avoid real commits unless the workflow guarantees isolation. Prefer:
  ```bash
  pnpm lefthook run pre-commit
  ```
  with a temporary type-error file, then delete the file and rerun clean.

- Expand offline verification:
  ```bash
  grep -rE "https?://" dist src index.html
  ```
  Then whitelist only intentional non-runtime references if any exist.

**Overall Risk Assessment: HIGH**

The architecture direction is sound, but the execution plan has several blocking correctness gaps: parallel file conflicts, a missing router dependency, runtime behavior being “proven” by build-only checks, stale release-build verification after adding WebDriver, and the required UI audit not actually being performed. These are fixable without changing the phase shape. After addressing them, I would downgrade the risk to **MEDIUM**, mostly because macOS WKWebView automation remains inherently uncertain.

---

## Consensus Summary

Single external reviewer (Codex); synthesis below reflects its findings cross-checked against the GSD plan-checker pass (which had earlier flagged & fixed the CSS-import and empty-ENABLED_TOOLS-crash issues).

### Agreed Strengths
- Strong requirement→plan traceability (FND/HRN coverage explicit).
- Pragmatic registry.ts handling (stub Phase-3 tools, register skeleton).
- HashRouter discipline; throwaway skeleton cleanly separated from real tools.
- Platform seam introduced early; WebDriver fallback pre-planned; decoder/tests guarded.

### Agreed Concerns (highest priority — feed into replan)
1. **[HIGH] react-router-dom never explicitly installed** — Plan 02 uses createHashRouter/Navigate/RouterProvider but no `pnpm add react-router-dom` step exists. Add to Plan 01.
2. **[HIGH] Wave-2 package.json conflict** — Plans 02 & 03 both edit package.json (testing-library/jsdom vs lefthook/prepare) yet claim parallel-safe. Move all dependency installs into Plan 01 (Wave 1), or serialize 03 after 02.
3. **[HIGH] build ≠ runtime proof** — `pnpm vite build` does NOT prove `firstTool = ENABLED_TOOLS[0]` is safe at module-eval. Add a jsdom render smoke test of `<RouterProvider/>` OR a real `#/tools/bad → _skeleton` redirect assertion in the running app.
4. **[HIGH] platform seam breaks the fallback path** — if `platform/index.ts` always imports the Tauri impl, the `vite preview` + chrome-devtools-mcp fallback (HRN-02) fails outside Tauri. Make the seam environment-safe: lazy-load Tauri impl + provide a browser fallback + `setPlatformForTest()`. (Also fixes the MEDIUM: jsdom tests importing Tauri APIs.)
5. **[HIGH] stale release-build proof** — Plan 03 runs `tauri build` BEFORE Plan 04 adds the (debug-only) WebDriver dep. Add a FINAL `pnpm tauri build` after Plan 04 and verify the WebDriver server is absent from the release artifact.
6. **[HIGH] gsd-ui-review audit not actually run** — phase constraint requires human sign-off + gsd-ui-review; Plan 04 only says 'ready for'. Make Plan 04 actually run/record the audit, then sign-off.

### Medium / Low (address in replan where cheap)
- [MED] WebDriver spike orchestration underspecified → make it a reproducible script (start tauri dev, wait for :4445, run WDIO, teardown), not a two-terminal recipe — it's the future UI-gate driver.
- [MED] Verify `ToolDefinition.id` is not a closed union before using `_skeleton` (else it forces a forbidden types.ts edit).
- [MED] lefthook 'bad commit' proof: use `pnpm lefthook run pre-commit` on a temp file instead of real commits (avoids dirty-worktree contamination).
- [MED] Pin exact pnpm version + set `packageManager` rather than `corepack prepare pnpm@latest` (reproducibility).
- [LOW] D-09 eslint+prettier locked but unscheduled — add or explicitly defer (GSD plan-checker also noted this).
- [LOW] Broaden offline check from Google-fonts grep to `grep -rE 'https?://' dist src index.html` with an allowlist.

### Divergent Views
None — single external reviewer. Codex's overall risk: **HIGH** as written, downgradable to **MEDIUM** after the 6 HIGH fixes (residual = inherent macOS WKWebView automation uncertainty, which the time-boxed spike + fallback already account for).
