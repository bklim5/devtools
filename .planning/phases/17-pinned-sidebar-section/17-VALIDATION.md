---
phase: 17
slug: pinned-sidebar-section
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-05
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `17-RESEARCH.md` → Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (jsdom for component/hook tests) + WebdriverIO e2e on the real WKWebView |
| **Config file** | `vitest.config.*` (existing); `wdio.conf.ts` auto-discovers `./test/e2e/*.e2e.ts` |
| **Quick run command** | `pnpm vitest run src/shell/toolOrder.test.ts src/shell/prefsStore.test.ts src/shell/usePreferences.test.ts` |
| **Full suite command** | `pnpm vitest run && pnpm exec tsc --noEmit && pnpm exec eslint .` |
| **Real-WKWebView gate** | `scripts/e2e-spike.sh` (starts `tauri dev --features webdriver`, runs `pnpm e2e`) |
| **Estimated runtime** | unit ~3–5s · full suite ~15–30s · e2e ~60–120s |

---

## Sampling Rate

- **After every task commit:** Run the quick unit command above + `tsc --noEmit` + `eslint` on touched files (lefthook enforces green — no RED-only commits, per project MEMORY).
- **After every plan wave / plan boundary:** Run the full suite. **The 19 decoder tests MUST stay green, byte-for-byte untouched.**
- **Before `/gsd-verify-work` / phase gate:** `scripts/e2e-spike.sh` green on the real WKWebView, then `pnpm tauri build` + `gsd-ui-review` WCAG-AA audit + human walkthrough sign-off.
- **Max feedback latency:** ~30 seconds (unit + tsc + eslint); e2e is a wave/phase-boundary gate, not per-task.

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | File | Status |
|-----|----------|-----------|-------------------|------|--------|
| PIN-07 | `pinnedToolIds` persists round-trip; `setPinnedToolIds`/`togglePinned` append-on-pin + unpin | unit (hook) | `pnpm vitest run src/shell/usePreferences.test.ts` | `usePreferences.test.ts` (ADD) | ⬜ pending |
| PIN-07 | `coercePinnedToolIds` drops junk, de-dupes, non-array→[] (no length cap) | unit | `pnpm vitest run src/shell/prefsStore.test.ts` | `prefsStore.test.ts` (ADD) | ⬜ pending |
| PIN-08 | `partitionTools`: unknown dropped, dupes collapsed, full registry permutation (every tool once) | unit | `pnpm vitest run src/shell/toolOrder.test.ts` | `toolOrder.test.ts` (ADD matrix) | ⬜ pending |
| PIN-01/02 | pin moves to top group / unpin returns — keyboard Alt+P | e2e (keyboard) | `scripts/e2e-spike.sh` | `test/e2e/sidebar.e2e.ts` (EXTEND) | ⬜ pending |
| PIN-03 | divider/group appears iff ≥1 pinned; disappears at 0 | e2e + unit (Sidebar render) | both | e2e + optional `Sidebar.test.tsx` | ⬜ pending |
| PIN-04 | pin icon visible on hover + focus-visible (filled-pinned / outline-unpinned) | e2e (focus) + manual (hover) | `scripts/e2e-spike.sh` + walkthrough | `test/e2e/sidebar.e2e.ts` + walkthrough | ⬜ pending |
| PIN-05 | Alt+P announces "Pinned/Unpinned {name}" via `aria-live` | e2e (keyboard) | `scripts/e2e-spike.sh` | `test/e2e/sidebar.e2e.ts` | ⬜ pending |
| PIN-06 | Alt+↑/↓ reorders WITHIN each group, no cross-boundary | e2e (keyboard) + manual (pointer drag) | `scripts/e2e-spike.sh` + walkthrough | `test/e2e/sidebar.e2e.ts` + walkthrough | ⬜ pending |
| PIN-09 | "Unpin all" via Shift+F10 menu clears the set | e2e (keyboard) | `scripts/e2e-spike.sh` | `test/e2e/sidebar.e2e.ts` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### `partitionTools` immovable-bar unit matrix (PIN-08 — the spec)

Mirror `toolOrder.test.ts`. Each case asserts: `union(pinned, unpinned) === registry set`, disjoint, no dupes, lengths sum to registry length.

1. Empty pinned, empty order → `pinned: []`, `unpinned: registry` (default).
2. One pinned → that id in `pinned`, rest in `unpinned`.
3. Pinned order honored (e.g. `["c","a"]` → `pinned: ["c","a"]`).
4. Unknown pinned id dropped (`["ghost","a"]`, registry `[a,b]` → `pinned: ["a"]`).
5. Duplicate pinned id collapsed (`["a","a"]` → `pinned: ["a"]`).
6. Non-string junk in pinned dropped (`[1, "a", null]` → `pinned: ["a"]`).
7. Non-array pinned (`"nope"`/`null`) → `pinned: []`, `unpinned: registry`.
8. A pinned id also present in `toolOrder` does NOT appear in `unpinned` (no duplication across groups — the union-once bar).
9. New registry tool (absent from both prefs) appears once in `unpinned` (append, via reconcile).
10. **Property test:** for arbitrary junk pinned + junk order, `[...pinned, ...unpinned].sort()` deep-equals `[...registry].sort()` and `new Set([...pinned,...unpinned]).size === registry.length`.

---

## Wave 0 Requirements

- [ ] `src/shell/toolOrder.test.ts` — ADD `partitionTools` describe block (matrix above) — covers PIN-08.
- [ ] `src/shell/prefsStore.test.ts` — ADD `coercePinnedToolIds` cases — covers PIN-07 (untrusted layer).
- [ ] `src/shell/usePreferences.test.ts` — ADD `setPinnedToolIds`/`togglePinned` round-trip + append-on-pin + unpin cases — covers PIN-07.
- [ ] `test/e2e/sidebar.e2e.ts` — EXTEND with Alt+P pin/unpin (group membership + `aria-live`), Alt+↑/↓ within a group (no cross-boundary), "Unpin all" via Shift+F10 (set cleared), persistence across reload — covers PIN-01/02/05/06/09 keyboard paths.

*Framework install: none — all present.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Native-OS pointer drag reorder within a group | PIN-06 | WebDriver/WKWebView cannot synthesize native OS drag (`dragDropEnabled:false` from v1.4; see post-ship fix `1c2c7664`) | On the real app: grab a grip handle, drag a row up/down within the pinned group, then within the unpinned list. Confirm reorder works in each group AND a dragged row never crosses the pinned↔unpinned divider. |
| Pin icon reveal on pointer hover (unpinned rows) | PIN-04 | Hover is a pointer interaction; e2e covers `focus-visible`, walkthrough covers hover | On the real app: hover an unpinned row → outline pin appears left of grip; move away → it hides. Pinned rows show a persistent filled pin with no hover needed. |

> e2e keyboard path (Alt+P, Alt+↑/↓, Shift+F10 "Unpin all") is automated and is the primary regression net; the two rows above are the human-walkthrough complement at the phase gate.

---

## Validation Sign-Off

- [ ] All tasks have an automated verify or a Wave 0 dependency (native drag + hover are the only manual items, both justified above)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING test references
- [ ] No watch-mode flags (all `vitest run`, not `vitest`)
- [ ] Feedback latency < 30s for the per-task quick run
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
