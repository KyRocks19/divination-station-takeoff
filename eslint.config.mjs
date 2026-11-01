// ESLint for this app (added 2026-10-30): the Next.js rules for React, hooks and Core Web Vitals, and the TypeScript rules. Formatting (quotes,
// spaces, line breaks) is Prettier's job (.prettierrc.json), so eslint-config-prettier turns off every rule that would argue with it.
// Run `npm run lint` for the whole app, or let the editor fix a file each time it is saved (.vscode/settings.json).
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      // Much older code reads database rows as `any`; a warning, not an error, until it is typed.
      "@typescript-eslint/no-explicit-any": "warn",
      // These come from the React Compiler, which this app does not use. Setting state in an effect is how a page here waits for the browser
      // (the time, the locale, storage) without a first draw that depends on it (before-you-code, section 4), so it is allowed.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      // `_name` marks something kept on purpose but not used.
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "next-env.d.ts",
    "public/**",
    "test-results/**",
    "playwright-report/**",
    "EncyclopediaArcana/**",
    "koboldcpp-linux-x64-nocuda/**",
  ]),
]);
