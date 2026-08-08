//  @ts-check

import { tanstackConfig } from "@tanstack/eslint-config";

export default [
  ...tanstackConfig,
  {
    rules: {
      "import/no-cycle": "off",
      "import/order": "off",
      "sort-imports": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/require-await": "off",
      "pnpm/json-enforce-catalog": "off",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-alert": "error",
      "no-debugger": "error",
      "prefer-const": "error",
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },
  {
    ignores: [
      "eslint.config.js",
      ".prettierrc",
      "src/routeTree.gen.ts",
      "dist/**",
      "data/**",
      "drizzle/meta/**",
    ],
  },
];
