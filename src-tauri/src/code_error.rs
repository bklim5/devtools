//! THE prose-free rejection contract shared by every Tauri command surface.
//!
//! Every command error in this crate serializes as `{"code": "..."}` — the
//! webview keys on the code string and NEVER on prose, so no user-facing English
//! crosses the FFI (and no error message can leak a path/key/identifier). The
//! `impl serde::Serialize` that enforces that shape was copy-pasted three times
//! (LicenseError, IapError, ReviewError); three hand-written copies of a wire
//! contract is three chances for one to drift. It lives here once instead.
//!
//! The macro is intentionally the ONLY thing here: the error enums themselves
//! stay in their own feature-gated modules, and this file compiles under BOTH
//! channels (it defines no types and pulls in no dependencies beyond serde).

/// Implement `serde::Serialize` for a code-carrying command error as
/// `{"code": "<self.code()>"}`.
///
/// Requires an inherent `fn code(&self) -> &'static str` on the type — the
/// single place the string constants live, which the per-module contract tests
/// pin. `$name` is the serde struct name (conventionally the type's own name).
#[macro_export]
macro_rules! impl_code_error_serialize {
    ($ty:ty, $name:literal) => {
        impl serde::Serialize for $ty {
            fn serialize<S: serde::Serializer>(
                &self,
                serializer: S,
            ) -> Result<S::Ok, S::Error> {
                use serde::ser::SerializeStruct;
                let mut s = serializer.serialize_struct($name, 1)?;
                s.serialize_field("code", self.code())?;
                s.end()
            }
        }
    };
}
