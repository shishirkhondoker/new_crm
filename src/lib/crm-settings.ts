import "server-only";

import { getPrisma } from "@/lib/prisma";

const DEFAULT_COMPANY_SETTINGS = {
  company: "Mugnee Solutions",
  email: "info@mugnee.com",
  phone: "01712345678",
  address: "House #12, Road #5, Dhanmondi, Dhaka-1205",
} as const;

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseSettingObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }

  return value as Record<string, unknown>;
}

export async function getCrmSettings() {
  const prisma = getPrisma();
  const settings = await prisma.systemSetting.findMany({
    where: {
      key: {
        in: ["company.profile"],
      },
    },
  });

  const companyProfile = parseSettingObject(settings.find((item) => item.key === "company.profile")?.value);

  const company = cleanString(companyProfile.company) || DEFAULT_COMPANY_SETTINGS.company;
  const email = cleanString(companyProfile.email) || DEFAULT_COMPANY_SETTINGS.email;
  const phone = cleanString(companyProfile.phone) || DEFAULT_COMPANY_SETTINGS.phone;
  const address = cleanString(companyProfile.address) || DEFAULT_COMPANY_SETTINGS.address;

  return {
    company,
    email,
    phone,
    address,
  };
}
