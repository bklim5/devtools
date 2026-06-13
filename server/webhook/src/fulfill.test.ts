import { describe, it, expect, vi } from "vitest";
import { fulfill, type FulfillDeps } from "./fulfill.ts";
import type { OrderEvent } from "./mor.ts";
import type { KeygenLicense } from "./keygen.ts";

const ORDER: OrderEvent = {
  kind: "order",
  orderId: "order_1",
  customerEmail: "buyer@example.com",
};

function makeDeps(overrides: Partial<FulfillDeps> = {}): FulfillDeps {
  return {
    verify: vi.fn().mockReturnValue(true),
    parse: vi.fn().mockReturnValue(ORDER),
    search: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue("KEY-123"),
    email: vi.fn().mockResolvedValue(undefined),
    alert: vi.fn(),
    log: vi.fn(),
    ...overrides,
  };
}

const req = { rawBody: "{}", signatureHeader: "sig" };

describe("fulfill orchestrator", () => {
  it("returns 401 on an invalid signature with NO keygen/email calls", async () => {
    const deps = makeDeps({ verify: vi.fn().mockReturnValue(false) });
    const res = await fulfill(req, deps);

    expect(res.status).toBe(401);
    expect(deps.parse).not.toHaveBeenCalled();
    expect(deps.search).not.toHaveBeenCalled();
    expect(deps.create).not.toHaveBeenCalled();
    expect(deps.email).not.toHaveBeenCalled();
  });

  it("returns 200 with no side effects for a non-order_created (ignore) event", async () => {
    const deps = makeDeps({ parse: vi.fn().mockReturnValue({ kind: "ignore" }) });
    const res = await fulfill(req, deps);

    expect(res.status).toBe(200);
    expect(deps.search).not.toHaveBeenCalled();
    expect(deps.create).not.toHaveBeenCalled();
    expect(deps.email).not.toHaveBeenCalled();
  });

  it("returns 400 on an invalid payload", async () => {
    const deps = makeDeps({
      parse: vi.fn().mockReturnValue({ kind: "invalid", reason: "bad" }),
    });
    const res = await fulfill(req, deps);

    expect(res.status).toBe(400);
    expect(deps.create).not.toHaveBeenCalled();
  });

  it("is idempotent: an existing license ⇒ 200, no create, no re-email (D-58)", async () => {
    const existing: KeygenLicense = { id: "lic_1", attributes: { key: "OLD-KEY" } };
    const deps = makeDeps({ search: vi.fn().mockResolvedValue(existing) });
    const res = await fulfill(req, deps);

    expect(res.status).toBe(200);
    expect(deps.create).not.toHaveBeenCalled();
    expect(deps.email).not.toHaveBeenCalled();
  });

  it("creates + emails a new order and returns 200", async () => {
    const deps = makeDeps();
    const res = await fulfill(req, deps);

    expect(res.status).toBe(200);
    expect(deps.create).toHaveBeenCalledWith("order_1");
    expect(deps.email).toHaveBeenCalledWith("buyer@example.com", "KEY-123");
  });

  it("returns 5xx when createLicense throws (LS retries — D-59); no email", async () => {
    const deps = makeDeps({ create: vi.fn().mockRejectedValue(new Error("CE down")) });
    const res = await fulfill(req, deps);

    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(deps.email).not.toHaveBeenCalled();
  });

  it("returns 5xx AND fires the alert callback when sendKeyEmail throws (D-59/D-72)", async () => {
    const alert = vi.fn();
    const deps = makeDeps({
      email: vi.fn().mockRejectedValue(new Error("Resend down")),
      alert,
    });
    const res = await fulfill(req, deps);

    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0][0]).toContain("order_1");
  });

  it("never returns 2xx when a side effect failed", async () => {
    const deps = makeDeps({ create: vi.fn().mockRejectedValue(new Error("x")) });
    const res = await fulfill(req, deps);
    expect(res.status).not.toBeLessThan(300);
  });
});
