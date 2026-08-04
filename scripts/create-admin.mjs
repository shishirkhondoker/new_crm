import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { syncDatabaseUrlEnv } from "../prisma/database-url.js";

const ADMIN_EMAIL = (process.env.CRM_ADMIN_EMAIL || "admin@crm.com").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.CRM_ADMIN_PASSWORD || "Crm@admin1234";
const ADMIN_MOBILE = (process.env.CRM_ADMIN_MOBILE || "01700000001").trim();

const connectionString = syncDatabaseUrlEnv();
if (!connectionString) {
  throw new Error("DATABASE_URL is required to create the CRM admin.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const existing =
    (await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })) ||
    (await prisma.user.findUnique({ where: { mobile: ADMIN_MOBILE } })) ||
    (await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } }));

  const adminPayload = {
    name: "CRM Admin",
    email: ADMIN_EMAIL,
    mobile: ADMIN_MOBILE,
    role: "ADMIN",
    status: "ACTIVE",
    designation: "Administrator",
    firstLogin: false,
    passwordNotSet: false,
    authSetupToken: null,
    authSetupPurpose: null,
    authSetupExpiresAt: null,
    lastLoginAt: null,
  };

  const admin = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: adminPayload,
      })
    : await prisma.user.create({
        data: adminPayload,
      });

  const activeAdminCount = await prisma.user.count({
    where: {
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  console.log(`Admin ready: ${admin.email} / ${ADMIN_PASSWORD}`);
  console.log(`Admin mobile: ${admin.mobile}`);
  if (activeAdminCount > 1) {
    console.warn(`Warning: ${activeAdminCount} active admin accounts exist. This script did not create duplicates, but you should review the extras.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
