// ESLint 10 flat config (D-09). Minimal recommended TS + React baseline.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

// ---------------------------------------------------------------------------
// F5 (architecture-review 2026-07-06): the two most load-bearing prose
// invariants in CLAUDE.md — "tools import src/lib/platform/, never @tauri-apps/*
// directly" and "HashRouter only" — made mechanical. lefthook already runs
// `pnpm lint` pre-commit, so a violation now FAILS the commit instead of relying
// on agent discipline plus review.
//
// `no-restricted-imports` alone is a POROUS gate: it only sees static import /
// export-from declarations. Three bypasses walk straight through it — a dynamic
// `import("@tauri-apps/…")`, a `require("@tauri-apps/…")`, and reaching a router
// through a namespace (`import * as RR …; RR.BrowserRouter`) or a re-export — so
// each is additionally covered by a `no-restricted-syntax` selector below.
// ---------------------------------------------------------------------------

const ROUTER_MESSAGE =
  "HashRouter only — CLAUDE.md. BrowserRouter/createBrowserRouter/createBrowserHistory 404 on reload from static files. Use createHashRouter (src/router.tsx), or MemoryRouter in tests.";

// ONE OWNER PER BYPASS CLASS.
//
// Acquisition by static import / export-from is owned ENTIRELY by
// no-restricted-imports (below): it sees the module AND the imported names, and
// it already covers ImportSpecifier, ImportDefaultSpecifier and
// `export … from`. Shared by both config blocks so the two cannot drift apart.
//
// One overlap is unavoidable and is NOT a duplicate: `import * as RR from
// "react-router-dom"` is reported by no-restricted-imports (ESLint cannot prove
// a namespace will not reach a restricted name), and `RR.BrowserRouter` is
// separately reported by the MemberExpression selector. Two different nodes,
// two different facts — acquisition and use.
const ROUTER_IMPORT_NAMES = [
  "BrowserRouter",
  "createBrowserRouter",
  "createBrowserHistory",
];
const ROUTER_IMPORT_PATHS = [
  { name: "react-router-dom", importNames: ROUTER_IMPORT_NAMES, message: ROUTER_MESSAGE },
  { name: "react-router", importNames: ROUTER_IMPORT_NAMES, message: ROUTER_MESSAGE },
  { name: "history", importNames: ["createBrowserHistory"], message: ROUTER_MESSAGE },
];

// no-restricted-syntax owns only what no-restricted-imports CANNOT see: the
// value being reached at RUNTIME.
//
// These are deliberately NOT a bare `Identifier[name=/…/]`. That selector fired
// on any occurrence of the name anywhere in the AST — a local `const
// BrowserRouter = …`, a function parameter, an object KEY in a `vi.mock`
// factory — none of which route anything. It also triple-reported a single
// `import { BrowserRouter }` line (ImportSpecifier.imported +
// ImportSpecifier.local, plus no-restricted-imports). Scoped to real usage:
//   • MemberExpression  — namespace access (`RR.BrowserRouter`) and re-exports,
//     dotted and computed;
//   • JSXIdentifier     — `<BrowserRouter>`, a distinct node type;
//   • CallExpression    — a bare factory call from a value obtained any other
//     way (dynamic-import destructure, require destructure, a global).
const ROUTER_SELECTORS = [
  {
    selector:
      "MemberExpression[property.name=/^(BrowserRouter|createBrowserRouter|createBrowserHistory)$/]",
    message: ROUTER_MESSAGE,
  },
  {
    selector:
      "MemberExpression[computed=true] > Literal[value=/^(BrowserRouter|createBrowserRouter|createBrowserHistory)$/]",
    message: ROUTER_MESSAGE,
  },
  { selector: "JSXIdentifier[name='BrowserRouter']", message: ROUTER_MESSAGE },
  {
    selector:
      "CallExpression[callee.name=/^(createBrowserRouter|createBrowserHistory)$/]",
    message: ROUTER_MESSAGE,
  },
];

// These target ImportExpression / require CALL nodes only — never arbitrary
// strings — so `vi.doMock("@tauri-apps/…")` in src/lib/platform/tauri.test.ts
// stays legal exactly as today.
const TAURI_SELECTORS = [
  {
    selector: "ImportExpression[source.value=/^@tauri-apps\\//]",
    message:
      "Reach Tauri through the platform seam (src/lib/platform/) — a dynamic import() is not an exemption.",
  },
  {
    selector: "CallExpression[callee.name='require'] > Literal[value=/^@tauri-apps\\//]",
    message:
      "Reach Tauri through the platform seam (src/lib/platform/) — require() is not an exemption.",
  },
];

export default tseslint.config(
  {
    // Don't lint build output, deps, vendored scaffold reference, Rust target, or
    // the DELIBERATELY-messy Prettier golden fixtures (unformatted test data whose
    // whole point is to trip unused-vars/undef — the parity test, not eslint, owns them).
    ignores: [
      "dist",
      "node_modules",
      "src-tauri/target",
      "scaffold",
      "test/fixtures",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    // The webhook backend (D-56) is Node, not browser — `process`/`Buffer`/
    // `crypto`/`console` are Node globals. This block MERGES node globals onto
    // server files (it comes AFTER the browser block, so node globals are added)
    // and drops the React-refresh constraint, which is meaningless server-side.
    files: ["server/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    // F5 — the general rule: nobody imports @tauri-apps/* or BrowserRouter.
    // Uses the BASE no-restricted-imports (not the typescript-eslint variant)
    // because the base rule flags `import type` declarations too, which is the
    // stricter and desired behaviour.
    files: ["**/*.{ts,tsx,mts,cts,js,mjs,cjs}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              // Both globs are needed: @tauri-apps/* matches "@tauri-apps/api",
              // @tauri-apps/*/** matches "@tauri-apps/api/window".
              group: ["@tauri-apps/*", "@tauri-apps/*/**"],
              message:
                "Reach Tauri through the platform seam (src/lib/platform/), never @tauri-apps/* directly — CLAUDE.md. src/lib/platform/tauri.ts is the ONLY legal importer; add the capability to the seam interface instead.",
            },
          ],
          paths: ROUTER_IMPORT_PATHS,
        },
      ],
      "no-restricted-syntax": ["error", ...TAURI_SELECTORS, ...ROUTER_SELECTORS],
    },
  },
  {
    // The seam IS the legal @tauri-apps importer — and the only one. The rules
    // are RE-DECLARED (not switched off) so the router restrictions still apply
    // inside the seam.
    files: ["src/lib/platform/**"],
    rules: {
      "no-restricted-imports": ["error", { paths: ROUTER_IMPORT_PATHS }],
      "no-restricted-syntax": ["error", ...ROUTER_SELECTORS],
    },
  },
);
