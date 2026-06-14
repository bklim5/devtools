---
created: 2026-06-14T08:30:00+0100
completed: 2026-06-14
title: Update tinkerdev.io Vercel site to showcase the product
area: marketing-site
files:
  - /Users/boonkhailim/Documents/projects/bk/playground/tinkerdev-io
---

## ✅ Completed 2026-06-14

Rebuilt `tinkerdev.io` as a real TinkerDev product site (commits `ec17166..8577b96`, pushed to `bklim5/tinkerdev` master → Vercel prod). Brand-matched dark theme (IBM Plex Sans + JetBrains Mono, app palette), hero copy "Tinker Less With Tools. Build More Software.", **real app screenshots** (Protobuf decoder + hash) in macOS window frames, value cards, two feature rows, tools grid (no hard-coded count — "more on the way"), Free/Pro section, Refund + Privacy pages (for MoR approval). `/buy` → live LS checkout; `/download/mac` is an ISR route that auto-resolves the latest release DMG from the GitHub API (better than the suggested releases-page link — the site tracks every `release:publish` with no script change). Offline messaging corrected per user: tools run locally, only license validation uses the network. Free download shown live + "also coming to the Mac App Store".

## Problem

`tinkerdev.io` (Next.js app on Vercel, `@ → 76.76.21.21`) is a generic/old landing page (last touched 2024). With Phase 20 shipping the purchase pipeline, the site should actually showcase **DevTools** — what it is, the schema-less Protobuf decoder hero, the six tools, offline/keyboard-driven pitch — and host the buy/download path.

## Scope

Repo: `/Users/boonkhailim/Documents/projects/bk/playground/tinkerdev-io` — Next.js (App Router, `app/`), Tailwind, shadcn (`components.json`), yarn. Separate repo from `devtools`.

Concrete asks:
- **Landing/marketing content** for DevTools: hero (the "paste an unknown blob → usable interpretation in <2s, offline" value prop), the Protobuf decoder as the hero feature, the six tools, screenshots/GIFs, calm/keyboard-driven positioning (match the app's brand — `devtools/design/DevTools Mockup.html` is the visual source of truth).
- **`/buy` redirect** (Phase 20 D-68): the app's Buy CTA opens `https://tinkerdev.io/buy`. Implement this as a Next.js redirect in `next.config.mjs` (`redirects()`) or a route handler that 302s to the live Lemon Squeezy checkout URL. This is the cleanest home for the redirect (the domain already lives on Vercel) — NO Cloudflare/DNS change needed. The LS checkout URL only exists after the LS store/product is created (RUNBOOK Step 5).
- **Download link** target: point at the GitHub releases the key-email references — `https://github.com/bklim5/devtools-releases/releases/latest` (confirm the actual releases repo/URL).
- Optionally a **post-purchase / "check email" page** — though D-70 uses Lemon Squeezy's own success page, so this is optional.

## Notes / constraints

- Keep the marketing site's email/SPF (Microsoft 365 — `MX → outlook`, root SPF TXT) and the Vercel `@`/`www` records intact; this is a content + redirect change, not infra.
- Brand consistency: reuse the DevTools palette/typography (IBM Plex Sans + JetBrains Mono) from `devtools/design/`.
- This is a SEPARATE project/deploy from the desktop app — no coupling to the `devtools` build/release.
- Sequencing: the `/buy` redirect needs the live LS checkout URL (Phase 20-03 ship-gate). The marketing content can be done anytime.
