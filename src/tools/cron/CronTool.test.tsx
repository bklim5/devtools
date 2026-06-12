// @vitest-environment jsdom
// CronTool (CRON-01..11): one paste-instant view over the pure analyzeCron core.
// Asserts each discriminated CronResult kind surfaces correctly — a scheduled
// expression renders the 24-hour description + 5 copyable run rows; @reboot shows
// the neutral startup banner with NO run rows; an impossible expression shows the
// calm neutral "No upcoming runs" line (NOT role=alert); an invalid expression
// shows an inline role=alert + aria-invalid on the input; empty input shows the
// neutral hint with no alert. All values render as escaped React text (never
// dangerouslySetInnerHTML); copy writes through the platform clipboard seam.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type Platform,
} from "@/lib/platform";
import { makeMemoryPlatform } from "@/shell/testStore";
import CronTool from "./CronTool";

let writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;

beforeEach(() => {
  writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
  const p: Platform = {
    ...makeMemoryPlatform(),
    clipboard: { writeText, readText: async () => "" },
  };
  setPlatformForTest(p);
});

afterEach(() => {
  cleanup();
  resetPlatformForTest();
});

function input(container: HTMLElement): HTMLInputElement {
  const el = container.querySelector<HTMLInputElement>("#cron-expression");
  if (!el) throw new Error("cron input #cron-expression not found");
  return el;
}

function type(container: HTMLElement, value: string) {
  fireEvent.change(input(container), { target: { value } });
}

describe("CronTool", () => {
  it("starts on the neutral empty hint, no error chrome", () => {
    const { container } = render(<CronTool />);
    expect(
      within(container).getByText(/Paste a cron expression/i),
    ).toBeTruthy();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelectorAll("[data-run-row]")).toHaveLength(0);
  });

  it("renders the 24-hour description + 5 copyable run rows for a valid expression (CRON-01/05)", () => {
    const { container } = render(<CronTool />);
    type(container, "0 9 * * *");

    // Description headline contains the 24-hour time (never AM/PM).
    const heading = container.querySelector("h2");
    expect(heading?.textContent).toContain("09:00");
    expect(heading?.textContent).not.toMatch(/AM|PM/);

    // Exactly 5 run rows, each with a copy button + a 24-hour datetime.
    const rows = container.querySelectorAll("[data-run-row]");
    expect(rows).toHaveLength(5);
    rows.forEach((row) => {
      expect(row.textContent).toContain("09:00");
      expect(row.querySelector("button")).toBeTruthy();
    });

    // The zone caption shows once above the list.
    expect(within(container).getByText(/Local time ·/i)).toBeTruthy();
    // Not an error.
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("copies a run label through the platform clipboard seam", () => {
    const { container } = render(<CronTool />);
    type(container, "0 9 * * *");
    const copyBtn = within(container).getByRole("button", {
      name: "Copy run 1",
    });
    fireEvent.click(copyBtn);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0]?.[0]).toContain("09:00");
  });

  it("shows the neutral @reboot startup banner with NO run rows (CRON-09)", () => {
    const { container } = render(<CronTool />);
    type(container, "@reboot");

    expect(container.querySelector("h2")?.textContent).toMatch(/startup/i);
    expect(within(container).getByText(/fires\s+only on startup/i)).toBeTruthy();
    expect(container.querySelectorAll("[data-run-row]")).toHaveLength(0);
    // Neutral, not an error.
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("shows the calm 'no upcoming runs' line for an impossible expression, not an error (CRON-08)", () => {
    const { container } = render(<CronTool />);
    type(container, "0 0 30 2 *");

    // Description still renders.
    expect(container.querySelector("h2")).toBeTruthy();
    expect(within(container).getByText(/No upcoming runs/i)).toBeTruthy();
    // It is NOT an error state.
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelectorAll("[data-run-row]")).toHaveLength(0);
    expect(input(container).getAttribute("aria-invalid")).toBeNull();
  });

  it("shows an inline role=alert error + aria-invalid for an invalid expression (CRON-11)", () => {
    const { container } = render(<CronTool />);
    type(container, "0 99 * * *");

    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeTruthy();
    expect(alert?.textContent).toMatch(/hour.+99.+0.+23/i);
    expect(input(container).getAttribute("aria-invalid")).toBe("true");
    // Description + run list suppressed.
    expect(container.querySelector("h2")).toBeNull();
    expect(container.querySelectorAll("[data-run-row]")).toHaveLength(0);
  });

  it("rejects the unsupported W/#/LW tokens via the same error path (CRON-F1)", () => {
    const { container } = render(<CronTool />);
    type(container, "0 0 1W * *");
    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeTruthy();
    expect(alert?.textContent).toMatch(/aren't supported yet/i);
  });

  it("freezes the relative caption to the compute-time `now`, not a live clock (MD-02)", () => {
    // The relative caption is the last span of the first run row's text column
    // (after the `#N` + absolute-datetime row). Read it structurally so we don't
    // depend on the runner-locale wording ("tomorrow" / "in 1 hour" / "2 days ago").
    const relCaption = (container: HTMLElement): string => {
      const row = container.querySelector("[data-run-row]");
      if (!row) throw new Error("no run row");
      const column = row.firstElementChild;
      const caption = column?.lastElementChild;
      if (!caption) throw new Error("no relative caption span");
      return caption.textContent ?? "";
    };

    // Freeze the clock, compute the runs, capture the relative caption.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-04T08:00:00Z"));
    try {
      const { container, rerender } = render(<CronTool />);
      type(container, "0 9 * * *");
      const relBefore = relCaption(container);

      // Advance wall-clock far enough that a LIVE `Date.now()` caption would shift,
      // then force an UNRELATED re-render (same [expr, zone] state, so the memo and
      // its frozen `now` are reused). The caption must NOT drift from the frozen run
      // instants — that is the MD-02 guarantee.
      vi.advanceTimersByTime(45 * 60 * 1000); // +45 minutes
      rerender(<CronTool />);
      const relAfter = relCaption(container);

      expect(relAfter).toBe(relBefore);
    } finally {
      vi.useRealTimers();
    }
  });
});
