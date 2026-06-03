// Shared accent-on-active segmented toggle (D-16) — its styling mirrors
// FormatterView's inline toggle, which is not yet migrated onto this component.
// One <button aria-pressed> per option inside a labeled role="group". Accent =
// selected only: the active segment carries the accent classes, inactive ones stay
// neutral. Keyboard-operable, type="button", focus-visible ring (WCAG-AA, D-03).
// Generic over the option value so callers stay type-safe (URL mode switch +
// component|full scope toggle in Phase 13; reused by Phases 14/15).

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

/** Accent-on-active / neutral-inactive segment styling (mirrors FormatterView's inline toggle). */
function toggleClasses(active: boolean): string {
  return [
    "rounded-[5px] px-2 py-0.5 text-[11px] font-medium outline-none transition-colors",
    "focus-visible:ring-2 focus-visible:ring-accent",
    active
      ? "border border-accent-line bg-accent-soft text-accent"
      : "border border-transparent text-tx-2 hover:text-tx",
  ].join(" ");
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex items-center gap-1 rounded-[7px] border border-bd bg-input-bg p-0.5"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={toggleClasses(value === opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
