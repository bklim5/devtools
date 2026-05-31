// @vitest-environment jsdom
// useCopyFeedback: a shared momentary "Copied" confirmation. confirm() flips
// `copied` true for the duration, then reverts; a second confirm re-arms (restarts)
// the window; the timer is cancelled on unmount.
import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCopyFeedback } from "./useCopyFeedback";

describe("useCopyFeedback", () => {
  it("flips copied true on confirm, then reverts after the duration", () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useCopyFeedback(1000));
      expect(result.current[0]).toBe(false);
      act(() => result.current[1]());
      expect(result.current[0]).toBe(true);
      act(() => vi.advanceTimersByTime(1000));
      expect(result.current[0]).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("re-arms the window on a second confirm (the timer restarts)", () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useCopyFeedback(1000));
      act(() => result.current[1]());
      act(() => vi.advanceTimersByTime(800));
      act(() => result.current[1]()); // re-arm before the first deadline
      act(() => vi.advanceTimersByTime(400)); // past the FIRST deadline (t=1200)
      expect(result.current[0]).toBe(true); // still showing — old timer was cancelled
      act(() => vi.advanceTimersByTime(600)); // full window after the second confirm
      expect(result.current[0]).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels the timer on unmount (no late state update)", () => {
    vi.useFakeTimers();
    try {
      const { result, unmount } = renderHook(() => useCopyFeedback(1000));
      act(() => result.current[1]());
      unmount();
      expect(() => act(() => vi.advanceTimersByTime(1000))).not.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });
});
