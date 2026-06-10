import { lazy, Suspense, type ComponentType } from "react";
import type { ToolDefinition } from "@/lib/tools/types";
import { isToolLocked } from "@/lib/entitlements/entitlements";
import { useEntitlements } from "@/shell/useEntitlements";
import { UpsellPanel } from "./UpsellPanel";

// React.lazy components are created ONCE per tool id, never per render —
// a per-render lazy() would remount the tool and refetch its chunk on every
// shell re-render, losing pasted input (RESEARCH Pitfall 2).
const lazyCache = new Map<string, ComponentType>();
function lazyToolComponent(tool: ToolDefinition): ComponentType {
  let C = lazyCache.get(tool.id);
  if (!C) {
    C = lazy(tool.component);
    lazyCache.set(tool.id, C);
  }
  return C;
}

/** Element-level entitlement gate (ENT-01/D-30): locked → UpsellPanel in place
 *  of the tool UI (never hidden, never redirected) and the chunk is NOT fetched;
 *  unlocked → the cached lazy component. Element-level (not route-level `lazy`)
 *  so an entitlement flip swaps the rendered surface live. */
export function ToolRoute({ tool }: { tool: ToolDefinition }) {
  const ents = useEntitlements();
  if (isToolLocked(tool, ents)) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <UpsellPanel icon={tool.icon} headingId="upsell-route-heading" />
      </div>
    );
  }
  const Tool = lazyToolComponent(tool);
  return (
    // fallback={null}: chunks come off local disk — a spinner would flash
    // (UI-SPEC lazy-load state). Real-WKWebView gate verifies no perceptible blank.
    <Suspense fallback={null}>
      {/* eslint-disable-next-line react-hooks/static-components -- identity IS
          static: lazyToolComponent returns the module-cached lazy() for this
          tool.id (created once, never per render) — exactly the stability this
          rule enforces, just behind a cache the linter can't see through. */}
      <Tool />
    </Suspense>
  );
}
