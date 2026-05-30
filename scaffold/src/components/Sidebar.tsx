import { useMemo, useRef, useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { searchTools } from "@/lib/tools/registry";

export function Sidebar() {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const tools = useMemo(() => searchTools(query), [query]);

  // ⌘/ or Ctrl+/ focuses search (matches the reference app).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <aside className="flex w-72 flex-col border-r border-neutral-800 bg-neutral-950">
      <div className="p-3">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search… (⌘/)"
          className="w-full rounded-md bg-neutral-800 px-3 py-2 text-sm outline-none placeholder:text-neutral-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <nav className="flex-1 space-y-0.5 overflow-auto px-2 pb-2">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <NavLink
              key={tool.id}
              to={`/tools/${tool.id}`}
              className={({ isActive }) =>
                `flex items-start gap-3 rounded-md px-3 py-2 transition-colors ${
                  isActive ? "bg-blue-600 text-white" : "text-neutral-300 hover:bg-neutral-800"
                }`
              }
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{tool.name}</span>
                <span className="truncate text-xs text-neutral-400">{tool.description}</span>
              </span>
            </NavLink>
          );
        })}
        {tools.length === 0 && (
          <p className="px-3 py-2 text-sm text-neutral-500">No tools match “{query}”.</p>
        )}
      </nav>
    </aside>
  );
}
