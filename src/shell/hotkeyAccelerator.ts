// Pure chord helper module (D-24-1/3/6). NO native/platform import — mirrors the
// purity of theme.ts so it is unit-testable with plain objects in jsdom. Every
// later Phase-24 plan (native re-register, palette matcher, the prefs coercers)
// builds on these four functions.
//
// SEAM DISCIPLINE: this file must NEVER import the native runtime packages or the
// platform seam — it is the pure transform layer (capture → accelerator string →
// match), and the grep audit asserts zero native imports.
//
// MACOS PITFALL (project memory: macos-option-key-composes-letters): on macOS the
// WKWebView composes Option+letter into a glyph, so the logical character for
// Option+P is "π", NEVER "p". The MAIN KEY is therefore ALWAYS derived from the
// PHYSICAL key code (KeyP, Digit3, …), never from the composed character. The
// ChordEvent type names a character field only so callers can pass a real
// KeyboardEvent; the logic below never branches on it.

/** Minimal structural shape so unit tests pass plain objects (a real
 *  KeyboardEvent satisfies it). */
export type ChordEvent = Pick<
  KeyboardEvent,
  "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "code" | "key"
>;

/** Physical-code → main-key normalization table. Punctuation/space/arrows map to
 *  Tauri's accelerator spelling; letters/digits/Fn keys fall through below. The
 *  symbol-row keys (`;`, `'`, `[`, `]`, `\`, `` ` ``, `-`, `=`) are all accepted by
 *  Tauri's global-shortcut parser (global-hotkey parse_key), so they're bindable. */
const CODE_TO_KEY: Readonly<Record<string, string>> = {
  Comma: ",",
  Period: ".",
  Slash: "/",
  Semicolon: ";",
  Quote: "'",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  Space: "Space",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
};

/** Pure-modifier physical codes — these are NEVER a "main key". */
const MODIFIER_CODES: ReadonlySet<string> = new Set([
  "ShiftLeft",
  "ShiftRight",
  "MetaLeft",
  "MetaRight",
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
]);

/** True iff a physical key code is a pure modifier (Cmd/Ctrl/Alt/Shift down on its
 *  own). Lets capture UIs tell a mid-chord modifier press ("keep recording, no
 *  main key yet") apart from a real-but-unbindable key (Tab, Enter, …). */
export function isModifierCode(code: string): boolean {
  return MODIFIER_CODES.has(code);
}

/** Normalize a PHYSICAL key code to its accelerator main-key segment, or null if
 *  the code is a pure modifier (no main key). NEVER reads the composed character
 *  (macOS Option+letter glyph corruption). */
function normalizeMainKey(code: string): string | null {
  if (MODIFIER_CODES.has(code)) return null;
  if (code.startsWith("Key")) return code.slice(3); // KeyD -> D
  if (code.startsWith("Digit")) return code.slice(5); // Digit3 -> 3
  if (/^F([1-9]|1[0-2])$/.test(code)) return code; // F1..F12 pass through
  const mapped = CODE_TO_KEY[code];
  return mapped ?? null;
}

/** Build the canonical modifier-segment list (in fixed order) from the event's
 *  boolean flags. CommandOrControl covers meta OR ctrl. */
function modifierSegments(e: ChordEvent): string[] {
  const mods: string[] = [];
  if (e.metaKey || e.ctrlKey) mods.push("CommandOrControl");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");
  return mods;
}

/** True iff at least one NON-SHIFT modifier (CommandOrControl or Alt) is present.
 *  Shift-only is NOT a valid chord modifier (D-24-3). */
function hasNonShiftModifier(e: ChordEvent): boolean {
  return e.metaKey || e.ctrlKey || e.altKey;
}

/**
 * Capture a KeyboardEvent as a canonical accelerator string, or null if it is not
 * a valid chord (D-24-3: requires a non-shift modifier + a real main key).
 *
 * Order: `CommandOrControl`, `Alt`, `Shift`, then the main key. The main key comes
 * from the PHYSICAL key code ONLY (never the composed character).
 */
export function keyEventToAccelerator(e: ChordEvent): string | null {
  if (!hasNonShiftModifier(e)) return null; // bare key / shift-only → not a chord
  const mainKey = normalizeMainKey(e.code);
  if (mainKey === null) return null; // modifier-only press → no main key
  return [...modifierSegments(e), mainKey].join("+");
}

interface ParsedAccelerator {
  commandOrControl: boolean;
  alt: boolean;
  shift: boolean;
  mainKey: string;
}

/** The recognized non-letter/digit/Fn main keys — derived from CODE_TO_KEY (the
 *  single source) so adding a bindable key in one place keeps capture, validation,
 *  and the reverse synthesis in agreement. */
const KNOWN_MAIN_KEYS: ReadonlySet<string> = new Set(Object.values(CODE_TO_KEY));

/** True iff a parsed main-key segment is a recognized key (a letter, a digit, an
 *  F1..F12, or one of the punctuation/space/arrow names). */
function isKnownMainKey(segment: string): boolean {
  if (/^[A-Z]$/.test(segment)) return true; // letters (KeyD -> D)
  if (/^[0-9]$/.test(segment)) return true; // digits (Digit3 -> 3)
  if (/^F([1-9]|1[0-2])$/.test(segment)) return true; // Fn keys
  return KNOWN_MAIN_KEYS.has(segment);
}

/** Parse an accelerator string into its component flags + main key, or null if it
 *  is malformed (no non-shift modifier, no/unknown main key, unknown segment). */
function parseAccelerator(accelerator: string): ParsedAccelerator | null {
  const parts = accelerator.split("+");
  if (parts.length < 2) return null; // need ≥1 modifier + a main key
  let commandOrControl = false;
  let alt = false;
  let shift = false;
  const mainKey = parts[parts.length - 1];
  for (const seg of parts.slice(0, -1)) {
    if (seg === "CommandOrControl") commandOrControl = true;
    else if (seg === "Alt") alt = true;
    else if (seg === "Shift") shift = true;
    else return null; // unknown modifier segment
  }
  if (!commandOrControl && !alt) return null; // require a non-shift modifier
  if (!isKnownMainKey(mainKey)) return null;
  return { commandOrControl, alt, shift, mainKey };
}

/**
 * True iff the event matches the accelerator string EXACTLY: each modifier segment
 * present requires its flag set, each absent modifier requires its flag clear, and
 * the (physical-code-normalized) main key equals the accelerator's main key.
 * `CommandOrControl` matches meta OR ctrl.
 */
export function matchesChord(e: ChordEvent, accelerator: string): boolean {
  const parsed = parseAccelerator(accelerator);
  if (parsed === null) return false;
  if (parsed.commandOrControl !== (e.metaKey || e.ctrlKey)) return false;
  if (parsed.alt !== e.altKey) return false;
  if (parsed.shift !== e.shiftKey) return false;
  return normalizeMainKey(e.code) === parsed.mainKey;
}

/**
 * True iff `value` is a string that parses as a valid accelerator (≥1 non-shift
 * modifier + a recognized main key). Used by the prefs chord coercers (Task 2) —
 * a hand-edited junk chord in prefs.json fails here and falls back to the default.
 */
export function isValidAccelerator(value: unknown): boolean {
  return typeof value === "string" && parseAccelerator(value) !== null;
}

/** macOS-reserved + Edit-menu chords (RESEARCH §3). The app's OWN defaults
 *  (CommandOrControl+K, CommandOrControl+Shift+D) are deliberately NOT here. */
const RESERVED_CHORDS: ReadonlySet<string> = new Set(
  [
    "CommandOrControl+Space",
    "CommandOrControl+Q",
    "CommandOrControl+Tab",
    "CommandOrControl+W",
    "CommandOrControl+M",
    "CommandOrControl+H",
    "CommandOrControl+Shift+3",
    "CommandOrControl+Shift+4",
    "CommandOrControl+Shift+5",
    "CommandOrControl+,",
    // Edit-menu set
    "CommandOrControl+C",
    "CommandOrControl+V",
    "CommandOrControl+X",
    "CommandOrControl+Z",
    "CommandOrControl+A",
  ].map((c) => c.toLowerCase()),
);

/**
 * True iff the accelerator is in the recommended macOS reserved set (RESEARCH §3).
 * A UX nicety (D-24-3) — the OS register-result is the authoritative gate. Compared
 * case-insensitively on the canonical form.
 */
export function isReservedChord(accelerator: string): boolean {
  return RESERVED_CHORDS.has(accelerator.toLowerCase());
}

/** Modifier → macOS glyph. CommandOrControl renders as ⌘ (this is a macOS-first
 *  app); the glyph order below follows the native menu convention (⌥ ⇧ ⌘ … key). */
const MODIFIER_GLYPHS = { alt: "⌥", shift: "⇧", commandOrControl: "⌘" } as const;
/** Named main keys → their glyph (letters/digits render as-is). */
const MAIN_KEY_GLYPHS: Readonly<Record<string, string>> = {
  Up: "↑",
  Down: "↓",
  Left: "←",
  Right: "→",
  Space: "␣",
};

/**
 * Render a canonical accelerator string as macOS display glyphs for the UI
 * (e.g. "CommandOrControl+K" → "⌘K", "CommandOrControl+Shift+D" → "⇧⌘D"). This is
 * the SINGLE formatter every surface uses so a rebound chord shows consistently
 * (the header palette pill, the Hotkeys-pane fields). A string that does not parse
 * is returned verbatim (defensive — never throws).
 */
export function formatAccelerator(accelerator: string): string {
  const parsed = parseAccelerator(accelerator);
  if (parsed === null) return accelerator;
  let mods = "";
  if (parsed.alt) mods += MODIFIER_GLYPHS.alt;
  if (parsed.shift) mods += MODIFIER_GLYPHS.shift;
  if (parsed.commandOrControl) mods += MODIFIER_GLYPHS.commandOrControl;
  return mods + (MAIN_KEY_GLYPHS[parsed.mainKey] ?? parsed.mainKey);
}

/** Inverse of CODE_TO_KEY (",": "Comma" → ",") so the main-key segment can be
 *  turned back into a physical code. Derived from the SINGLE source above. */
const KEY_TO_CODE: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(CODE_TO_KEY).map(([code, key]) => [key, code]),
);

/** Map a parsed main-key segment back to its physical code (the inverse of
 *  normalizeMainKey): "K" → "KeyK", "3" → "Digit3", "F5" → "F5", "," → "Comma". */
function mainKeyToCode(mainKey: string): string | null {
  if (/^[A-Z]$/.test(mainKey)) return `Key${mainKey}`;
  if (/^[0-9]$/.test(mainKey)) return `Digit${mainKey}`;
  if (/^F([1-9]|1[0-2])$/.test(mainKey)) return mainKey;
  return KEY_TO_CODE[mainKey] ?? null;
}

/**
 * Build a KeyboardEvent init that `matchesChord(_, accelerator)` accepts — the
 * inverse of capture. Used to SYNTHESIZE the configured chord (e.g. the header
 * pill dispatches the user's palette chord, not a hard-coded ⌘K, so a rebind
 * keeps the click in sync with what the pill displays). `CommandOrControl` is
 * synthesized as `metaKey` (macOS-first; matchesChord accepts meta OR ctrl).
 * Returns null for an unparseable accelerator (defensive — never throws). The
 * `key` field is best-effort (matchesChord keys off `code`, never the character).
 */
export function acceleratorToKeyboardInit(
  accelerator: string,
): KeyboardEventInit | null {
  const parsed = parseAccelerator(accelerator);
  if (parsed === null) return null;
  const code = mainKeyToCode(parsed.mainKey);
  if (code === null) return null;
  return {
    code,
    key: parsed.mainKey.length === 1 ? parsed.mainKey.toLowerCase() : parsed.mainKey,
    metaKey: parsed.commandOrControl,
    ctrlKey: false,
    altKey: parsed.alt,
    shiftKey: parsed.shift,
  };
}
