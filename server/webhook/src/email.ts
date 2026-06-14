// Resend plain-text license-key email (D-64/D-66).
//
// The buyer receives the raw license key plus 3-line activation steps and a
// reply-for-help line. Resend resolves with `{ data, error }` rather than
// throwing on an API error, so we surface `error` as a thrown Error — letting
// the orchestrator 5xx + alert (D-59/D-72) on a failed send. A Reply-To routes
// buyer replies to a monitored mailbox (M365), separate from the Resend send
// domain (email.tinkerdev.io), which has no inbox.

const SUBJECT = "Your TinkerDev license key";

/** Minimal slice of the Resend client we depend on (injectable for tests). */
export interface EmailSender {
  emails: {
    send(payload: {
      from: string;
      to: string[];
      subject: string;
      text: string;
      reply_to?: string;
    }): Promise<{ error: { message: string } | null }>;
  };
}

export interface EmailConfig {
  readonly from: string;
  /** Reply-To — routes buyer replies to a monitored mailbox (e.g. M365 on
   * tinkerdev.io), separate from the Resend send-only domain. */
  readonly replyTo?: string;
}

/** D-66 plain-text body: key + 3 activation steps + reply-for-help. */
export function buildKeyEmailText(licenseKey: string): string {
  return [
    `Thank you for buying TinkerDev! Here is your license key:`,
    ``,
    `    ${licenseKey}`,
    ``,
    `To activate:`,
    `  1. Open TinkerDev`,
    `  2. Click "Unlock Pro"`,
    `  3. Paste the key above and click Activate`,
    ``,
    `Just reply to this email if you need any help.`,
  ].join("\n");
}

/**
 * Send the key email. Throws if Resend reports an error so the orchestrator can
 * 5xx + alert (D-59/D-72).
 */
export async function sendKeyEmail(
  client: EmailSender,
  config: EmailConfig,
  to: string,
  licenseKey: string,
): Promise<void> {
  const { error } = await client.emails.send({
    from: config.from,
    to: [to],
    subject: SUBJECT,
    text: buildKeyEmailText(licenseKey),
    reply_to: config.replyTo,
  });
  if (error) {
    throw new Error(`Resend send failed: ${error.message}`);
  }
}
