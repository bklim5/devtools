import { describe, it, expect, vi } from "vitest";
import { createKeygenClient, type KeygenConfig } from "./keygen.ts";

const config: KeygenConfig = {
  baseUrl: "http://localhost:3000",
  accountId: "acct_1",
  adminToken: "admin-token-xyz",
  policyId: "policy_42",
};

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("createKeygenClient.searchByOrderId (D-58 idempotency)", () => {
  it("GETs /licenses?metadata[orderId]= with the Bearer admin token + JSON:API Accept", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: [] }));
    const client = createKeygenClient(config, fetchMock);

    await client.searchByOrderId("order 1/x");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain(
      "http://localhost:3000/v1/accounts/acct_1/licenses?metadata[orderId]=",
    );
    expect(url).toContain(encodeURIComponent("order 1/x"));
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer admin-token-xyz");
    expect(init.headers.Accept).toBe("application/vnd.api+json");
  });

  it("returns the existing license when data[] has an exact metadata.orderId match", async () => {
    const license = {
      id: "lic_1",
      attributes: { key: "ABC-123", metadata: { orderId: "order_1" } },
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: [license] }));
    const client = createKeygenClient(config, fetchMock);

    expect(await client.searchByOrderId("order_1")).toEqual(license);
  });

  it("returns null when data[] is empty", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: [] }));
    const client = createKeygenClient(config, fetchMock);

    expect(await client.searchByOrderId("order_1")).toBeNull();
  });

  it("returns null when no entry's metadata.orderId matches (never blind data[0])", async () => {
    const other = {
      id: "lic_2",
      attributes: { key: "ZZZ", metadata: { orderId: "different_order" } },
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: [other] }));
    const client = createKeygenClient(config, fetchMock);

    expect(await client.searchByOrderId("order_1")).toBeNull();
  });
});

describe("createKeygenClient.createLicense (D-58 metadata + D-54 policy rel)", () => {
  it("POSTs the JSON:API body (type licenses, attributes.metadata.orderId, relationships.policy) and returns {id,key}", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, { data: { id: "lic_9", attributes: { key: "KEY-XYZ" } } }),
    );
    const client = createKeygenClient(config, fetchMock);

    const created = await client.createLicense("order_77");
    expect(created).toEqual({ id: "lic_9", key: "KEY-XYZ" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:3000/v1/accounts/acct_1/licenses");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/vnd.api+json");
    const sent = JSON.parse(init.body);
    expect(sent.data.type).toBe("licenses");
    expect(sent.data.attributes.metadata.orderId).toBe("order_77");
    expect(sent.data.relationships.policy.data).toEqual({
      type: "policies",
      id: "policy_42",
    });
  });

  it("throws on a non-2xx create response (so fulfill can 5xx — D-59)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(500, { errors: [] }));
    const client = createKeygenClient(config, fetchMock);

    await expect(client.createLicense("order_1")).rejects.toThrow(/500/);
  });

  it("throws when the create response carries no license key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, { data: { id: "lic_x", attributes: {} } }),
    );
    const client = createKeygenClient(config, fetchMock);

    await expect(client.createLicense("order_1")).rejects.toThrow(/no license id\/key/);
  });
});

describe("createKeygenClient.markEmailed", () => {
  it("PATCHes /licenses/:id with metadata { orderId, emailed: true }", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: {} }));
    const client = createKeygenClient(config, fetchMock);

    await client.markEmailed("lic_9", "order_77");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:3000/v1/accounts/acct_1/licenses/lic_9");
    expect(init.method).toBe("PATCH");
    expect(init.headers["Content-Type"]).toBe("application/vnd.api+json");
    const sent = JSON.parse(init.body);
    expect(sent.data.type).toBe("licenses");
    expect(sent.data.attributes.metadata).toEqual({ orderId: "order_77", emailed: true });
  });

  it("throws on a non-2xx PATCH response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(422, { errors: [] }));
    const client = createKeygenClient(config, fetchMock);

    await expect(client.markEmailed("lic_9", "order_77")).rejects.toThrow(/422/);
  });
});
