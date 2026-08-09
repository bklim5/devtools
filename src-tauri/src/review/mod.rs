//! The App Store review request command (UP5-02, quick-260808-up5).
//!
//! Appstore channel ONLY — the whole module is behind `#[cfg(feature = "appstore")] mod
//! review;` in lib.rs, so the direct build compiles no Rust here, no Swift (build.rs gates the
//! swiftc call on the same feature), and registers no `request_app_store_review` command.
//!
//! WHAT IT DOES: asks the OS to consider showing its review sheet, via StoreKit 2
//! `AppStore.requestReview(in:)` through the tiny Swift bridge in `review.swift`. That API
//! lives in StoreKit's Swift overlay with no ObjC class behind it, so objc2/msg_send cannot
//! reach it; the ObjC-reachable `SKStoreReviewController` is `API_DEPRECATED macos(10.14,
//! 15.0)` and is deliberately NOT shipped. The Swift compile doubles as a BUILD-TIME
//! availability check.
//!
//! WHAT IT DOES NOT DO: it creates no UI of its own, takes no arguments, returns no data, and
//! makes no decision about WHEN to ask. Cadence — every 3rd settled tool success, at most once
//! per 7 days — is the webview's job (`src/shell/reviewPrompt.ts`), enforced by a PERSISTED
//! stamp. The OS owns real rate limiting on top of that (at most 3 prompts per 365 days) and
//! may legitimately show nothing, including for a user who has ALREADY reviewed — StoreKit
//! exposes no "did they review?" signal, which is exactly why we never infer one client-side
//! (Apple 5.6.1: OS mechanism only, no incentive, no feature gating).
//!
//! REJECTION CONTRACT: the webview stamps `lastReviewRequestAt` only after this command
//! RESOLVES, so this command must REJECT whenever the OS was not actually asked (no window /
//! no presentation anchor, main-thread dispatch failure, or an overlapping request). Silently succeeding there would burn
//! a whole 7-day window on a request that never happened. A rejection is a normal, handled
//! outcome: the webview persists nothing and retries at the next 3rd-success boundary.
//! Errors serialize as `{"code": "..."}` (the prose-free rejection contract shared with the
//! license and iap surfaces) — prose never crosses the FFI.

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{async_runtime::channel, AppHandle, Runtime};

extern "C" {
    /// Defined in `review.swift`, compiled to `libtinkerdev_review.a` and statically linked by
    /// build.rs under the `appstore` feature only. Returns 0 when the request was issued to
    /// StoreKit, 1 when no presentation anchor exists. MUST be called on the main thread (the
    /// Swift side is `@MainActor` and touches AppKit).
    fn tinkerdev_request_app_store_review() -> i32;
}

/// Process-level IN-FLIGHT guard (user revision 2026-08-09 — demoted from the previous
/// once-ever guard). Cadence ("every 3rd settled success, at most once per 7 days") is
/// enforced by the webview's PERSISTED gap gate; this static exists ONLY so two callers that
/// overlap in TIME cannot drive StoreKit twice at once. It is therefore claimed on entry and
/// ALWAYS released on completion — success AND failure — through a Drop guard, so no exit path
/// (including an early `?` return or a panic) can latch the feature off for the process. A
/// once-ever latch would silently kill every request after the first for the life of the
/// process, breaking the recurring cadence.
static REVIEW_IN_FLIGHT: AtomicBool = AtomicBool::new(false);

/// Claim the single in-flight slot. `Some(InFlight)` = this caller owns it; the claim is
/// released when (and ONLY when) that guard drops. Handing back the GUARD rather than a bool
/// is what makes "claimed but never released" and "released without claiming" unrepresentable:
/// there is no free release function to call by hand.
#[must_use]
fn try_claim() -> Option<InFlight> {
    REVIEW_IN_FLIGHT
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_ok()
        // `then`, NEVER `then_some`: `then_some` takes its argument BY VALUE, so it would
        // construct an `InFlight` even on the losing branch and immediately drop it —
        // releasing the WINNER's claim. (Observed: 4 of 16 barrier-synchronized threads
        // "winning".) The closure form only constructs it when the CAS actually succeeded.
        .then(|| InFlight)
}

/// RAII release — the ONLY way the claim is dropped, so an early `?` return (or a panic, or a
/// dropped/cancelled future) cannot forget it.
struct InFlight;

impl Drop for InFlight {
    fn drop(&mut self) {
        REVIEW_IN_FLIGHT.store(false, Ordering::SeqCst);
    }
}

/// Review command errors. The wire shape is `{"code": "..."}`; the webview keys on the code
/// string, never on prose. One variant on purpose: the webview's only reaction to ANY failure
/// is "persist nothing, retry at the next boundary", so a finer taxonomy would carry no
/// behavior — and a wider error surface across the IPC boundary is surface for nothing.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReviewError {
    /// THIS CALL did not ask the OS: no window / no presentation anchor (non-zero Swift
    /// return), a main-thread dispatch failure, or another request already in flight. Never
    /// returned for "the OS declined to show a sheet" — that is indistinguishable from success
    /// by design and IS a success here.
    Unavailable,
}

impl ReviewError {
    /// The serialized contract string — the webview keys on this.
    pub fn code(&self) -> &'static str {
        match self {
            ReviewError::Unavailable => "reviewUnavailable",
        }
    }
}

// Tauri command errors must Serialize; the wire shape is `{"code": "..."}`
// (crate::code_error).
crate::impl_code_error_serialize!(ReviewError, "ReviewError");

/// Ask the OS to consider showing its App Store review sheet. Takes no arguments, returns no
/// data. App-defined commands registered through `generate_handler!` need NO capability entry
/// (only plugin commands do), so `capabilities/default.json` and both config overlays are
/// untouched by this surface.
///
/// `async` on purpose: a sync Tauri command runs ON the main thread, and this must hop TO the
/// main thread and wait for the result — a sync body would deadlock against its own dispatch.
#[tauri::command]
pub async fn request_app_store_review<R: Runtime>(app: AppHandle<R>) -> Result<(), ReviewError> {
    with_in_flight_claim(|| present_on_main_thread(app)).await
}

/// The claim → present → classify core, factored out of the command so all four exit shapes
/// (overlap rejection, success, non-zero Swift return, dispatch failure) are unit-testable
/// without a live `AppHandle`.
async fn with_in_flight_claim<F, Fut>(present: F) -> Result<(), ReviewError>
where
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = Result<i32, ReviewError>>,
{
    // An OVERLAPPING call REJECTS. `Ok(())` here would be a LIE with a persistent
    // consequence: `Ok` is the webview's signal that the OS was asked, so it would stamp
    // `lastReviewRequestAt` and burn a whole 7-day window on a request this call never made.
    // Rejecting costs nothing — the webview's reaction to any failure is "persist nothing,
    // retry at the next 3rd-success boundary", and the twin that IS presenting will stamp on
    // its own success. Returning here (before any guard is bound) also means the loser can
    // never release the winner's claim.
    let Some(_in_flight) = try_claim() else {
        eprintln!("review: another request is already in flight; not asking again");
        return Err(ReviewError::Unavailable);
    };
    // `_in_flight` releases the claim on EVERY exit path below — the `?`, both match arms,
    // and any panic.

    match present().await? {
        0 => Ok(()),
        // Non-zero = no window / no presentation anchor: the OS was never asked, so REJECT.
        _ => {
            eprintln!("review: no presentation anchor; StoreKit was not asked");
            Err(ReviewError::Unavailable)
        }
    }
}

/// Hop to the main thread (AppKit + the `@MainActor` Swift entry both require it), run the
/// bridge, and carry its return code back.
async fn present_on_main_thread<R: Runtime>(app: AppHandle<R>) -> Result<i32, ReviewError> {
    let (tx, mut rx) = channel::<i32>(1);

    app.run_on_main_thread(move || {
        // SAFETY: the Swift entry point is `@_cdecl` with a C ABI, takes no arguments, returns
        // a plain i32, and is statically linked by build.rs under this same feature. It is
        // `@MainActor` and touches AppKit — this closure is exactly the main-thread guarantee
        // it requires.
        let code = unsafe { tinkerdev_request_app_store_review() };
        // The channel has capacity 1 and is empty, so `try_send` always succeeds and never
        // blocks. A BLOCKING send here would park the event-loop thread (and tokio's
        // blocking_send panics inside a runtime context) — never do that on the main thread.
        let _ = tx.try_send(code);
    })
    .map_err(|e| {
        eprintln!("review: run_on_main_thread failed: {e}");
        ReviewError::Unavailable
    })?;

    // `None` = the sender was dropped without sending (the closure never ran), i.e. the OS was
    // never asked → reject so the webview retries at the next boundary.
    rx.recv().await.ok_or_else(|| {
        eprintln!("review: main-thread bridge produced no result");
        ReviewError::Unavailable
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Barrier, Mutex, MutexGuard};
    use tauri::async_runtime::block_on;

    /// `REVIEW_IN_FLIGHT` is process-global while `cargo test` runs test fns on MULTIPLE
    /// THREADS, so every test that touches it holds this lock — otherwise the suite races
    /// itself. Poison-tolerant: one panicking test must not cascade into the others. Each
    /// acquisition also resets the static (the one place that is legitimate — a leaked guard
    /// from a panicking test must not wedge the rest of the suite), so every test starts
    /// unclaimed.
    static TEST_LOCK: Mutex<()> = Mutex::new(());

    fn claim_static() -> MutexGuard<'static, ()> {
        let guard = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        REVIEW_IN_FLIGHT.store(false, Ordering::SeqCst);
        guard
    }

    /// Test 1: the guard admits exactly ONE in-flight request at a time. Every thread's guard
    /// is held until ALL threads have raced (the Vec outlives the joins), so a winner cannot
    /// release early and let a second caller in — which would make the assertion vacuous.
    #[test]
    fn concurrent_claims_admit_exactly_one() {
        let _lock = claim_static();

        let barrier = Arc::new(Barrier::new(16));
        let handles: Vec<_> = (0..16)
            .map(|_| {
                let barrier = Arc::clone(&barrier);
                std::thread::spawn(move || {
                    barrier.wait(); // maximize the overlap
                    try_claim()
                })
            })
            .collect();
        let guards: Vec<Option<InFlight>> = handles
            .into_iter()
            .map(|h| h.join().expect("claim thread panicked"))
            .collect();

        assert_eq!(
            guards.iter().filter(|g| g.is_some()).count(),
            1,
            "exactly one of 16 concurrent callers may hold the in-flight claim"
        );
    }

    /// The Swift bridge actually LINKS. Taking the address forces the linker to resolve
    /// `_tinkerdev_request_app_store_review` out of `libtinkerdev_review.a` — without this the
    /// archive member is never pulled into a test binary (nothing else here references it, and
    /// the only production reference sits behind a generic that a test build need not
    /// monomorphize), so a missing/renamed Swift export would link CLEANLY and the "the
    /// appstore build links the bridge" claim would be vacuous. Never CALLED: the real call
    /// must happen on the main thread with an AppKit window alive.
    #[test]
    fn swift_bridge_symbol_resolves_at_link_time() {
        let entry: unsafe extern "C" fn() -> i32 = tinkerdev_request_app_store_review;
        // black_box keeps the reference (and therefore the link edge) from being optimized
        // away; a plain null check would be folded AND lint as useless on a fn pointer.
        assert!(std::hint::black_box(entry as usize) > 0);
    }

    /// Test 2: the `{"code": "..."}` wire contract (mirrors the IapError contract test).
    #[test]
    fn review_error_serializes_code() {
        assert_eq!(ReviewError::Unavailable.code(), "reviewUnavailable");
        assert_eq!(
            serde_json::to_string(&ReviewError::Unavailable).unwrap(),
            r#"{"code":"reviewUnavailable"}"#
        );
    }

    /// Test 3: sequential calls BOTH succeed — this is an IN-FLIGHT guard, not a once-ever
    /// latch. "Never twice over time" is the webview's persisted 7-day gap; a native
    /// once-latch would silently kill every request after the first for the life of the
    /// process and break the recurring cadence.
    #[test]
    fn sequential_claims_both_succeed() {
        let _lock = claim_static();

        {
            let first = try_claim();
            assert!(first.is_some(), "first claim");
        } // dropping the guard releases
        assert!(
            try_claim().is_some(),
            "a released claim must be re-claimable — the static is not a once-ever latch"
        );
    }

    /// Test 4: the claim is released on EVERY exit path — success, non-zero Swift return, and
    /// dispatch failure — and an overlapping call REJECTS without presenting and without
    /// releasing the winner's claim.
    ///
    /// Every path is driven through `with_in_flight_claim` (the code the command runs), and
    /// the "was it released?" probe is a claim ATTEMPT whose guard drops at the end of the
    /// statement — the test never touches the static by hand.
    #[test]
    fn every_exit_path_releases_the_claim() {
        let _lock = claim_static();

        // (a) SUCCESS path.
        assert_eq!(block_on(with_in_flight_claim(|| async { Ok(0) })), Ok(()));
        assert!(
            try_claim().is_some(),
            "the success path must release the claim"
        );

        // (b) Non-zero Swift return (no window / no presentation anchor) → REJECT, released.
        assert_eq!(
            block_on(with_in_flight_claim(|| async { Ok(1) })),
            Err(ReviewError::Unavailable)
        );
        assert!(
            try_claim().is_some(),
            "the non-zero-return path must release the claim"
        );

        // (c) Dispatch failure (the `?` early return) → REJECT, released.
        assert_eq!(
            block_on(with_in_flight_claim(|| async {
                Err(ReviewError::Unavailable)
            })),
            Err(ReviewError::Unavailable)
        );
        assert!(
            try_claim().is_some(),
            "the run_on_main_thread-failure path must release the claim"
        );

        // (d) OVERLAP: a call arriving while another is in flight never presents, REJECTS
        // (an Ok would tell the webview the OS was asked and burn a 7-day window on a
        // request this call never made), and must NOT release the in-flight owner's claim.
        let owner = try_claim();
        assert!(
            owner.is_some(),
            "simulate an in-flight request owned elsewhere"
        );
        let presented = Arc::new(AtomicBool::new(false));
        let flag = Arc::clone(&presented);
        assert_eq!(
            block_on(with_in_flight_claim(move || async move {
                flag.store(true, Ordering::SeqCst);
                Ok(0)
            })),
            Err(ReviewError::Unavailable),
            "an overlapping call must REJECT, never Ok-without-asking"
        );
        assert!(
            !presented.load(Ordering::SeqCst),
            "an overlapping call must not reach StoreKit"
        );
        assert!(
            try_claim().is_none(),
            "an overlapping rejection must not release the in-flight owner's claim"
        );
        drop(owner);
        assert!(
            try_claim().is_some(),
            "the owner's guard still releases normally"
        );
    }
}
