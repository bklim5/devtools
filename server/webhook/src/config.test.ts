import { describe, it, expect } from "vitest";
import { loadConfig } from "./config.ts";

/** A complete, valid env bag we can selectively override per test. */
function validEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    KEYGEN_HOST: "localhost",
    KEYGEN_ACCOUNT_ID: "acct_1",
    KEYGEN_ADMIN_TOKEN: "admin-token",
    KEYGEN_POLICY_ID: "policy_1",
    LS_WEBHOOK_SECRET: "ls-secret",
    RESEND_API_KEY: "resend-key",
    ...overrides,
  };
}

describe("loadConfig required() trimming", () => {
  it("trims a trailing newline off a required secret (so it never corrupts the HMAC/Bearer)", () => {
    const config = loadConfig(validEnv({ LS_WEBHOOK_SECRET: "abc\n" }));
    expect(config.lsWebhookSecret).toBe("abc");
  });

  it("trims surrounding whitespace off the admin token", () => {
    const config = loadConfig(validEnv({ KEYGEN_ADMIN_TOKEN: "  tok  " }));
    expect(config.keygenAdminToken).toBe("tok");
  });

  it("still throws on a whitespace-only required var", () => {
    expect(() => loadConfig(validEnv({ LS_WEBHOOK_SECRET: "   \n" }))).toThrow(
      /LS_WEBHOOK_SECRET/,
    );
  });

  it("throws on a missing required var", () => {
    const env = validEnv();
    delete env.KEYGEN_ACCOUNT_ID;
    expect(() => loadConfig(env)).toThrow(/KEYGEN_ACCOUNT_ID/);
  });
});
