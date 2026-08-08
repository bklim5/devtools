# CHANNELS.md — direct vs App Store, in one table

> Written 2026-08-08 (quick/260808-kfs) to close architecture-review findings **F7 / KG-4**:
> the two build channels differ along ~15 dimensions that were documented only as scattered
> comments across configs, scripts and plan files. Every row below was verified against the
> live tree on that date.

The app ships as two products from one source tree:

- **direct** — the notarised DMG published to `bklim5/devtools-releases`, self-updating,
  Pro unlocked by a Keygen licence key.
- **appstore** — the sandboxed Mac App Store build, no updater, Pro unlocked by StoreKit.

The channel is chosen at **build time** by a cargo feature plus a Tauri config overlay plus
a Vite env var. Getting any one of the three wrong produces a binary that builds, launches,
and is wrong.

## The matrix

| Dimension | direct | appstore | Enforced / asserted by |
|---|---|---|---|
| Cargo features | default (`default = ["direct"]`) | **`--no-default-features --features appstore`** | `src-tauri/Cargo.toml:115,126,133`; `assert_plugins_absent` |
| Hybrid-build guard | n/a | `compile_error!` if both features are on | `src-tauri/src/lib.rs:11-17` |
| Native deps carried | `tauri-plugin-updater`, `tauri-plugin-autostart`, `tauri-plugin-process`, `keyring` | `tauri-plugin-iap` only | `src-tauri/Cargo.toml:126,133`; `assert_plugins_absent` |
| Config overlay | `src-tauri/tauri.direct.conf.json` | `src-tauri/tauri.appstore.conf.json` | `package.json` scripts; `scripts/build-appstore-bundle.sh:130` |
| Extra capability | `direct-native`: `updater:default`, `process:allow-restart`, `autostart:allow-{enable,disable,is-enabled}` | `appstore-iap`: `iap:allow-register-listener`, `iap:allow-remove-listener` | `tauri.direct.conf.json:8-18`; `tauri.appstore.conf.json:8-15` |
| Baseline capability | the literal `"default"` entry — **load-bearing** (see call-out 1) | same | both overlays, first array entry |
| Frontend channel switch | `VITE_CHANNEL=direct` → `IS_APPSTORE === false` | `VITE_CHANNEL=appstore` → `IS_APPSTORE === true` | `src/lib/platform/channel.ts:13-14`, consumed at `src/App.tsx:19,28,47` |
| Pro entitlement source | Keygen licence (`baseFromLicense`) | StoreKit (`baseFromStoreKit`) | `src/lib/entitlements/resolve.ts:27,42,83-84`; `assert_no_keygen_strings` |
| Licence UI | present | compiled/tree-shaken out | `scripts/licenseUiFoldInGuard.mjs` (gated on `VITE_CHANNEL=appstore` in `vite.config.ts:34`); `assert_no_license_ui_module` |
| Updater UI + launch-at-login | present | absent | `src/App.tsx:47`; `assert_no_license_ui_module` (updater subtree) |
| Keychain / keyring | `keyring` links; licence stored in the macOS Keychain | no Keychain at all | `Cargo.toml:126`; `assert_plugins_absent`, `assert_entitlements_present` (no `keychain-access-groups`) |
| Entitlements file | `entitlements.plist` — hardened-runtime JIT / unsigned-memory / library-validation exceptions | `entitlements.appstore.plist` — `app-sandbox`, `network.client`, `application-identifier`, `team-identifier` | `tauri.conf.json:46`; `tauri.appstore.conf.json:23`; `assert_entitlements_present` |
| Hardened runtime | `true` | `false` | `tauri.conf.json:45`; `tauri.appstore.conf.json:24` |
| `minimumSystemVersion` | `10.15` | `13.0` | `tauri.conf.json:47`; `tauri.appstore.conf.json:25`; `assert_min_system_version` (asserted on the built `Info.plist`, not the overlay) |
| Bundle targets | `["app", "dmg"]` | `["app"]` | `tauri.conf.json:32`; `tauri.appstore.conf.json:20` |
| Updater artifacts | `createUpdaterArtifacts: true` | `false`, and `plugins.updater: null` | `tauri.conf.json:34`; `tauri.appstore.conf.json:21,29` |
| Signing identity | `Developer ID Application` (+ notarise + staple) | `Apple Development` (local sandbox build) / `Apple Distribution` + `3rd Party Mac Developer Installer` (the `.pkg`) | `scripts/build-appstore-bundle.sh:45`; `scripts/build-appstore-pkg.sh:93,104` |
| Provisioning profile | none | `src-tauri/embedded.provisionprofile`, embedded + re-signed | `scripts/build-appstore-pkg.sh:64`; `assert_binary_integrity` |
| `CARGO_TARGET_DIR` | `src-tauri/target/direct` | `src-tauri/target/appstore` (`.pkg`: `…/appstore-pkg`) | `scripts/build.sh:64-76`; each build entry self-defaults to the same tree |
| Build command | `pnpm tauri:build:direct`, or `scripts/build.sh direct` (signed + notarised, via `release:build-only`) | `scripts/build.sh appstore` / `appstore-pkg` | `package.json` scripts; `scripts/build.sh:66-76` |
| Publish | `pnpm release:publish` → `gh release` on `bklim5/devtools-releases` | Transporter / App Store Connect upload of the `.pkg` | `scripts/build-and-publish.mjs:76`; `docs/appstore/SUBMISSION-RUNBOOK.md` |
| Verification command | `pnpm release:publish` internals (lipo, single fresh `.sig`, `spctl`, served-version curl) | `bash scripts/verify-appstore-bundle.sh [app] [--require-bundle]` | — |

`assert_*` names above refer to `scripts/verify-appstore-bundle.sh`; the invariant index at
the top of that file maps each one to what it asserts.

## Call-out 1 — the capability silent-drop trap (F7)

**A non-empty `app.security.capabilities` array REPLACES the `capabilities/` directory
glob.** Tauri's `get_capabilities()` (tauri-utils, ACL) reads `capabilities/*.json` **only
when that array is empty**. The moment an overlay sets a non-empty array, the active
capability set is built *exclusively* from those entries.

That is why **both** overlays begin with the bare string `"default"`
(`tauri.direct.conf.json:6`, `tauri.appstore.conf.json:6`). It is a
`CapabilityEntry::Reference` that re-pulls the globbed `capabilities/default.json` by
identifier. Delete it and the 12 baseline grants in `src-tauri/capabilities/default.json`
(`core:default`, the four `core:window` mutators, clipboard read/write, `store:default`,
the three `global-shortcut` permissions, `window-state:default`, and the host-scoped
`opener:allow-open-url`) are **silently dropped**: the app builds, signs, launches — and
then denies core IPC at runtime.

The same silence applies *inside* an inline capability: a malformed `identifier`, a
`windows` list that does not include `"main"`, or a permission name that does not attach,
drops the grant without a build error. This is why both inline capabilities mirror
`default.json`'s shape verbatim.

There is **no automated backstop for the direct channel here.** The only current gate is
the manual updater round-trip that `build-and-publish.mjs` prints at publish time — install
an older build, Check for Updates, verify + relaunch. Treat any change to either overlay as
requiring that round-trip. (The appstore channel has `verify-appstore-bundle.sh`; the direct
channel does not have an equivalent.)

Related, from project memory: JS `window.show()` / `setFocus()` / `unminimize()` are
rejected unless explicitly granted — `core:window:default` is read-only — which is exactly
this failure mode, and it was invisible to both the unit suite and WebDriver.

## Call-out 2 — `--no-default-features` is not optional

Cargo features are **additive**: you cannot subtract a dependency by adding one. A bare
`--features appstore` therefore keeps the default `direct` umbrella and links a **hybrid**
binary with `keyring`, the updater and autostart compiled in — a build that looks like a
store build, passes a casual string grep, and would be rejected (or worse, accepted) by
App Review.

Two protections now exist:

1. **`compile_error!`** at `src-tauri/src/lib.rs:11-17` rejects `direct + appstore`
   together, so the hybrid no longer compiles at all.
2. On the shipped path the flag goes **after `--`**:
   `tauri build -f appstore --target … --bundles app --config … -- --no-default-features`
   (`scripts/build-appstore-bundle.sh:127-131`). The Tauri CLI has no
   `--no-default-features` flag of its own — it is a **cargo** flag, and without the `--`
   the CLI errors with `unexpected argument '--no-default-features'`.

Historical note: Phase-26-era documentation that shows a bare
`cargo … --features appstore` no longer compiles, by design.

## Call-out 3 — where e2e actually runs

The real-WKWebView e2e gate runs on the **direct** overlay:

```
pnpm tauri:dev:e2e
  = VITE_CHANNEL=direct tauri dev --features webdriver --config src-tauri/tauri.direct.conf.json
```

So **appstore-only regressions are not covered by e2e.** The appstore channel's gate is
`scripts/verify-appstore-bundle.sh`, which asserts plugin absence, entitlements, the 13.0
floor at the artifact, the Keygen copy markers, the licenceUi and updater chunk absence, the
heavy-engine lazy-load requirement, dist↔binary freshness, and binary integrity — plus its
own `--selftest` / `--selftest-realbuild` proving those markers are load-bearing.

One more trap the verifier encodes: **Tauri 2 brotli-embeds `dist/` into the Rust binary**,
so `Contents/Resources/` holds only `icon.icns`. Grepping the `.app`'s Resources for
frontend strings passes *vacuously*. The content assertions therefore run against the
appstore build's `dist/`, bound to the signed binary by `assert_dist_freshness`.

---

**See also:** `docs/RELEASE.md` (the direct-channel release pipeline),
`docs/appstore/SUBMISSION-RUNBOOK.md` and the rest of `docs/appstore/` (the MAS path),
`docs/KEYS.md` (which trust anchor each channel depends on),
`scripts/verify-appstore-bundle.sh` (the invariant index at the top of the file).
