import type { ComponentType, ReactElement } from "react";
import { createHashRouter, Navigate } from "react-router-dom";
import { App } from "./App";
import { ENABLED_TOOLS } from "./lib/tools/registry";
import type { ToolDefinition } from "./lib/tools/types";

// HashRouter (not BrowserRouter): Tauri serves the build as static files, so a
// path like /tools/base64 would 404 on reload — hash routes (#/tools/base64)
// need no server rewrite. A global shortcut or tray item can deep-link to any
// tool by navigating to its route.
//
// `firstTool` may be undefined: the Phase-1 skeleton was removed and the three
// real tools are still enabled:false stubs, so ENABLED_TOOLS is currently empty.
// We guard for that — index/unknown routes fall back to the bare App shell
// instead of throwing on `firstTool.id`. Phase 2/3 enable real tools and the
// redirect-to-first-tool behaviour activates automatically.
const firstTool = ENABLED_TOOLS[0] as ToolDefinition | undefined;

// ToolDefinition.component is `ComponentType | LazyComponent`. Under React 19's
// stricter JSX types the union can't be rendered as a JSX element directly
// (a LazyComponent returns a Promise). Narrow to ComponentType at the render
// site. Phase 2 wires code-split tools through React Router's route-level `lazy`
// option rather than rendering a LazyComponent inline, so this stays correct.
function renderTool(component: ComponentType): ReactElement {
  const Tool = component;
  return <Tool />;
}

// Index/unknown routes redirect to the first enabled tool when one exists;
// otherwise render nothing extra (the App shell's <Outlet/> is empty).
const fallbackElement = firstTool ? (
  <Navigate to={`/tools/${firstTool.id}`} replace />
) : null;

export const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: fallbackElement },
      ...ENABLED_TOOLS.map((tool) => ({
        path: `tools/${tool.id}`,
        element: renderTool(tool.component as ComponentType),
      })),
      // Unknown route -> first tool (or App shell if no tools are enabled yet).
      { path: "*", element: fallbackElement },
    ],
  },
]);
