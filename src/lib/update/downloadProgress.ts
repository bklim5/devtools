// Pure reducer for the Tauri updater's download events (DST-02). The plugin
// emits `Started{contentLength}` → a series of `Progress{chunkLength}` →
// `Finished`, where `chunkLength` is the byte size of THAT chunk — NOT a
// percent. Forwarding `chunkLength` straight to the UI showed "8000%" during a
// real download; the percent must be (accumulated bytes / total) * 100.
//
// Lives here (zero I/O, fully unit-tested) so the @tauri-apps seam in
// platform/tauri.ts stays a thin forwarder that can't be unit-tested.

export type DownloadProgressEvent =
  | { event: "Started"; data: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished"; data?: unknown };

export interface DownloadProgressState {
  /** Total payload size from `Started` (0 when the server omitted it). */
  contentLength: number;
  /** Bytes accumulated across `Progress` events so far. */
  downloaded: number;
}

export const initialDownloadProgress: DownloadProgressState = {
  contentLength: 0,
  downloaded: 0,
};

/**
 * Fold one updater event into the next state plus an optional 0-100 percent to
 * surface. `pct` is `undefined` when the total size is unknown (the UI then
 * shows a label without a bogus number) and is always clamped to ≤ 100.
 */
export function reduceDownloadProgress(
  state: DownloadProgressState,
  event: DownloadProgressEvent,
): { state: DownloadProgressState; pct: number | undefined } {
  switch (event.event) {
    case "Started":
      return {
        state: { contentLength: event.data.contentLength ?? 0, downloaded: 0 },
        pct: undefined,
      };
    case "Progress": {
      const downloaded = state.downloaded + event.data.chunkLength;
      const next: DownloadProgressState = { ...state, downloaded };
      if (state.contentLength <= 0) return { state: next, pct: undefined };
      return {
        state: next,
        pct: Math.min(100, (downloaded / state.contentLength) * 100),
      };
    }
    case "Finished":
      return { state, pct: state.contentLength > 0 ? 100 : undefined };
    default:
      return { state, pct: undefined };
  }
}
