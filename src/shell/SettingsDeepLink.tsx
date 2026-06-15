// SettingsDeepLink (D-S6) — the router element for #/settings/license. The modal
// SUPERSEDES the Phase-21 in-window route: there is ONE surface, no duplication.
// This tiny element opens the Settings modal on the License pane, then redirects
// to "/" so nothing renders a duplicate in-window License surface.
//
// T-22-01 (tampering): the deep-link only ever calls openSettings("license")
// against the fixed literal pane id — the hash is NEVER parsed into a dynamic
// pane/route target, so a crafted #/settings/<anything> cannot reach another pane.
//
// D-S2 focus-return: this element unmounts immediately (the <Navigate> below),
// like the transient native-opener case, so it passes an EXPLICIT persistent
// return target (document.body) rather than letting the store capture a
// detaching element. The <Navigate to="/" replace /> falls through to
// StartupRedirect, which resolves the last-used/hero tool — so the underlying
// view is a real tool, never a blank or duplicate License surface.

import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { openSettings } from "./settingsStore";

export function SettingsDeepLink(): React.ReactElement {
  useEffect(() => {
    openSettings("license", document.body);
  }, []);
  return <Navigate to="/" replace />;
}
