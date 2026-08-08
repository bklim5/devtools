# Phase 22 — walkthrough follow-ups + remaining finalization

**22-03 human-verify checkpoint: APPROVED** (2026-06-15, native menu/tray walkthrough — app menu ⌘, + tray Settings… open the modal; Edit menu Copy/Paste/Undo/Quit intact; focus-return + upsell-stacking + native summon all good). Two follow-up comments below; neither blocked approval.

## Remaining finalization (do first, fresh session)
1. Write `22-03-SUMMARY.md`; mark SET-01/SET-02 complete in REQUIREMENTS traceability; update ROADMAP plan-progress (22-03 done) + STATE.
2. Run the phase goal-verifier (gsd-verifier) → `22-VERIFICATION.md`.
3. Persist any human-verify residue; mark Phase 22 complete in ROADMAP/STATE (it's the first v1.7 phase; v1.6 close still parked separately).
4. Run the harness gate before any passback (now a standing rule — [[always-run-harness-gate-before-passback]]).

## Follow-up 1 (BUG, small) — app menu shows "devtools-app" not "TinkerDev"
The macOS app menu (built in `src-tauri/src/lib.rs` via `set_menu()`) shows **"About devtools-app" / "Hide devtools-app" / "Quit devtools-app"** and the bold app-menu title is the binary name `devtools-app`, instead of the product name **TinkerDev**. The tray ("Show TinkerDev") is already correct.
- **Root cause:** the App submenu title + the `PredefinedMenuItem` about/hide/quit labels derive from the executable name (`devtools-app`, the Cargo bin name) rather than `productName: "TinkerDev"` in `tauri.conf.json`.
- **Fix:** in the `set_menu` App submenu, set the title to "TinkerDev" and give the predefined items explicit text ("About TinkerDev" / "Hide TinkerDev" / "Quit TinkerDev") OR set the app name Tauri uses for predefined-item labels to the product name. Verify the exact Tauri 2.11.2 API (PredefinedMenuItem::about/hide/quit accept optional text; SubmenuBuilder title). Native change → rebuild + manual re-verify (the menu labels).

## Follow-up 2 (DESIGN, revises SET-06) — inline upsell/activation in the License pane
Currently the Settings ▸ License pane (free/`notActivated`) shows "Free" + an **"Activate a license"** button that opens the shared `UpsellModal` STACKED on top of the Settings modal (modal-on-modal). User (and I) prefer the **upsell + activation content rendered INLINE in the License pane**: the "Thank you for using TinkerDev ❤️" copy + **Buy license** CTA + **license-key input field + Activate** directly in the pane, no second modal. (Same likely applies to `problem`/`refreshNeeded` Reactivate.)
- **Impact:** revises **SET-06** ("LicenseSettings reused unchanged") and D-S6/D-S11 (which route free-tier/attention to `openUpsell`). Approach: extract the upsell/activation surface (today inside `UpsellPanel.tsx`'s modal) into a shared **content** component used BOTH by the standalone `UpsellModal` (sidebar "Unlock Pro" / ⌘K free-tier) AND inline inside the License pane (`settingsPanes` License pane renders it for the not-Pro states). Keep WCAG-AA; the standalone modal stays for the non-Settings entry points.
- **Scope:** a focused Phase-22 follow-up task (or 22.1) — needs a small decision on whether the standalone upsell modal still exists for sidebar/⌘K free-tier entries (likely yes) while the License pane shows it inline. Not a blocker for closing Phase 22's core; can be a gap-closure plan.

## Status at handoff
- HEAD `977fd00c`; tree clean. Harness gate fully run on 22-03 (codex 3 findings fixed, vitest 967, cargo 82, e2e 20/20, rebuilt 16:30, decoder untouched).
- Tasks 22-01/22-02 complete (SUMMARYs written). 22-03 code complete + approved; SUMMARY/verify/roadmap-complete pending (item 1 above).
