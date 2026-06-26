# TinkerDev — App Store listing copy

Version-tracked source for the App Store Connect listing metadata. Paste into ASC (this is metadata only — no code, no build). See `SUBMISSION-RUNBOOK.md` for the full submission flow and `screenshots/` for the image set.

## Where each field goes in ASC

- **Name, Subtitle** → **App Information** page (Distribution tab → *App Information* in the left rail → "Localizable Information").
- **Promotional Text, Description, Keywords, Support URL, Marketing URL** → the **version page** (Distribution tab → select the version, e.g. *"1.0.0 — Prepare for Submission"*, in the left rail → "English (U.S.)" localized section).

## Name (App Information)

```
TinkerDev - Dev Toolbox
```

## Subtitle (App Information · ≤30 chars)

Recommended:
```
Schema-less protobuf decoder
```
Alternatives (≤30): `Protobuf, JSON, JWT & more` (26) · `Protobuf decoder, offline` (25) · `Offline protobuf & dev tools` (28)

## Description (version page)

```
TinkerDev is a fast, offline, keyboard-driven toolbox for the messy bytes developers actually deal with.

Paste an unknown Protobuf blob and get a readable, explorable field tree in under two seconds — no .proto schema required. Wire types, lengths, nested messages, and repeated fields are decoded and laid out as cards or rows you can scan and copy.

Beyond the schema-less Protobuf decoder, TinkerDev bundles the transforms you reach for every day:
• JWT — decode header and payload
• Base64 / Hex
• Hashing — MD5, SHA-1, SHA-256/384/512
• JSON & XML — format and minify
• URL — parse, encode and decode
• UUID / ULID — generate and inspect
• Unix time — convert timestamps
• Regex — test patterns live
• Cron — read expressions in plain English

Everything runs 100% offline. No account, no login, no setup, no telemetry — nothing you paste ever leaves your Mac (App Privacy: Data Not Collected). Jump to any tool from the ⌘K command palette.

TinkerDev is free. A one-time Pro purchase (no subscription) unlocks custom themes and sidebar reordering and pinning — and helps fund what's next.
```

## Keywords (version page · 100-char field, comma-separated, NO spaces)

```
json,jwt,base64,hex,hash,sha256,uuid,ulid,regex,cron,timestamp,xml,url,encode,offline,developer
```
95 chars. Apple indexes Name + Subtitle + Keywords together — **dedupe** against the chosen subtitle:
- Subtitle "Schema-less protobuf decoder" → keep as-is (no overlap; `protobuf` is already in the subtitle).
- Subtitle "Protobuf, JSON, JWT & more" → drop `json,jwt`, add e.g. `decode,formatter`.

## URLs

- Support URL: `https://www.tinkerdev.io/support`
- Marketing URL (optional): `https://www.tinkerdev.io`
- Privacy Policy URL (App Information): `https://www.tinkerdev.io/privacy`

(Use the `www.` form — the apex redirects, and some ASC validators reject redirects.)
