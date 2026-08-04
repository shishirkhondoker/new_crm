import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const nextDevDir = path.join(projectRoot, ".next", "dev");

if (existsSync(nextDevDir)) {
  rmSync(nextDevDir, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 150,
  });
}
