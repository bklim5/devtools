fn main() {
    // Phase 26 (MAS-IAP-01): when the `appstore` feature links tauri-plugin-iap's
    // StoreKit Swift package (via swift-bridge), the resulting binary references
    // the macOS Swift runtime (`@rpath/libswift_Concurrency.dylib`, libswiftCore,
    // …). cargo's default rpath does NOT include the OS Swift runtime dir, so the
    // `cargo test --features appstore` lib binary (and any non-bundled run) aborts
    // at load with "Library not loaded: @rpath/libswift_Concurrency.dylib". The OS
    // ships the runtime at /usr/lib/swift; add it to the rpath so the linked Swift
    // FFI resolves without a manual DYLD_FALLBACK_LIBRARY_PATH. Gated on the
    // feature (CARGO_FEATURE_* env — build scripts don't see cfg(feature)) + macOS
    // so the direct build/link is byte-unaffected.
    let appstore = std::env::var_os("CARGO_FEATURE_APPSTORE").is_some();
    let macos = std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos");
    if appstore && macos {
        println!("cargo:rustc-link-arg=-Wl,-rpath,/usr/lib/swift");
        compile_review_bridge();
    }

    tauri_build::build()
}

/// Compile + statically link the StoreKit 2 review bridge (UP5-02, quick-260808-up5).
///
/// `AppStore.requestReview(in:)` lives in StoreKit's SWIFT overlay (`@available(macOS 13.0,
/// *) @MainActor`, `@available(iOS, unavailable)`) — there is no ObjC class behind it, so
/// objc2/msg_send cannot reach it and the only non-deprecated entry point is Swift. This adds
/// NO new build prerequisite: the appstore channel ALREADY requires a Swift toolchain
/// (tauri-plugin-iap runs `swift build` from its own build.rs) and already solves the Swift
/// runtime link (the rpath line above). It also adds no crate — `swiftc` straight to a static
/// archive needs neither SwiftPM, swift-bridge, nor objc2, so Cargo.toml is untouched.
///
/// Called ONLY from the `appstore && macos` arm, so a direct build compiles NO Swift, links no
/// StoreKit, and never even spawns swiftc.
///
/// The archive lands in OUT_DIR (never a tracked `.build/` dir) so nothing new needs
/// gitignoring and `cargo clean` stays authoritative. cargo runs this script once per arch, so
/// the universal (`universal-apple-darwin`) build keys the Swift target triple on
/// CARGO_CFG_TARGET_ARCH and compiles the bridge once per slice — mirroring
/// tauri-plugin-iap's own build.rs.
#[cfg(target_os = "macos")]
fn compile_review_bridge() {
    const SWIFT_SOURCE: &str = "src/review/review.swift";

    // tauri_build::build() emits its own rerun-if-changed directives, so the "any file in the
    // package" default is already off — the Swift source needs an explicit one or an edit to
    // it would not rebuild the archive.
    println!("cargo:rerun-if-changed={SWIFT_SOURCE}");
    println!("cargo:rerun-if-env-changed=CARGO_CFG_TARGET_ARCH");
    println!("cargo:rerun-if-env-changed=MACOSX_DEPLOYMENT_TARGET");

    let out_dir = std::env::var("OUT_DIR").expect("OUT_DIR must be set");
    let arch = match std::env::var("CARGO_CFG_TARGET_ARCH").as_deref() {
        Ok("aarch64") => "arm64",
        Ok("x86_64") => "x86_64",
        other => panic!(
            "unsupported macOS architecture for the StoreKit review bridge: {other:?} \
             (expected aarch64 or x86_64)"
        ),
    };
    // 13.0 is this channel's floor; the build scripts export MACOSX_DEPLOYMENT_TARGET=13.0.
    let deployment_target = std::env::var("MACOSX_DEPLOYMENT_TARGET")
        .ok()
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| "13.0".to_string());
    let triple = format!("{arch}-apple-macosx{deployment_target}");
    let archive = std::path::Path::new(&out_dir).join("libtinkerdev_review.a");

    // A removed/changed StoreKit symbol MUST fail the build LOUDLY here — that is the
    // build-time availability check the Swift path buys us (a runtime objc lookup would fail
    // silently instead).
    let output = std::process::Command::new("swiftc")
        .args(["-emit-library", "-static", "-O", "-target", &triple, "-o"])
        .arg(&archive)
        .arg(SWIFT_SOURCE)
        .output()
        .unwrap_or_else(|e| panic!("failed to spawn swiftc for {SWIFT_SOURCE}: {e}"));
    assert!(
        output.status.success(),
        "swiftc failed for target {triple}\n--- stderr ---\n{}\n--- stdout ---\n{}",
        String::from_utf8_lossy(&output.stderr),
        String::from_utf8_lossy(&output.stdout),
    );

    println!("cargo:rustc-link-search=native={out_dir}");
    println!("cargo:rustc-link-lib=static=tinkerdev_review");
    println!("cargo:rustc-link-lib=framework=StoreKit");
    println!("cargo:rustc-link-lib=framework=AppKit");
}

/// Non-macOS hosts never reach the `appstore && macos` arm; this keeps the file compiling if
/// one is ever added as a build host.
#[cfg(not(target_os = "macos"))]
fn compile_review_bridge() {}
