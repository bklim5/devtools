// Preferences schema + store keys + defaults (SHL-05, D-08/D-10).
//
// This is the single typed shape of everything Phase 2 persists through the
// platform `Store` seam (theme/accent, last-used tool, recents). Tools and
// components never read/write `platform.store` for prefs directly — they go
// through `usePreferences`/`useRecentTools`, so the schema stays in ONE place
// and stays extensible.
//
// EXTENSIBILITY (do not pre-create): Phase 3 (which owns the Protobuf tool)
// will add a `protobufTreeStyle` field here — leave room for it; the merge in
// usePreferences accepts only known fields so adding one is a single edit.

/** Theme is a NAMED value (D-10), NOT a boolean. Two values (D-23-4): "light"
 *  and "dark" (the theme IS the effective theme — no prefers-color-scheme
 *  resolution). Fresh-install default stays "dark"; existing installs keep their
 *  persisted value (a hand-edited/legacy "system" coerces to the "dark" default). */
export type ThemeName = "light" | "dark";

/** Protobuf wire-format tree layout (PRO-06, D-07). Two layouts only: stacked
 *  "cards" (default) and dense "rows". Persisted so the toggle survives reload. */
export type ProtobufTreeStyle = "cards" | "rows";

export interface Preferences {
  /** Named theme (D-10/D-23-4): light or dark. Fresh-install default "dark". */
  theme: ThemeName;
  /** Accent color as a CSS color value (drives `--accent`; D-10). One of the
   *  mockup's swatches, but stored as a free string for forward-compat. */
  accent: string;
  /** Id of the most recently opened tool (powers opens-to-last, SHL-06). */
  lastUsedId: string | null;
  /** Most-recent-first, de-duped, capped list of recently used tool ids
   *  (powers the palette's recents group, SHL-03/D-05). */
  recentToolIds: string[];
  /** User's custom sidebar tool order (REORD-05, D-09): ordered tool IDs applied
   *  as a render overlay over ENABLED_TOOLS (D-10). [] = default registry order.
   *  Reconciled against the live registry on every load (D-11). */
  toolOrder: string[];
  /** User's pinned tool IDs (PIN-07). Render-overlay over ENABLED_TOOLS — pinned
   *  group order IS this array's order (append-on-pin). [] = nothing pinned.
   *  Reconciled against the live registry on render via partitionTools (PIN-08). */
  pinnedToolIds: string[];
  /** Protobuf tree layout (PRO-06, D-07). Persisted; default "cards". */
  protobufTreeStyle: ProtobufTreeStyle;
  /** First-run update-check opt-in (D-09). null = never asked (show the one-time
   *  prompt on first launch); true = silent check at launch; false = no automatic
   *  network call ever. A manual check is always available regardless. */
  autoUpdateCheck: boolean | null;
  /** Epoch-ms timestamp of the last COMPLETED update check (D-25-6), stamped on
   *  every check resolution (manual pane, tray, silent launch). null = never
   *  checked (renders "Never"). UNTRUSTED (hand-editable): a non-finite / non-positive
   *  / non-number value coerces to null. */
  lastUpdateCheck: number | null;
  /** Dev/test entitlement override (D-31). "free" forces the free-tier set
   *  through the central gate in ANY build — downgrade-only, the prod invariant
   *  (T-18-10/T-21-15). "full" is DEV-ONLY: it grants Pro under
   *  `import.meta.env.DEV` so the dev/e2e harness can reach Pro after the D-85 flip
   *  made an unlicensed in-Tauri install resolve FREE; in a release build the
   *  coercer (prefsStore.ts) nulls it and the resolve.ts branch is tree-shaken, so
   *  it can NEVER unlock prod. null = no override (the environment default applies). */
  entitlementsOverride: "free" | "full" | null;
  /** One-shot license-drop notice acknowledgement (D-84). `true` = nothing to
   *  acknowledge (the steady state); set to `false` when Pro entitlements drop so
   *  the next open of the status route surfaces ONE calm, dismissable inline
   *  notice ("Your Pro features turned off…"), then back to `true` on dismiss.
   *  Never a mid-use toast/dialog — the flag is surfaced inline on the route. */
  licenseDropNoticeAck: boolean;
  /** Global summon hotkey accelerator (SET-08, D-24-1). Same shipped default as
   *  SUMMON_CHORD ("CommandOrControl+Shift+D"). UNTRUSTED (the user can hand-edit
   *  prefs.json): a junk/invalid chord coerces to the shipped default (D-24-12),
   *  never persists a dead binding. Re-registered natively by a later Phase-24
   *  plan; the OS register-result is the final gate (D-24-3). */
  summonChord: string;
  /** In-webview ⌘K command-palette hotkey accelerator (SET-08). Default
   *  "CommandOrControl+K". Same untrusted-coercion as summonChord (invalid →
   *  shipped default). Matched in-webview via matchesChord (no native register). */
  paletteChord: string;
  /** Launch-at-login toggle (SET-09, D-24-7). Default false. Drives the
   *  platform.autostart capability. UNTRUSTED: only the literal booleans are
   *  honored; anything else → false. */
  launchAtLogin: boolean;
  /** Start hidden in the tray on launch (SET-09). Default false. UNTRUSTED: only
   *  the literal booleans are honored; anything else → false. */
  startInTray: boolean;
  /** Default tool to open into (SET-09, D-12). null = "Last used" (today's
   *  behavior). UNTRUSTED + must be a CURRENTLY-ENABLED tool id (validated via
   *  getToolById against ENABLED_TOOLS, T-02-08); an unknown/removed id coerces to
   *  null. resolveStartupTool consumes it between the explicit target and last-used. */
  defaultToolId: string | null;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "dark",
  // Applied dark default-blue (matches index.css --color-accent); #3b82f6 was dead/AA-failing — Pitfall 1.
  accent: "#5b9bf8",
  lastUsedId: null,
  recentToolIds: [],
  toolOrder: [],
  pinnedToolIds: [],
  protobufTreeStyle: "cards",
  autoUpdateCheck: null,
  lastUpdateCheck: null,
  entitlementsOverride: null,
  licenseDropNoticeAck: true,
  // Same value as SUMMON_CHORD (summon.ts) — the single shipped default chord.
  summonChord: "CommandOrControl+Shift+D",
  paletteChord: "CommandOrControl+K",
  launchAtLogin: false,
  startInTray: false,
  defaultToolId: null, // null = "Last used" (today's behavior)
};

/** Single namespaced store key holding the whole prefs blob. One key keeps the
 *  read/merge atomic (no partial-load skew) and the on-disk file tidy. */
export const PREFERENCES_STORE_KEY = "shell.preferences";

/** Most-recent-first recents cap (≈5, D-05/Open-Question-2). */
export const RECENT_TOOLS_CAP = 5;
