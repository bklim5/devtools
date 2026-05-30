import { Outlet } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { CommandPalette } from "./components/CommandPalette";

// The registry-driven application shell (SHL-01/02). All layout chrome lives
// HERE — tools stay layout-agnostic and render inside <main>'s <Outlet/> with no
// fixed widths of their own (UX-05). The compact <Sidebar/> (268px) is a pure
// projection of ENABLED_TOOLS; <CommandPalette/> is mounted once and overlays
// everything, owning its own ⌘K open state (it never auto-opens — D-07).
//
// Phase scope note: the titlebar traffic-lights (Phase 5) and per-tool status-bar
// metrics (Phase 3) are intentionally NOT rendered here — only the frame the
// shell owns. A lightweight header strip carries the ⌘K hint, the no-mouse
// switch affordance (D-03/D-07).

// Dispatch a synthetic ⌘K so the header pill opens the same palette the global
// keydown handler does — the palette stays the single owner of its open state.
function openPalette() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
}

export function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-app font-sans text-tx">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col bg-pane">
        <header className="flex h-11 flex-none items-center justify-end border-b border-bd px-4">
          <button
            type="button"
            onClick={openPalette}
            aria-label="Open command palette"
            className="flex items-center gap-2 rounded-[8px] border border-bd bg-panel px-2.5 py-1.5 text-tx-2 outline-none transition-colors hover:text-tx focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="text-[11.5px]">Search tools</span>
            <kbd className="font-mono text-[11px] text-tx-2">⌘K</kbd>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
      <CommandPalette />
    </div>
  );
}
