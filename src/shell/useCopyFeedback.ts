import { useCallback, useEffect, useState } from "react";

// Momentary "Copied" confirmation shared by every copy affordance (the OS gives
// no feedback of its own). Returns [copied, confirm]: call confirm() right after
// writing to the clipboard; `copied` flips true for `durationMs`, then reverts.
// Each confirm() bumps a tick so the effect re-arms — rapid re-copies restart the
// window instead of an in-flight timer cutting it short — and the effect cleanup
// cancels the timer on unmount.
export function useCopyFeedback(durationMs = 1200): [boolean, () => void] {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (tick === 0) return;
    const timer = setTimeout(() => setTick(0), durationMs);
    return () => clearTimeout(timer);
  }, [tick, durationMs]);
  const confirm = useCallback(() => setTick((n) => n + 1), []);
  return [tick > 0, confirm];
}
