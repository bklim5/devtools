// Shared placeholder for tools that are ENABLED in the registry but whose real UI
// lands in a later phase (D-01). It makes the sidebar/palette/router/persistence
// fully exercisable in Phase 2 without faking a tool. Phase 3/4 swaps each tool's
// registry `component` from this placeholder to the real one.
//
// Layout-agnostic (UX-05): no fixed widths, responsive; layout chrome lives in
// the shell, not here. Tone per UI-SPEC Copywriting: calm/informational — a
// registry-name heading + one quiet line in --tx-3. No spinner, no "under
// construction" cliché.
//
// `ToolDefinition.component` is a no-prop ComponentType, so we expose a factory
// that closes over the tool's name and returns a no-prop component for the
// registry entry to reference.
import type { ComponentType } from "react";

/** Build a no-prop placeholder component bound to a tool's display name. */
export function makePlaceholder(name: string): ComponentType {
  function ToolPlaceholder() {
    return (
      <section className="flex h-full w-full flex-col items-center justify-center gap-2 p-8 text-center">
        {/* 19px / 600 per UI-SPEC Typography (tool header h1). */}
        <h1 className="text-[19px] font-semibold leading-[1.2] text-tx">{name}</h1>
        <p className="text-tx-3">Coming in Phase 3</p>
      </section>
    );
  }
  // Aid React DevTools / error overlays in identifying which tool rendered.
  ToolPlaceholder.displayName = `ToolPlaceholder(${name})`;
  return ToolPlaceholder;
}
