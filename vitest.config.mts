import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Tests unitaires ciblés (CLAUDE.md §3) : scoring de matching et référentiel des
// métiers. Le parser de structuration (lib/services/llm.ts) n'a pas encore de test.
// Pas de suite exhaustive.
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
