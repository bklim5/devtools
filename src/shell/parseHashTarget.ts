// parseHashTarget — extract a `#/tools/<id>` deep-link id from a hash string
// (D-14 data model). Pure string helper, kept out of the component module so
// StartupRedirect.tsx only exports a component (react-refresh constraint).
//
// The returned id is UNVALIDATED — resolveStartupTool runs it through
// getToolById before any navigation (threat T-02-07).

export function parseHashTarget(hash: string): string | undefined {
  // hash looks like "#/tools/base64" or "#/" or "" — match the tools segment,
  // stopping at the next path/query/fragment separator.
  const match = /^#\/tools\/([^/?#]+)/.exec(hash);
  return match ? decodeURIComponent(match[1]) : undefined;
}
