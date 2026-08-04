function resolveDatabaseUrl() {
  return process.env.DATABASE_URL?.trim() ?? "";
}

function syncDatabaseUrlEnv() {
  const resolved = resolveDatabaseUrl();
  return resolved;
}

module.exports = {
  resolveDatabaseUrl,
  syncDatabaseUrlEnv,
};
