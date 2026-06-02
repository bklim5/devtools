# Deferred Items — Phase 01 (out-of-scope discoveries, NOT fixed here)

Logged per the executor scope boundary: only issues directly caused by a plan's own
task changes are auto-fixed. The items below are pre-existing or out-of-plan-scope.

## From Plan 01-03

- **`tauri.conf.json` `productName` is `devtools-app`** (so the bundle is
  `devtools-app.app` / `devtools-app_0.1.0_aarch64.dmg`), while the user-facing window
  title is `DevTools`. Purely cosmetic; a later phase may align `productName` to
  `DevTools` for a nicer Finder name. Out of Plan 01-03's lefthook-only/docs-only
  scope. (Note: an earlier draft wrongly claimed a `bundle.icon` nesting bug — there
  is none; the icon key is correctly nested and bundled fine.)

- **`dist/` and `node_modules/` are untracked but NOT gitignored.** Pre-existing from
  Plan 01/02 (the `.gitignore` only lists `.DS_Store`, `.agents/`, `skills-lock.json`).
  These build/dependency dirs should be gitignored, but `.gitignore` is outside Plan
  01-03's scope (lefthook.yml + docs only). Left untouched (never staged). Suggest a
  follow-up to add `dist/`, `node_modules/`, and `src-tauri/target/` to `.gitignore`.
  (`src-tauri/target/` now exists after the first `tauri build` and is also untracked.)

- **`.claude/` is untracked but NOT gitignored.** Sibling tooling artifact; same
  rationale as above — out of this plan's scope, left untouched.
