// @vitest-environment jsdom
// useToolSuccess (UP5-01/UP5-02): the ONE shared settled-success seam.
//
// The notifier arm is selected at MODULE SCOPE from the build constant
// IS_APPSTORE, so the channel cannot be flipped on a live module — every suite
// below imports a FRESH hook module behind `vi.doMock("@/lib/platform/channel")`.
// The appstore suites additionally mock `./reviewPrompt` with a factory that
// records whether it was ever EVALUATED, which is what the direct-channel
// no-invoke proof asserts (Test 9): on the direct build the module must never
// even be loaded, not merely never called.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type Platform,
} from "@/lib/platform";
import { makeMemoryPlatform } from "@/shell/testStore";

/** The appstore arm's target: reviewPrompt.recordSettledSuccess (Task 1). */
const recordSettledSuccess = vi.fn(async () => {});
/** True once the mocked ./reviewPrompt module factory has been EVALUATED. */
let reviewPromptEvaluated = false;

type HookModule = typeof import("./useToolSuccess");

/** Import a FRESH useToolSuccess under the requested build channel. */
async function loadHook(isAppstore: boolean): Promise<HookModule> {
  vi.resetModules();
  recordSettledSuccess.mockClear();
  reviewPromptEvaluated = false;
  vi.doMock("@/lib/platform/channel", () => ({ IS_APPSTORE: isAppstore }));
  vi.doMock("./reviewPrompt", () => {
    reviewPromptEvaluated = true;
    return { recordSettledSuccess };
  });
  return await import("./useToolSuccess");
}

interface HarnessProps {
  toolId: string;
  ok: boolean;
  /** The SUBMITTED SOURCE — the seam keys episodes on the input, never on the
   *  rendered output (so a view/option change is not a new episode). */
  identityInput: string;
  /** An unrelated sibling value (timingMs/byteCount/view-option stand-in) —
   *  changing it re-renders WITHOUT touching the seam's inputs. */
  sibling?: number;
}

/** Build a test component bound to a specific fresh hook module instance. */
function harnessFor(mod: HookModule) {
  return function Harness({ toolId, ok, identityInput, sibling }: HarnessProps) {
    mod.useToolSuccess(toolId, ok, identityInput);
    return <div data-sibling={sibling ?? 0} />;
  };
}

/** Advance fake timers AND drain the microtasks the dynamic import resolves on. */
async function advance(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.doUnmock("@/lib/platform/channel");
  vi.doUnmock("./reviewPrompt");
});

describe("useToolSuccess — appstore channel", () => {
  it("Test 1: counts a settled success only after the full quiet window", async () => {
    vi.useFakeTimers();
    const mod = await loadHook(true);
    const Harness = harnessFor(mod);
    render(<Harness toolId="json-formatter" ok identityInput='{"a":1}' />);

    await advance(mod.SETTLE_MS - 1);
    expect(recordSettledSuccess).toHaveBeenCalledTimes(0);

    await advance(2);
    expect(recordSettledSuccess).toHaveBeenCalledTimes(1);
  });

  it("Test 2: 10s of typing never counts; holding the result once does", async () => {
    vi.useFakeTimers();
    const mod = await loadHook(true);
    const Harness = harnessFor(mod);
    const { rerender } = render(<Harness toolId="json-formatter" ok identityInput="v0" />);

    // A keystroke every 500 ms for 10 s — the window never completes.
    for (let i = 1; i <= 20; i++) {
      await advance(500);
      rerender(<Harness toolId="json-formatter" ok identityInput={`v${i}`} />);
    }
    expect(recordSettledSuccess).toHaveBeenCalledTimes(0);

    await advance(mod.SETTLE_MS + 1);
    expect(recordSettledSuccess).toHaveBeenCalledTimes(1);
  });

  it("Test 3: settle, change the output, settle again = two episodes", async () => {
    vi.useFakeTimers();
    const mod = await loadHook(true);
    const Harness = harnessFor(mod);
    const { rerender } = render(<Harness toolId="base64" ok identityInput="first" />);

    await advance(mod.SETTLE_MS + 1);
    expect(recordSettledSuccess).toHaveBeenCalledTimes(1);

    rerender(<Harness toolId="base64" ok identityInput="second" />);
    await advance(mod.SETTLE_MS + 1);
    expect(recordSettledSuccess).toHaveBeenCalledTimes(2);
  });

  it("Test 4: the SAME output re-rendered many times is exactly ONE episode", async () => {
    vi.useFakeTimers();
    const mod = await loadHook(true);
    const Harness = harnessFor(mod);
    const same = "the same settled output";
    const { rerender } = render(
      <Harness toolId="hash" ok identityInput={same} sibling={0} />,
    );

    await advance(mod.SETTLE_MS + 1);
    expect(recordSettledSuccess).toHaveBeenCalledTimes(1);

    // 20+ re-renders across TWO further settle windows, changing only a sibling
    // value (a timingMs/byteCount churn stand-in) — never the seam's inputs.
    for (let i = 1; i <= 24; i++) {
      rerender(<Harness toolId="hash" ok identityInput={same} sibling={i} />);
      await advance(300);
    }
    await advance(mod.SETTLE_MS * 2);

    expect(recordSettledSuccess).toHaveBeenCalledTimes(1);
  });

  it("Test 5: equal-length outputs that differ (incl. MIDDLE-only) are distinct episodes", async () => {
    vi.useFakeTimers();
    const mod = await loadHook(true);
    const Harness = harnessFor(mod);

    // (i) the short pair.
    const { rerender } = render(<Harness toolId="url" ok identityInput="abcd" />);
    await advance(mod.SETTLE_MS + 1);
    rerender(<Harness toolId="url" ok identityInput="wxyz" />);
    await advance(mod.SETTLE_MS + 1);
    expect(recordSettledSuccess).toHaveBeenCalledTimes(2);
    expect(mod.successIdentity("url", "abcd")).not.toBe(
      mod.successIdentity("url", "wxyz"),
    );

    // (ii) the REQUIRED case: >16 KB, byte-identical 4 KB head AND 4 KB tail,
    // differing only somewhere in the MIDDLE — the shape of a large JSON/XML
    // edit. A head/tail-truncated digest could not tell these apart, which is
    // exactly why truncation was removed.
    const head = "H".repeat(4096);
    const tail = "T".repeat(4096);
    const midA = `${"m".repeat(4000)}A${"m".repeat(4000)}`;
    const midB = `${"m".repeat(4000)}B${"m".repeat(4000)}`;
    const bigA = head + midA + tail;
    const bigB = head + midB + tail;
    expect(bigA.length).toBe(bigB.length);
    expect(bigA.length).toBeGreaterThan(16_000);
    expect(bigA.slice(0, 4096)).toBe(bigB.slice(0, 4096));
    expect(bigA.slice(-4096)).toBe(bigB.slice(-4096));
    expect(mod.successIdentity("json-formatter", bigA)).not.toBe(
      mod.successIdentity("json-formatter", bigB),
    );

    rerender(<Harness toolId="json-formatter" ok identityInput={bigA} />);
    await advance(mod.SETTLE_MS + 1);
    rerender(<Harness toolId="json-formatter" ok identityInput={bigB} />);
    await advance(mod.SETTLE_MS + 1);
    expect(recordSettledSuccess).toHaveBeenCalledTimes(4);
  });

  it("Test 6: the same text from a DIFFERENT tool is a different episode", async () => {
    vi.useFakeTimers();
    const mod = await loadHook(true);
    const Harness = harnessFor(mod);
    const shared = "deadbeef";

    const { rerender } = render(<Harness toolId="base64" ok identityInput={shared} />);
    await advance(mod.SETTLE_MS + 1);
    rerender(<Harness toolId="hash" ok identityInput={shared} />);
    await advance(mod.SETTLE_MS + 1);

    expect(recordSettledSuccess).toHaveBeenCalledTimes(2);
    expect(mod.successIdentity("base64", shared)).not.toBe(
      mod.successIdentity("hash", shared),
    );
  });

  it("Test 7: ok=false (error or empty) never counts, whatever the output holds", async () => {
    vi.useFakeTimers();
    const mod = await loadHook(true);
    const Harness = harnessFor(mod);

    const { rerender } = render(
      <Harness toolId="jwt" ok={false} identityInput="stale payload text" />,
    );
    await advance(10_000);
    rerender(<Harness toolId="jwt" ok={false} identityInput="" />);
    await advance(10_000);

    expect(recordSettledSuccess).toHaveBeenCalledTimes(0);
  });

  it("Test 8a: re-pasting the IDENTICAL source is still ONE episode, even across an ok flap", async () => {
    vi.useFakeTimers();
    const mod = await loadHook(true);
    const Harness = harnessFor(mod);
    const src = "089601";

    const { rerender } = render(
      <Harness toolId="protobuf-decoder" ok identityInput={src} />,
    );
    await advance(mod.SETTLE_MS + 1);
    expect(recordSettledSuccess).toHaveBeenCalledTimes(1);

    // Clear the field (ok=false), then paste EXACTLY the same thing again. The
    // user accomplished one thing, not two.
    rerender(<Harness toolId="protobuf-decoder" ok={false} identityInput="" />);
    await advance(mod.SETTLE_MS + 1);
    rerender(<Harness toolId="protobuf-decoder" ok identityInput={src} />);
    await advance(mod.SETTLE_MS + 1);

    expect(recordSettledSuccess).toHaveBeenCalledTimes(1);
  });

  it("Test 8b: a VIEW/OPTION change (same source) is not an episode; a new source is", async () => {
    vi.useFakeTimers();
    const mod = await loadHook(true);
    const Harness = harnessFor(mod);
    const src = '{"a":1}';

    // The tool settles one success on this source.
    const { rerender } = render(
      <Harness toolId="json-formatter" ok identityInput={src} sibling={0} />,
    );
    await advance(mod.SETTLE_MS + 1);
    expect(recordSettledSuccess).toHaveBeenCalledTimes(1);

    // Now toggle view options (indent 2→4→tab, sort-keys, a LEN chip, a regex
    // flag …). Each re-renders the tool and changes what is DISPLAYED — the
    // seam's `identityInput` is unchanged because none of them is input.
    for (const option of [1, 2, 3, 4]) {
      rerender(
        <Harness toolId="json-formatter" ok identityInput={src} sibling={option} />,
      );
      await advance(mod.SETTLE_MS + 1);
    }
    expect(recordSettledSuccess).toHaveBeenCalledTimes(1);

    // A genuinely different SOURCE is a second episode.
    rerender(<Harness toolId="json-formatter" ok identityInput='{"a":2}' />);
    await advance(mod.SETTLE_MS + 1);
    expect(recordSettledSuccess).toHaveBeenCalledTimes(2);
  });

  it("Test 8: unmounting before the window elapses cancels the episode", async () => {
    vi.useFakeTimers();
    const mod = await loadHook(true);
    const Harness = harnessFor(mod);
    const { unmount } = render(<Harness toolId="cron" ok identityInput="0 9 * * 1-5" />);

    await advance(mod.SETTLE_MS - 500);
    unmount();
    await advance(10_000);

    expect(recordSettledSuccess).toHaveBeenCalledTimes(0);
  });
});

describe("useToolSuccess — direct channel (runtime no-invoke proof)", () => {
  afterEach(() => {
    resetPlatformForTest();
  });

  it("Test 9: three settled successes invoke nothing and never load reviewPrompt", async () => {
    vi.useFakeTimers();
    const request = vi.fn(async () => {});
    const set = vi.fn<(key: string, value: unknown) => void>();
    const memory = makeMemoryPlatform();
    const p: Platform = {
      ...memory,
      review: { request },
      store: {
        ...memory.store,
        set: async (key: string, value: unknown) => {
          set(key, value);
          await memory.store.set(key, value);
        },
      },
    };
    setPlatformForTest(p);

    const mod = await loadHook(false);
    const Harness = harnessFor(mod);
    const { rerender } = render(<Harness toolId="base64" ok identityInput="one" />);
    await advance(mod.SETTLE_MS + 1);
    rerender(<Harness toolId="base64" ok identityInput="two" />);
    await advance(mod.SETTLE_MS + 1);
    rerender(<Harness toolId="base64" ok identityInput="three" />);
    await advance(mod.SETTLE_MS + 1);

    expect(recordSettledSuccess).toHaveBeenCalledTimes(0);
    expect(request).toHaveBeenCalledTimes(0);
    expect(reviewPromptEvaluated).toBe(false);
    // No persisted blob may carry a counted success on the direct build.
    for (const [, value] of set.mock.calls) {
      const blob = value as Record<string, unknown> | null;
      if (blob && typeof blob === "object") {
        expect(blob.toolSuccessCount ?? 0).toBe(0);
      }
    }
  });
});

describe("fnv1a32", () => {
  it("Test 10: known vectors, purity, and a full 2 MB scan well under 50 ms", async () => {
    const mod = await loadHook(true);

    // FNV-1a 32-bit offset basis — the empty string hashes to the basis itself.
    expect(mod.fnv1a32("")).toBe(0x811c9dc5);
    expect(mod.fnv1a32("a")).not.toBe(mod.fnv1a32("b"));
    // Pure: same input, same output, across calls.
    expect(mod.fnv1a32("devtools")).toBe(mod.fnv1a32("devtools"));

    // A SETTLE-time-only cost (at most once per quiet window), so a full scan
    // with no truncation is irrelevant to render performance.
    const twoMb = "x".repeat(2 * 1024 * 1024);
    const start = performance.now();
    mod.fnv1a32(twoMb);
    expect(performance.now() - start).toBeLessThan(50);
  });
});

describe("SETTLE_MS dev/e2e override", () => {
  it("Test 12: __setSettleMsForTest shortens the quiet window and restores it", async () => {
    vi.useFakeTimers();
    const mod = await loadHook(true);
    const Harness = harnessFor(mod);
    try {
      mod.__setSettleMsForTest(200);
      expect(mod.currentSettleMs()).toBe(200);

      const { rerender } = render(<Harness toolId="base64" ok identityInput="a" />);
      await advance(199);
      expect(recordSettledSuccess).toHaveBeenCalledTimes(0);
      await advance(2);
      expect(recordSettledSuccess).toHaveBeenCalledTimes(1);

      // Restoring puts the SHIPPED window back — a shortened window can never
      // outlive the override.
      mod.__setSettleMsForTest();
      expect(mod.currentSettleMs()).toBe(mod.SETTLE_MS);
      rerender(<Harness toolId="base64" ok identityInput="b" />);
      await advance(mod.SETTLE_MS - 1);
      expect(recordSettledSuccess).toHaveBeenCalledTimes(1);
      await advance(2);
      expect(recordSettledSuccess).toHaveBeenCalledTimes(2);
    } finally {
      mod.__setSettleMsForTest();
    }
  });
});

describe("useToolSuccess — render path", () => {
  it("Test 11: 50 re-renders of a 2 MB output hash ZERO times until settle, then once", async () => {
    vi.useFakeTimers();
    const mod = await loadHook(true);
    const Harness = harnessFor(mod);
    const twoMb = "y".repeat(2 * 1024 * 1024);

    expect(mod.__hashCallCountForTest()).toBe(0);

    const { rerender } = render(
      <Harness toolId="json-formatter" ok identityInput={twoMb} sibling={0} />,
    );
    for (let i = 1; i <= 50; i++) {
      rerender(<Harness toolId="json-formatter" ok identityInput={twoMb} sibling={i} />);
    }
    // Still inside the SAME quiet window: nothing has been hashed.
    await advance(mod.SETTLE_MS - 1);
    expect(mod.__hashCallCountForTest()).toBe(0);

    await advance(2);
    expect(mod.__hashCallCountForTest()).toBe(1);
    expect(recordSettledSuccess).toHaveBeenCalledTimes(1);
  });
});
