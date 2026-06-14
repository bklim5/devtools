---
created: 2026-06-13T19:48:14+0100
title: "Send feedback" affordance in the sidebar footer (mailto:)
area: ui
files:
  - src/components/Sidebar.tsx
  - src/lib/platform/tauri.ts
  - src-tauri/capabilities/default.json
  - src/components/Sidebar.test.tsx
---

## Problem

There's no in-app way for a user to send feedback about the tool. User asked (2026-06-13, during Phase 20 Wave 1) for a small "Send feedback" affordance, and to decide placement.

**Decision captured:** sidebar **footer cluster, near/just below the Unlock Pro item** (NOT a Settings UI — no Settings surface exists yet; theme settings is itself backlog 999.3, and building a panel to host one link is over-engineering). It is **not** a 7th tool — stays OUT of the registry/tool list (registry remains the single control plane).

**Target:** `mailto:feedback@tinkerdev.io` (user chose mailto over an https feedback page "to keep things simple" — no `tinkerdev.io/feedback` page to build, hands straight to the OS mail client, fully offline, no accounts; consistent with D-71's "one user-initiated network/handoff action" posture).

## Solution (small lift — ~1–2 hrs)

Reuse the **Phase 20-01 opener seam** — `platform.opener.openUrl()` already opens any URL through `@tauri-apps/plugin-opener`, confined to `src/lib/platform/tauri.ts` (components never import `@tauri-apps/*` directly).

1. **Capability scope** — the opener capability is now narrowed to `https://tinkerdev.io/*` only (quick-task 260614-l39 / finding 7, T-20-01 — it was `https://*`). Add the `mailto:` scope as a **separate, narrow allow entry** in `src-tauri/capabilities/default.json` (the `opener:allow-open-url` `allow` array), e.g. `{ "url": "mailto:feedback@tinkerdev.io*" }` — keep it tight (only the support address, no arbitrary-scheme opening) and **never widen the existing https rule back to `https://*`/`*`**. Verify the tauri-plugin-opener scope format accepts non-https schemes.
2. **Sidebar footer row** — add a quiet, low-emphasis "Send feedback" link in `Sidebar.tsx`'s footer region near Unlock Pro (keep Unlock Pro the visually dominant CTA — feedback should not compete with the upsell). Handler: `openUrl("mailto:feedback@tinkerdev.io?subject=DevTools%20feedback")`.
3. **Tests** — unit test in `Sidebar.test.tsx` asserting the footer link calls the opener seam with the `mailto:` URL (no jsdom navigation, mirror the 20-01 `UpsellPanel.test.tsx` opener-seam assertion pattern). Optional: a one-line real-WKWebView e2e assertion (native mail-client open is a manual-walkthrough item, same as the 20-01 native browser-open).

## Constraints / notes

- Keyboard-reachable + WCAG-AA (focus state, accessible name) — the sidebar is fully keyboard-driven.
- Independent of entitlements — feedback is free-tier, always visible (unlike the gated reorder/pin rows).
- `feedback@tinkerdev.io` — confirm/route this alias (the Phase 20 infra sets up `tinkerdev.io` email routing for `alerts@`/`licenses@`; a `feedback@` forward to the user inbox would slot in there, D-65 area).
- Decoder.ts + its 19 tests untouched (unrelated).
