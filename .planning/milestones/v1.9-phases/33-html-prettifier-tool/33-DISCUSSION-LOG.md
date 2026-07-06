# Phase 33: HTML Prettifier Tool - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-01
**Phase:** 33-html-prettifier-tool
**Areas discussed:** Large-paste guard (behavior + threshold), Guard scope/placement, Tool identity & placement, Prettify option surface

---

## Area selection

| Option | Selected |
|--------|----------|
| Guard behavior + threshold | ✓ |
| Guard scope / placement | ✓ |
| Tool identity & placement | ✓ |
| Prettify option surface | ✓ |

---

## Large-paste guard — behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Hard reject + role=alert | Engine never called over cap; output clears; calm role=alert; input stays editable | ✓ |
| Soft warn, still run | Warn but run anyway — risks the freeze SC6 exists to prevent | |
| Interruptible / worker path | Off-thread + cancel; complicates shared lazy chunk for near-zero common-case benefit | |

**User's choice:** Hard reject + role=alert (preview approved: `Input too large (2.4 MB) — 2 MB max`).

## Large-paste guard — cap value

| Option | Description | Selected |
|--------|-------------|----------|
| 2 MB | Covers real-world HTML; worst-case parse well under <2s | ✓ |
| 1 MB | More conservative; could reject a legit large single-file export | |
| 5 MB | Generous; 5 MB with embedded JS could approach the 2s budget | |

**User's choice:** 2 MB (UTF-8 bytes via existing byteLen).

## Guard scope / placement

| Option | Description | Selected |
|--------|-------------|----------|
| Shared in useAsyncFormat | P34 inherits for free; oversized input never reaches runner; one place to test | ✓ |
| HTML-only, in the tool | P34 must re-add — duplication the roadmap warns against | |
| Shared + retrofit JSON/XML | Also cap the sync tools — broader but likely scope creep | |

**User's choice:** Shared in useAsyncFormat (JSON/XML retrofit deferred).

## Tool identity & placement

| Option | Description | Selected |
|--------|-------------|----------|
| 'HTML', code-ish icon, next to XML | id=html-formatter, name=HTML, distinct-from-XML icon, adjacent to json/xml | ✓ |
| 'HTML' but I'll pick the icon | Same identity, user picks icon | |
| Different name/description | User has a specific name in mind | |

**User's choice:** 'HTML', code-ish icon distinct from XML's FileCode, placed next to XML. Naming parity with JSON/XML.

## Prettify option surface

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal — indent + width + Minify only | Exactly PRT-08; Prettier HTML defaults implicit; golden parity holds | ✓ |
| Add htmlWhitespaceSensitivity | Adds a knob JSON/XML lack; deviates from PRT-08 | |

**User's choice:** Minimal — indent + printWidth + Minify only.

## Claude's Discretion

- Exact byte constant (2 MiB vs 2 MB) + status wording.
- Specific lucide icon (distinct from FileCode).
- useAsyncFormat guard shape (`maxInputBytes` param vs wrapper).
- Golden-fixture design (script+style parity, minify), offline-e2e + role=alert e2e mechanics.

## Deferred Ideas

- Retrofit the size guard onto sync JSON/XML tools.
- HTML-specific Prettier knobs (htmlWhitespaceSensitivity, bracketSameLine, singleAttributePerLine).
