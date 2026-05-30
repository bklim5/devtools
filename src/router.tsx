import type { ComponentType, ReactElement } from "react";
import { createHashRouter } from "react-router-dom";
import { App } from "./App";
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

// ToolDefinition.component is `ComponentType | LazyComponent`. Under React 19's
// stricter JSX types the union can't be rendered as a JSX element directly
// (a LazyComponent returns a Promise). Narrow to ComponentType at the render
// site. Phase 2 wires code-split tools through React Router's route-level `lazy`
// option rather than rendering a LazyComponent inline, so this stays correct.
function renderTool(component: ComponentType): ReactElement {
  const Tool = component;
  return <Tool />;
}

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
        element: renderTool(tool.component as ComponentType),
      })),
      // Unknown route -> resolved startup tool (last-used / hero).
      { path: "*", element: startupElement },
    ],
  },
]);
