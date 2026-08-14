import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const codeLineBudget = Object.freeze({
  perFile: 300,
  perFunction: 80,
});
const countOnlyCodeLines = Object.freeze({
  skipBlankLines: true,
  skipComments: true,
});

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      "max-lines": [
        "error",
        { max: codeLineBudget.perFile, ...countOnlyCodeLines },
      ],
      "max-lines-per-function": [
        "error",
        {
          max: codeLineBudget.perFunction,
          ...countOnlyCodeLines,
          IIFEs: true,
        },
      ],
    },
  },
  {
    files: ["**/*.{test,spec}.{ts,tsx,mts}", "tests/**"],
    rules: {
      "max-lines-per-function": "off",
    },
  },
  {
    files: ["**/database.types.ts", "**/*.gen.ts", "scripts/**"],
    rules: {
      "max-lines": "off",
      "max-lines-per-function": "off",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/domain/**/*"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/scripts/**", "scripts/**"],
              message:
                "Application code cannot import local administrator scripts.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/domain/**/*.ts", "src/domain/**/*.tsx"],
    rules: {
      "@typescript-eslint/triple-slash-reference": [
        "error",
        { lib: "never", path: "never", types: "never" },
      ],
      "no-restricted-globals": [
        "error",
        "window",
        "document",
        "navigator",
        "location",
        "history",
        "localStorage",
        "sessionStorage",
        "indexedDB",
        "fetch",
        "WebSocket",
        "EventSource",
        "BroadcastChannel",
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              message: "Domain rules must remain independent of React.",
            },
            {
              name: "react-dom",
              message: "Domain rules must remain independent of React.",
            },
            {
              name: "next",
              message: "Domain rules must remain independent of Next.js.",
            },
          ],
          patterns: [
            {
              group: ["react/*", "react-dom/*", "next/*", "@supabase/*"],
              message:
                "Domain rules must remain independent of UI and persistence libraries.",
            },
            {
              regex: "^@/(?!domain(?:/|$))",
              message:
                "Domain rules may use the @/ alias only for @/domain modules.",
            },
            {
              regex: "(?:^|/)\\.\\.(?:/|$)",
              message:
                "Domain rules cannot use parent path segments; use @/domain for cross-directory imports.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportExpression",
          message: "Domain rules cannot use dynamic imports.",
        },
        {
          selector: "TSImportType",
          message:
            "Domain rules cannot use import type expressions; use a static import type declaration.",
        },
      ],
    },
  },
  globalIgnores([
    // Agent worktrees nest inside the repo but are their own checkouts.
    ".claude/worktrees/**",
    "**/.next/**",
    "**/.next-verify/**",
    "coverage/**",
    "next-env.d.ts",
    "playwright-report/**",
    "supabase/.branches/**",
    "supabase/.temp/**",
    "test-results/**",
  ]),
]);
