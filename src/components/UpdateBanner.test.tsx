// @vitest-environment jsdom
// UpdateBanner (DST-02, D-11c/D-13): a CONTROLLED, layout-agnostic, WCAG-AA banner.
// Shown whenever the parent mounts it with an `info` (so a later detection re-shows
// it — no internal "dismissed forever" state, D-11c). Install verifies+relaunches
// via the parent's onInstall; Later/✕ dismisses via onDismiss. Every interactive
// control is a real keyboard-reachable <button> with a visible focus ring and an
// accessible name; the installing/disabled state is NOT signalled by opacity alone.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { UpdateBanner } from "./UpdateBanner";
import type { UpdateInfo } from "@/lib/platform";

const INFO: UpdateInfo = {
  version: "0.3.0",
  notes: "Faster protobuf decoding and a fix for hex paste.",
  date: null,
};

afterEach(cleanup);

describe("UpdateBanner", () => {
  it("renders the version headline and the notes body", () => {
    const { getByText } = render(
      <UpdateBanner info={INFO} onInstall={() => {}} onDismiss={() => {}} />,
    );
    expect(getByText(/v0\.3\.0 available/i)).toBeDefined();
    expect(getByText(/Faster protobuf decoding/i)).toBeDefined();
  });

  it("renders multi-line notes in a paragraph that preserves line breaks (whitespace-pre-line)", () => {
    const multiline: UpdateInfo = {
      version: "0.3.0",
      notes: "- Added the URL tool.\n- Fixed hex paste.",
      date: null,
    };
    const { getByText } = render(
      <UpdateBanner info={multiline} onInstall={() => {}} onDismiss={() => {}} />,
    );
    // The notes <p> carries whitespace-pre-line so the CHANGELOG's newlines survive
    // (without it, the browser collapses them into one run of text).
    const notes = getByText(/Added the URL tool/);
    expect(notes.tagName).toBe("P");
    expect(notes.className).toContain("whitespace-pre-line");
    expect(notes.textContent).toContain("\n");
  });

  it("calls onInstall when the Install button is clicked", () => {
    const onInstall = vi.fn();
    const { getByRole } = render(
      <UpdateBanner info={INFO} onInstall={onInstall} onDismiss={() => {}} />,
    );
    fireEvent.click(getByRole("button", { name: /install/i }));
    expect(onInstall).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when the keyboard-reachable dismiss (✕) button is clicked", () => {
    const onDismiss = vi.fn();
    const { getByRole } = render(
      <UpdateBanner info={INFO} onInstall={() => {}} onDismiss={onDismiss} />,
    );
    // The dismiss control is a real <button> with an accessible name.
    const dismiss = getByRole("button", {
      name: /dismiss update notification/i,
    });
    expect(dismiss.tagName).toBe("BUTTON");
    fireEvent.click(dismiss);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("dismisses via the keyboard (Enter / Space) on the focused ✕ button", () => {
    const onDismiss = vi.fn();
    const { getByRole } = render(
      <UpdateBanner info={INFO} onInstall={() => {}} onDismiss={onDismiss} />,
    );
    const dismiss = getByRole("button", { name: /dismiss update notification/i });
    fireEvent.keyDown(dismiss, { key: "Enter" });
    fireEvent.keyDown(dismiss, { key: " " });
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  it("gives every interactive control a visible focus ring (focus-visible:ring-accent)", () => {
    const { getByRole } = render(
      <UpdateBanner info={INFO} onInstall={() => {}} onDismiss={() => {}} />,
    );
    const install = getByRole("button", { name: /install/i });
    const dismiss = getByRole("button", { name: /dismiss update notification/i });
    expect(install.className).toContain("focus-visible:ring-accent");
    expect(dismiss.className).toContain("focus-visible:ring-accent");
  });

  it("signals the installing/disabled state with aria-disabled + a label change, not opacity alone", () => {
    const { getByRole } = render(
      <UpdateBanner
        info={INFO}
        onInstall={() => {}}
        onDismiss={() => {}}
        installing
        progress={37}
      />,
    );
    const install = getByRole("button", { name: /installing/i });
    // Non-opacity-only signal: an aria-disabled attribute AND a label/text change.
    expect(install.getAttribute("aria-disabled")).toBe("true");
    expect(install.textContent).toMatch(/installing/i);
  });

  it("is controlled — it re-renders content whenever mounted with info (no permanent dismiss)", () => {
    const { rerender, getByText, queryByText } = render(
      <UpdateBanner info={INFO} onInstall={() => {}} onDismiss={() => {}} />,
    );
    expect(getByText(/v0\.3\.0 available/i)).toBeDefined();
    // The PARENT owns visibility: a later detection re-mounts with a new info.
    const next: UpdateInfo = { version: "0.4.0", notes: null, date: null };
    rerender(
      <UpdateBanner info={next} onInstall={() => {}} onDismiss={() => {}} />,
    );
    expect(getByText(/v0\.4\.0 available/i)).toBeDefined();
    expect(queryByText(/v0\.3\.0 available/i)).toBeNull();
  });
});
