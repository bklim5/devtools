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
import { createStoreStub } from "@/lib/platform/stub";
import {
  noopWindow,
  noopNativeShortcut,
  noopUpdater,
  noopEvents,
} from "@/shell/testStore";
import CronTool from "./CronTool";

let writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;

beforeEach(() => {
  writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
  const p: Platform = {
    clipboard: { writeText, readText: async () => "" },
    store: createStoreStub(),
    window: noopWindow,
    nativeShortcut: noopNativeShortcut,
    updater: noopUpdater,
    events: noopEvents,
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
});
