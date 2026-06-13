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
import { Resend } from "resend";

const WEBHOOK_PATH = "/webhooks/lemonsqueezy";

/** Read the request stream to a UTF-8 string — the RAW bytes, before any parse. */
function readRawBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export function startServer() {
  const config = loadConfig();
  const keygen = createKeygenClient({
    host: config.keygenHost,
    accountId: config.keygenAccountId,
    adminToken: config.keygenAdminToken,
    policyId: config.keygenPolicyId,
  });
  const resend = new Resend(config.resendApiKey);
  const verify = makeVerify(config.lsWebhookSecret);

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
      // the exact bytes LS signed (Pitfall 5 / T-20-10).
      const rawBody = await readRawBody(req);
      const signatureHeader = headerValue(req, "x-signature");

      const result = await fulfill(
        { rawBody, signatureHeader },
        {
          verify,
          parse: defaultParse,
          search: (orderId) => keygen.searchByOrderId(orderId),
          create: (orderId) => keygen.createLicense(orderId),
          email: (to, key) => sendKeyEmail(resend, { from: config.emailFrom }, to, key),
          alert: (message) => console.error("[ALERT]", message),
          log: (event, fields) => console.log(JSON.stringify({ event, ...fields })),
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
