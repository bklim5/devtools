// useBytesConvert (ENC-01/02/03, D-12/D-13): ONE internal Uint8Array is the single
// source of truth. Editing any of text/base64/hex parses ONLY that field back to
// bytes, then re-derives the OTHER TWO from those bytes. On a parse failure, only
// that field's error is set and bytes + the other two strings stay last-good — the
// user still sees the raw text they typed. The alphabet toggle re-derives ONLY the
// base64 string (no re-parse → no round-trip mangling). All byte work routes through
// src/lib/bytes.ts; NO btoa/atob/TextEncoder and NO @tauri-apps here.
import { useCallback, useMemo, useState } from "react";
import {
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  bytesToUtf8,
  hexToBytes,
  utf8ToBytes,
  type Base64Alphabet,
} from "@/lib/bytes";

/** Per-field parse errors. A field is absent here iff it currently parses. */
export interface FieldErrors {
  text?: string;
  base64?: string;
  hex?: string;
}

export interface BytesConvert {
  text: string;
  base64: string;
  hex: string;
  alphabet: Base64Alphabet;
  errors: FieldErrors;
  byteCount: number;
  editText(raw: string): void;
  editBase64(raw: string): void;
  editHex(raw: string): void;
  setAlphabet(next: Base64Alphabet): void;
}

const EMPTY = new Uint8Array(0);
const EMPTY_ERRORS: FieldErrors = {};

export function useBytesConvert(): BytesConvert {
  const [bytes, setBytes] = useState<Uint8Array>(EMPTY);
  const [text, setText] = useState("");
  const [base64, setBase64] = useState("");
  const [hex, setHex] = useState("");
  const [alphabet, setAlphabetState] = useState<Base64Alphabet>("base64");
  const [errors, setErrors] = useState<FieldErrors>({});

  // A successful edit re-derives the OTHER TWO fields from fresh bytes, so any
  // stale error on them no longer matches what is displayed — clear all three.
  const clearErrors = useCallback(() => setErrors((prev) => (prev === EMPTY_ERRORS ? prev : EMPTY_ERRORS)), []);

  const setError = useCallback(
    (field: keyof FieldErrors, message: string) =>
      setErrors((prev) => ({ ...prev, [field]: message })),
    [],
  );

  const editText = useCallback(
    (raw: string) => {
      setText(raw);
      // utf8ToBytes never throws — text is always a valid source of bytes.
      const next = utf8ToBytes(raw);
      setBytes(next);
      setBase64(bytesToBase64(next, alphabet));
      setHex(bytesToHex(next));
      clearErrors();
    },
    [alphabet, clearErrors],
  );

  const editBase64 = useCallback(
    (raw: string) => {
      setBase64(raw);
      try {
        const next = base64ToBytes(raw, alphabet);
        setBytes(next);
        setText(bytesToUtf8(next)); // non-fatal: lossy display is acceptable
        setHex(bytesToHex(next));
        clearErrors();
      } catch (e) {
        // Last-good: do NOT touch bytes/text/hex; flag only this field.
        setError("base64", (e as Error).message);
      }
    },
    [alphabet, clearErrors, setError],
  );

  const editHex = useCallback(
    (raw: string) => {
      setHex(raw);
      try {
        const next = hexToBytes(raw);
        setBytes(next);
        setText(bytesToUtf8(next));
        setBase64(bytesToBase64(next, alphabet));
        clearErrors();
      } catch (e) {
        setError("hex", (e as Error).message);
      }
    },
    [alphabet, clearErrors, setError],
  );

  // Re-derive ONLY base64 from the CURRENT bytes — never re-parse the base64 string
  // (that would mangle on a non-canonical input). text + hex are byte-identical.
  const setAlphabet = useCallback(
    (next: Base64Alphabet) => {
      setAlphabetState(next);
      setBase64(bytesToBase64(bytes, next));
    },
    [bytes],
  );

  const byteCount = bytes.length;

  return useMemo(
    () => ({
      text,
      base64,
      hex,
      alphabet,
      errors,
      byteCount,
      editText,
      editBase64,
      editHex,
      setAlphabet,
    }),
    [
      text,
      base64,
      hex,
      alphabet,
      errors,
      byteCount,
      editText,
      editBase64,
      editHex,
      setAlphabet,
    ],
  );
}
