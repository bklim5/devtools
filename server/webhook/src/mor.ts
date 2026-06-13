// Merchant-of-Record adapter — the ONE swap seam (D-61).
//
// MoR = Lemon Squeezy this phase. Everything LS-payload-specific lives HERE so a
// future MoR change (Polar, Paddle, …) is a single-module swap: the orchestrator
// only ever sees the neutral `OrderEvent` shape below. Keep this thin — parsing
// only, no I/O, no side effects.
//
// LS `order_created` shape (verify exact paths against a real test-mode payload
// during Plan 03's D-63 e2e — log the raw event once, A5):
//   meta.event_name === "order_created"
//   order id        = data.id
//   buyer email     = data.attributes.user_email

export type OrderEvent =
  | { kind: "order"; orderId: string; customerEmail: string }
  | { kind: "ignore" }
  | { kind: "invalid"; reason: string };

/**
 * Parse a raw LS webhook body into a MoR-neutral event.
 * - `order_created` with the expected fields → `{ kind: "order", ... }`
 * - any other `event_name` → `{ kind: "ignore" }` (orchestrator 200-acks it)
 * - unparseable / missing fields → `{ kind: "invalid", reason }`
 */
export function parseOrderEvent(rawBody: string): OrderEvent {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { kind: "invalid", reason: "body is not valid JSON" };
  }

  if (typeof payload !== "object" || payload === null) {
    return { kind: "invalid", reason: "payload is not an object" };
  }

  const root = payload as Record<string, unknown>;
  const meta = root.meta as Record<string, unknown> | undefined;
  const eventName = meta?.event_name;

  if (eventName !== "order_created") {
    return { kind: "ignore" };
  }

  const data = root.data as Record<string, unknown> | undefined;
  const orderId = data?.id;
  const attributes = data?.attributes as Record<string, unknown> | undefined;
  const customerEmail = attributes?.user_email;

  if (typeof orderId !== "string" || orderId === "") {
    return { kind: "invalid", reason: "missing data.id" };
  }
  if (typeof customerEmail !== "string" || customerEmail === "") {
    return { kind: "invalid", reason: "missing data.attributes.user_email" };
  }

  return { kind: "order", orderId, customerEmail };
}
