import { createHashRouter, Navigate } from "react-router-dom";
import { App } from "./App";
import { ENABLED_TOOLS } from "./lib/tools/registry";

// HashRouter (not BrowserRouter): Tauri serves the build as static files, so a
// path like /tools/base64 would 404 on reload — hash routes (#/tools/base64)
// need no server rewrite. A global shortcut or tray item can deep-link to any
// tool by navigating to its route.
const firstTool = ENABLED_TOOLS[0];

export const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Navigate to={`/tools/${firstTool.id}`} replace /> },
      ...ENABLED_TOOLS.map((tool) => ({
        path: `tools/${tool.id}`,
        element: <tool.component />,
      })),
      // Unknown route -> first tool.
      { path: "*", element: <Navigate to={`/tools/${firstTool.id}`} replace /> },
    ],
  },
]);
