import { describe, expect, it } from "vitest";

import {
  acceleratorToKeyboardInit,
  formatAccelerator,
  isReservedChord,
  isValidAccelerator,
  keyEventToAccelerator,
  matchesChord,
  type ChordEvent,
} from "./hotkeyAccelerator";

/** Build a ChordEvent with all flags defaulting to false. */
function ev(partial: Partial<ChordEvent>): ChordEvent {
  return {
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    code: "",
    key: "",
    ...partial,
  };
}

describe("keyEventToAccelerator", () => {
  it("captures Cmd+Shift+D from physical e.code", () => {
    expect(
      keyEventToAccelerator(ev({ metaKey: true, shiftKey: true, code: "KeyD", key: "D" })),
    ).toBe("CommandOrControl+Shift+D");
  });

  it("captures Cmd+K (lowercase e.key irrelevant)", () => {
    expect(keyEventToAccelerator(ev({ metaKey: true, code: "KeyK", key: "k" }))).toBe(
      "CommandOrControl+K",
    );
  });

  it("uses e.code not the composed glyph for Option+P (macOS Pitfall 2)", () => {
    // On macOS Option+P composes to "π" in e.key — the main key MUST come from e.code.
    expect(keyEventToAccelerator(ev({ altKey: true, code: "KeyP", key: "π" }))).toBe("Alt+P");
  });

  it("captures a digit chord from Digit3", () => {
    expect(
      keyEventToAccelerator(ev({ code: "Digit3", metaKey: true, shiftKey: true, key: "3" })),
    ).toBe("CommandOrControl+Shift+3");
  });

  it("returns null for a bare key (no non-shift modifier, D-24-3)", () => {
    expect(keyEventToAccelerator(ev({ code: "KeyD", key: "d" }))).toBeNull();
  });

  it("returns null for shift-only (shift is not a non-shift modifier)", () => {
    expect(keyEventToAccelerator(ev({ shiftKey: true, code: "KeyD", key: "D" }))).toBeNull();
  });

  it("returns null for a modifier-only press (no main key)", () => {
    expect(
      keyEventToAccelerator(ev({ metaKey: true, code: "ShiftLeft", key: "Shift" })),
    ).toBeNull();
  });

  it("maps punctuation and arrow physical codes", () => {
    expect(keyEventToAccelerator(ev({ metaKey: true, code: "Comma", key: "," }))).toBe(
      "CommandOrControl+,",
    );
    expect(keyEventToAccelerator(ev({ altKey: true, code: "ArrowUp", key: "ArrowUp" }))).toBe(
      "Alt+Up",
    );
  });

  it("maps the symbol-row keys Tauri accepts (Semicolon, Quote, Bracket, etc.)", () => {
    expect(
      keyEventToAccelerator(ev({ metaKey: true, shiftKey: true, code: "Semicolon", key: ";" })),
    ).toBe("CommandOrControl+Shift+;");
    expect(keyEventToAccelerator(ev({ metaKey: true, code: "Quote", key: "'" }))).toBe(
      "CommandOrControl+'",
    );
    expect(keyEventToAccelerator(ev({ altKey: true, code: "BracketLeft", key: "[" }))).toBe(
      "Alt+[",
    );
    expect(keyEventToAccelerator(ev({ metaKey: true, code: "Backquote", key: "`" }))).toBe(
      "CommandOrControl+`",
    );
  });

  it("still returns null for a key Tauri can't bind (e.g. Tab)", () => {
    expect(keyEventToAccelerator(ev({ metaKey: true, code: "Tab", key: "Tab" }))).toBeNull();
  });

  it("treats meta OR ctrl as CommandOrControl", () => {
    expect(keyEventToAccelerator(ev({ ctrlKey: true, code: "KeyK", key: "k" }))).toBe(
      "CommandOrControl+K",
    );
  });
});

describe("matchesChord", () => {
  it("matches Cmd+K via meta", () => {
    expect(matchesChord(ev({ metaKey: true, code: "KeyK", key: "k" }), "CommandOrControl+K")).toBe(
      true,
    );
  });

  it("matches CommandOrControl via ctrl", () => {
    expect(matchesChord(ev({ ctrlKey: true, code: "KeyK", key: "k" }), "CommandOrControl+K")).toBe(
      true,
    );
  });

  it("does not match when shift differs", () => {
    expect(
      matchesChord(ev({ metaKey: true, code: "KeyK", key: "k" }), "CommandOrControl+Shift+K"),
    ).toBe(false);
  });

  it("does not match when an extra modifier is present", () => {
    expect(
      matchesChord(
        ev({ metaKey: true, altKey: true, code: "KeyK", key: "k" }),
        "CommandOrControl+K",
      ),
    ).toBe(false);
  });

  it("uses e.code for the main key (Option+P glyph)", () => {
    expect(matchesChord(ev({ altKey: true, code: "KeyP", key: "π" }), "Alt+P")).toBe(true);
  });

  it("returns false for a malformed accelerator", () => {
    expect(matchesChord(ev({ metaKey: true, code: "KeyK", key: "k" }), "garbage")).toBe(false);
  });
});

describe("isValidAccelerator", () => {
  it("accepts a well-formed chord", () => {
    expect(isValidAccelerator("CommandOrControl+Shift+D")).toBe(true);
    expect(isValidAccelerator("CommandOrControl+K")).toBe(true);
    expect(isValidAccelerator("Alt+P")).toBe(true);
    expect(isValidAccelerator("CommandOrControl+Shift+3")).toBe(true);
    expect(isValidAccelerator("CommandOrControl+,")).toBe(true);
  });

  it("rejects a bare key (no modifier)", () => {
    expect(isValidAccelerator("D")).toBe(false);
  });

  it("rejects shift-only (no non-shift modifier)", () => {
    expect(isValidAccelerator("Shift+D")).toBe(false);
  });

  it("rejects garbage strings", () => {
    expect(isValidAccelerator("garbage")).toBe(false);
    expect(isValidAccelerator("CommandOrControl+")).toBe(false);
    expect(isValidAccelerator("CommandOrControl+Bogus")).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isValidAccelerator(123)).toBe(false);
    expect(isValidAccelerator(null)).toBe(false);
    expect(isValidAccelerator(undefined)).toBe(false);
    expect(isValidAccelerator({})).toBe(false);
  });
});

describe("isReservedChord", () => {
  it("flags macOS-reserved chords", () => {
    expect(isReservedChord("CommandOrControl+Space")).toBe(true);
    expect(isReservedChord("CommandOrControl+Shift+3")).toBe(true);
    expect(isReservedChord("CommandOrControl+Q")).toBe(true);
    expect(isReservedChord("CommandOrControl+,")).toBe(true);
    expect(isReservedChord("CommandOrControl+C")).toBe(true);
  });

  it("does not flag the app's own defaults", () => {
    expect(isReservedChord("CommandOrControl+K")).toBe(false);
    expect(isReservedChord("CommandOrControl+Shift+D")).toBe(false);
  });

  it("compares case-insensitively", () => {
    expect(isReservedChord("commandorcontrol+space")).toBe(true);
  });
});

describe("round-trip property", () => {
  const events: ChordEvent[] = [
    ev({ metaKey: true, shiftKey: true, code: "KeyD", key: "D" }),
    ev({ metaKey: true, code: "KeyK", key: "k" }),
    ev({ altKey: true, code: "KeyP", key: "π" }),
    ev({ code: "Digit3", metaKey: true, shiftKey: true, key: "3" }),
    ev({ ctrlKey: true, code: "KeyK", key: "k" }),
    ev({ metaKey: true, code: "Comma", key: "," }),
    ev({ altKey: true, code: "ArrowUp", key: "ArrowUp" }),
  ];

  it("matchesChord(e, keyEventToAccelerator(e)) is true for every chord event", () => {
    for (const e of events) {
      const accel = keyEventToAccelerator(e);
      expect(accel).not.toBeNull();
      expect(matchesChord(e, accel as string)).toBe(true);
    }
  });
});

describe("formatAccelerator", () => {
  it("renders ⌘ for CommandOrControl + the bare key", () => {
    expect(formatAccelerator("CommandOrControl+K")).toBe("⌘K");
  });

  it("orders modifiers ⌥ ⇧ ⌘ before the key (native macOS menu order)", () => {
    expect(formatAccelerator("CommandOrControl+Shift+D")).toBe("⇧⌘D");
    expect(formatAccelerator("CommandOrControl+Alt+Shift+P")).toBe("⌥⇧⌘P");
  });

  it("maps named main keys to their glyphs", () => {
    expect(formatAccelerator("Alt+Up")).toBe("⌥↑");
    expect(formatAccelerator("CommandOrControl+Space")).toBe("⌘␣");
  });

  it("returns an unparseable string verbatim (defensive, never throws)", () => {
    expect(formatAccelerator("not-a-chord")).toBe("not-a-chord");
  });
});

describe("acceleratorToKeyboardInit", () => {
  it("synthesizes an event init that matchesChord accepts for the same accelerator (round-trip)", () => {
    const accels = [
      "CommandOrControl+K",
      "CommandOrControl+Shift+D",
      "Alt+P",
      "CommandOrControl+Shift+3",
      "CommandOrControl+,",
      "CommandOrControl+Shift+;",
      "Alt+[",
      "Alt+Up",
    ];
    for (const accel of accels) {
      const init = acceleratorToKeyboardInit(accel);
      expect(init).not.toBeNull();
      // The init carries exactly the fields matchesChord reads (code + flags).
      expect(matchesChord(init as ChordEvent, accel)).toBe(true);
    }
  });

  it("returns null for an unparseable accelerator", () => {
    expect(acceleratorToKeyboardInit("not-a-chord")).toBeNull();
  });
});
