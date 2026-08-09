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
private enum ReviewAnchor {
    static var controller: NSViewController?
}

@MainActor
private func presentReview() -> Int32 {
    guard let window = NSApp.keyWindow ?? NSApp.mainWindow
            ?? NSApp.windows.first(where: { $0.isVisible }) else { return 1 }
    let controller: NSViewController
    if let existing = window.contentViewController {
        controller = existing
    } else if let anchor = ReviewAnchor.controller {
        controller = anchor
    } else if let content = window.contentView {
        let vc = NSViewController()
        let view = NSView(frame: .zero)   // MUST set .view before reading it: a bare
        view.isHidden = true              // NSViewController would try to load a nib.
        vc.view = view
        content.addSubview(view)
        ReviewAnchor.controller = vc
        controller = vc
    } else { return 1 }
    AppStore.requestReview(in: controller)
    return 0
}

/// C-ABI entry point. Rust guarantees the main thread via AppHandle::run_on_main_thread.
/// Returns 0 on request issued, 1 when no presentation anchor exists.
@_cdecl("tinkerdev_request_app_store_review")
public func tinkerdev_request_app_store_review() -> Int32 {
    MainActor.assumeIsolated { presentReview() }
}
