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

/** Theme is a NAMED value (D-10), NOT a boolean — so a light theme can be added
 *  later (e.g. "light") without reworking the persistence model. Dark-only in
 *  Phase 2. */
export type ThemeName = "dark";

/** Protobuf wire-format tree layout (PRO-06, D-07). Two layouts only: stacked
 *  "cards" (default) and dense "rows". Persisted so the toggle survives reload. */
export type ProtobufTreeStyle = "cards" | "rows";

export interface Preferences {
  /** Named theme (D-10). Dark-only for v1; extensible to "light" later. */
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
  /** Protobuf tree layout (PRO-06, D-07). Persisted; default "cards". */
  protobufTreeStyle: ProtobufTreeStyle;
  /** First-run update-check opt-in (D-09). null = never asked (show the one-time
   *  prompt on first launch); true = silent check at launch; false = no automatic
   *  network call ever. A manual check is always available regardless. */
  autoUpdateCheck: boolean | null;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "dark",
  accent: "#3b82f6",
  lastUsedId: null,
  recentToolIds: [],
  toolOrder: [],
  protobufTreeStyle: "cards",
  autoUpdateCheck: null,
};

/** Single namespaced store key holding the whole prefs blob. One key keeps the
 *  read/merge atomic (no partial-load skew) and the on-disk file tidy. */
export const PREFERENCES_STORE_KEY = "shell.preferences";

/** Most-recent-first recents cap (≈5, D-05/Open-Question-2). */
export const RECENT_TOOLS_CAP = 5;
