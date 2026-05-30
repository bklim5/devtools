import { Outlet } from "react-router-dom";

// Minimal Phase-1 layout shell. The routed tool renders inside via <Outlet/>.
// The real registry-driven shell + sidebar + ⌘K palette land in Phase 2 (SHL-*);
// this stays intentionally bare so the walking skeleton has somewhere to mount.
export function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-app font-sans text-[#e7e9ee]">
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
