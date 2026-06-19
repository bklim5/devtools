// SettingToggle (SET-09, D-24-8..10 / T-24-08) — a reusable, accessible boolean
// switch row. The General pane's boolean controls (launch-at-login,
// start-in-tray) all render through this.
//
// A11y contract (WCAG-AA, the gsd-ui-review bar): a native <button> with
// role="switch" + aria-checked reflecting `checked`; the native button handles
// click AND Enter/Space (no mouse-only path); a visible focus-visible:ring-accent;
// and the on/off distinction is by ACCENT FILL + knob position — NEVER opacity
// (no faded-only state, Pitfall 5 / the SegmentedControl selected precedent).
// The on state uses bg-accent-soft + border-accent-line (accent fill); the off
// state is the neutral bg-input-bg + border-bd. Every token resolves in BOTH
// themes (Phase-23 light/dark), so no hardcoded dark hex enters here.

import { useId } from "react";

export interface SettingToggleProps {
  label: string;
  helper?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  id?: string;
}

export function SettingToggle({
  label,
  helper,
  checked,
  onChange,
  id,
}: SettingToggleProps) {
  // Associate the helper sentence with the switch so AT reads it on focus
  // (a visual-only sibling span is invisible to screen readers — WCAG-AA).
  const helperId = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-medium text-tx">{label}</span>
        {helper ? (
          <span id={helperId} className="text-[12px] text-tx-3">
            {helper}
          </span>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        aria-describedby={helper ? helperId : undefined}
        onClick={() => onChange(!checked)}
        className={[
          // Track: ≥24px tall target (WCAG 2.5.8), rounded pill, accent fill on /
          // neutral off. Distinction is fill + knob position, NOT opacity.
          "relative inline-flex h-6 w-11 flex-none items-center rounded-full border outline-none transition-colors",
          "focus-visible:ring-2 focus-visible:ring-accent",
          checked
            ? "border-accent-line bg-accent-soft"
            : "border-bd bg-input-bg",
        ].join(" ")}
      >
        {/* Knob — translated right when on, left when off (position encodes state,
            reinforcing the accent fill so the state is never color/fade-alone). */}
        <span
          aria-hidden="true"
          className={[
            "inline-block h-4 w-4 rounded-full transition-transform",
            checked ? "translate-x-6 bg-accent" : "translate-x-1 bg-tx-3",
          ].join(" ")}
        />
      </button>
    </div>
  );
}
