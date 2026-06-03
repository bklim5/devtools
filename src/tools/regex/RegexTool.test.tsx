// @vitest-environment jsdom
// RegexTool component spec (RGX-05 / RGX-07, D-03/D-09/D-10/D-11). Originally the
// 14-01 RED wave; per the user's Rule-4 merge decision it ships GREEN here in
// 14-03 alongside RegexTool.tsx (the binding lefthook pre-commit hook rejects any
// commit where tsc/vitest fail, so a RED-only test file cannot land).
//
// These cases target UI that renders directly from input — independent of worker
// output — so they hold even though jsdom has no real Worker (the global Worker is
// stubbed to a no-op; the real worker round-trip is proven by the Plan-03
// real-WKWebView e2e, not here):
//   • RGX-05 (D-10/11): a library chip click OVERWRITES the pattern field (+ flags),
//     no confirm; exactly three chips Email/URL/IPv4 in the "Insert a common
//     pattern" group.
//   • RGX-07 (D-03): the highlight backdrop mirrors the sample text as ESCAPED React
//     children — user text "x<b>y" renders no real <b> element, the literal "<b>"
//     appears as text.
//   • T-14-02: a runtime absence-grep (Vite import.meta.glob ?raw) asserts the
//     raw-inner-HTML React escape hatch appears in NO non-test source file under
//     src/tools/regex/ (the URL-tool T-13-04 invariant, upgraded to a real assertion).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, within } from "@testing-library/react";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type Platform,
} from "@/lib/platform";
import { createStoreStub } from "@/lib/platform/stub";
import {
  noopWindow,
  noopNativeShortcut,
  noopUpdater,
  noopEvents,
} from "@/shell/testStore";
import RegexTool from "./RegexTool";

let writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;

beforeEach(() => {
  writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
  const p: Platform = {
    clipboard: { writeText, readText: async () => "" },
    store: createStoreStub(),
    window: noopWindow,
    nativeShortcut: noopNativeShortcut,
    updater: noopUpdater,
    events: noopEvents,
  };
  setPlatformForTest(p);
  // jsdom has no real Worker; stub a no-op so the watchdog's `new Worker(new URL(...))`
  // constructs without throwing. These cases never depend on a worker reply.
  vi.stubGlobal(
    "Worker",
    class {
      onmessage: ((e: unknown) => void) | null = null;
      postMessage() {}
      terminate() {}
    },
  );
});

afterEach(() => {
  cleanup();
  resetPlatformForTest();
  vi.unstubAllGlobals();
});

function patternInput(container: HTMLElement): HTMLInputElement {
  const el = container.querySelector<HTMLInputElement>("#regex-pattern");
  if (!el) throw new Error("pattern input #regex-pattern not found");
  return el;
}

function textInput(container: HTMLElement): HTMLTextAreaElement {
  const el = container.querySelector<HTMLTextAreaElement>("#regex-text");
  if (!el) throw new Error("sample-text input #regex-text not found");
  return el;
}

describe("RegexTool", () => {
  it("renders exactly three library chips Email/URL/IPv4 in the insert group", () => {
    const { container } = render(<RegexTool />);
    const group = within(container).getByRole("group", {
      name: "Insert a common pattern",
    });
    for (const label of ["Email", "URL", "IPv4"]) {
      expect(within(group).getByRole("button", { name: label })).toBeTruthy();
    }
    expect(within(group).getAllByRole("button")).toHaveLength(3);
  });

  it("clicking a library chip OVERWRITES a non-empty pattern, no confirm (RGX-05/D-11)", () => {
    const { container } = render(<RegexTool />);
    const input = patternInput(container);
    fireEvent.change(input, { target: { value: "OLD" } });
    expect(input.value).toBe("OLD");

    const group = within(container).getByRole("group", {
      name: "Insert a common pattern",
    });
    fireEvent.click(within(group).getByRole("button", { name: "Email" }));

    // Overwritten (no longer "OLD") and now carries the Email source (a literal @).
    expect(input.value).not.toBe("OLD");
    expect(input.value).toContain("@");
  });

  it("the highlight backdrop renders sample text as ESCAPED React children (RGX-07/D-03)", () => {
    const { container } = render(<RegexTool />);
    fireEvent.change(textInput(container), { target: { value: "x<b>y" } });

    // No real <b> element is injected from user input.
    expect(container.querySelector("b")).toBeNull();
    // The angle-bracket text renders escaped (the literal "<b>" appears as text).
    expect(container.textContent).toContain("<b>");
  });

  it("renders the 'Pattern timed out' state when the worker never replies (RGX-06/D-15)", async () => {
    // The stubbed Worker NEVER calls onmessage — modeling a wedged catastrophic
    // match. The view's terminate-on-timeout watchdog must fire and render the
    // timeout state. (On the real WKWebView, JavaScriptCore defuses textbook ReDoS
    // patterns so this path can't be driven by a naturally-catastrophic regex —
    // hence it's proven here at the unit layer with fake timers.) A terminate() spy
    // also confirms the wedged worker is hard-killed (the only real kill).
    const terminate = vi.fn();
    vi.stubGlobal(
      "Worker",
      class {
        onmessage: ((e: unknown) => void) | null = null;
        postMessage() {}
        terminate = terminate;
      },
    );
    vi.useFakeTimers();
    try {
      const { container } = render(<RegexTool />);
      // Non-empty pattern + text => the effect debounces (80ms) then posts + arms
      // the 1000ms watchdog. The stub never replies, so the watchdog wins.
      fireEvent.change(textInput(container), { target: { value: "aaaa" } });
      fireEvent.change(patternInput(container), { target: { value: "(a*)*$" } });

      // Advance past the debounce + the watchdog window (inside act so the
      // watchdog's setResult flushes a re-render).
      await act(async () => {
        await vi.advanceTimersByTimeAsync(80 + 1000 + 10);
      });

      const alert = container.querySelector('[role="alert"]');
      expect(alert?.textContent ?? "").toContain("Pattern timed out");
      expect(terminate).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("no dangerouslySetInnerHTML in src/tools/regex", () => {
  it("appears in NO non-test source file under the tool directory (T-14-02)", () => {
    // Read every source file in this directory at test time via Vite's import.meta.glob
    // (?raw, eager) — a real runtime assertion that needs no node:fs/@types/node (the
    // repo ships none; the browser tsconfig typechecks src/, so the 14-01-prescribed
    // readdirSync/__dirname approach won't compile here). The XSS-safety invariant is
    // identical: the literal must appear in NO non-test file under src/tools/regex.
    const sources = import.meta.glob("./*.{ts,tsx}", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    const files = Object.entries(sources).filter(
      ([path]) => !path.includes(".test."),
    );
    expect(files.length).toBeGreaterThan(0);
    for (const [path, contents] of files) {
      expect(contents, `${path} must not use the raw-inner-HTML escape hatch`)
        .not.toContain("dangerouslySetInnerHTML");
    }
  });
});
