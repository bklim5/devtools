// @vitest-environment jsdom
// useAsyncFormat: the shared latest-wins async formatting hook (PRT-03). These
// tests lock the load-bearing guarantees — the out-of-order-resolution stale-drop
// (T-32-04), the pending lifecycle, last-good output staying visible, the empty
// reset dropping in-flight work, and unmount cleanup (T-32-05) — using fake timers
// plus a deferred runner whose resolutions we control by hand.
import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { DEBOUNCE_MS, useAsyncFormat } from "./useAsyncFormat";
import type { FormatResult } from "@/lib/format/types";

const OPTS = { indent: "2" } as const;

/** A formatter whose every call parks until we resolve it by hand, in any order. */
function makeDeferredRunner() {
  const calls: { input: string; resolve: (r: FormatResult) => void }[] = [];
  const runner = (input: string) =>
    new Promise<FormatResult>((resolve) => {
      calls.push({ input, resolve });
    });
  return { runner, calls };
}

/** A resolved `FormatResult` tagged with `output` so we can assert which run won. */
function ok(output: string): FormatResult {
  return { ok: true, output, inputBytes: 0, outputBytes: output.length };
}

/** A resolved error `FormatResult` — used to surface the under-cap `inputBytes`
 *  (which maps to the bounded exact count on the error branch). */
function err(message: string): FormatResult {
  return { ok: false, error: { message } };
}

/** Advance past the debounce so the pending run's setTimeout callback fires. */
function fireDebounce() {
  act(() => {
    vi.advanceTimersByTime(DEBOUNCE_MS);
  });
}

describe("useAsyncFormat", () => {
  it("debounces: no runner call until the debounce elapses, then one call", () => {
    vi.useFakeTimers();
    try {
      const { runner, calls } = makeDeferredRunner();
      const { result } = renderHook(() => useAsyncFormat("hi", OPTS, runner));

      expect(calls).toHaveLength(0); // still inside the debounce window
      expect(result.current.pending).toBe(false);

      fireDebounce();
      expect(calls).toHaveLength(1);
      expect(calls[0].input).toBe("hi");
      expect(result.current.pending).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("drops a STALE resolve: the earlier call resolving AFTER the later call does not win", async () => {
    vi.useFakeTimers();
    try {
      const { runner, calls } = makeDeferredRunner();
      const { result, rerender } = renderHook(
        ({ input }) => useAsyncFormat(input, OPTS, runner),
        { initialProps: { input: "a" } },
      );

      // Run #1 for "a" starts.
      fireDebounce();
      expect(calls).toHaveLength(1);

      // Type "ab" — run #2 starts (a fresh, higher reqId).
      rerender({ input: "ab" });
      fireDebounce();
      expect(calls).toHaveLength(2);
      expect(calls[1].input).toBe("ab");

      // The LATER call ("ab") resolves FIRST → it is applied.
      await act(async () => {
        calls[1].resolve(ok("ab"));
      });
      expect(result.current.result).toEqual(ok("ab"));
      expect(result.current.pending).toBe(false);

      // The EARLIER call ("a") resolves LAST → it is stale and must be dropped,
      // NOT overwrite the newer "ab" output (T-32-04, inverted timing).
      await act(async () => {
        calls[0].resolve(ok("a"));
      });
      expect(result.current.result).toEqual(ok("ab"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("pending is true from run start until the result is applied, false otherwise", async () => {
    vi.useFakeTimers();
    try {
      const { runner, calls } = makeDeferredRunner();
      const { result } = renderHook(() => useAsyncFormat("x", OPTS, runner));

      expect(result.current.pending).toBe(false); // before debounce
      fireDebounce();
      expect(result.current.pending).toBe(true); // run in flight
      await act(async () => {
        calls[0].resolve(ok("X"));
      });
      expect(result.current.pending).toBe(false); // resolved
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the last-good result visible while a new format is pending", async () => {
    vi.useFakeTimers();
    try {
      const { runner, calls } = makeDeferredRunner();
      const { result, rerender } = renderHook(
        ({ input }) => useAsyncFormat(input, OPTS, runner),
        { initialProps: { input: "x" } },
      );

      fireDebounce();
      await act(async () => {
        calls[0].resolve(ok("X"));
      });
      expect(result.current.result).toEqual(ok("X"));

      // New keystroke → a new run goes pending, but the prior output stays readable
      // (no clear-to-blank flash).
      rerender({ input: "xy" });
      fireDebounce();
      expect(result.current.pending).toBe(true);
      expect(result.current.result).toEqual(ok("X"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("resets to empty-ok on whitespace input, calls no runner, and drops in-flight work", async () => {
    vi.useFakeTimers();
    try {
      const { runner, calls } = makeDeferredRunner();
      const { result, rerender } = renderHook(
        ({ input }) => useAsyncFormat(input, OPTS, runner),
        { initialProps: { input: "x" } },
      );

      fireDebounce();
      expect(calls).toHaveLength(1); // "x" run in flight
      expect(result.current.pending).toBe(true);

      // Clear to whitespace → neutral reset, no new runner call, pending cleared.
      act(() => {
        rerender({ input: "   " });
      });
      expect(calls).toHaveLength(1); // NO runner call for empty/whitespace
      expect(result.current.pending).toBe(false);
      expect(result.current.result).toEqual(ok("")); // { ok, "", 0, 0 }
      expect(result.current.result).toEqual({
        ok: true,
        output: "",
        inputBytes: 0,
        outputBytes: 0,
      });

      // The dropped in-flight "x" resolving now must not resurrect stale output.
      await act(async () => {
        calls[0].resolve(ok("X"));
      });
      expect(result.current.result).toEqual(ok(""));
    } finally {
      vi.useRealTimers();
    }
  });

  it("cleans up on unmount: no runner call after unmount, late resolve is a no-op", async () => {
    vi.useFakeTimers();
    try {
      const { runner, calls } = makeDeferredRunner();
      const { result, unmount } = renderHook(() =>
        useAsyncFormat("x", OPTS, runner),
      );

      fireDebounce();
      expect(calls).toHaveLength(1);

      unmount();

      // A late resolve after unmount must not throw (no setState-after-unmount).
      await act(async () => {
        calls[0].resolve(ok("X"));
      });
      // Nothing observable changed / threw.
      expect(result.current.pending).toBe(true); // last value before unmount
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels a still-debouncing run on unmount (timer cleared, runner never called)", () => {
    vi.useFakeTimers();
    try {
      const { runner, calls } = makeDeferredRunner();
      const { unmount } = renderHook(() => useAsyncFormat("x", OPTS, runner));

      unmount(); // before the debounce fires
      expect(() =>
        act(() => {
          vi.advanceTimersByTime(DEBOUNCE_MS);
        }),
      ).not.toThrow();
      expect(calls).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("size guard (SC6)", () => {
  it("does NOT call the runner for over-cap ASCII input (0 calls)", () => {
    vi.useFakeTimers();
    try {
      const { runner, calls } = makeDeferredRunner();
      const bigInput = "x".repeat(50); // 50 bytes > cap 10
      const { result } = renderHook(() =>
        useAsyncFormat(bigInput, OPTS, runner, 10),
      );

      fireDebounce();
      expect(calls).toHaveLength(0);
      expect(result.current.pending).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("surfaces an ok:false 'too large' result for over-cap input", () => {
    vi.useFakeTimers();
    try {
      const { runner } = makeDeferredRunner();
      const bigInput = "x".repeat(50);
      const { result } = renderHook(() =>
        useAsyncFormat(bigInput, OPTS, runner, 10),
      );

      fireDebounce();
      const r = result.current.result;
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.message).toMatch(/Input too large \(> 2 MB\) — 2 MB max/);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects a MULTIBYTE over-cap input WITHOUT a full-string encode (4th-Codex-finding fix)", () => {
    vi.useFakeTimers();
    // "€" = 1 UTF-16 code unit / 3 UTF-8 bytes → length 4 <= cap 10, but 4×3 = 12 > 10.
    const bigMb = "€".repeat(4);
    const encodeSpy = vi.spyOn(TextEncoder.prototype, "encode");
    try {
      const { runner, calls } = makeDeferredRunner();
      const { result } = renderHook(() =>
        useAsyncFormat(bigMb, OPTS, runner, 10),
      );

      fireDebounce();
      expect(calls).toHaveLength(0); // runner never reached
      const r = result.current.result;
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.message).toMatch(/> 2 MB/);
      // IDENTITY check: the over-cap string itself was NEVER encoded (the bounded
      // counter detected over-cap without a full encode). A `.length` filter would
      // be WRONG here — bigMb.length (4) is already under the cap.
      expect(encodeSpy.mock.calls.every(([s]) => s !== bigMb)).toBe(true);
    } finally {
      encodeSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("rejects a MALFORMED-SURROGATE over-cap input — the 5th-Codex-finding bypass fix", () => {
    vi.useFakeTimers();
    try {
      const { runner, calls } = makeDeferredRunner();
      // "\uD800€" = lone high surrogate + € → TextEncoder emits 6 bytes (U+FFFD 3 +
      // € 3), but the OLD naive counter scored it 4 (and swallowed the €). With cap
      // 15: TRUE = 3×6 = 18 > 15, naive = 3×4 = 12 < 15.
      const unit = "\uD800€";
      const bad = unit.repeat(3);
      // Prove the fixture is genuinely over-cap by the REAL encoder.
      expect(new TextEncoder().encode(bad).length).toBeGreaterThan(15);

      const { result } = renderHook(() =>
        useAsyncFormat(bad, OPTS, runner, 15),
      );

      fireDebounce();
      expect(calls).toHaveLength(0); // the over-cap payload did NOT reach the runner
      const r = result.current.result;
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.message).toMatch(/> 2 MB/);
      expect(result.current.inputBytes).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("counts unpaired surrogates byte-for-byte like TextEncoder (exact under-cap parity)", async () => {
    vi.useFakeTimers();
    try {
      // lone high, lone low, lone-high+ASCII, lone-high+multibyte, ASCII+lone-low+ASCII,
      // and a VALID pair. Each is well under the 1 MB cap.
      const fixtures = ["\uD800", "\uDC00", "\uD800a", "\uD800€", "a\uDC00b", "😀"];
      for (const s of fixtures) {
        const { runner, calls } = makeDeferredRunner();
        const { result } = renderHook(() =>
          useAsyncFormat(s, OPTS, runner, 1_000_000),
        );
        fireDebounce();
        expect(calls).toHaveLength(1);
        await act(async () => {
          calls[0].resolve(err("bad")); // error branch surfaces the bounded exact count
        });
        expect(result.current.inputBytes).toBe(
          new TextEncoder().encode(s).length,
        );
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("runs the runner normally for under-cap input", async () => {
    vi.useFakeTimers();
    try {
      const { runner, calls } = makeDeferredRunner();
      const { result } = renderHook(() =>
        useAsyncFormat("ab", OPTS, runner, 10),
      ); // 2 bytes <= 10

      fireDebounce();
      expect(calls).toHaveLength(1);
      expect(calls[0].input).toBe("ab");
      await act(async () => {
        calls[0].resolve(ok("AB"));
      });
      expect(result.current.result).toEqual(ok("AB"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("treats UNDER-cap whitespace as empty (neutral reset, no runner call)", () => {
    vi.useFakeTimers();
    try {
      const { runner, calls } = makeDeferredRunner();
      const { result } = renderHook(() =>
        useAsyncFormat("   ", OPTS, runner, 10),
      ); // 3 whitespace bytes <= cap 10 → empty, not oversize

      fireDebounce();
      expect(calls).toHaveLength(0);
      expect(result.current.result).toEqual({
        ok: true,
        output: "",
        inputBytes: 0,
        outputBytes: 0,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("treats OVER-cap whitespace as OVERSIZE without trimming the full payload (Codex adversarial fix)", () => {
    vi.useFakeTimers();
    // A whitespace-only blob larger than the cap must be rejected as oversize, NOT
    // classified empty: classifying it empty would require input.trim() to scan the
    // ENTIRE leading-whitespace run (= the whole payload), an unbounded scan on the
    // exact large-paste path the byte guard exists to protect. The bounded byte scan
    // runs FIRST, so an over-cap whitespace paste short-circuits to oversize and is
    // never trimmed.
    const realTrim = String.prototype.trim;
    const trimmedLengths: number[] = [];
    const trimSpy = vi
      .spyOn(String.prototype, "trim")
      .mockImplementation(function (this: string) {
        trimmedLengths.push(this.length);
        return realTrim.call(this);
      });
    try {
      const { runner, calls } = makeDeferredRunner();
      const bigWs = " ".repeat(50); // 50 whitespace bytes > cap 10
      const { result } = renderHook(() =>
        useAsyncFormat(bigWs, OPTS, runner, 10),
      );

      fireDebounce();
      expect(calls).toHaveLength(0); // runner never reached — oversize hard reject
      const r = result.current.result;
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.message).toMatch(/> 2 MB/);
      expect(result.current.inputBytes).toBeUndefined();
      // The over-cap payload was NEVER trimmed: no trim() call saw a string as long
      // as bigWs (the `!isOversize &&` short-circuit skips input.trim() entirely).
      expect(trimmedLengths.every((len) => len < bigWs.length)).toBe(true);
    } finally {
      trimSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("uses the 2 MB default when maxInputBytes is omitted", () => {
    vi.useFakeTimers();
    try {
      const { runner, calls } = makeDeferredRunner();
      renderHook(() => useAsyncFormat("<a>hi</a>", OPTS, runner)); // no 4th arg

      fireDebounce();
      expect(calls).toHaveLength(1); // small input runs under the default 2 MB cap
    } finally {
      vi.useRealTimers();
    }
  });

  it("exposes inputBytes without recomputation — 0 / undefined / exact contract", async () => {
    vi.useFakeTimers();
    try {
      // under-cap whitespace → empty → 0 (cap 10 > the 3 whitespace bytes)
      {
        const { runner } = makeDeferredRunner();
        const { result } = renderHook(() =>
          useAsyncFormat("   ", OPTS, runner, 10),
        );
        expect(result.current.inputBytes).toBe(0);
      }
      // over-cap ASCII → undefined (and 0 runner calls)
      {
        const { runner, calls } = makeDeferredRunner();
        const { result } = renderHook(() =>
          useAsyncFormat("x".repeat(50), OPTS, runner, 10),
        );
        fireDebounce();
        expect(result.current.inputBytes).toBeUndefined();
        expect(calls).toHaveLength(0);
      }
      // over-cap multibyte → undefined
      {
        const { runner } = makeDeferredRunner();
        const { result } = renderHook(() =>
          useAsyncFormat("€".repeat(4), OPTS, runner, 10),
        );
        expect(result.current.inputBytes).toBeUndefined();
      }
      // over-cap malformed-surrogate → undefined
      {
        const { runner } = makeDeferredRunner();
        const { result } = renderHook(() =>
          useAsyncFormat("\uD800€".repeat(3), OPTS, runner, 15),
        );
        expect(result.current.inputBytes).toBeUndefined();
      }
      // under-cap error (ASCII) → exact bounded count 2
      {
        const { runner, calls } = makeDeferredRunner();
        const { result } = renderHook(() =>
          useAsyncFormat("ab", OPTS, runner, 10),
        );
        fireDebounce();
        await act(async () => {
          calls[0].resolve(err("bad"));
        });
        expect(result.current.inputBytes).toBe(2);
      }
      // under-cap error (MULTIBYTE) → 3, not the code-unit length 1
      {
        const { runner, calls } = makeDeferredRunner();
        const { result } = renderHook(() =>
          useAsyncFormat("€", OPTS, runner, 10),
        );
        fireDebounce();
        await act(async () => {
          calls[0].resolve(err("bad"));
        });
        expect(result.current.inputBytes).toBe(3);
      }
      // ok → engine-provided inputBytes 2
      {
        const { runner, calls } = makeDeferredRunner();
        const { result } = renderHook(() =>
          useAsyncFormat("ab", OPTS, runner, 10),
        );
        fireDebounce();
        await act(async () => {
          calls[0].resolve({ ok: true, output: "AB", inputBytes: 2, outputBytes: 2 });
        });
        expect(result.current.inputBytes).toBe(2);
      }
    } finally {
      vi.useRealTimers();
    }
  });
});
