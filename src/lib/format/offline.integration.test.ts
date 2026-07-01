// No-network integration proof (PRT-04 offline half / PRT-02 engine layer) — the
// load-bearing engine-level offline proof for Phase 32. It drives the REAL prettier
// (formatScript/formatHtml) + esbuild-wasm (minifyScript) wrappers with
// globalThis.fetch / XMLHttpRequest / WebSocket replaced by stand-ins that RECORD +
// THROW if invoked, and asserts every format/minify resolves ok:true while the
// network stand-ins are NEVER called (zero outbound requests). Prettier plugins +
// esbuild-wasm load from vendored npm subpaths / the local wasm service on disk —
// no CDN, no fetch (PITFALLS 10).
//
// OFFLINE-PROOF BOUNDARY (explicit, per ROADMAP criterion #4's "offline e2e"):
// what THIS phase (P32) proves IS an engine-level no-network integration test (this
// file) + a post-build bundle grep for no-CDN + the prettierChunkGuard chunk
// sentinel. What it is NOT — no user-facing tool consumes prettier/esbuild until
// Phase 33/34, so the interactive real-WKWebView paste flow (Wi-Fi off, DevTools
// Network tab clean while prettifying/minifying) CANNOT run this phase. That
// interactive proof is a BLOCKING carry-forward onto Phase 33 (the first mounted
// tool) — recorded in 32-05-PLAN.md must_haves.carry_forward AND as a blocking
// Success-Criteria bullet on the Phase 33 ROADMAP entry. It is not silently deferred.
//
// Runs in the default `node` env (NOT jsdom): jsdom's TextEncoder returns a
// cross-realm Uint8Array that trips esbuild-wasm's own startup invariant (the exact
// Rule-3 blocker Plan 32-04 hit) — node is both correct and sufficient, and the
// network stand-ins are installed on globalThis regardless of environment.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FormatOptions } from "./types";

const opts: FormatOptions = { indent: "2", minify: false };

// Count every outbound-network attempt across all three transport APIs. A real
// engine that reached the network (a CDN plugin fetch, a telemetry ping) would
// increment this — the assertion is that it stays exactly 0.
let networkCalls = 0;

// Loose view of the global so the transport APIs can be swapped for stand-ins
// without fighting the strict lib.dom types (the stand-ins deliberately have no
// UNSENT/OPEN/… statics — they exist only to be counted, never used).
const g = globalThis as unknown as Record<string, unknown>;
let origFetch: unknown;
let origXHR: unknown;
let origWS: unknown;

class ForbiddenXHR {
  constructor() {
    networkCalls++;
    throw new Error("network forbidden: XMLHttpRequest constructed during offline format/minify");
  }
}
class ForbiddenWS {
  constructor() {
    networkCalls++;
    throw new Error("network forbidden: WebSocket constructed during offline format/minify");
  }
}

beforeAll(() => {
  origFetch = g.fetch;
  origXHR = g.XMLHttpRequest;
  origWS = g.WebSocket;
  g.fetch = (...args: unknown[]) => {
    networkCalls++;
    return Promise.reject(
      new Error(`network forbidden: fetch(${String(args[0])}) during offline format/minify`),
    );
  };
  g.XMLHttpRequest = ForbiddenXHR;
  g.WebSocket = ForbiddenWS;
});

afterAll(() => {
  g.fetch = origFetch;
  g.XMLHttpRequest = origXHR;
  g.WebSocket = origWS;
});

describe("offline engine integration (no-network)", () => {
  it("prettier formatScript (JS) runs offline with zero network calls", async () => {
    const { formatScript } = await import("./prettier");
    const r = await formatScript("const a=1", "babel", opts);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toContain("const a = 1;");
    expect(networkCalls).toBe(0);
  });

  it("prettier formatHtml (with embedded script) runs offline with zero network calls", async () => {
    const { formatHtml } = await import("./prettier");
    const r = await formatHtml("<div><script>const a=1</script></div>", opts);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.length).toBeGreaterThan(0);
    expect(networkCalls).toBe(0);
  });

  it("esbuild minifyScript (JS) runs offline with zero network calls", async () => {
    const { __setEsbuildInitForTest, minifyScript } = await import("./minify");
    // esbuild-wasm resolves to its NODE build under vitest; the empty init provider
    // lets it self-load the vendored on-disk service (no browser wasmURL, no fetch).
    __setEsbuildInitForTest(async () => ({}));
    const r = await minifyScript("let a=1;let b=2", "js");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.length).toBeGreaterThan(0);
    expect(networkCalls).toBe(0);
  });

  it("no outbound network call was made by any engine (fetch/XHR/WebSocket all 0)", () => {
    expect(networkCalls).toBe(0);
  });
});
