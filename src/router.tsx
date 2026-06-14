import { createHashRouter } from "react-router-dom";
import { App } from "./App";
import { LicenseSettings } from "./components/LicenseSettings";
import { ToolRoute } from "./components/ToolRoute";
import { ENABLED_TOOLS } from "./lib/tools/registry";
import { StartupRedirect } from "./shell/StartupRedirect";

// HashRouter (not BrowserRouter): Tauri serves the build as static files, so a
// path like /tools/base64 would 404 on reload — hash routes (#/tools/base64)
// need no server rewrite. A global shortcut or tray item can deep-link to any
// tool by navigating to its route.
//
// The index and catch-all routes resolve which tool to open via the single
// `StartupRedirect`/`resolveStartupTool` seam (SHL-06, D-12/13/14): explicit
// deep-link target > real last-used (from prefs) > hero (protobuf-decoder).
// This replaces the old hardcoded `firstTool` redirect — the opening tool is no
// longer "first in the registry" but the resolved last-used/hero.

// Tool routes render through the element-level <ToolRoute> gate (Phase 18,
// RESEARCH Pitfall 1). React Router's route-level `lazy` option is deliberately
// NOT used: the router memoizes lazy() once per route, which would (a) prevent
// an entitlement flip from swapping upsell↔tool on a mounted route and
// (b) fetch a locked tool's chunk. ToolRoute gates BEFORE invoking the loader,
// so a locked tool's chunk is never fetched. The registry stays the single
// control plane: the route list still derives 1:1 from ENABLED_TOOLS.

// Index/unknown routes resolve the opening tool via the StartupRedirect seam
// (explicit target > last-used > hero). StartupRedirect itself defensively
// handles the (post-Plan-01 unreachable) empty-registry case: resolveStartupTool
// returns the hero id and Navigate targets `/tools/<hero>` — if no such route
// exists the catch-all simply re-matches, never throwing.
const startupElement = <StartupRedirect />;

export const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: startupElement },
      ...ENABLED_TOOLS.map((tool) => ({
        path: `tools/${tool.id}`,
        element: <ToolRoute tool={tool} />,
      })),
      // APP CHROME — NOT a tool (D-87): the license status/management route sits
      // OUTSIDE the six/eleven-tools registry constraint. It is a sibling of the
      // ENABLED_TOOLS.map block above, deliberately NOT derived from it, so the
      // registry stays the single control plane for tools. HashRouter-friendly —
      // reached at #/settings/license (footer + ⌘K route here per D-88).
      { path: "settings/license", element: <LicenseSettings /> },
      // Unknown route -> resolved startup tool (last-used / hero).
      { path: "*", element: startupElement },
    ],
  },
]);
