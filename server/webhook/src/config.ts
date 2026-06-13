// Runtime configuration — read + validate required env at startup (D-55).
// No secret values are hardcoded; everything comes from the gitignored env
// (see .env.example for the template). A missing required var throws a clear,
// var-named error so a misconfigured VPS fails loud at boot, not mid-fulfillment.

export interface Config {
  /** Keygen CE host the backend reaches over localhost (D-55). */
  readonly keygenHost: string;
  readonly keygenAccountId: string;
  /** Privileged admin token — server-side ONLY (D-55/T-20-06). */
  readonly keygenAdminToken: string;
  /** Policy carrying pro.theming + pro.ordering entitlements (D-54). */
  readonly keygenPolicyId: string;
  /** Lemon Squeezy store webhook signing secret (D-60). */
  readonly lsWebhookSecret: string;
  /** Resend API key (D-64). */
  readonly resendApiKey: string;
  /** Verified "from" address for the key email. */
  readonly emailFrom: string;
  readonly port: number;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

/** Build + validate the Config from an env bag (defaults to process.env). */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    keygenHost: required(env, "KEYGEN_HOST"),
    keygenAccountId: required(env, "KEYGEN_ACCOUNT_ID"),
    keygenAdminToken: required(env, "KEYGEN_ADMIN_TOKEN"),
    keygenPolicyId: required(env, "KEYGEN_POLICY_ID"),
    lsWebhookSecret: required(env, "LS_WEBHOOK_SECRET"),
    resendApiKey: required(env, "RESEND_API_KEY"),
    emailFrom: env.EMAIL_FROM?.trim() || "TinkerDev Licenses <licenses@tinkerdev.io>",
    port: Number(env.PORT ?? 8787),
  };
}
