import { lazy, Suspense, type ComponentType } from "react";
import type { ToolDefinition } from "@/lib/tools/types";
import { isToolLocked } from "@/lib/entitlements/entitlements";
import { useEntitlements } from "@/shell/useEntitlements";
import { IS_APPSTORE } from "@/lib/platform/channel";

// D-02/D-04 (user-approved Option A): the locked-tool upsell surface is selected at
// build time — the store build renders the StoreKit StoreToolUpsell in place of the
// Keygen UpsellPanel. Each arm is a `lazy(() => import(...))` DYNAMIC import so the
// dead arm's module subtree is statically unreachable in the other build and Rollup
// tree-shakes it out (a plain `IS_APPSTORE ? <UpsellPanel/> : <StoreToolUpsell/>`
// over static imports keeps BOTH — the JSX is retained at runtime, folding the
// Keygen UpsellPanel → @/lib/license subtree into the store bundle). The lazy
// surface is created ONCE at module load (the cache below handles the TOOL chunk;
// this is a single build-constant lazy, not per-render). The store arm (StoreTool-
// Upsell) carries NO Keygen activation form / key field; the direct arm keeps the
// shared ActivationSurface route placement byte-behaviourally identical.
const UpsellSurface: ComponentType<{
  icon: ComponentType<{ className?: string }>;
  headingId?: string;
}> = IS_APPSTORE
  ? lazy(() =>
      import("./StoreToolUpsell").then((m) => ({ default: m.StoreToolUpsell })),
    )
  : lazy(() => import("./UpsellPanel").then((m) => ({ default: m.UpsellPanel })));

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
        {/* fallback={null}: the upsell chunk is local-disk — a spinner would flash
            (UI-SPEC). The surface is the build-selected lazy() (Keygen UpsellPanel
            direct / StoreKit StoreToolUpsell store — D-04 tree-shake). */}
        <Suspense fallback={null}>
          <UpsellSurface icon={tool.icon} headingId="upsell-route-heading" />
        </Suspense>
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
