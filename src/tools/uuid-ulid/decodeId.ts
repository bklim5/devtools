// decodeId (UID-01, D-17) — auto-detect UUID vs ULID from a pasted string and return
// a full breakdown, or an explicit error. Pure: it consumes the Plan-01 libs
// (decodeUuid / decodeUlid) and adds NO new parsing of its own — the only job here is
// detection + a boundary that NEVER throws (T-04-14). All malformed input — wrong
// length, bad charset, an unrecognized shape — becomes a bounded `kind:"error"` result
// rather than a crash, mirroring the JWT tool's discriminated-union error style.
import { decodeUuid } from "@/lib/uuidv7";
import { decodeUlid } from "@/lib/ulid";

export type DecodedId =
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | {
      kind: "ok";
      type: "uuid";
      version: number;
      variant: string;
      /** Embedded 48-bit BE ms timestamp for time-based versions (v7 here). */
      tsMs?: number;
    }
  | {
      kind: "ok";
      type: "ulid";
      tsMs: number;
      randomness: Uint8Array;
    };

// Canonical 8-4-4-4-12 hex layout, case-insensitive (the UUID shape).
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Crockford base32 alphabet (excludes I, L, O, U). A ULID is 26 of these chars.
const ULID_SHAPE = /^[0-9A-HJKMNP-TV-Z]{26}$/i;

/**
 * Detect whether `input` is a UUID or a ULID and decode it.
 *
 * - empty / whitespace-only → `{ kind: "empty" }` (neutral, not an error)
 * - matches the UUID shape → `decodeUuid` (a decode failure → scoped error)
 * - matches the ULID shape → `decodeUlid` (a decode failure → scoped error)
 * - anything else → `{ kind: "error", message: "Not a recognized UUID or ULID" }`
 *
 * Never throws past this boundary.
 */
export function decodeId(input: string): DecodedId {
  const trimmed = input.trim();
  if (trimmed === "") return { kind: "empty" };

  if (UUID_SHAPE.test(trimmed)) {
    try {
      const { version, variant, tsMs } = decodeUuid(trimmed);
      return { kind: "ok", type: "uuid", version, variant, tsMs };
    } catch (e) {
      return { kind: "error", message: messageOf(e, "Invalid UUID") };
    }
  }

  if (ULID_SHAPE.test(trimmed)) {
    try {
      // decodeUlid is case-sensitive (uppercase Crockford); normalize first.
      const { tsMs, randomness } = decodeUlid(trimmed.toUpperCase());
      return { kind: "ok", type: "ulid", tsMs, randomness };
    } catch (e) {
      return { kind: "error", message: messageOf(e, "Invalid ULID") };
    }
  }

  return { kind: "error", message: "Not a recognized UUID or ULID" };
}

function messageOf(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}
