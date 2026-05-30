# design/

Canonical UI design files from Claude Design (claude.ai/design). **Reference only — do not modify.**

## Files

| File | What it is |
|---|---|
| `DevTools Mockup.html` | **The visual system.** CSS variables, layout grid, typography, animation, palette overlay, status bar. Read the source — do not render in a browser. Everything you need (dimensions, colors, layout rules) is spelled out in the source. |
| `devtools-ui.jsx` | React component structure + sample protobuf payload. **Prototype, not production code.** Use to understand component composition, but rewrite as TypeScript and rebuild against the production code conventions. |
| `tweaks-panel.jsx` | Claude Design's experimentation harness. **Dev tool only — do not include in the production build.** It exists so the designer could toggle variants (sidebar mode, tree style, copy mode, density, etc.) live. |

## How to use these files

The design is the **visual contract**. The `docs/design-and-plan.md` is the **engineering contract**. When they appear to conflict, the plan wins — specifically §9 (UX constraints), which lifts a few decisions the design alone doesn't enforce:

- The `hover` copy mode in `devtools-ui.jsx` **must not ship** — it fails keyboard reach.
- The interpretation chips on LEN fields must show **all viable interpretations** the decoder computes (including `packed-varints` / `packed-i32` / `packed-i64`), not the curated subset in the design's `FIELDS` data.
- `#N` field numbers must be neutral, not the accent blue the design uses.
- Fonts must be self-hosted, not loaded from Google Fonts at runtime.

These aren't "improvements over the design" — they're constraints the design's experimentation tool exposed as variants and the plan locked down.

## Defaults the design implies

The `TWEAK_DEFAULTS` block inside `DevTools Mockup.html` is the source of truth for which variant should ship:

```js
{
  "accent": "#3b82f6",
  "tree": "rows",
  "copyMode": "always",
  "density": "comfortable",
  "sidebar": "compact",
  "premium": false,
  "palette": false
}
```

Apply the constraints from `docs/design-and-plan.md` §9 on top: drop `hover` from `copyMode` entirely (only `always` and `inline` ship), keep `premium: false` for v1 (no Pro UI visible), and bind ⌘K globally even though `palette: false` (it just means "not open on load").
