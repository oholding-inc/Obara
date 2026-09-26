import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Conventions CLAUDE.md §7 : pas de `any`, pas de console.log (utiliser lib/log.ts).
    rules: {
      "no-console": "error",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    // Le logger est le seul endroit autorisé à écrire sur la console.
    files: ["lib/log.ts"],
    rules: { "no-console": "off" },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "drizzle/**",
    ],
  },
];

export default eslintConfig;
