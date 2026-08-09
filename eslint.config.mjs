import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    files: ["src/domain/**/*.ts"],
    rules: {
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
              regex: "^(?:@/(?:app|lib)(?:/|$)|(?:\\.\\./)+(?:app|lib)(?:/|$))",
              message:
                "Domain rules cannot import application or integration modules.",
            },
          ],
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
