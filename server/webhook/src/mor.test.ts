import { describe, it, expect } from "vitest";
import { parseOrderEvent } from "./mor.ts";

const orderCreated = JSON.stringify({
  meta: { event_name: "order_created" },
  data: {
    type: "orders",
    id: "order_abc123",
    attributes: {
      user_email: "buyer@example.com",
      order_number: 4069391,
      total: 1900,
    },
  },
});

describe("parseOrderEvent (Lemon Squeezy MoR adapter)", () => {
  it("maps a real-shaped order_created to {orderId: data.id, customerEmail, orderNumber (coerced to string)}", () => {
    const result = parseOrderEvent(orderCreated);
    expect(result).toEqual({
      kind: "order",
      orderId: "order_abc123",
      customerEmail: "buyer@example.com",
      orderNumber: "4069391",
    });
  });

  it("omits orderNumber when data.attributes.order_number is absent (best-effort, never rejects)", () => {
    const body = JSON.stringify({
      meta: { event_name: "order_created" },
      data: { id: "order_2", attributes: { user_email: "b@c.com" } },
    });
    const result = parseOrderEvent(body);
    expect(result).toEqual({
      kind: "order",
      orderId: "order_2",
      customerEmail: "b@c.com",
    });
  });

  it("yields an ignore signal for a non-order_created event (orchestrator 200-acks)", () => {
    const subscription = JSON.stringify({
      meta: { event_name: "subscription_created" },
      data: { id: "sub_1", attributes: { user_email: "x@y.com" } },
    });
    expect(parseOrderEvent(subscription)).toEqual({ kind: "ignore" });
  });

  it("yields invalid on a malformed (non-JSON) body", () => {
    const result = parseOrderEvent("not json");
    expect(result.kind).toBe("invalid");
  });

  it("yields invalid when data.id is missing", () => {
    const body = JSON.stringify({
      meta: { event_name: "order_created" },
      data: { attributes: { user_email: "buyer@example.com" } },
    });
    expect(parseOrderEvent(body).kind).toBe("invalid");
  });

  it("yields invalid when data.attributes.user_email is missing", () => {
    const body = JSON.stringify({
      meta: { event_name: "order_created" },
      data: { id: "order_1" },
    });
    expect(parseOrderEvent(body).kind).toBe("invalid");
  });
});
