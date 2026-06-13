// ESLint 10 flat config (D-09). Minimal recommended TS + React baseline.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default tseslint.config(
  {
    // Don't lint build output, deps, vendored scaffold reference, or Rust target.
    ignores: ["dist", "node_modules", "src-tauri/target", "scaffold"],
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
);
