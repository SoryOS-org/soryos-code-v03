import { defineConfig } from "vitest/config";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const packagesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const alias = Object.fromEntries(
  readdirSync(packagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => [`@soryos/${d.name}`, path.join(packagesDir, d.name, "src")])
);

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
  },
  resolve: { alias },
});
