# TinkerDev — Mac App Store Screenshots (spec + staging) (D-05)

*This directory stages the App Store screenshots. The PNGs are **captured by the human during the ship-gate walkthrough** (`SUBMISSION-RUNBOOK.md` Step 4) on the running DEV-signed `.app` — they are NOT agent-generated. Drop the captured files here, then upload them in ASC (runbook Step 6).*

---

## Resolution (Apple, June 2026)

Accepted Mac screenshot sizes are **16:10, strict** — use **ONE** size category for the whole set:

- 1280 × 800
- 1440 × 900
- 2560 × 1600
- **2880 × 1800 ← capture at this tier (highest, Retina)**

**Capture at 2880 × 1800.** Count: 1–10 (Apple recommends **≥ 3**). Format: **PNG or JPG, flattened, no alpha channel.**

> A Retina (2×) macOS display screenshots a 1440 × 900 logical window at 2880 × 1800 physical pixels. If you capture on a non-Retina display, target one of the smaller tiers instead and keep the *whole set* in that single category.

## Which states to capture (≥ 3, real testable tool states)

Capture **real** tool output — no mockups. During the walkthrough:

1. **Protobuf decoder with a decoded blob** — the hero feature; show the wire-format tree with LEN chips on a real paste.
2. **JWT decode** — a decoded token showing header + payload.
3. **Settings ▸ License — Buy / Restore pane** — the Pro upsell with the live StoreKit `displayPrice`, the "Buy Pro — Lifetime" + "Restore Purchases" buttons. **This same shot doubles as the IAP review screenshot** required by `ASC-SETUP.md §5` (the paywall in context).

Optional extras (up to 10 total): Base64/Hex converter, Hash, JSON formatter.

## Staging / placeholder filenames

Capture into this directory using these names (replace the placeholders with the real PNGs):

```
01-protobuf-decoder.png      # 2880×1800, flattened, no alpha
02-jwt-decode.png            # 2880×1800
03-license-buy-restore.png   # 2880×1800 — also the IAP review screenshot
04-optional-*.png            # optional extras
```

After capturing, reference these from `SUBMISSION-RUNBOOK.md` Step 6 and upload them in App Store Connect. Flatten before upload (`sips -s format png --deleteColorManagementProperties …` or export with no alpha) so ASC does not reject an alpha channel.
