// In-house, zero-dependency fuzzy ranker for the ⌘K command palette (D-06, SHL-02).
//
// No `cmdk`, no `fuse.js` — a small subsequence ranker is ample for six tools and
// fits the offline / no-runtime-dependency ethos. Pure module: it imports only the
// `ToolDefinition` *type* (no React, no platform/store, no @tauri-apps). The query is
// scanned char-by-char as a subsequence — never compiled into a RegExp — so untrusted
// palette input cannot alter control flow (threat T-02-05).
import type { ToolDefinition } from "@/lib/tools/types";

// Field weights: a match in `name` outscores the same match in `keywords`, which
// outscores `description` (the ORDERING contract the tests assert; the magnitudes
// are Claude's discretion per D-06). The gaps are wide enough that no quantity of
// description-match bonus can overtake a name match.
const FIELD_WEIGHT = { name: 1000, keywords: 100, description: 10 } as const;

/**
 * Score `needle` as a case-insensitive subsequence of `haystack` (both assumed
 * already lower-cased by the caller). Returns a non-negative number, or `null`
 * when `needle` is not a subsequence at all.
 *
 * Rewards, highest-impact first:
 *  - matching all needle chars (required — else `null`),
 *  - contiguous runs of matched chars (a run bonus that grows with run length),
 *  - matches that begin at the field start / a word boundary,
 *  - earlier overall match position.
 */
export function subsequenceScore(needle: string, haystack: string): number | null {
  if (needle === "") return FIELD_WEIGHT.name; // empty needle trivially matches
  let score = 0;
  let run = 0; // length of the current contiguous matched run
  let hIdx = 0;
  let firstMatchAt = -1;

  for (let nIdx = 0; nIdx < needle.length; nIdx++) {
    const ch = needle[nIdx];
    const found = haystack.indexOf(ch, hIdx);
    if (found === -1) return null; // a needle char is missing → not a subsequence

    if (firstMatchAt === -1) firstMatchAt = found;

    if (found === hIdx) {
      // Contiguous with the previous matched char: reward longer runs more.
      run += 1;
      score += 10 + run * 5;
    } else {
      run = 1;
      score += 5;
    }

    // Word-boundary / field-start bonus for this matched char.
    const prev = found > 0 ? haystack[found - 1] : " ";
    if (found === 0 || prev === " " || prev === "-" || prev === "_" || prev === "/") {
      score += 15;
    }

    hIdx = found + 1;
  }

  // Earlier matches rank higher (small, never enough to flip a contiguity win).
  score += Math.max(0, 20 - firstMatchAt);
  return score;
}

/**
 * Rank `tools` against `query`, best-first.
 *
 * - Empty / whitespace query → returns `tools` unchanged (the caller layers
 *   recents / registry order on top — D-05).
 * - Otherwise, each tool is scored as the best (field-weighted) subsequence match
 *   over its name, keywords, and description; tools with no subsequence match in
 *   any field are excluded (an unknown query → `[]`, powering the palette's quiet
 *   "No tools match" state — D-07).
 * - Sorted by descending score; ties keep input (registry) order (stable).
 */
export function rankTools(query: string, tools: ToolDefinition[]): ToolDefinition[] {
  const q = query.trim().toLowerCase();
  if (q === "") return tools;

  const scored: { tool: ToolDefinition; score: number; idx: number }[] = [];

  tools.forEach((tool, idx) => {
    const name = subsequenceScore(q, tool.name.toLowerCase());
    const keywords = tool.keywords.reduce<number | null>((best, kw) => {
      const s = subsequenceScore(q, kw.toLowerCase());
      if (s === null) return best;
      return best === null ? s : Math.max(best, s);
    }, null);
    const description = subsequenceScore(q, tool.description.toLowerCase());

    let score: number | null = null;
    if (name !== null) score = Math.max(score ?? 0, name + FIELD_WEIGHT.name);
    if (keywords !== null) score = Math.max(score ?? 0, keywords + FIELD_WEIGHT.keywords);
    if (description !== null) score = Math.max(score ?? 0, description + FIELD_WEIGHT.description);

    if (score !== null) scored.push({ tool, score, idx });
  });

  // Descending score; stable tie-break by original index.
  scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
  return scored.map((s) => s.tool);
}
