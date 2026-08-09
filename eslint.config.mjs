import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
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
    "**/.next/**",
    "coverage/**",
    "next-env.d.ts",
    "playwright-report/**",
    "supabase/.branches/**",
    "supabase/.temp/**",
    "test-results/**",
  ]),
]);
