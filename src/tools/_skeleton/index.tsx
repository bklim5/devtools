// PHASE 1 THROWAWAY — delete this whole directory (and its registry entry) before
// Phase 2. The "byte inspector" walking skeleton (D-04/D-05) exists ONLY to drive
// the build+verify harness through the real UX-constraint surface the per-task UI
// gate must verify: paste-transforms-instantly, an always-visible + focusable copy
// affordance (NEVER hover-only), and a status bar (parse state · byte count · timing).
// It does NOT reuse the real Protobuf/Base64 tools and copies through the platform
// seam (@/lib/platform), never @tauri-apps/* directly.
import { useCallback, useState } from "react";
import type { ToolDefinition } from "@/lib/tools/types";
import { platform } from "@/lib/platform";
import { inspect } from "./transform";

/** Trivial throwaway icon — the real lucide icons land with the real tools. */
function SkeletonIcon({ className }: { className?: string }) {
  return (
    <span className={className} aria-hidden>
      ◇
    </span>
  );
}

export function ByteInspector() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState(() => inspect(""));
  const [timingMs, setTimingMs] = useState(0);
  const [copied, setCopied] = useState(false);

  // Instant transform: runs on every change (which fires on paste/Cmd+V too).
  // There is intentionally NO decode button — the common case transforms live.
  const onChange = useCallback((next: string) => {
    const start = performance.now();
    const inspected = inspect(next);
    const elapsed = performance.now() - start;
    setInput(next);
    setResult(inspected);
    setTimingMs(elapsed);
    setCopied(false);
  }, []);

  const onCopy = useCallback(async () => {
    // Copy ALWAYS routes through the platform seam — never @tauri-apps/* here.
    await platform.clipboard.writeText(result.hex);
    setCopied(true);
  }, [result.hex]);

  return (
    <section className="flex h-full flex-col gap-3 p-4 font-sans text-[#e7e9ee]">
      <header className="text-sm font-semibold text-white/80">
        Byte Inspector <span className="text-white/40">(skeleton)</span>
      </header>

      <textarea
        data-testid="skeleton-input"
        aria-label="Bytes to inspect"
        className="min-h-24 w-full resize-y rounded-md border border-white/10 bg-pane p-3 font-mono text-sm outline-none focus:border-accent"
        placeholder="Paste bytes — transforms instantly"
        value={input}
        onChange={(e) => onChange(e.target.value)}
      />

      <div className="flex items-start gap-3">
        <output
          data-testid="skeleton-output"
          className="min-w-0 flex-1 break-all rounded-md border border-white/10 bg-panel p-3 font-mono text-sm text-white/80"
        >
          <div>
            <span className="text-white/40">upper:</span> {result.upper}
          </div>
          <div>
            <span className="text-white/40">hex:</span> {result.hex}
          </div>
        </output>

        {/* Always-visible, keyboard-focusable copy button (a real <button> in tab
            order). NOT hover-gated (no opacity-0 group-hover) — the gate must
            catch any hover-only regression here. */}
        <button
          type="button"
          data-testid="skeleton-copy"
          onClick={onCopy}
          className="shrink-0 rounded-md border border-white/15 bg-titlebar px-3 py-2 text-xs font-medium text-white/80 hover:border-accent focus:border-accent focus:outline-none"
        >
          {copied ? "Copied" : "Copy hex"}
        </button>
      </div>

      {/* Status bar: parse state · byte count · timing. */}
      <footer
        data-testid="skeleton-status"
        className="mt-auto flex items-center gap-4 border-t border-white/10 bg-titlebar px-3 py-2 font-mono text-xs text-white/60"
      >
        <span className={result.parseState === "ok" ? "text-ok" : "text-white/40"}>
          {result.parseState === "ok" ? "● parsed" : "○ empty"}
        </span>
        <span data-testid="skeleton-bytecount">{result.byteLength} bytes</span>
        <span data-testid="skeleton-timing">{timingMs.toFixed(2)} ms</span>
      </footer>
    </section>
  );
}

// PHASE 1 THROWAWAY — registry entry removed with this skeleton before Phase 2.
// Registered enabled:true (the FIRST enabled tool) so ENABLED_TOOLS is non-empty
// and router.tsx's `firstTool = ENABLED_TOOLS[0]` resolves at module load.
export const skeletonTool: ToolDefinition = {
  id: "_skeleton",
  name: "Byte Inspector (skeleton)",
  description: "Phase 1 throwaway walking-skeleton — removed before Phase 2.",
  category: "inspectors",
  keywords: ["skeleton", "byte", "inspector", "throwaway"],
  icon: SkeletonIcon,
  component: ByteInspector,
  enabled: true,
  status: "experimental",
};
