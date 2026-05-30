// useTrackActiveTool — records the currently-open tool as last-used (+ recents)
// on every route change. This is the SINGLE writer of last-used, so EVERY way of
// opening a tool restores on the next launch: a sidebar click, a ⌘K palette
// selection, and a deep-link all flow through the router and are captured here.
//
// Before this existed, only the ⌘K palette recorded the switch, so switching via
// the sidebar never updated last-used — the app kept reopening to whatever the
// palette last wrote. Centralising on the route is the one place that covers all
// navigation paths.
//
// Gated on `useRecentTools().loaded` so the first record can't fire before the
// async store load resolves and clobber the stored recents (Pitfall 3 timing).

import { useEffect } from "react";
import { useMatch } from "react-router-dom";
import { getToolById } from "@/lib/tools/registry";
import { useRecentTools } from "./useRecentTools";

export function useTrackActiveTool(): void {
  // Matches the in-hash pathname `/tools/<id>` under HashRouter. Null on the
  // index/unknown routes, in which case there is no tool to record.
  const match = useMatch("/tools/:id");
  const id = match?.params.id;
  const { recordSwitch, loaded } = useRecentTools();

  useEffect(() => {
    if (!loaded) return; // wait for the stored recents to load first
    // `id` is untrusted (it comes from the URL) — only record a real, enabled
    // tool so a bogus `#/tools/evil` can never be persisted as last-used.
    if (id && getToolById(id)) recordSwitch(id);
  }, [id, loaded, recordSwitch]);
}
