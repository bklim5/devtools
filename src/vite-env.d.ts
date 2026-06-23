/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Build-variant channel, bound by the package.json build script.
   *  "appstore" → the sandboxed Mac App Store build; unset/"direct" → the
   *  Developer-ID DMG channel. Consumed by src/lib/platform/channel.ts. */
  readonly VITE_CHANNEL?: "appstore" | "direct";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
