/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { syncDatabaseUrlEnv } = require("./database-url");

if (process.env.CRM_ENABLE_DEMO_SEED !== "true") {
  console.log("Demo seeding is disabled by default. Use `npm run prisma:seed:demo` only in non-production environments.");
  process.exit(0);
}

const connectionString = syncDatabaseUrlEnv();
if (!connectionString) {
  throw new Error("DATABASE_URL is required for seeding.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const roles = {
  admin: { name: "Admin User", email: "admin@crm.com", mobile: "01700000001", role: "ADMIN", designation: "System Admin" },
  supervisor: { name: "Sadia Akter", email: "sadia@mugnee.com", mobile: "01700000002", role: "SUPERVISOR", designation: "Sales Supervisor" },
  marketers: [
    ["John Doe", "01700000003", "Senior Marketer"],
    ["Tawhid Hasan", "01700000004", "Field Marketer"],
    ["Fahim Ahmed", "01700000005", "Account Executive"],
    ["Michal Rahman", "01700000006", "Sales Associate"],
    ["Tanvir Hossain", "01700000007", "Growth Marketer"],
  ],
};

const productCatalog = [
  ["LED Display", "Display", "Mugnee", 25000],
  ["PA System", "Audio", "Mugnee", 18000],
  ["Interactive Flat Panel", "Education", "ViewBoard", 85000],
  ["Walkie Talkie", "Communication", "Motorola", 4500],
  ["Software Service", "IT Services", "Mugnee", 32000],
  ["CCTV Package", "Security", "Hikvision", 42000],
];

const industries = ["Education", "Trading", "Electronics", "IT Services", "Healthcare", "Retail"];
const companyNames = [
  "ABC Corporation", "XYZ Limited", "Metro Electronics", "Delta Solutions", "Omega Traders",
  "Prime Academy", "Eastern Tech", "Smart Retail", "Green Hospital", "North Bridge",
  "Blue Ocean Ltd", "Future School", "Sunrise Mart", "City Electronics", "Digital Hub",
  "Vertex Systems", "Pioneer Pharma", "Summit Traders", "Capital College", "Orbit Telecom",
];

const leadStatuses = [
  "NEW_LEAD", "CONTACTED", "INTERESTED", "FOLLOW_UP_REQUIRED", "QUOTATION_SENT",
  "NEGOTIATION", "WON_SALE", "LOST_SALE", "ON_HOLD",
];
const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const taskStatuses = ["TODO", "IN_PROGRESS", "PENDING", "COMPLETED", "OVERDUE"];
const quotationStatuses = ["DRAFT", "SENT", "REVISED", "APPROVED", "REJECTED", "CONVERTED_TO_SALE"];

function day(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date;
}

async function main() {
  await prisma.systemSetting.deleteMany();
  await prisma.activityTimeline.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.importExportLog.deleteMany();
  await prisma.reportLog.deleteMany();
  await prisma.performanceMetric.deleteMany();
  await prisma.rewardExecutionLog.deleteMany();
  await prisma.rewardHistory.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.leadStatusHistory.deleteMany();
  await prisma.userPermission.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.reportExport.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.target.deleteMany();
  await prisma.rewardRule.deleteMany();
  await prisma.reward.deleteMany();
  await prisma.quotationItem.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.productInterest.deleteMany();
  await prisma.communicationLog.deleteMany();
  await prisma.followUp.deleteMany();
  await prisma.todayPlan.deleteMany();
  await prisma.task.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.productService.deleteMany();
  await prisma.phoneNumber.deleteMany();
  await prisma.contactPerson.deleteMany();
  await prisma.customerCompany.deleteMany();
  await prisma.oTP.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({ data: { ...roles.admin, firstLogin: false, passwordNotSet: false } });
  const supervisor = await prisma.user.create({ data: { ...roles.supervisor, firstLogin: true, passwordNotSet: true } });
  const marketers = [];

  for (const [index, marketer] of roles.marketers.entries()) {
    marketers.push(await prisma.user.create({
      data: {
        name: marketer[0],
        mobile: marketer[1],
        email: `${marketer[0].toLowerCase().replace(/\s+/g, ".")}@mugnee.com`,
        role: "MARKETER",
        firstLogin: true,
        passwordNotSet: true,
        designation: marketer[2],
        supervisorId: supervisor.id,
        avatar: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(marketer[0])}`,
        createdAt: day(-index),
      },
    }));
  }

  if (marketers.length) {
    await prisma.userSupervisorAssignment.createMany({
      data: marketers.map((marketer) => ({ supervisorId: supervisor.id, marketerId: marketer.id })),
      skipDuplicates: true,
    });
  }

  const products = [];
  for (const item of productCatalog) {
    products.push(await prisma.productService.create({
      data: {
        name: item[0],
        category: item[1],
        brand: item[2],
        price: item[3],
        imageUrl: `/products/${item[0].toLowerCase().replace(/\s+/g, "-")}.jpg`,
        description: `${item[0]} package for sales-ready B2B customers.`,
        specification: "Warranty, installation support, training, and after-sales maintenance included.",
      },
    }));
  }

  const companies = [];
  for (let i = 0; i < companyNames.length; i += 1) {
    const company = await prisma.customerCompany.create({
      data: {
        name: companyNames[i],
        industry: industries[i % industries.length],
        address: `House ${12 + i}, Road ${3 + i}, Dhanmondi, Dhaka-120${i % 10}`,
        website: `www.${companyNames[i].toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
        notes: "Imported starter customer profile with active sales opportunity.",
        assignedToId: marketers[i % marketers.length].id,
        contacts: {
          create: {
            name: ["Mr. Rahim", "Mr. Karim", "Mr. Hasan", "Ms. Jahan"][i % 4],
            designation: ["Manager", "Owner", "Procurement Lead", "Principal"][i % 4],
            email: `contact${i + 1}@example.com`,
            mobile: `01712${String(345000 + i).padStart(6, "0")}`,
            whatsapp: `01712${String(345000 + i).padStart(6, "0")}`,
            isPrimary: true,
          },
        },
        phoneNumbers: {
          create: [
            { label: "Office", number: `02${String(910000 + i).padStart(7, "0")}` },
            { label: "WhatsApp", number: `01819${String(670000 + i).padStart(6, "0")}`, whatsapp: true },
          ],
        },
      },
    });
    companies.push(company);
  }

  const leads = [];
  for (let i = 0; i < 50; i += 1) {
    const company = companies[i % companies.length];
    const product = products[i % products.length];
    const assigned = marketers[i % marketers.length];
    leads.push(await prisma.lead.create({
      data: {
        title: `${company.name} - ${product.name}`,
        companyId: company.id,
        customerName: company.name,
        phone: `01799${String(430000 + i).padStart(6, "0")}`,
        email: `lead${i + 1}@${company.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
        productInterestId: product.id,
        status: leadStatuses[i % leadStatuses.length],
        score: 45 + (i % 50),
        priority: priorities[i % priorities.length],
        purchaseProbability: 20 + ((i * 7) % 75),
        assignedToId: assigned.id,
        createdById: i % 3 === 0 ? supervisor.id : admin.id,
        followUpDate: day((i % 12) - 4),
        notes: "Qualified through field visit and needs regular communication.",
        createdAt: day(-i),
      },
    }));
  }

  for (let i = 0; i < 40; i += 1) {
    await prisma.task.create({
      data: {
        title: ["Call customer", "Prepare quotation", "Visit client office", "Send catalog", "Follow up decision"][i % 5],
        description: "Keep customer progress moving through the CRM pipeline.",
        status: taskStatuses[i % taskStatuses.length],
        priority: priorities[(i + 1) % priorities.length],
        dueDate: day((i % 10) - 2),
        taskTime: day((i % 10) - 2),
        reminder: ["15 Minutes Before", "1 Hour Before", "1 Day Before"][i % 3],
        notes: "Seed task note for daily sales execution.",
        assignedById: i % 2 === 0 ? supervisor.id : admin.id,
        assignedToId: marketers[i % marketers.length].id,
        leadId: leads[i % leads.length].id,
        companyId: companies[i % companies.length].id,
        productId: products[i % products.length].id,
      },
    });
  }

  for (let i = 0; i < 25; i += 1) {
    await prisma.todayPlan.create({
      data: {
        userId: marketers[i % marketers.length].id,
        title: ["Call ABC Corporation", "Follow-up with XYZ Limited", "Visit Metro Electronics", "Prepare quotation"][i % 4],
        plannedAt: day(i % 3 === 0 ? -1 : 0),
        priority: priorities[i % priorities.length],
        note: "Daily plan generated from seed data.",
        companyId: companies[i % companies.length].id,
        leadId: leads[i % leads.length].id,
        productId: products[i % products.length].id,
        status: taskStatuses[i % taskStatuses.length],
        carryForward: i % 5 === 0,
      },
    });
  }

  for (let i = 0; i < 45; i += 1) {
    await prisma.followUp.create({
      data: {
        leadId: leads[i % leads.length].id,
        companyId: companies[i % companies.length].id,
        assignedToId: marketers[i % marketers.length].id,
        method: ["Phone Call", "WhatsApp", "Email", "Meeting"][i % 4],
        note: ["Need price list", "Interested in PP", "Send catalogue", "Meeting at 4 PM"][i % 4],
        nextDiscussionPlan: "Confirm decision maker and next budget step.",
        status: ["DUE", "TODAY", "UPCOMING", "OVERDUE", "COMPLETED"][i % 5],
        followUpDate: day((i % 14) - 5),
        completedAt: i % 5 === 4 ? day(-1) : null,
      },
    });
  }

  for (let i = 0; i < 35; i += 1) {
    await prisma.communicationLog.create({
      data: {
        companyId: companies[i % companies.length].id,
        leadId: leads[i % leads.length].id,
        userId: marketers[i % marketers.length].id,
        method: ["Phone Call", "Email", "WhatsApp", "Physical Visit"][i % 4],
        note: "Customer communication recorded from seed data.",
        communicationAt: day(-i % 10),
        outcome: ["Interested", "Need quotation", "Call later", "Meeting scheduled"][i % 4],
        rating: 3 + (i % 3),
        nextFollowUpDate: day((i % 7) + 1),
        followUpNote: "Follow up with updated product and budget details.",
      },
    });
  }

  for (let i = 0; i < 30; i += 1) {
    const product = products[i % products.length];
    await prisma.productInterest.create({
      data: {
        productId: product.id,
        companyId: companies[i % companies.length].id,
        leadId: leads[i % leads.length].id,
        userId: marketers[i % marketers.length].id,
        score: 35 + (i % 60),
      },
    });
  }

  for (let i = 0; i < 12; i += 1) {
    const product = products[i % products.length];
    const total = Number(product.price) * (1 + (i % 3));
    await prisma.quotation.create({
      data: {
        quoteNumber: `QTN-${String(i + 1).padStart(4, "0")}`,
        companyId: companies[i % companies.length].id,
        leadId: leads[i % leads.length].id,
        createdById: marketers[i % marketers.length].id,
        status: quotationStatuses[i % quotationStatuses.length],
        subtotal: total,
        discount: i % 2 === 0 ? 1000 : 0,
        totalAmount: total - (i % 2 === 0 ? 1000 : 0),
        validUntil: day(15 + i),
        items: {
          create: {
            productId: product.id,
            description: product.name,
            quantity: 1 + (i % 3),
            unitPrice: product.price,
            discount: i % 2 === 0 ? 1000 : 0,
            total: total - (i % 2 === 0 ? 1000 : 0),
          },
        },
      },
    });
  }

  for (const [index, marketer] of marketers.entries()) {
    await prisma.reward.create({ data: { userId: marketer.id, points: 650 + index * 140, reason: "Lead conversion performance", source: "AUTO", eventKey: `seed-performance-${marketer.id}` } });
    await prisma.rewardHistory.create({ data: { userId: marketer.id, points: 650 + index * 140, reason: "Lead conversion performance", source: "AUTO", entity: "Seed", entityId: marketer.id } });
    await prisma.target.create({ data: { userId: marketer.id, period: "June 2026", leadsTarget: 30, salesTarget: 300000, achieved: 110000 + index * 25000 } });
    await prisma.performanceMetric.create({
      data: {
        userId: marketer.id,
        period: "June 2026",
        leadsAdded: 18 + index * 3,
        followUpsCompleted: 22 + index * 2,
        meetingsScheduled: 6 + index,
        salesCompleted: 3 + index,
        activityCount: 55 + index * 8,
        conversionRate: 18 + index * 2,
        salesAmount: 110000 + index * 25000,
        rewardPoints: 650 + index * 140,
      },
    });
  }

  await prisma.rewardRule.createMany({
    data: [
      { name: "Lead Added", trigger: "LEAD_CREATED", points: 10 },
      { name: "Follow-up Completed", trigger: "FOLLOW_UP_COMPLETED", points: 20 },
      { name: "Sale Converted", trigger: "WON_SALE", points: 100 },
    ],
  });

  await prisma.activityLog.createMany({
    data: [
      { userId: admin.id, action: "Created system seed data", entity: "System" },
      { userId: supervisor.id, action: "Reviewed team pipeline", entity: "Lead" },
      { userId: marketers[0].id, action: "Completed follow-up", entity: "FollowUp" },
    ],
  });

  await prisma.activityTimeline.createMany({
    data: [
      { userId: marketers[0].id, title: "Phone Call Logged", description: "Discussed LED display requirements.", entity: "CommunicationLog", companyId: companies[0].id, leadId: leads[0].id },
      { userId: marketers[1].id, title: "Follow-up Scheduled", description: "Send revised quotation and catalog.", entity: "FollowUp", companyId: companies[1].id, leadId: leads[1].id },
      { userId: supervisor.id, title: "Task Assigned", description: "Supervisor assigned task to marketer.", entity: "Task", companyId: companies[2].id, leadId: leads[2].id },
    ],
  });

  await prisma.notification.createMany({
    data: [
      { recipientId: marketers[0].id, title: "Follow-up Reminder", message: "Rahim Traders follow-up is due today.", type: "FOLLOW_UP_REMINDER", entity: "FollowUp" },
      { recipientId: marketers[1].id, title: "Task Assigned", message: "You have been assigned a new task.", type: "TASK_ASSIGNED", entity: "Task" },
      { recipientId: supervisor.id, title: "Follow-up Overdue", message: "A team follow-up is overdue.", type: "FOLLOW_UP_OVERDUE", entity: "FollowUp" },
      { recipientId: admin.id, title: "System Alert", message: "Monthly sales target update generated.", type: "SYSTEM_ALERT", entity: "System" },
    ],
  });

  await prisma.leadStatusHistory.createMany({
    data: leads.slice(0, 10).map((lead, index) => ({
      leadId: lead.id,
      fromStatus: index % 2 === 0 ? "NEW_LEAD" : "CONTACTED",
      toStatus: leadStatuses[index % leadStatuses.length],
      changedById: marketers[index % marketers.length].id,
      note: "Seed status movement history.",
    })),
  });

  const permissionData = [];
  const modules = ["DASHBOARD", "LEADS", "CUSTOMERS", "TASKS", "FOLLOW_UPS", "COMMUNICATIONS", "PRODUCTS", "QUOTATIONS", "REWARDS", "REPORTS", "TEAM", "USERS", "SETTINGS", "IMPORT_EXPORT", "NOTIFICATIONS"];
  const actions = ["VIEW", "CREATE", "EDIT", "DELETE", "ASSIGN", "REASSIGN", "IMPORT", "EXPORT", "DOWNLOAD_REPORT"];
  for (const moduleName of modules) {
    for (const action of actions) {
      permissionData.push({ module: moduleName, action, label: `${moduleName} ${action}` });
    }
  }
  await prisma.permission.createMany({ data: permissionData, skipDuplicates: true });
  const permissions = await prisma.permission.findMany();
  await prisma.rolePermission.createMany({
    data: permissions.flatMap((permission) => [
      { role: "ADMIN", permissionId: permission.id, enabled: true },
      { role: "SUPERVISOR", permissionId: permission.id, enabled: !["USERS", "SETTINGS"].includes(permission.module) || permission.action === "VIEW" },
      { role: "MARKETER", permissionId: permission.id, enabled: ["DASHBOARD", "LEADS", "CUSTOMERS", "TASKS", "FOLLOW_UPS", "COMMUNICATIONS", "PRODUCTS", "QUOTATIONS", "REWARDS", "REPORTS", "NOTIFICATIONS"].includes(permission.module) && !["DELETE", "REASSIGN", "IMPORT", "EXPORT", "DOWNLOAD_REPORT"].includes(permission.action) },
    ]),
    skipDuplicates: true,
  });

  await prisma.importExportLog.createMany({
    data: [
      { type: "IMPORT", module: "CUSTOMERS", format: "CSV", requestedById: admin.id, fileName: "customers-seed.csv", status: "COMPLETED", processedRows: 20 },
      { type: "EXPORT", module: "LEADS", format: "EXCEL", requestedById: supervisor.id, fileName: "team-leads.xlsx", status: "COMPLETED", processedRows: 50 },
    ],
  });

  await prisma.reportLog.createMany({
    data: [
      { reportType: "CUSTOMER_COMMUNICATION", format: "PDF", requestedById: admin.id, status: "COMPLETED", completedAt: day(0) },
      { reportType: "FOLLOW_UP", format: "CSV", requestedById: supervisor.id, status: "COMPLETED", completedAt: day(0) },
    ],
  });

  await prisma.systemSetting.create({
    data: {
      key: "company.profile",
      group: "company",
      value: { company: "Mugnee Solutions", email: "info@mugnee.com", phone: "01712345678", address: "House #12, Road #5, Dhanmondi, Dhaka-1205" },
    },
  });

  await prisma.reportExport.createMany({
    data: [
      { reportType: "CUSTOMER_COMMUNICATION", format: "PDF", requestedById: admin.id },
      { reportType: "EMPLOYEE_PERFORMANCE", format: "XLSX", requestedById: supervisor.id },
      { reportType: "LEAD_CONVERSION", format: "CSV", requestedById: admin.id },
    ],
  });

  console.log("Seed complete: admin 01700000001, supervisor 01700000002, marketer 01700000003. Demo OTP: 123456");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
