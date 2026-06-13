// HTTP entrypoint — built-in Node `http` (no framework dep; D-56 zero-heavy-deps).
//
// Two routes:
//   GET  /health                 → 200 {"ok":true}  (D-72 uptime probe)
//   POST /webhooks/lemonsqueezy  → capture the RAW body BEFORE any JSON.parse
//                                  (Pitfall 5 / T-20-10), verify, fulfill.
//
// Caddy fronts this on the VPS (Plan 03); the backend itself binds PORT and
// reaches Keygen CE over localhost (D-55).

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { loadConfig } from "./config.ts";
import { createKeygenClient } from "./keygen.ts";
import { sendKeyEmail } from "./email.ts";
import { fulfill, defaultParse, makeVerify } from "./fulfill.ts";
import { createKeyedMutex } from "./lock.ts";
import { Resend } from "resend";

const WEBHOOK_PATH = "/webhooks/lemonsqueezy";

/** LS order payloads are tiny; cap the unauthenticated body to bound DoS memory. */
export const MAX_WEBHOOK_BYTES = 512 * 1024;

/** Raised by readRawBody when the body exceeds the cap (⇒ 413, before any work). */
export class PayloadTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`Request body exceeds ${maxBytes} bytes`);
    this.name = "PayloadTooLargeError";
  }
}

/**
 * Read the request stream to a UTF-8 string — the RAW bytes, before any parse.
 * Tracks cumulative length and rejects with PayloadTooLargeError once it exceeds
 * `maxBytes` (destroying the stream), so an unauthenticated caller can't buffer
 * unbounded memory before the signature check.
 */
export function readRawBody(
  req: IncomingMessage,
  maxBytes = MAX_WEBHOOK_BYTES,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        req.destroy();
        reject(new PayloadTooLargeError(maxBytes));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export function startServer() {
  const config = loadConfig();
  const keygen = createKeygenClient({
    baseUrl: config.keygenBaseUrl,
    accountId: config.keygenAccountId,
    adminToken: config.keygenAdminToken,
    policyId: config.keygenPolicyId,
  });
  const resend = new Resend(config.resendApiKey);
  const verify = makeVerify(config.lsWebhookSecret);
  // One per-order mutex shared across all requests (single-instance, D-47).
  const mutex = createKeyedMutex();

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void handle(req, res);
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end('{"ok":true}');
      return;
    }

    if (req.method === "POST" && req.url === WEBHOOK_PATH) {
      // Capture the RAW body BEFORE any JSON.parse so the signature verifies over
      // the exact bytes LS signed (Pitfall 5 / T-20-10). Cap the size first so an
      // unauthenticated caller can't exhaust memory before we verify.
      let rawBody: string;
      try {
        rawBody = await readRawBody(req);
      } catch (err) {
        if (err instanceof PayloadTooLargeError) {
          res.writeHead(413, { "Content-Type": "application/json" });
          res.end('{"error":"payload too large"}');
          return;
        }
        throw err;
      }
      const signatureHeader = headerValue(req, "x-signature");

      const result = await fulfill(
        { rawBody, signatureHeader },
        {
          verify,
          parse: defaultParse,
          search: (orderId) => keygen.searchByOrderId(orderId),
          create: (orderId) => keygen.createLicense(orderId),
          markEmailed: (id, orderId) => keygen.markEmailed(id, orderId),
          email: (to, key) => sendKeyEmail(resend, { from: config.emailFrom }, to, key),
          alert: (message) => console.error("[ALERT]", message),
          log: (event, fields) => console.log(JSON.stringify({ event, ...fields })),
          withLock: mutex.withLock,
        },
      );
      res.writeHead(result.status, { "Content-Type": "application/json" });
      res.end(result.body);
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end('{"error":"not found"}');
  }

  server.listen(config.port, () => {
    console.log(JSON.stringify({ event: "server.listening", port: config.port }));
  });
  return server;
}

function headerValue(req: IncomingMessage, name: string): string | undefined {
  const raw = req.headers[name];
  return Array.isArray(raw) ? raw[0] : raw;
}

// Boot when run directly (not when imported by a test).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
