import type { ComponentType, ReactElement } from "react";
import { createHashRouter, Navigate } from "react-router-dom";
import { App } from "./App";
import { ENABLED_TOOLS } from "./lib/tools/registry";

// HashRouter (not BrowserRouter): Tauri serves the build as static files, so a
// path like /tools/base64 would 404 on reload — hash routes (#/tools/base64)
// need no server rewrite. A global shortcut or tray item can deep-link to any
// tool by navigating to its route.
const firstTool = ENABLED_TOOLS[0];

// ToolDefinition.component is `ComponentType | LazyComponent`. Under React 19's
// stricter JSX types the union can't be rendered as a JSX element directly
// (a LazyComponent returns a Promise). Every Phase-1 enabled tool ships an eager
// ComponentType (the skeleton), so narrow to ComponentType at the render site.
// Phase 2 wires code-split tools through React Router's route-level `lazy` option
// rather than rendering a LazyComponent inline, so this narrowing stays correct.
function renderTool(component: ComponentType): ReactElement {
  const Tool = component;
  return <Tool />;
}

export const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Navigate to={`/tools/${firstTool.id}`} replace /> },
      ...ENABLED_TOOLS.map((tool) => ({
        path: `tools/${tool.id}`,
        element: renderTool(tool.component as ComponentType),
      })),
      // Unknown route -> first tool.
      { path: "*", element: <Navigate to={`/tools/${firstTool.id}`} replace /> },
    ],
  },
]);
