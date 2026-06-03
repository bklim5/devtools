// Thin off-main-thread transport for the Regex tester (Phase 14). ALL real logic
// lives in regex.ts (pure, total, TDD'd) — this file only ferries a request in and
// a result out, so a catastrophic-backtracking match holds the WORKER's event loop
// (killable via terminate() in Plan 03), never the window (T-14-01). Compiling the
// RegExp INSIDE the worker keeps a catastrophic COMPILE off-thread too (D-14).
//
// Vite bundles this as a same-origin module chunk via
//   new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })
// in Plan 03 — that passes the project CSP `script-src 'self'` with NO CSP change
// (RESEARCH Pitfall 1). There is deliberately NO object-URL / blob fallback worker
// (the CSP would refuse it). Not unit-testable in node/jsdom (no real Worker); its logic
// is covered by regex.test.ts and its transport by the Plan-03 real-WKWebView e2e.
import { runRegex, type RegexRequest } from "./regex";

self.onmessage = (e: MessageEvent<RegexRequest>) => {
  const result = runRegex(e.data); // pure + total: {matches,replaced?} | {error} | {empty}
  (self as unknown as Worker).postMessage({ id: e.data.id, ...result }); // {id, ...result} (Pattern 2)
};
