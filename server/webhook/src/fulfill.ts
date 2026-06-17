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
  /** Create a license stamped with the buyer email (D-89) + orderNumber when present, returns its id + key. Throws on failure (⇒ 5xx). */
  create(
    orderId: string,
    email: string,
    orderNumber?: string,
  ): Promise<{ id: string; key: string }>;
  /** Email the key. Throws on failure (⇒ 5xx + alert). */
  email(customerEmail: string, key: string): Promise<void>;
  /** Mark the license emailed so a retry won't re-email (re-sends orderId + email + orderNumber, D-89). Best-effort (never 5xx). */
  markEmailed(
    licenseId: string,
    orderId: string,
    email: string,
    orderNumber?: string,
  ): Promise<void>;
  /** Out-of-band alert hook for a failed email after a successful create (D-72). */
  alert(message: string): void;
  /** Structured logger (defaults to console). */
  log?(event: string, fields?: Record<string, unknown>): void;
  /**
   * Serialize the search→create→email→mark critical section per orderId to close
   * the idempotency TOCTOU (single-instance, D-47). Defaults to a pass-through.
   */
  withLock?<T>(key: string, fn: () => Promise<T>): Promise<T>;
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

  const { orderId, customerEmail, orderNumber } = event;
  const withLock = deps.withLock ?? ((_key, fn) => fn());

  // Serialize the search→create→email→mark section per orderId so two concurrent
  // deliveries can't both search()->null and double-mint (idempotency TOCTOU, D-47).
  return await withLock(orderId, async (): Promise<FulfillResult> => {
    // 3. Idempotency (D-58): if a license exists, only skip when it was ALSO emailed.
    // A license that exists but never emailed (create succeeded, email failed last
    // try) must be re-emailed — otherwise the buyer pays and never gets the key.
    // The idempotency search is a CE call too — wrap it so a transient CE error
    // (or a routing 4xx) returns 500 for LS to retry, and NEVER escapes to crash
    // the process (an unhandled rejection here 502s the request and would take
    // the whole webhook down mid-fulfillment).
    let existing: KeygenLicense | null;
    try {
      existing = await deps.search(orderId);
    } catch (err) {
      log("webhook.search_failed", { orderId, error: String(err) });
      return { status: 500, body: '{"error":"idempotency search failed"}' };
    }
    let licenseId: string;
    let key: string;
    if (existing) {
      if (existing.attributes.metadata?.emailed === true) {
        log("webhook.idempotent_skip", { orderId });
        return ok();
      }
      licenseId = existing.id;
      key = existing.attributes.key;
      log("webhook.resume_unsent_email", { orderId });
    } else {
      // 4. Create the license, stamping the buyer email (D-89) + orderNumber. Failure ⇒ 5xx so LS retries (D-59).
      try {
        const created = await deps.create(orderId, customerEmail, orderNumber);
        licenseId = created.id;
        key = created.key;
      } catch (err) {
        log("webhook.create_failed", { orderId, error: String(err) });
        return { status: 500, body: '{"error":"license creation failed"}' };
      }
    }

    // 5. Email the key. Failure ⇒ alert + 5xx so LS retries (D-59/D-72).
    try {
      await deps.email(customerEmail, key);
    } catch (err) {
      deps.alert(`Key email failed for order ${orderId}: ${String(err)}`);
      log("webhook.email_failed", { orderId, error: String(err) });
      return { status: 500, body: '{"error":"email delivery failed"}' };
    }

    // 6. Mark emailed so a future retry idempotent-skips. Best-effort: the email
    // already went out, so a failure here must NOT 5xx (that would double-email).
    try {
      await deps.markEmailed(licenseId, orderId, customerEmail, orderNumber);
    } catch (err) {
      log("webhook.mark_emailed_failed", { orderId, error: String(err) });
    }

    log("webhook.fulfilled", { orderId });
    return ok();
  });
}

/** Default `parse`/`verify` wiring for production callers. */
export const defaultParse = parseOrderEvent;
export function makeVerify(secret: string) {
  return (rawBody: string, signatureHeader: string | undefined): boolean =>
    verifyLemonSqueezySignature(rawBody, signatureHeader, secret);
}
