import { describe, it, expect, vi } from "vitest";
import { sendKeyEmail, buildKeyEmailText, type EmailSender } from "./email.ts";

const config = {
  from: "TinkerDev Licenses <licenses@email.tinkerdev.io>",
  replyTo: "licenses@tinkerdev.io",
};

function makeSender(error: { message: string } | null = null) {
  const send = vi.fn().mockResolvedValue({ error });
  const client: EmailSender = { emails: { send } };
  return { client, send };
}

describe("sendKeyEmail (D-64/D-66)", () => {
  it("calls emails.send once with from, reply_to, buyer to, subject, and a plain-text body", async () => {
    const { client, send } = makeSender();

    await sendKeyEmail(client, config, "buyer@example.com", "KEY-123");

    expect(send).toHaveBeenCalledTimes(1);
    const payload = send.mock.calls[0][0];
    expect(payload.from).toBe("TinkerDev Licenses <licenses@email.tinkerdev.io>");
    expect(payload.replyTo).toBe("licenses@tinkerdev.io");
    expect(payload.to).toEqual(["buyer@example.com"]);
    expect(payload.subject).toBe("Your TinkerDev license key");
    expect(typeof payload.text).toBe("string");
  });

  it("includes the key and the 3 activation steps, with NO download link", async () => {
    const { client, send } = makeSender();

    await sendKeyEmail(client, config, "buyer@example.com", "MY-LICENSE-KEY");

    const text: string = send.mock.calls[0][0].text;
    expect(text).toContain("MY-LICENSE-KEY");
    expect(text).toContain("Unlock Pro");
    expect(text).toContain("Activate");
    expect(text).not.toContain("github.com");
    expect(text).not.toMatch(/download/i);
  });

  it("propagates a Resend error (so fulfill can 5xx + alert — D-59)", async () => {
    const { client } = makeSender({ message: "domain not verified" });

    await expect(
      sendKeyEmail(client, config, "buyer@example.com", "KEY-1"),
    ).rejects.toThrow(/domain not verified/);
  });
});

describe("buildKeyEmailText", () => {
  it("embeds the literal license key", () => {
    expect(buildKeyEmailText("ABC-DEF")).toContain("ABC-DEF");
  });
});
