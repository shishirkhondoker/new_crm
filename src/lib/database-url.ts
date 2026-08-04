export function resolveDatabaseUrl() {
  return process.env.DATABASE_URL?.trim() ?? "";
}

export function syncDatabaseUrlEnv() {
  const resolved = resolveDatabaseUrl();
  return resolved;
}
