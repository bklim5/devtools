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
