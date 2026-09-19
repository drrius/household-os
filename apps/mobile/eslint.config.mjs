import effectPlugin from "@effect/eslint-plugin";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["node_modules/**", "dist/**", ".expo/**"],
  },
  tseslint.configs.base,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "@effect": effectPlugin,
    },
    rules: {
      "@effect/no-import-from-barrel-package": "error",
    },
  },
);
