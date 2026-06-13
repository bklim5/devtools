// Fulfillment orchestrator (D-58/D-59/D-60/D-72).
//
// The single decision point: verify → parse → idempotent-search → create → email.
// It NEVER returns 2xx when a side effect failed, so Lemon Squeezy auto-retries
// (LS treats any non-2xx as "retry later", and the search-before-create makes a
// retry idempotent). All collaborators are injected so this is pure + testable.

import { parseOrderEvent, type OrderEvent } from "./mor.ts";
import { verifyLemonSqueezySignature } from "./verify.ts";
import type { KeygenLicense } from "./keygen.ts";

export interface FulfillResult {
  status: number;
  body: string;
}

export interface FulfillRequest {
  rawBody: string;
  signatureHeader: string | undefined;
}

export interface FulfillDeps {
  /** HMAC verify over the raw body (returns boolean). */
  verify(rawBody: string, signatureHeader: string | undefined): boolean;
  /** MoR parse → neutral order event. */
  parse(rawBody: string): OrderEvent;
  /** D-58 idempotency: existing license for orderId, or null. */
  search(orderId: string): Promise<KeygenLicense | null>;
  /** Create a license, returns the key. Throws on failure (⇒ 5xx). */
  create(orderId: string): Promise<string>;
  /** Email the key. Throws on failure (⇒ 5xx + alert). */
  email(customerEmail: string, key: string): Promise<void>;
  /** Out-of-band alert hook for a failed email after a successful create (D-72). */
  alert(message: string): void;
  /** Structured logger (defaults to console). */
  log?(event: string, fields?: Record<string, unknown>): void;
}

function ok(body = '{"ok":true}'): FulfillResult {
  return { status: 200, body };
}

export async function fulfill(
  req: FulfillRequest,
  deps: FulfillDeps,
): Promise<FulfillResult> {
  const log = deps.log ?? (() => {});

  // 1. Verify the signature over the RAW body BEFORE any side effect (D-60).
  if (!deps.verify(req.rawBody, req.signatureHeader)) {
    log("webhook.rejected", { reason: "invalid_signature" });
    return { status: 401, body: '{"error":"invalid signature"}' };
  }

  // 2. Parse via the MoR seam.
  const event = deps.parse(req.rawBody);
  if (event.kind === "ignore") {
    log("webhook.ignored", { reason: "non_order_event" });
    return ok();
  }
  if (event.kind === "invalid") {
    log("webhook.invalid", { reason: event.reason });
    return { status: 400, body: '{"error":"invalid payload"}' };
  }

  const { orderId, customerEmail } = event;

  // 3. Idempotency: a license already exists for this order ⇒ skip, do NOT re-email (D-58).
  const existing = await deps.search(orderId);
  if (existing) {
    log("webhook.idempotent_skip", { orderId });
    return ok();
  }

  // 4. Create the license. Failure ⇒ 5xx so LS retries (D-59).
  let key: string;
  try {
    key = await deps.create(orderId);
  } catch (err) {
    log("webhook.create_failed", { orderId, error: String(err) });
    return { status: 500, body: '{"error":"license creation failed"}' };
  }

  // 5. Email the key. Failure ⇒ alert + 5xx so LS retries (D-59/D-72).
  try {
    await deps.email(customerEmail, key);
  } catch (err) {
    deps.alert(`Key email failed for order ${orderId}: ${String(err)}`);
    log("webhook.email_failed", { orderId, error: String(err) });
    return { status: 500, body: '{"error":"email delivery failed"}' };
  }

  log("webhook.fulfilled", { orderId });
  return ok();
}

/** Default `parse`/`verify` wiring for production callers. */
export const defaultParse = parseOrderEvent;
export function makeVerify(secret: string) {
  return (rawBody: string, signatureHeader: string | undefined): boolean =>
    verifyLemonSqueezySignature(rawBody, signatureHeader, secret);
}
