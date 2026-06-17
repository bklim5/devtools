// Keygen CE admin client (D-58 idempotency + D-54 policy-attached entitlements).
//
// Thin wrapper over the CE JSON:API. The privileged admin token (D-55/T-20-06)
// is passed in from config and sent as a Bearer header — it lives ONLY in the
// gitignored env and the backend reaches CE over localhost.
//
// Entitlements pro.theming + pro.ordering are attached to the POLICY (D-54, set
// in Plan 03's setup.sh) and inherit automatically onto every license — the
// backend does NOT attach them per-license. We only stamp metadata.orderId.
//
// D-89: the buyer email is stamped into attributes.metadata.email at create
// time. Keygen embeds license metadata into the checkout cert's license
// resource, so the email flows all the way to machine.lic and the Rust verifier
// extracts it (verify.rs) for the support-lookup path (D-80) + the status UI.
// Keygen REPLACES the whole metadata object on PATCH, so markEmailed re-sends
// orderId + email (+ orderNumber) alongside the emailed flag (never clobber them).
//
// We also stamp metadata.orderNumber (the LS dashboard "#") when present, so a
// refund/suspend can resolve a license straight from the dashboard order number
// (the API order id and the dashboard URL id are both different identifiers).
// Best-effort: undefined drops out of the JSON body, so pre-existing licenses
// and order_number-less payloads are unaffected.

const JSON_API = "application/vnd.api+json";

export interface KeygenConfig {
  /** Full CE origin incl. scheme+port (e.g. http://localhost:3000) — no hardcoded https (D-55). */
  readonly baseUrl: string;
  readonly accountId: string;
  readonly adminToken: string;
  readonly policyId: string;
}

/** Minimal JSON:API license resource shape we consume. */
export interface KeygenLicense {
  id: string;
  attributes: {
    key: string;
    metadata?: {
      orderId?: string;
      orderNumber?: string;
      email?: string;
      emailed?: boolean;
    };
  };
}

export interface KeygenClient {
  /** D-58: existing license for this exact orderId, or null. */
  searchByOrderId(orderId: string): Promise<KeygenLicense | null>;
  /** Create a license stamped with metadata.orderId + email (D-89) + orderNumber (when present); returns its id + key. Throws on non-2xx (D-59). */
  createLicense(
    orderId: string,
    email: string,
    orderNumber?: string,
  ): Promise<{ id: string; key: string }>;
  /** Mark a license emailed (Keygen replaces metadata, so re-send orderId + email + orderNumber, D-89). Throws on non-2xx. */
  markEmailed(
    licenseId: string,
    orderId: string,
    email: string,
    orderNumber?: string,
  ): Promise<void>;
}

type FetchLike = typeof fetch;

/**
 * Build a Keygen CE admin client. `fetchImpl` is injectable for tests (defaults
 * to global fetch).
 */
export function createKeygenClient(
  config: KeygenConfig,
  fetchImpl: FetchLike = fetch,
): KeygenClient {
  // Keygen CE (singleplayer) mounts the API at /v1/... with NO /accounts/{id}
  // segment — the single account is implicit. Account-scoped routes 404 on the
  // real prod CE (verified live 2026-06-14). config.accountId is retained for
  // the record but is not in the URL path.
  const base = `${config.baseUrl.replace(/\/$/, "")}/v1`;
  const authHeaders = {
    Authorization: `Bearer ${config.adminToken}`,
    Accept: JSON_API,
  };

  return {
    async searchByOrderId(orderId: string): Promise<KeygenLicense | null> {
      const url = `${base}/licenses?metadata[orderId]=${encodeURIComponent(orderId)}`;
      const res = await fetchImpl(url, { method: "GET", headers: authHeaders });
      if (!res.ok) {
        throw new Error(`Keygen search failed (${res.status})`);
      }
      const body = (await res.json()) as { data?: KeygenLicense[] };
      // D-58: only accept an EXACT orderId match (the metadata[] filter is a CE
      // hint, not a guarantee — never blind-trust data[0]).
      const match = body.data?.find(
        (lic) => lic.attributes.metadata?.orderId === orderId,
      );
      return match ?? null;
    },

    async createLicense(
      orderId: string,
      email: string,
      orderNumber?: string,
    ): Promise<{ id: string; key: string }> {
      const url = `${base}/licenses`;
      const payload = {
        data: {
          type: "licenses",
          // D-89: stamp the buyer email beside orderId so it flows into machine.lic.
          // (orderNumber is optional — undefined drops out of the JSON body.)
          attributes: { metadata: { orderId, orderNumber, email } },
          relationships: {
            policy: { data: { type: "policies", id: config.policyId } },
          },
        },
      };
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": JSON_API },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        // Non-2xx ⇒ throw so the orchestrator returns 5xx and LS auto-retries (D-59).
        throw new Error(`Keygen create failed (${res.status})`);
      }
      const body = (await res.json()) as { data?: KeygenLicense };
      const id = body.data?.id;
      const key = body.data?.attributes?.key;
      if (!id || !key) {
        throw new Error("Keygen create returned no license id/key");
      }
      return { id, key };
    },

    async markEmailed(
      licenseId: string,
      orderId: string,
      email: string,
      orderNumber?: string,
    ): Promise<void> {
      const url = `${base}/licenses/${licenseId}`;
      // Keygen REPLACES the metadata object on PATCH, so re-send orderId + email
      // (+ orderNumber, D-89) alongside the emailed flag to avoid clobbering them.
      const payload = {
        data: {
          type: "licenses",
          attributes: { metadata: { orderId, orderNumber, email, emailed: true } },
        },
      };
      const res = await fetchImpl(url, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": JSON_API },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(`Keygen markEmailed failed (${res.status})`);
      }
    },
  };
}
