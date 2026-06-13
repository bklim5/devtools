import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import {
  readRawBody,
  MAX_WEBHOOK_BYTES,
  PayloadTooLargeError,
} from "./index.ts";

/** Minimal IncomingMessage stand-in: an EventEmitter with a spyable destroy(). */
function mockReq(): { req: IncomingMessage; destroy: ReturnType<typeof vi.fn> } {
  const emitter = new EventEmitter();
  const destroy = vi.fn();
  Object.assign(emitter, { destroy });
  return { req: emitter as unknown as IncomingMessage, destroy };
}

describe("readRawBody size cap (unauthenticated DoS guard)", () => {
  it("resolves a body under the cap to the right UTF-8 string", async () => {
    const { req, destroy } = mockReq();
    const promise = readRawBody(req);

    req.emit("data", Buffer.from("hello "));
    req.emit("data", Buffer.from("world"));
    req.emit("end");

    expect(await promise).toBe("hello world");
    expect(destroy).not.toHaveBeenCalled();
  });

  it("rejects with PayloadTooLargeError and destroys the stream once the cap is exceeded", async () => {
    const { req, destroy } = mockReq();
    const promise = readRawBody(req, 8);
    const rejection = expect(promise).rejects.toBeInstanceOf(PayloadTooLargeError);

    req.emit("data", Buffer.from("12345"));
    req.emit("data", Buffer.from("67890")); // total 10 > cap 8

    await rejection;
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("defaults the cap to MAX_WEBHOOK_BYTES (512 KiB)", () => {
    expect(MAX_WEBHOOK_BYTES).toBe(512 * 1024);
  });
});
