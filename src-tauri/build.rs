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
    }

    tauri_build::build()
}
