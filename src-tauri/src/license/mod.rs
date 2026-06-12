//! Licensing core (Phase 19, LIC-01/03/04/06).
//!
//! Pure, cargo-testable modules: no network in this tree (D-45 — the only
//! network call, user-initiated activation, joins in Plan 03's client module).

// TEMPORARY until Plan 03 wires the Tauri commands: nothing outside this module
// consumes it yet, so every public item dead-code-warns. Remove with Plan 03.
#![allow(dead_code)]

pub mod config;
pub mod fingerprint;
pub mod verify;
