---
phase: 16
slug: reorderable-sidebar-tool-list
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-05
---

# Phase 16 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Reorderable sidebar tool list. ASVS Level 1 — local-only, offline desktop app; no network, auth, or secrets at runtime. The only untrusted input is the hand-editable `toolOrder` field in the on-disk prefs blob.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| prefs.json (on disk) → app load | `toolOrder` is read from a user-writable/hand-editable preferences blob — untrusted input crosses here. | `toolOrder: string[]` (tool-id list, low sensitivity) |
| persisted `toolOrder` → Sidebar render | The saved order reaches the render/overlay; reconciled before use. | tool-id strings → render order |
| tool IDs/names → DOM + aria-live text | Registry-controlled strings flow into rendered markup and the live-region announcement. | `tool.name` / `tool.id` → DOM text |
| drag/keyboard events → reorder mutation | User input drives `moveToolInOrder` + `setToolOrder` writes. | reorder intent → pref overlay write |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-16-01 | Tampering | `mergePreferences` reading `toolOrder` from prefs.json | mitigate | `coerceToolOrder` (`src/shell/prefsStore.ts:71-82`) — non-array → `[]`, drops non-strings, de-dupes via `seen` Set, no throw; wired at `prefsStore.ts:96` | closed |
| T-16-02 | Denial of Service | Oversized/duplicate-stuffed `toolOrder` | mitigate | `reconcileToolOrder` (`src/shell/toolOrder.ts:19-43`) gates each id against `new Set(registryIds)`; output bounded by registry (11 tools), duplicates collapse via `emitted` Set | closed |
| T-16-03 | Tampering | `toolOrder` referencing unknown/removed IDs | mitigate | `reconcileToolOrder` drops ids absent from registry (`toolOrder.ts:30` `if (!known.has(id)) continue;`); output always a registry permutation — no phantom tool renders/routes (D-11) | closed |
| T-16-04 | Injection | tool IDs flowing toward DOM/aria-live text | accept (Plan 01, no DOM) / mitigate (Plan 02) | Plan 01 is pure (no React/DOM import); ids stay opaque strings. Plan 02 aria-live uses registry `tool.name`, not raw stored input — see T-16-06 | closed |
| T-16-05 | Tampering | Sidebar render of tampered/oversized `toolOrder` | mitigate | Render routes through `reconcileToolOrder` (`src/components/Sidebar.tsx:40-41`); rows from `orderedIds.map` with defensive `if (!tool) return null` (`Sidebar.tsx:340`); bounded/de-duped/unknown-dropped per T-16-02/03 | closed |
| T-16-06 | Injection (XSS) | tool name/id into DOM + `aria-live` text | mitigate | No `dangerouslySetInnerHTML` in Sidebar; name rendered as escaped JSX text (`Sidebar.tsx:399`); aria-live message built from registry `tool.name` via `getToolById(id)` in `announceMove` (`Sidebar.tsx:100-108`), never raw stored id | closed |
| T-16-07 | Elevation / Scope creep | drag/keyboard mutating the registry or router | mitigate | Reorder only calls `setToolOrder(next)` (pref overlay) on drop/Alt-arrow/reset (`Sidebar.tsx:115, 293-296`); `ENABLED_TOOLS`/⌘K palette/router never mutated (D-10); `setToolOrder` writes only `{ toolOrder }` (`usePreferences.ts:83-86`) | closed |
| T-16-08 | Denial of Service | rapid drag/key spam writing prefs | accept | Each move is a single bounded `setToolOrder` (write-on-change, one `savePreferences` per `update` — `usePreferences.ts:69-75`); blob ≤ registry size (bounded by T-16-02); local-only, no network | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-16-01 | T-16-04 (Plan 01 portion) | Tool IDs in `toolOrder` are registry-controlled identifiers, not free-text user input, and Plan 01 has no DOM surface (pure `toolOrder.ts`). Coercion keeps them as opaque strings; the only DOM/aria consumer (Plan 02) renders the registry `tool.name`, not the raw stored id. No injection surface. | BK Lim | 2026-06-05 |
| AR-16-02 | T-16-08 | Reorder writes are single, bounded `setToolOrder` calls (write-on-change), the blob can hold at most the registry's worth of ids (≤11), and the app is local-only with no network. Rapid drag/key spam cannot cause unbounded growth or remote impact. | BK Lim | 2026-06-05 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-05 | 8 | 8 | 0 | gsd-security-auditor (verified mitigations in code, cited file:line) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-05
