import { describe, expect, it } from "vitest";
import {
  initialDownloadProgress,
  reduceDownloadProgress,
} from "./downloadProgress";

describe("reduceDownloadProgress", () => {
  it("Started captures the total and reports no percent yet", () => {
    const { state, pct } = reduceDownloadProgress(initialDownloadProgress, {
      event: "Started",
      data: { contentLength: 200 },
    });
    expect(state).toEqual({ contentLength: 200, downloaded: 0 });
    expect(pct).toBeUndefined();
  });

  it("accumulates chunk bytes into a 0-100 percent of the total", () => {
    const started = reduceDownloadProgress(initialDownloadProgress, {
      event: "Started",
      data: { contentLength: 200 },
    });

    const first = reduceDownloadProgress(started.state, {
      event: "Progress",
      data: { chunkLength: 50 },
    });
    expect(first.pct).toBe(25);

    const second = reduceDownloadProgress(first.state, {
      event: "Progress",
      data: { chunkLength: 50 },
    });
    expect(second.pct).toBe(50);
  });

  it("does NOT report raw chunk bytes as a percent (the 8000% regression)", () => {
    // A single ~8KB chunk of a 1MB download must read ~0.8%, never 8192%.
    let state = initialDownloadProgress;
    ({ state } = reduceDownloadProgress(state, {
      event: "Started",
      data: { contentLength: 1_000_000 },
    }));
    const { pct } = reduceDownloadProgress(state, {
      event: "Progress",
      data: { chunkLength: 8192 },
    });
    expect(pct).toBeCloseTo(0.8192, 4);
    expect(pct).toBeLessThan(1);
  });

  it("clamps to 100 when reported bytes exceed the announced total", () => {
    let state = initialDownloadProgress;
    ({ state } = reduceDownloadProgress(state, {
      event: "Started",
      data: { contentLength: 100 },
    }));
    const { pct } = reduceDownloadProgress(state, {
      event: "Progress",
      data: { chunkLength: 250 },
    });
    expect(pct).toBe(100);
  });

  it("reports no percent when the total size is unknown", () => {
    let state = initialDownloadProgress;
    ({ state } = reduceDownloadProgress(state, {
      event: "Started",
      data: {},
    }));
    const { pct } = reduceDownloadProgress(state, {
      event: "Progress",
      data: { chunkLength: 8192 },
    });
    expect(pct).toBeUndefined();
  });

  it("Finished reports 100 when the total was known, undefined otherwise", () => {
    const known = reduceDownloadProgress(
      { contentLength: 200, downloaded: 200 },
      { event: "Finished" },
    );
    expect(known.pct).toBe(100);

    const unknown = reduceDownloadProgress(
      { contentLength: 0, downloaded: 8192 },
      { event: "Finished" },
    );
    expect(unknown.pct).toBeUndefined();
  });
});
