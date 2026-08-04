import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "@/lib/database-url";

const PRISMA_CLIENT_SCHEMA_VERSION = "2026-07-07-supervisor-assignments";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaVersion?: string;
};

export function getPrisma() {
  const shouldRefreshClient =
    !globalForPrisma.prisma ||
    globalForPrisma.prismaSchemaVersion !== PRISMA_CLIENT_SCHEMA_VERSION;

  if (shouldRefreshClient) {
    if (globalForPrisma.prisma) {
      void globalForPrisma.prisma.$disconnect().catch(() => undefined);
    }

    const connectionString = resolveDatabaseUrl();

    if (!connectionString) {
      throw new Error(
        "Database connection is not configured. Set DATABASE_URL before starting the app.",
      );
    }

    const adapter = new PrismaPg({ connectionString });
    globalForPrisma.prisma = new PrismaClient({ adapter });
    globalForPrisma.prismaSchemaVersion = PRISMA_CLIENT_SCHEMA_VERSION;
  }

  if (!globalForPrisma.prisma) {
    throw new Error("Failed to initialize Prisma client.");
  }

  return globalForPrisma.prisma;
}
