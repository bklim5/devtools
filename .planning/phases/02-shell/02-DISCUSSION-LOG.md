# Phase 2: Shell - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 2-shell
**Areas discussed:** Sidebar & disabled tools, ⌘K palette scope, Preferences & storage, First-run & opens-to-last

---

## Sidebar & disabled tools

### Handling not-yet-built tools (empty ENABLED_TOOLS today)
| Option | Description | Selected |
|--------|-------------|----------|
| Enable as placeholders | Flip 3 stubs to enabled:true; render "coming in Phase 3" placeholder; sidebar/palette/routing/persistence become verifiable | ✓ |
| Show all, grey disabled | List all TOOLS, grey enabled:false ones as "coming soon" | |
| Seed one real tool | Pull Unix Time forward and build it for real in Phase 2 | |

**User's choice:** Enable as placeholders.
**Notes:** Unblocks shell verification without blurring the Phase 2/3 boundary; must not touch decoder/bytes/types (port-unchanged bar).

### Sidebar density
| Option | Description | Selected |
|--------|-------------|----------|
| Fixed compact (icon+name) | Single compact mode, exactly per SHL-01 | ✓ |
| User-toggleable + persisted | full / compact / icons-only, persisted | |
| Icons-only | Most compact, tooltip/palette for names | |

**User's choice:** Fixed compact (icon + name).

### Keyboard navigation
| Option | Description | Selected |
|--------|-------------|----------|
| Palette is the kbd path | Sidebar = mouse + Tab focus; ⌘K is the no-mouse switcher | ✓ |
| Arrow-key sidebar nav | Up/down or j/k + Enter in the sidebar | |
| Number shortcuts | ⌘1..⌘6 jump to tools by position | |

**User's choice:** Palette is the keyboard path.

---

## ⌘K palette scope

### Searchable scope
| Option | Description | Selected |
|--------|-------------|----------|
| Tools only | Fuzzy over name+keywords+description, Enter switches | ✓ |
| Tools + app actions | Also global actions (toggle theme, copy output) | |
| Tools + actions + recents | Also recent inputs/values | |

**User's choice:** Tools only.

### Recents on empty query
| Option | Description | Selected |
|--------|-------------|----------|
| Recents first, then rest | ~5 recents at top, then registry order; typing filters all | ✓ |
| All in registry order | No recents section | |
| Recents only until typing | Empty query shows only recents | |

**User's choice:** Recents first, then rest.

### Fuzzy matching implementation
| Option | Description | Selected |
|--------|-------------|----------|
| In-house subsequence rank | ~30-line zero-dep fuzzy ranker | ✓ |
| cmdk component | Adopt cmdk library | |
| fuse.js | Add fuse.js for ranking | |

**User's choice:** In-house subsequence rank.

### Trigger / appearance
| Option | Description | Selected |
|--------|-------------|----------|
| ⌘K only, never auto-open | Opens on ⌘K + click; quiet no-match; app boots to a tool | ✓ |
| Auto-open on first run | Palette as the picker on first launch | |
| ⌘K + Esc nuances | Recommended + user-specified extras | |

**User's choice:** ⌘K only, never auto-open.

---

## Preferences & storage

### What persists (multi-select)
| Option | Description | Selected |
|--------|-------------|----------|
| Last-used tool | Reopened on launch (SHL-06) | ✓ |
| Recent tools list | ~5-entry MRU powering palette recents (SHL-03) | ✓ |
| Theme | Theme/accent (SHL-05) | ✓ |
| Window geometry | Size + position restored on relaunch (SHL-05) | |

**User's choice:** Last-used tool, recent tools list, theme. (Window geometry NOT selected here — explicitly deferred to Phase 5 in the next question.)
**Notes:** Protobuf tree-style (also in SHL-05) deferred to Phase 3, which owns that tool; store schema kept extensible for it.

### Storage mechanism
| Option | Description | Selected |
|--------|-------------|----------|
| Tauri store + localStorage fallback | @tauri-apps/plugin-store on desktop, localStorage in browser, behind Store seam | ✓ |
| Custom JSON file | Own prefs.json via Tauri fs | |
| localStorage only | Simplest, not the real desktop path | |

**User's choice:** Tauri store + localStorage fallback (behind the existing Store seam).

### Theme scope
| Option | Description | Selected |
|--------|-------------|----------|
| Dark-only; persist accent | Dark theme, persisted accent color | ✓ |
| Light + dark toggle | Full light theme + toggle | |
| Dark-only; no theme pref | Defer theme persistence entirely | |

**User's choice:** Dark only; persist accent for now — but build with the flexibility to extend to a light theme in the future (store theme as a named value, drive colors via CSS variables).

### Window geometry timing
| Option | Description | Selected |
|--------|-------------|----------|
| Here, via the seam | Persist/restore in Phase 2 | |
| Defer to Phase 5 | With native/tray work | ✓ |

**User's choice:** Defer to Phase 5 — "this is the least of the priorities."

---

## First-run & opens-to-last

### First launch default tool
| Option | Description | Selected |
|--------|-------------|----------|
| Protobuf decoder (hero) | Open straight to the hero | ✓ |
| First tool in registry order | Arbitrary first entry | |
| Neutral home/welcome | Landing surface before any tool | |

**User's choice:** Protobuf decoder (hero) for now (most-used) — but make the startup-tool resolution configurable in the future (last-used / first-in-list / user preference) via a single seam.

### Stale last-used tool
| Option | Description | Selected |
|--------|-------------|----------|
| Fall back to hero default | Silently open Protobuf | ✓ |
| First enabled tool | First of ENABLED_TOOLS | |
| Open the palette | Re-pick | |

**User's choice:** Fall back to the hero default.

### Launch target vs last-used
| Option | Description | Selected |
|--------|-------------|----------|
| Explicit target overrides last-used | Deep-link/summon wins, else last-used | ✓ |
| Last-used always wins | Ignore launch route | |

**User's choice:** Explicit target overrides last-used (Phase 5 wires the actual shortcut).

## Claude's Discretion

Placeholder component markup/copy, recents list length (~5), fuzzy-ranker scoring, palette Esc/typeahead micro-behaviors, store key naming, reset-to-defaults, lucide icon choices, adding lucide-react + @tauri-apps/plugin-store deps.

## Deferred Ideas

Sidebar density toggle; palette global app-actions and recent-inputs; light theme/toggle (structured for later); **window-geometry persistence (deferred to Phase 5)**; configurable default/startup tool; global summon shortcut + tray + single-instance (Phase 5); Protobuf tree-style pref value (Phase 3).
