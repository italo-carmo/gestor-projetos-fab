/**
 * scripts/generate-client.ts
 * Gera types TS a partir do OpenAPI.
 *
 * Requer: npm i -D openapi-typescript
 *
 * Uso:
 *  - node scripts/generate-client.ts core   # OPENAPI_TASKS_EXPANDED.yaml
 *  - node scripts/generate-client.ts full   # OPENAPI_FULL.yaml
 */
import { execSync } from "node:child_process";
import path from "node:path";

const target = process.argv[2] ?? "core";
const spec = target === "full"
  ? path.join("docs","OPENAPI_FULL.yaml")
  : path.join("docs","OPENAPI_TASKS_EXPANDED.yaml");

const out = path.join("frontend","src","api","generated","schema.d.ts");

execSync(`npx openapi-typescript "${spec}" -o "${out}"`, { stdio: "inherit" });
console.log("Gerado:", out, "a partir de", spec);
