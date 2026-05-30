// Registry-driven compact sidebar (SHL-01, SHL-04).
//
// A PURE projection of ENABLED_TOOLS — it holds no tool list of its own. One
// NavLink per enabled tool (icon + name only; compact density D-02, no
// description row, no density toggle). Active styling follows the mockup's
// `.navitem.on`: a left --accent bar (scaleY 0→1), an --accent-soft background
// tint, the icon recoloured to --accent and the name to --tx. Accent is RESERVED
// for the active item (project-wide "accent = selected only" rule).
//
// The sidebar is pointer + standard Tab focus ONLY — no arrow/j-k navigation and
// no ⌘1..⌘6 shortcuts (D-03). The ⌘K command palette is the sole keyboard
// tool-switch path, so there is no second keyboard-focus system here.
import { NavLink } from "react-router-dom";
import { ENABLED_TOOLS } from "@/lib/tools/registry";

export function Sidebar() {
  return (
    <aside className="flex w-[268px] flex-none flex-col gap-3 border-r border-bd bg-sidebar p-[14px]">
      <nav className="flex flex-col gap-0.5">
        {ENABLED_TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <NavLink
              key={tool.id}
              to={`/tools/${tool.id}`}
              className={({ isActive }) =>
                [
                  // navitem: compact padding 8px 11px, radius 9px, icon↔name gap 12px
                  "group relative flex items-center gap-3 rounded-[9px] px-[11px] py-2",
                  "outline-none transition-colors",
                  // visible Tab focus indicator (UX-04) — not signalled by colour alone
                  "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-0",
                  isActive
                    ? "bg-accent-soft text-tx"
                    : "text-tx-2 hover:bg-[rgba(255,255,255,0.035)]",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  {/* left accent bar — scaleY 0→1 on active (mockup .navbar-accent) */}
                  <span
                    aria-hidden="true"
                    className={[
                      "pointer-events-none absolute left-[3px] top-1/2 h-[56%] w-[3px]",
                      "-translate-y-1/2 rounded-[2px] bg-accent transition-transform",
                      isActive ? "scale-y-100" : "scale-y-0",
                    ].join(" ")}
                  />
                  <Icon
                    className={[
                      "h-[18px] w-[18px] flex-none transition-colors",
                      isActive ? "text-accent" : "text-tx-2",
                    ].join(" ")}
                  />
                  <span className="whitespace-nowrap text-[13.5px] font-semibold">
                    {tool.name}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
