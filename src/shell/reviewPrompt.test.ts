// App Store review prompt core (UP5-01/UP5-02) — the recurring 3rd-success
// boundary + 7-day-gap cadence, serialized, stamped only after the native request
// resolves.
//
// NODE environment on purpose: the core is pure module state + the prefs
// singleton + the platform seam, with no DOM beyond an optional
// `document.hasFocus()` probe (which the frontmost tests install explicitly).
//
// EVERY cadence expectation is built off the INJECTED clock (`__setReviewClockForTest`
// driving a mutable `t`) — never off `Date.now()`. A wall-clock-dependent cadence
// test is a time bomb that rots (memory: license-fixture-cert-time-bombs); the
// only test allowed to touch the real clock is Test 15, which asserts the
// injection seam DEFAULTS to it.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type Platform,
} from "@/lib/platform";
import { makeMemoryPlatform } from "./testStore";
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_STORE_KEY,
  type Preferences,
} from "./preferences";
import { mergePreferences } from "./prefsStore";
import {
  flushPreferences,
  getSharedPreferences,
  resetPreferencesForTest,
} from "./usePreferences";
import {
  FUTURE_STAMP_SLACK_MS,
  MAX_TOOL_SUCCESS_COUNT,
  MIN_REQUEST_GAP_MS,
  REQUEST_TIMEOUT_MS,
  SUCCESS_INTERVAL,
  __resetReviewPromptForTest,
  __setReviewClockForTest,
  recordSettledSuccess,
} from "./reviewPrompt";

/** Arbitrary fixed epoch-ms the injected clock starts at. Its VALUE is irrelevant
 *  — every expectation is relative to it, so this suite can never rot. */
const T0 = 1_700_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Drain pending microtasks + the `void savePreferences(...)` write. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

type SetSpy = ReturnType<typeof vi.fn<(key: string, value: unknown) => Promise<void>>>;

/** Mutable clock every test drives explicitly. */
let t = T0;
function setClock(value: number): void {
  t = value;
}

/** The persisted blobs a test observed, in write order. */
function writtenBlobs(set: SetSpy): Preferences[] {
  return set.mock.calls
    .filter((call) => call[0] === PREFERENCES_STORE_KEY)
    .map((call) => call[1] as Preferences);
}

interface Harness {
  set: SetSpy;
  request: ReturnType<typeof vi.fn<() => Promise<void>>>;
}

/** Install a fresh prefs singleton + platform whose store is seeded with `seed`
 *  merged over the defaults, and whose review arm is an observable spy. */
function install(
  seed: Partial<Preferences> = {},
  review?: Partial<Platform["review"]>,
): Harness {
  const map = new Map<string, unknown>();
  map.set(PREFERENCES_STORE_KEY, { ...DEFAULT_PREFERENCES, ...seed });
  const set: SetSpy = vi.fn(async (key: string, value: unknown) => {
    map.set(key, value);
  });
  const request = vi.fn<() => Promise<void>>(async () => {});
  const store = { get: async (key: string) => map.get(key), set };
  setPlatformForTest({
    ...makeMemoryPlatform(store),
    review: { request, ...review },
  });
  return { set, request };
}

/** Drive N settled successes, awaiting each (the queue serializes anyway). */
async function drive(n: number): Promise<void> {
  for (let i = 0; i < n; i++) await recordSettledSuccess();
  await flush();
}

type FakeDoc = { hasFocus: () => boolean };
function setFakeDocument(hasFocus: () => boolean): void {
  (globalThis as unknown as { document?: FakeDoc }).document = { hasFocus };
}
function clearFakeDocument(): void {
  delete (globalThis as unknown as { document?: FakeDoc }).document;
}

beforeEach(() => {
  resetPreferencesForTest();
  __resetReviewPromptForTest();
  setClock(T0);
  __setReviewClockForTest(() => t);
});

afterEach(async () => {
  await flush(); // let any in-flight persist land before the seam is torn down
  clearFakeDocument();
  __resetReviewPromptForTest();
  resetPreferencesForTest();
  resetPlatformForTest();
  vi.restoreAllMocks();
});

describe("reviewPrompt — the recurring 3rd-success boundary (UP5-01/UP5-02)", () => {
  it("Test 1: three settled successes persist 1, 2, 3 and request EXACTLY ONCE, on the third", async () => {
    const { set, request } = install();

    await recordSettledSuccess();
    expect(getSharedPreferences().toolSuccessCount).toBe(1);
    expect(request).toHaveBeenCalledTimes(0);

    await recordSettledSuccess();
    expect(getSharedPreferences().toolSuccessCount).toBe(2);
    expect(request).toHaveBeenCalledTimes(0);

    await recordSettledSuccess();
    expect(getSharedPreferences().toolSuccessCount).toBe(3);
    expect(request).toHaveBeenCalledTimes(1);

    await flush();
    // Persisted through the single-writer singleton — but only the BOUNDARY
    // count reaches disk (counts 1 and 2 are memory-only; see Test 16), so the
    // writes here are the count-3 blob and the stamp blob that follows it.
    expect(writtenBlobs(set).map((b) => b.toolSuccessCount)).toEqual([3, 3]);
  });

  it("Test 2: the stamp is persisted ONLY AFTER the native request resolves", async () => {
    let resolveRequest!: () => void;
    const deferred = vi.fn<() => Promise<void>>(
      () =>
        new Promise<void>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const { set } = install({}, { request: deferred });

    await recordSettledSuccess();
    await recordSettledSuccess();

    const third = recordSettledSuccess();
    await flush();

    // The request is in flight...
    expect(deferred).toHaveBeenCalledTimes(1);
    // ...and NOTHING has been stamped yet.
    expect(getSharedPreferences().lastReviewRequestAt).toBeNull();
    expect(
      writtenBlobs(set).every((b) => b.lastReviewRequestAt === null),
    ).toBe(true);

    resolveRequest();
    await third;
    await flush();

    // Only now does the stamp land, at the INJECTED clock's value.
    expect(getSharedPreferences().lastReviewRequestAt).toBe(T0);
    expect(
      writtenBlobs(set).filter((b) => b.lastReviewRequestAt === T0),
    ).toHaveLength(1);
  });

  it("Test 3: non-boundary counts never fire, and a request never resets the counter", async () => {
    const { request } = install();

    await drive(3);
    expect(request).toHaveBeenCalledTimes(1);
    expect(getSharedPreferences().lastReviewRequestAt).toBe(T0);

    await recordSettledSuccess();
    expect(getSharedPreferences().toolSuccessCount).toBe(4); // keeps climbing
    await recordSettledSuccess();
    expect(getSharedPreferences().toolSuccessCount).toBe(5);

    expect(request).toHaveBeenCalledTimes(1);
    expect(getSharedPreferences().lastReviewRequestAt).toBe(T0);
  });

  it("Test 4: a boundary INSIDE the 7-day gap does not invoke, but the counter still advances", async () => {
    const { set, request } = install();

    await drive(3);
    expect(request).toHaveBeenCalledTimes(1);

    setClock(T0 + MIN_REQUEST_GAP_MS - 1); // one millisecond short
    await drive(3); // counts 4, 5, 6

    expect(getSharedPreferences().toolSuccessCount).toBe(6);
    expect(writtenBlobs(set).some((b) => b.toolSuccessCount === 6)).toBe(true);
    expect(request).toHaveBeenCalledTimes(1); // still just the count-3 request
    expect(getSharedPreferences().lastReviewRequestAt).toBe(T0); // unchanged
  });

  it("Test 5: a boundary AFTER the gap fires again — the >= edge is inclusive", async () => {
    const { request } = install();

    await drive(3);
    const stamp = getSharedPreferences().lastReviewRequestAt;
    expect(stamp).toBe(T0);

    // gap - 1 ms at count 6: NO call.
    setClock(T0 + MIN_REQUEST_GAP_MS - 1);
    await drive(3);
    expect(getSharedPreferences().toolSuccessCount).toBe(6);
    expect(request).toHaveBeenCalledTimes(1);

    // exactly gap at count 9: CALLS.
    setClock(T0 + MIN_REQUEST_GAP_MS);
    await drive(3);
    expect(getSharedPreferences().toolSuccessCount).toBe(9);
    expect(request).toHaveBeenCalledTimes(2);
    expect(getSharedPreferences().lastReviewRequestAt).toBe(
      T0 + MIN_REQUEST_GAP_MS,
    );
  });

  it("Test 6: a mid-session counter that has never requested fires at its next boundary", async () => {
    const { request } = install({ toolSuccessCount: 2, lastReviewRequestAt: null });

    await drive(1);

    expect(getSharedPreferences().toolSuccessCount).toBe(3);
    expect(request).toHaveBeenCalledTimes(1);
    expect(getSharedPreferences().lastReviewRequestAt).toBe(T0);
  });

  it("Test 7: a stamp from a previous session suppresses the next boundary until the gap elapses", async () => {
    const previousStamp = T0 - DAY_MS;
    const { request } = install({
      toolSuccessCount: 5,
      lastReviewRequestAt: previousStamp,
    });

    await drive(1); // count 6 — a boundary, but only 1 day since the stamp
    expect(getSharedPreferences().toolSuccessCount).toBe(6);
    expect(request).toHaveBeenCalledTimes(0);
    expect(getSharedPreferences().lastReviewRequestAt).toBe(previousStamp);

    setClock(previousStamp + MIN_REQUEST_GAP_MS);
    await drive(3); // counts 7, 8, 9
    expect(getSharedPreferences().toolSuccessCount).toBe(9);
    expect(request).toHaveBeenCalledTimes(1);
    expect(getSharedPreferences().lastReviewRequestAt).toBe(
      previousStamp + MIN_REQUEST_GAP_MS,
    );
  });

  it("Test 8: not frontmost defers to the NEXT boundary — never a mid-interval retry", async () => {
    let focused = false;
    setFakeDocument(() => focused);
    const { set, request } = install();

    await drive(3);
    expect(getSharedPreferences().toolSuccessCount).toBe(3);
    expect(request).toHaveBeenCalledTimes(0);
    expect(getSharedPreferences().lastReviewRequestAt).toBeNull();
    expect(writtenBlobs(set).every((b) => b.lastReviewRequestAt === null)).toBe(true);

    focused = true;
    await drive(2); // counts 4, 5 — not boundaries, so still nothing
    expect(request).toHaveBeenCalledTimes(0);

    await drive(1); // count 6 — the next boundary gets the turn
    expect(request).toHaveBeenCalledTimes(1);
    expect(getSharedPreferences().lastReviewRequestAt).toBe(T0);
  });

  it("Test 9: a failed prefs load persists nothing and never requests", async () => {
    const set: SetSpy = vi.fn(async () => {});
    const request = vi.fn<() => Promise<void>>(async () => {});
    setPlatformForTest({
      ...makeMemoryPlatform({
        get: async () => {
          throw new Error("store read failed");
        },
        set,
      }),
      review: { request },
    });

    await drive(3);

    expect(set).toHaveBeenCalledTimes(0); // never clobber the real on-disk blob
    expect(request).toHaveBeenCalledTimes(0);
    expect(getSharedPreferences().toolSuccessCount).toBe(0);
  });

  it("Test 10: a native failure persists nothing and the NEXT boundary retries", async () => {
    const request = vi.fn<() => Promise<void>>(async () => {});
    request.mockRejectedValueOnce(new Error("no window to anchor the sheet"));
    const { set } = install({}, { request });

    // Count 3: the OS was never asked, so nothing may be stamped.
    await expect(drive(3)).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledTimes(1);
    expect(getSharedPreferences().lastReviewRequestAt).toBeNull();

    // Counts 4, 5, 6: the counter keeps climbing and the retry lands at 6 —
    // a null stamp means no gap to wait out, and no `done` latch exists.
    await drive(3);
    expect(getSharedPreferences().toolSuccessCount).toBe(6);
    expect(request).toHaveBeenCalledTimes(2);
    expect(getSharedPreferences().lastReviewRequestAt).toBe(T0);
    expect(
      writtenBlobs(set).filter((b) => b.lastReviewRequestAt !== null),
    ).toHaveLength(1); // stamped exactly once
  });

  it("Test 11: ten same-tick calls serialize to 10 with EXACTLY ONE request", async () => {
    const { request } = install();

    // Issued in the same tick, none awaited — the queue is the only guard.
    const pending = Array.from({ length: 10 }, () => recordSettledSuccess());
    await Promise.all(pending);
    await flush();

    expect(getSharedPreferences().toolSuccessCount).toBe(10); // no lost update
    // Count 3 fires; counts 6 and 9 are suppressed by the gap against the stamp
    // written at 3 (the injected clock does not advance during the tick).
    expect(request).toHaveBeenCalledTimes(1);
    expect(getSharedPreferences().lastReviewRequestAt).toBe(T0);
  });

  it("Test 12: two module instances race — at most one request PER INSTANCE, EXACTLY ONE stamp", async () => {
    // A second, ISOLATED instance of this module. `./usePreferences` and
    // `@/lib/platform` stay SHARED singletons (only reviewPrompt re-evaluates),
    // so both instances write the same blob through the same single writer.
    const specifier = "./reviewPrompt?instance=2";
    const b = (await import(/* @vite-ignore */ specifier)) as typeof import("./reviewPrompt");
    expect(b.recordSettledSuccess).not.toBe(recordSettledSuccess); // truly a 2nd instance
    b.__resetReviewPromptForTest();
    b.__setReviewClockForTest(() => t);

    // Park BOTH instances inside their native request by deferring it.
    const resolvers: Array<() => void> = [];
    const request = vi.fn<() => Promise<void>>(
      () => new Promise<void>((resolve) => resolvers.push(resolve)),
    );
    const { set } = install({ toolSuccessCount: 2 }, { request });

    // Instance A reaches the count-3 boundary and parks in the request.
    const aCall = recordSettledSuccess();
    await flush();
    expect(request).toHaveBeenCalledTimes(1);

    // Instance B climbs 4, 5, 6 and reaches its own boundary. The stamp is still
    // null (A has not resolved), so B legitimately asks too — cross-instance
    // NATIVE dedup is the Task-3 process in-flight guard, not this module's job.
    const bCalls = [
      b.recordSettledSuccess(),
      b.recordSettledSuccess(),
      b.recordSettledSuccess(),
    ];
    await flush();
    expect(request).toHaveBeenCalledTimes(2); // exactly one PER INSTANCE

    setClock(T0 + 5); // the winner's stamp value, distinguishable from the loser's
    resolvers[0]!();
    await aCall;
    await flush();
    expect(getSharedPreferences().lastReviewRequestAt).toBe(T0 + 5);

    setClock(T0 + 9); // would be the loser's stamp — it must never be written
    resolvers[1]!();
    await Promise.all(bCalls);
    await flush();

    // The loser's post-resolve gap re-read sees the winner's fresh stamp and skips.
    expect(getSharedPreferences().lastReviewRequestAt).toBe(T0 + 5);
    expect(
      writtenBlobs(set).filter((blob) => blob.lastReviewRequestAt !== null),
    ).toHaveLength(1);
    expect(getSharedPreferences().toolSuccessCount).toBe(6); // no lost update
  });

  it("Test 13: the constants contract (and the deliberate prefsStore duplication)", () => {
    expect(SUCCESS_INTERVAL).toBe(3);
    expect(MIN_REQUEST_GAP_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(MIN_REQUEST_GAP_MS).toBe(604800000);
    // prefsStore keeps its OWN copy of the ceiling (it must not import this
    // appstore-only module); its clamp must equal ours.
    expect(mergePreferences({ toolSuccessCount: 1e12 }).toolSuccessCount).toBe(
      MAX_TOOL_SUCCESS_COUNT,
    );
    // A clamped counter can never stand permanently on a request boundary.
    expect(MAX_TOOL_SUCCESS_COUNT % SUCCESS_INTERVAL).not.toBe(0);
  });

  it("Test 14: a counter pinned at the ceiling writes nothing and never fires", async () => {
    const { set, request } = install({
      toolSuccessCount: MAX_TOOL_SUCCESS_COUNT,
      lastReviewRequestAt: null,
    });

    await drive(5);

    expect(getSharedPreferences().toolSuccessCount).toBe(MAX_TOOL_SUCCESS_COUNT);
    expect(set).toHaveBeenCalledTimes(0);
    expect(request).toHaveBeenCalledTimes(0);
  });

  it("Test 16: sub-boundary counts are memory-only; a flush persists them", async () => {
    const { set } = install();

    await drive(2);
    // In MEMORY the counter is exact — every gate below reads this, so cadence
    // semantics are untouched by the write bound.
    expect(getSharedPreferences().toolSuccessCount).toBe(2);
    // …but nothing has hit disk: two settled successes = zero prefs writes.
    expect(writtenBlobs(set)).toHaveLength(0);

    // The window-hide / pagehide path (and any other prefs write) lands it.
    await flushPreferences();
    await flush();
    expect(writtenBlobs(set).map((b) => b.toolSuccessCount)).toEqual([2]);

    // A second flush with nothing outstanding is a no-op, not a rewrite.
    await flushPreferences();
    await flush();
    expect(writtenBlobs(set)).toHaveLength(1);
  });

  it("Test 17: an implausibly FUTURE stamp is ignored rather than bricking the prompt", async () => {
    // A backwards clock correction / hand-edited blob leaves a stamp a YEAR
    // ahead. Honoring it as a rate limit would suppress the prompt until real
    // time caught up — i.e. forever, in practice.
    const { request } = install({
      toolSuccessCount: 2,
      lastReviewRequestAt: T0 + 365 * DAY_MS,
    });

    await drive(1); // count 3 — the boundary
    expect(request).toHaveBeenCalledTimes(1);
    // …and the garbage stamp is overwritten by a real one.
    expect(getSharedPreferences().lastReviewRequestAt).toBe(T0);
  });

  it("Test 17b: a stamp only SLIGHTLY ahead is still honored as a rate limit", async () => {
    // Ordinary clock jitter (NTP step, DST-adjacent nudge) must not become a
    // licence to prompt early — only an implausible future is discarded.
    const { request } = install({
      toolSuccessCount: 2,
      lastReviewRequestAt: T0 + FUTURE_STAMP_SLACK_MS - 1,
    });

    await drive(1); // count 3 — a boundary, but inside the (negative) gap
    expect(request).toHaveBeenCalledTimes(0);
    expect(getSharedPreferences().lastReviewRequestAt).toBe(
      T0 + FUTURE_STAMP_SLACK_MS - 1,
    );
  });

  it("Test 18: a native request that never settles times out, stamps nothing, and leaves the queue usable", async () => {
    vi.useFakeTimers();
    try {
      const request = vi.fn<() => Promise<void>>(async () => {});
      // The pathological case: a wedged main thread / lost IPC reply.
      request.mockImplementationOnce(() => new Promise<void>(() => {}));
      const { set } = install({}, { request });

      const first = drive(3);
      await vi.advanceTimersByTimeAsync(1);
      expect(request).toHaveBeenCalledTimes(1);
      expect(getSharedPreferences().toolSuccessCount).toBe(3);

      // One millisecond short of the deadline: still outstanding, still unstamped.
      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 2);
      expect(getSharedPreferences().lastReviewRequestAt).toBeNull();

      await vi.advanceTimersByTimeAsync(2);
      await first;
      // Timed out = "we cannot know the OS was asked" → persist NOTHING.
      expect(getSharedPreferences().lastReviewRequestAt).toBeNull();

      // The queue is NOT parked behind the dead promise: the next boundary runs.
      const second = drive(3);
      await vi.advanceTimersByTimeAsync(1);
      await second;
      expect(request).toHaveBeenCalledTimes(2);
      expect(getSharedPreferences().toolSuccessCount).toBe(6);
      expect(getSharedPreferences().lastReviewRequestAt).toBe(T0);
      expect(
        writtenBlobs(set).filter((b) => b.lastReviewRequestAt !== null),
      ).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("Test 19: the stamp is DURABLE — the call does not resolve until the write lands", async () => {
    // Fire-and-forget would resolve here with the stamp still only in memory, so
    // a quit in the next few ms loses it and the app re-asks at the very next
    // boundary — the 7-day floor silently stops meaning anything.
    const map = new Map<string, unknown>();
    map.set(PREFERENCES_STORE_KEY, { ...DEFAULT_PREFERENCES });
    /** Resolvers for the writes that CARRY the stamp (the count write is not gated). */
    const gatedWrites: Array<() => void> = [];
    const set: SetSpy = vi.fn(async (key: string, value: unknown) => {
      if ((value as Preferences).lastReviewRequestAt !== null) {
        await new Promise<void>((resolve) => gatedWrites.push(resolve));
      }
      map.set(key, value);
    });
    const request = vi.fn<() => Promise<void>>(async () => {});
    setPlatformForTest({
      ...makeMemoryPlatform({ get: async (key: string) => map.get(key), set }),
      review: { request },
    });

    await recordSettledSuccess();
    await recordSettledSuccess();

    let resolved = false;
    const third = recordSettledSuccess().then(() => {
      resolved = true;
    });
    await flush();

    // The OS has been asked and the stamp is live IN MEMORY (the in-session gap
    // gate is correct immediately)...
    expect(request).toHaveBeenCalledTimes(1);
    expect(getSharedPreferences().lastReviewRequestAt).toBe(T0);
    // ...the write is in flight, nothing is on "disk" yet...
    expect(gatedWrites).toHaveLength(1);
    expect((map.get(PREFERENCES_STORE_KEY) as Preferences).lastReviewRequestAt).toBeNull();
    // ...and the call has NOT resolved: durability is part of its contract.
    expect(resolved).toBe(false);

    gatedWrites[0]!();
    await third;

    expect(resolved).toBe(true);
    expect((map.get(PREFERENCES_STORE_KEY) as Preferences).lastReviewRequestAt).toBe(T0);
  });

  it("Test 20: a REJECTED stamp write does not wedge the queue, and stays flushable", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const map = new Map<string, unknown>();
    map.set(PREFERENCES_STORE_KEY, { ...DEFAULT_PREFERENCES });
    let failStampWrite = true;
    const set: SetSpy = vi.fn(async (key: string, value: unknown) => {
      if (failStampWrite && (value as Preferences).lastReviewRequestAt !== null) {
        throw new Error("store write failed");
      }
      map.set(key, value);
    });
    const request = vi.fn<() => Promise<void>>(async () => {});
    setPlatformForTest({
      ...makeMemoryPlatform({ get: async (key: string) => map.get(key), set }),
      review: { request },
    });

    // The boundary call still RESOLVES (never rejects, never hangs) …
    await expect(drive(3)).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledTimes(1);
    // … the stamp is live in memory …
    expect(getSharedPreferences().lastReviewRequestAt).toBe(T0);
    // … the failure was logged (dev/test only) …
    expect(warn).toHaveBeenCalled();
    // … and nothing reached disk.
    expect((map.get(PREFERENCES_STORE_KEY) as Preferences).lastReviewRequestAt).toBeNull();

    // The QUEUE is still functional: later successes keep counting, and the
    // in-memory stamp correctly suppresses the next boundary.
    await drive(3); // counts 4, 5, 6
    expect(getSharedPreferences().toolSuccessCount).toBe(6);
    expect(request).toHaveBeenCalledTimes(1);

    // The failed write was NOT dropped: it is still outstanding, so a flush
    // (pagehide / window-hide) retries it once the store recovers.
    failStampWrite = false;
    await flushPreferences();
    expect((map.get(PREFERENCES_STORE_KEY) as Preferences).lastReviewRequestAt).toBe(T0);
    expect((map.get(PREFERENCES_STORE_KEY) as Preferences).toolSuccessCount).toBe(6);
  });

  it("Test 15: the injection seam defaults to the real clock, and the reset restores it", async () => {
    // First prove an override is honored...
    const sentinel = 42_000;
    __setReviewClockForTest(() => sentinel);
    const { request } = install();
    await drive(3);
    expect(request).toHaveBeenCalledTimes(1);
    expect(getSharedPreferences().lastReviewRequestAt).toBe(sentinel);

    // ...then that the reset restores Date.now for the NEXT boundary. (The
    // sentinel stamp is ancient relative to the real clock, so the gap is clear.)
    __resetReviewPromptForTest();
    const before = Date.now();
    await drive(3); // counts 4, 5, 6
    const after = Date.now();

    const stamp = getSharedPreferences().lastReviewRequestAt ?? 0;
    expect(request).toHaveBeenCalledTimes(2);
    expect(stamp).toBeGreaterThan(0);
    expect(stamp).toBeGreaterThanOrEqual(before);
    expect(stamp).toBeLessThanOrEqual(after);
  });
});
