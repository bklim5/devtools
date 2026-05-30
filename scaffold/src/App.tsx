import { Outlet } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";

export function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-900 text-neutral-100">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
