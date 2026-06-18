// StartupRedirect — the index/catch-all route element that sends the app
// straight to a tool with no "pick a tool" step (SHL-06).
//
// It reads the REAL last-used id from usePreferences (async store) and the
// explicit deep-link target from the current hash, then defers to the single
// resolveStartupTool seam for precedence (explicit > default-tool > last-used >
// hero). The
// redirect waits for prefs to finish loading so last-used actually restores
// (Pitfall 3) — on first paint prefs are still the defaults (lastUsedId=null),
// so we hold until the load resolves rather than redirecting to the hero early.

import { Navigate, useLocation } from "react-router-dom";
import { usePreferences } from "./usePreferences";
import { resolveStartupTool } from "./resolveStartupTool";
import { parseHashTarget } from "./parseHashTarget";

export function StartupRedirect(): React.ReactElement | null {
  const { preferences, prefsLoaded } = usePreferences();
  const location = useLocation();

  // Hold first paint until prefs load so last-used restores (Pitfall 3): before
  // the load resolves lastUsedId is the default null and we'd wrongly fall to
  // the hero. Render nothing (blank) for the brief async window.
  if (!prefsLoaded) return null;

  // The explicit target only matters when the current route IS the bare index
  // (an actual `#/tools/<id>` already matches its own route directly). We still
  // parse the hash to honour the D-14 data model uniformly.
  const target = parseHashTarget(location.hash);
  const resolved = resolveStartupTool(
    target,
    preferences.defaultToolId,
    preferences.lastUsedId,
  );
  return <Navigate to={`/tools/${resolved}`} replace />;
}
