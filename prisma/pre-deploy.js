require("dotenv/config");
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { syncDatabaseUrlEnv } = require("./database-url");

function findBundledSchemaEngine() {
  try {
    const enginesPackagePath = require.resolve("@prisma/engines/package.json");
    const enginesDir = path.dirname(enginesPackagePath);
    const engineFile = fs
      .readdirSync(enginesDir)
      .find((file) => /^schema-engine(?:-.+)?(?:\.exe)?$/i.test(file));

    if (!engineFile) {
      return null;
    }

    const enginePath = path.join(enginesDir, engineFile);
    return fs.existsSync(enginePath) ? enginePath : null;
  } catch {
    return null;
  }
}

function getPrismaEnv() {
  const env = { ...process.env };

  if (!env.PRISMA_SCHEMA_ENGINE_BINARY) {
    const bundledSchemaEngine = findBundledSchemaEngine();
    if (bundledSchemaEngine) {
      env.PRISMA_SCHEMA_ENGINE_BINARY = bundledSchemaEngine;
    }
  }

  return env;
}

function run(command) {
  execSync(command, { stdio: "inherit", env: getPrismaEnv() });
}

function readMigrateStatus() {
  try {
    return execSync("npx prisma migrate status", {
      encoding: "utf8",
      stdio: ["inherit", "pipe", "pipe"],
      env: getPrismaEnv(),
    });
  } catch (error) {
    const stdout = error.stdout?.toString() ?? "";
    const stderr = error.stderr?.toString() ?? "";
    return `${stdout}\n${stderr}`;
  }
}

function hasGeneratedPrismaClient() {
  return fs.existsSync(
    path.join(process.cwd(), "node_modules", ".prisma", "client", "index.js"),
  );
}

const databaseUrl = syncDatabaseUrlEnv();

if (!hasGeneratedPrismaClient()) {
  run("npx prisma generate");
}

if (!databaseUrl) {
  console.error(`
[CRM deploy] Database connection is missing.

Add this environment variable in your server or Vercel project:
  Project -> Settings -> Environment Variables

Required:
  DATABASE_URL          Your Postgres connection string

Recommended Vercel setup:
  1. Open your Vercel project
  2. Go to Storage -> Create Database -> Postgres
  3. Connect the database to this project
  4. Copy the generated connection string into DATABASE_URL
  5. Redeploy

Or use Neon / Supabase / Railway and paste the connection string into DATABASE_URL.
`);
  process.exit(1);
}

const failedMigration = "20260617000000_customer_phone2_city";
const status = readMigrateStatus();

if (status.includes(failedMigration) && status.toLowerCase().includes("failed")) {
  run(`npx prisma migrate resolve --rolled-back "${failedMigration}"`);
}

run("npx prisma migrate deploy");
