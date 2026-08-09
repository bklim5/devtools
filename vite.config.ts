/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
// @ts-expect-error .mjs guard module has no type declarations (nodejs ESM)
import { licenseUiFoldInGuard } from "./scripts/licenseUiFoldInGuard.mjs";
// @ts-expect-error .mjs guard module has no type declarations (nodejs ESM)
import { prettierChunkGuard } from "./scripts/prettierChunkGuard.mjs";
// @ts-expect-error .mjs guard module has no type declarations (nodejs ESM)
import { reviewPromptFoldInGuard } from "./scripts/reviewPromptFoldInGuard.mjs";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// D-04: the appstore-ONLY fold-in guard. The DIRECT build adds no plugin (its
// plugins list is byte-unchanged), so this is gated on the same VITE_CHANNEL the
// store build's frontend uses (scripts/build-appstore-bundle.sh exports
// VITE_CHANNEL=appstore). The guard throws if the licenseUi module is folded into
// any shipped chunk and emits the licenseui-inventory.json sentinel the verifier
// reads. The fold-in module-ID regex lives ONLY in the shared guard module — it is
// never re-declared here.
// @ts-expect-error process is a nodejs global
const isAppstoreBuild = process.env.VITE_CHANNEL === "appstore";

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react(),
    tailwindcss(),
    // PRT-02 heavy-engine chunk-isolation guard — UNGATED (both channels ship
    // prettier + esbuild, so this is NOT inside the isAppstoreBuild branch). Fails
    // the build if a prettier/esbuild-wasm module becomes initially-reachable from
    // an entry chunk via static imports, and emits prettier-chunk-inventory.json.
    prettierChunkGuard(),
    // The two fold-in guards are MIRROR IMAGES and are therefore mutually
    // exclusive by channel: on the APPSTORE build licenseUiFoldInGuard keeps the
    // Keygen licence UI + the direct-only updater subtree out of the store
    // bundle; on the DIRECT build reviewPromptFoldInGuard (UP5-03) keeps
    // src/shell/reviewPrompt out of the direct bundle. Neither channel's plugin
    // list is "unchanged" any more — each carries exactly one fold-in guard.
    // What is DELIBERATELY not asserted (the shared useToolSuccess seam and the
    // request_app_store_review invoke literal in the shared tauri.ts) is
    // documented once, in scripts/reviewPromptFoldInGuard.mjs.
    ...(isAppstoreBuild ? [licenseUiFoldInGuard()] : [reviewPromptFoldInGuard()]),
  ],

  resolve: {
    // The ported lib uses `@/lib/...` and `@/tools/...`. This alias must also be
    // mirrored in tsconfig.json (tsc gate) — vitest reads this same config so the
    // alias resolves in app, build, AND test (FND-03 blocker).
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  // Vitest config. The ported decoder tests are pure (Uint8Array, no DOM) and
  // import describe/it/expect explicitly — so node environment + globals:false.
  // Skeleton component tests (Plan 02) opt into jsdom per-file via
  // `// @vitest-environment jsdom`.
  test: {
    environment: "node",
    globals: false,
    // Exclude the vendored `scaffold/` reference copy so the decoder spec has a
    // single source of truth in `src/` (scaffold/ is deleted later this phase).
    exclude: ["**/node_modules/**", "**/dist/**", "scaffold/**"],
  },
}));
