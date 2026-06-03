# Appendix — lint & format config (specification)

The enforcement teeth for `modularity.md`. Specification only.

---

## `eslint.config.js` (flat config)

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    plugins: { import: importPlugin },
    languageOptions: { parserOptions: { project: true } },
    rules: {
      // --- file-size discipline (HARD requirement) ---
      "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["warn", { max: 80, skipBlankLines: true, skipComments: true }],
      "complexity": ["warn", 12],

      // --- layer boundaries ---
      "no-restricted-imports": ["error", { patterns: [
        // web must never import the api package
        { group: ["@macronome/api", "@macronome/api/*"], message: "web is an API client; call /api instead." },
        // domain must stay pure (no I/O layers)
        // (enforced per-folder via overrides below)
      ]}],
    },
  },

  // domain purity: no Prisma / http / data imports inside domain
  {
    files: ["packages/api/src/domain/**/*.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [
      { group: ["**/data/**", "**/http/**", "@prisma/client"],
        message: "domain/* is pure: take inputs, return outputs. No I/O." },
    ]}]},
  },

  // controllers stay thin: no direct Prisma
  {
    files: ["packages/api/src/http/controllers/**/*.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [
      { group: ["@prisma/client", "**/data/prisma*"],
        message: "controllers call services, not Prisma." },
    ]}]},
  },

  // exemptions from the size rule
  {
    files: [
      "**/prisma/migrations/**",
      "**/i18n/locales/*.json",
      "**/styles/tokens.css",
      "**/*.generated.*",
    ],
    rules: { "max-lines": "off" },
  },
);
```

(`schema.prisma`, generated client, and lockfiles are not linted by ESLint anyway.)

---

## `.prettierrc`

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

---

## Pre-commit (lint-staged + husky)

`package.json` (root) `lint-staged`:

```jsonc
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --max-warnings=0", "prettier --write"],
    "*.{json,css,md}": ["prettier --write"]
  }
}
```

The husky `pre-commit` hook runs `lint-staged` then `tsc -b --noEmit`. An oversized
file (>300 lines) or a boundary violation fails the commit, so the discipline is
enforced at write time, not review time.
