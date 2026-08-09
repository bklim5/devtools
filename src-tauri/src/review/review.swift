// StoreKit 2 review request (UP5-02, appstore channel only).
//
// WHY SWIFT: AppStore.requestReview(in:) is @available(macOS 13.0, *) @MainActor and lives
// in StoreKit's SWIFT overlay — there is no ObjC class behind it, so objc2/msg_send cannot
// reach it. The deprecated +[SKStoreReviewController requestReview] is API_DEPRECATED
// macos(10.14, 15.0) and is deliberately NOT used. Compiled ONLY for the appstore feature
// (src-tauri/build.rs), so the direct build links no Swift and no StoreKit.
//
// macOS 13.0 is exactly this channel's floor (tauri.appstore.conf.json minimumSystemVersion
// + MACOSX_DEPLOYMENT_TARGET=13.0), so no #available guard is needed. The availability check
// is therefore a BUILD-TIME one: if Apple ever removes or changes this API, `cargo build`
// fails loudly here instead of failing soft at runtime.
//
// Apple 5.6.1: this asks the OS. The OS owns rate limiting (at most 3 real prompts per 365
// days, and silently nothing at all for a user who already reviewed) and may legitimately
// show nothing. No custom UI, no incentive, no feature gating.
import AppKit
import StoreKit

/// Retained anchor: a tao NSWindow has a NIL contentViewController, and StoreKit needs an
/// NSViewController to present from. We attach a zero-size hidden view to the real
/// contentView (never reparenting the webview) and keep the controller alive for the
/// process — releasing it mid-presentation would pull the anchor out from under the sheet.
///
/// KEYED TO THE WINDOW IT WAS BUILT FOR. The cached controller's view lives inside ONE
/// window's contentView. This app closes and re-creates its window (tray/summon hide-close,
/// single-instance re-show), so a later request can resolve a DIFFERENT NSWindow — and
/// presenting from a controller whose view is not in that window means presenting from a
/// detached (or dead) view hierarchy, which is at best no sheet and at worst a crash. The
/// window reference is WEAK so a closed window is not kept alive by this cache; it going nil
/// is itself the "rebuild" signal.
private enum ReviewAnchor {
    static weak var window: NSWindow?
    static var controller: NSViewController?
}

@MainActor
private func presentReview() -> Int32 {
    guard let window = NSApp.keyWindow ?? NSApp.mainWindow
            ?? NSApp.windows.first(where: { $0.isVisible }) else { return 1 }

    // The real contentViewController, when one exists, is always the best anchor.
    if let existing = window.contentViewController {
        AppStore.requestReview(in: existing)
        return 0
    }
    // Reuse the cached anchor ONLY if it was built for THIS window and is still installed in
    // it (both checks matter: the window may have been re-created, or the view removed).
    if let cached = ReviewAnchor.controller,
       ReviewAnchor.window === window,
       cached.view.window === window {
        AppStore.requestReview(in: cached)
        return 0
    }
    guard let content = window.contentView else { return 1 }
    // Rebuilding: detach the stale anchor's view so we do not leave orphan subviews behind in
    // a window that is still alive. Safe here — the process-level in-flight guard on the Rust
    // side means no presentation can be running while this executes.
    ReviewAnchor.controller?.view.removeFromSuperview()
    let vc = NSViewController()
    let view = NSView(frame: .zero)   // MUST set .view before reading it: a bare
    view.isHidden = true              // NSViewController would try to load a nib.
    vc.view = view
    content.addSubview(view)
    ReviewAnchor.window = window
    ReviewAnchor.controller = vc
    AppStore.requestReview(in: vc)
    return 0
}

/// C-ABI entry point. Rust guarantees the main thread via AppHandle::run_on_main_thread.
/// Returns 0 on request issued, 1 when no presentation anchor exists.
@_cdecl("tinkerdev_request_app_store_review")
public func tinkerdev_request_app_store_review() -> Int32 {
    MainActor.assumeIsolated { presentReview() }
}
