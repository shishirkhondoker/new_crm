import {
  Award,
  BellRing,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileBarChart,
  FileText,
  Goal,
  HandCoins,
  Headphones,
  LayoutDashboard,
  LineChart,
  MessageSquareText,
  Package,
  PhoneCall,
  ReceiptText,
  Settings,
  ShieldCheck,
  Star,
  Target,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import type { Role } from "@/lib/utils";

export type LeadStatus =
  | "NEW_LEAD"
  | "CONTACTED"
  | "INTERESTED"
  | "FOLLOW_UP_REQUIRED"
  | "QUOTATION_SENT"
  | "NEGOTIATION"
  | "WON_SALE"
  | "LOST_SALE"
  | "ON_HOLD";

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: Role;
  designation: string;
  status: "Active" | "Inactive";
  avatar: string;
  rewardPoints: number;
};

export type CompanyRecord = {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  address: string;
  industry: string;
  totalLeads: number;
  lastCommunication: string;
  status: "Active" | "Inactive";
};

export type ProductRecord = {
  id: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  interestedLeads: number;
  conversionRate: number;
  accent: string;
  specs: string[];
};

export type LeadRecord = {
  id: string;
  title: string;
  company: string;
  customerName: string;
  phone: string;
  email: string;
  productInterest: string;
  status: LeadStatus;
  score: number;
  priority: Priority;
  purchaseProbability: number;
  assignedTo: string;
  createdBy: string;
  followUpDate: string;
  notes: string;
};

export type TaskRecord = {
  id: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "PENDING" | "COMPLETED" | "OVERDUE";
  dueDate: string;
  priority: Priority;
  assignedBy: string;
  assignedTo: string;
  lead: string;
};

export type FollowUpRecord = {
  id: string;
  customer: string;
  method: string;
  date: string;
  assignedTo: string;
  note: string;
  status: "Due" | "Today" | "Upcoming" | "Overdue" | "Completed";
};

export type QuotationRecord = {
  id: string;
  customer: string;
  product: string;
  amount: number;
  status: "Draft" | "Sent" | "Revised" | "Approved" | "Rejected" | "Converted to Sale";
  createdBy: string;
  date: string;
};

export const users: UserRecord[] = [
  {
    id: "u-admin",
    name: "Arifin Ullash",
    email: "admin@mugnee.com",
    mobile: "01700000001",
    role: "ADMIN",
    designation: "Admin",
    status: "Active",
    avatar: "AU",
    rewardPoints: 0,
  },
  {
    id: "u-supervisor",
    name: "Sadia Akter",
    email: "sadia@mugnee.com",
    mobile: "01700000002",
    role: "SUPERVISOR",
    designation: "Sales Supervisor",
    status: "Active",
    avatar: "SA",
    rewardPoints: 960,
  },
  {
    id: "u-john",
    name: "John Doe",
    email: "john@mugnee.com",
    mobile: "01700000003",
    role: "MARKETER",
    designation: "Senior Marketer",
    status: "Active",
    avatar: "JD",
    rewardPoints: 1200,
  },
  {
    id: "u-tawhid",
    name: "Tawhid Hasan",
    email: "tawhid@mugnee.com",
    mobile: "01700000004",
    role: "MARKETER",
    designation: "Field Marketer",
    status: "Active",
    avatar: "TH",
    rewardPoints: 800,
  },
  {
    id: "u-fahim",
    name: "Fahim Ahmed",
    email: "fahim@mugnee.com",
    mobile: "01700000005",
    role: "MARKETER",
    designation: "Account Executive",
    status: "Active",
    avatar: "FA",
    rewardPoints: 650,
  },
  {
    id: "u-michal",
    name: "Michal Rahman",
    email: "michal@mugnee.com",
    mobile: "01700000006",
    role: "MARKETER",
    designation: "Sales Associate",
    status: "Inactive",
    avatar: "MR",
    rewardPoints: 600,
  },
];

export const products: ProductRecord[] = [
  {
    id: "prod-led",
    name: "LED Display",
    category: "Display",
    brand: "Mugnee",
    price: 25000,
    interestedLeads: 45,
    conversionRate: 25,
    accent: "from-blue-600 to-cyan-400",
    specs: ["4K panel", "Wall mount", "2 year warranty", "Installation support"],
  },
  {
    id: "prod-pa",
    name: "PA System",
    category: "Audio",
    brand: "Mugnee",
    price: 18000,
    interestedLeads: 38,
    conversionRate: 25,
    accent: "from-slate-800 to-slate-500",
    specs: ["Wireless mic", "Portable speaker", "Mixer", "Training included"],
  },
  {
    id: "prod-panel",
    name: "Interactive Flat Panel",
    category: "Education",
    brand: "ViewBoard",
    price: 85000,
    interestedLeads: 28,
    conversionRate: 25,
    accent: "from-indigo-600 to-sky-400",
    specs: ["Touch screen", "Android board", "OPS ready", "Classroom mode"],
  },
  {
    id: "prod-walkie",
    name: "Walkie Talkie",
    category: "Communication",
    brand: "Motorola",
    price: 4500,
    interestedLeads: 16,
    conversionRate: 16,
    accent: "from-emerald-600 to-lime-400",
    specs: ["Long range", "Rechargeable", "Belt clip", "Service support"],
  },
  {
    id: "prod-software",
    name: "Software Service",
    category: "IT Services",
    brand: "Mugnee",
    price: 32000,
    interestedLeads: 22,
    conversionRate: 18,
    accent: "from-violet-600 to-fuchsia-400",
    specs: ["CRM setup", "Hosting guide", "Training", "Support"],
  },
];

const companySeeds = [
  ["ABC Corporation", "Mr. Rahim", "Education"],
  ["XYZ Limited", "Mr. Karim", "Trading"],
  ["Metro Electronics", "Mr. Hasan", "Electronics"],
  ["Delta Solutions", "Ms. Jahan", "IT Services"],
  ["Omega Traders", "Mr. Hossain", "Trading"],
  ["Prime Academy", "Dr. Kabir", "Education"],
  ["Eastern Tech", "Nusrat Jahan", "IT Services"],
  ["Smart Retail", "Imran Hossain", "Retail"],
  ["Green Hospital", "Dr. Farzana", "Healthcare"],
  ["North Bridge", "Aminul Islam", "Trading"],
  ["Blue Ocean Ltd", "Farhan Ahmed", "Electronics"],
  ["Future School", "Samiha Rahman", "Education"],
  ["Sunrise Mart", "Anika Sultana", "Retail"],
  ["City Electronics", "Kamal Uddin", "Electronics"],
  ["Digital Hub", "Rafiq Ahmed", "IT Services"],
  ["Vertex Systems", "Sourav Datta", "IT Services"],
  ["Pioneer Pharma", "Dr. Rashed", "Healthcare"],
  ["Summit Traders", "Mahfuz Alam", "Trading"],
  ["Capital College", "Nazmul Bari", "Education"],
  ["Orbit Telecom", "Jamal Hossain", "Communication"],
];

export const companies: CompanyRecord[] = companySeeds.map((seed, index) => ({
  id: `cust-${index + 1}`,
  name: seed[0],
  contactPerson: seed[1],
  phone: `01712${String(345678 + index).slice(0, 6)}`,
  whatsapp: `01813${String(244678 + index).slice(0, 6)}`,
  email: `contact${index + 1}@${seed[0].toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
  website: `www.${seed[0].toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
  address: `Dhanmondi, Dhaka-120${index % 6}`,
  industry: seed[2],
  totalLeads: 2 + (index % 5),
  lastCommunication: `May ${18 + (index % 9)}, 2026`,
  status: index % 9 === 0 ? "Inactive" : "Active",
}));

export const leadStatusLabels: Record<LeadStatus, string> = {
  NEW_LEAD: "New Lead",
  CONTACTED: "Contacted",
  INTERESTED: "Interested",
  FOLLOW_UP_REQUIRED: "Follow-up Req",
  QUOTATION_SENT: "Quotation Sent",
  NEGOTIATION: "Negotiation",
  WON_SALE: "Won Sale",
  LOST_SALE: "Lost Sale",
  ON_HOLD: "On Hold",
};

const leadStatusCycle: LeadStatus[] = [
  "NEW_LEAD",
  "CONTACTED",
  "INTERESTED",
  "FOLLOW_UP_REQUIRED",
  "QUOTATION_SENT",
  "NEGOTIATION",
  "WON_SALE",
  "LOST_SALE",
  "ON_HOLD",
];

const priorityCycle: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const marketers = users.filter((user) => user.role === "MARKETER");

export const leads: LeadRecord[] = Array.from({ length: 50 }, (_, index) => {
  const company = companies[index % companies.length];
  const product = products[index % products.length];
  const owner = marketers[index % marketers.length];

  return {
    id: `lead-${index + 1}`,
    title: `${company.name} ${product.name}`,
    company: company.name,
    customerName: company.contactPerson,
    phone: `01799${String(543210 + index).slice(0, 6)}`,
    email: `lead${index + 1}@${company.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
    productInterest: product.name,
    status: leadStatusCycle[index % leadStatusCycle.length],
    score: 55 + ((index * 7) % 42),
    priority: priorityCycle[index % priorityCycle.length],
    purchaseProbability: 20 + ((index * 8) % 76),
    assignedTo: owner.name,
    createdBy: index % 2 === 0 ? "Sadia Akter" : "Arifin Ullash",
    followUpDate: `May ${20 + (index % 10)}, 2026`,
    notes: "Customer is evaluating pricing, delivery timeline, and warranty details.",
  };
});

export const tasks: TaskRecord[] = Array.from({ length: 24 }, (_, index) => ({
  id: `task-${index + 1}`,
  title: ["Call ABC Corporation", "Follow up with XYZ", "Prepare Proposal", "Visit Client Office", "Send Quotation", "Meeting with Delta"][index % 6],
  status: ["TODO", "IN_PROGRESS", "PENDING", "COMPLETED", "OVERDUE"][index % 5] as TaskRecord["status"],
  dueDate: `May ${20 + (index % 8)}`,
  priority: priorityCycle[(index + 1) % priorityCycle.length],
  assignedBy: index % 2 === 0 ? "Sadia Akter" : "Arifin Ullash",
  assignedTo: marketers[index % marketers.length].name,
  lead: leads[index % leads.length].company,
}));

export const todayPlans = [
  { id: "plan-1", title: "Call ABC Corporation", time: "10:00 AM", status: "Todo", section: "today" },
  { id: "plan-2", title: "Follow-up with XYZ Limited", time: "12:30 PM", status: "Todo", section: "today" },
  { id: "plan-3", title: "Visit Metro Electronics", time: "03:00 PM", status: "Todo", section: "today" },
  { id: "plan-4", title: "Prepare proposal for Delta Solutions", time: "Pending", status: "Pending", section: "previous" },
  { id: "plan-5", title: "Follow-up with Omega Traders", time: "Pending", status: "Pending", section: "previous" },
  { id: "plan-6", title: "Call New Lead - Rahim Store", time: "Completed", status: "Completed", section: "completed" },
];

export const followUps: FollowUpRecord[] = Array.from({ length: 16 }, (_, index) => ({
  id: `follow-${index + 1}`,
  customer: companies[index % companies.length].name,
  method: ["Phone Call", "WhatsApp", "Email", "Meeting"][index % 4],
  date: `May ${22 + (index % 8)}, 2026`,
  assignedTo: marketers[index % marketers.length].name,
  note: ["Need price list", "Interested in PP", "Send catalogue", "Meeting at 4 PM"][index % 4],
  status: ["Today", "Upcoming", "Overdue", "Completed", "Due"][index % 5] as FollowUpRecord["status"],
}));

export const quotations: QuotationRecord[] = Array.from({ length: 18 }, (_, index) => {
  const product = products[index % products.length];
  return {
    id: `QTN-${String(index + 1).padStart(4, "0")}`,
    customer: companies[index % companies.length].name,
    product: product.name,
    amount: product.price * (1 + (index % 3)),
    status: ["Draft", "Sent", "Revised", "Approved", "Rejected", "Converted to Sale"][index % 6] as QuotationRecord["status"],
    createdBy: marketers[index % marketers.length].name,
    date: `May ${18 + (index % 12)}, 2026`,
  };
});

export const activityFeed = [
  { title: "Lead Added", detail: "ABC Corporation moved to interested", time: "May 22, 2026", icon: BellRing },
  { title: "Follow-up Completed", detail: "XYZ Limited was contacted by phone", time: "May 22, 2026", icon: CheckCircle2 },
  { title: "Meeting Scheduled", detail: "Metro Electronics visit confirmed", time: "May 21, 2026", icon: CalendarClock },
  { title: "Sale Completed", detail: "LED Display quotation approved", time: "May 20, 2026", icon: HandCoins },
];

export const leadStatusData = [
  { name: "New", value: 18, color: "#2563EB" },
  { name: "Contacted", value: 32, color: "#06B6D4" },
  { name: "Interested", value: 28, color: "#16A34A" },
  { name: "Quotation", value: 20, color: "#F59E0B" },
  { name: "Won", value: 15, color: "#8B5CF6" },
  { name: "Lost", value: 8, color: "#DC2626" },
];

export const salesTrend = [
  { month: "May 1", sales: 18000 },
  { month: "May 5", sales: 22000 },
  { month: "May 9", sales: 14000 },
  { month: "May 13", sales: 29000 },
  { month: "May 17", sales: 24000 },
  { month: "May 21", sales: 36000 },
  { month: "May 25", sales: 46000 },
  { month: "May 29", sales: 38000 },
];

export const productInterestData = products.map((product) => ({
  name: product.name,
  leads: product.interestedLeads,
}));

export const funnelData = [
  { label: "New Lead", value: 100, color: "#2563EB" },
  { label: "Contacted", value: 82, color: "#0EA5E9" },
  { label: "Interested", value: 62, color: "#22C55E" },
  { label: "Quotation", value: 42, color: "#F59E0B" },
  { label: "Won", value: 28, color: "#EF4444" },
];

export const employeePerformance = users
  .filter((user) => user.role !== "ADMIN")
  .map((user, index) => ({
    employee: user.name,
    role: user.role === "SUPERVISOR" ? "Supervisor" : "Employee",
    leads: 32 - index * 2,
    followUps: 25 - index,
    sales: 8 - (index % 4),
    rewardPoints: user.rewardPoints,
    status: user.status,
    conversion: `${25 - index}%`,
  }));

export const reportCards = [
  ["Customer Communication Report", "Call logs, meeting notes, and customer activity.", FileText],
  ["Follow-up Report", "Upcoming, overdue, and completed follow-ups.", CalendarClock],
  ["Employee Performance Report", "Lead ownership, conversion, and rewards.", FileBarChart],
  ["Sales Report", "Revenue, quotation, and product sales trends.", LineChart],
  ["Reward Report", "Points, rules, rank, and incentive history.", Award],
  ["Lead Conversion Report", "Pipeline movement from new lead to won sale.", TrendingUp],
] as const;

export const quickAccess = [
  ["Add User", Users],
  ["Add Lead", Target],
  ["Add Customer", BriefcaseBusiness],
  ["Add Product", Package],
  ["Import Data", ClipboardCheck],
  ["Generate Report", FileBarChart],
  ["Reward Points", Award],
  ["System Settings", Settings],
] as const;

export const marketerStats = [
  ["Today's Tasks", "08", "2 done today", ClipboardCheck, "bg-amber-100 text-amber-700"],
  ["Pending Tasks", "03", "Needs attention", Clock3, "bg-blue-100 text-blue-700"],
  ["Follow-ups Due", "05", "Due before 5 PM", PhoneCall, "bg-rose-100 text-rose-700"],
  ["New Leads", "02", "Fresh assignments", UserCheck, "bg-indigo-100 text-indigo-700"],
  ["Meetings Today", "01", "Client visit", Headphones, "bg-orange-100 text-orange-700"],
  ["Reward Points", "120", "This month", Award, "bg-emerald-100 text-emerald-700"],
] as const;

export const supervisorStats = [
  ["Team Members", "12", "Active sales team", Users, "bg-blue-100 text-blue-700"],
  ["Active Leads", "145", "Across team", Target, "bg-indigo-100 text-indigo-700"],
  ["Due Follow-ups", "32", "Need action", PhoneCall, "bg-rose-100 text-rose-700"],
  ["Pending Tasks", "28", "Open items", ClipboardCheck, "bg-amber-100 text-amber-700"],
  ["Conversion Rate", "35%", "This month", TrendingUp, "bg-emerald-100 text-emerald-700"],
  ["Target Achievement", "75%", "Against monthly goal", Goal, "bg-violet-100 text-violet-700"],
] as const;

export const adminStats = [
  ["Total Customers", "520", "Active companies", BriefcaseBusiness, "bg-blue-100 text-blue-700"],
  ["Total Leads", "1,250", "All pipelines", Target, "bg-emerald-100 text-emerald-700"],
  ["Monthly Revenue", "BDT 28,50,000", "Current month", ReceiptText, "bg-violet-100 text-violet-700"],
  ["Conversion Rate", "28%", "Lead to sale", TrendingUp, "bg-orange-100 text-orange-700"],
  ["Active Employees", "25", "Sales users", Users, "bg-cyan-100 text-cyan-700"],
  ["Total Reward Given", "15,200", "Reward points", Award, "bg-amber-100 text-amber-700"],
  ["Won Sales", "85", "Converted deals", HandCoins, "bg-green-100 text-green-700"],
  ["Pending Follow-ups", "32", "Needs review", MessageSquareText, "bg-fuchsia-100 text-fuchsia-700"],
] as const;

export const sidebarMenus: Record<Role, { label: string; href: string; icon: typeof LayoutDashboard }[]> = {
  ADMIN: [
    { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Leads", href: "/admin/leads", icon: Target },
    { label: "Customers", href: "/admin/customers", icon: BriefcaseBusiness },
    { label: "Today's Task", href: "/admin/tasks", icon: ClipboardCheck },
    { label: "Follow-ups", href: "/admin/follow-ups", icon: CalendarClock },
    { label: "Products", href: "/admin/products", icon: Package },
    { label: "Quotations", href: "/admin/quotations", icon: ReceiptText },
    { label: "Rewards", href: "/admin/rewards", icon: Award },
    { label: "Reports", href: "/admin/reports", icon: FileBarChart },
    { label: "Team", href: "/admin/team", icon: Users },
    { label: "Users", href: "/admin/users", icon: ShieldCheck },
    { label: "Settings", href: "/admin/settings", icon: Settings },
  ],
  SUPERVISOR: [
    { label: "Dashboard", href: "/supervisor/dashboard", icon: LayoutDashboard },
    { label: "Leads", href: "/supervisor/leads", icon: Target },
    { label: "Customers", href: "/supervisor/customers", icon: BriefcaseBusiness },
    { label: "Today's Task", href: "/supervisor/tasks", icon: ClipboardCheck },
    { label: "Follow-ups", href: "/supervisor/follow-ups", icon: CalendarClock },
    { label: "Products", href: "/supervisor/products", icon: Package },
    { label: "Quotations", href: "/supervisor/quotations", icon: ReceiptText },
    { label: "Rewards", href: "/supervisor/rewards", icon: Award },
    { label: "Reports", href: "/supervisor/reports", icon: FileBarChart },
    { label: "Team", href: "/supervisor/team", icon: Users },
  ],
  MARKETER: [
    { label: "Dashboard", href: "/marketer/dashboard", icon: LayoutDashboard },
    { label: "Leads", href: "/marketer/leads", icon: Target },
    { label: "Customers", href: "/marketer/customers", icon: BriefcaseBusiness },
    { label: "Today's Task", href: "/marketer/tasks", icon: ClipboardCheck },
    { label: "Follow-ups", href: "/marketer/follow-ups", icon: PhoneCall },
    { label: "Products", href: "/marketer/products", icon: Package },
    { label: "Quotations", href: "/marketer/quotations", icon: ReceiptText },
    { label: "Rewards", href: "/marketer/rewards", icon: Award },
    { label: "Reports", href: "/marketer/reports", icon: FileBarChart },
  ],
};

export function scopeLeads(role: Role) {
  if (role === "MARKETER") {
    return leads.filter((lead) => lead.assignedTo === "John Doe");
  }
  if (role === "SUPERVISOR") {
    return leads.filter((lead) => lead.assignedTo !== "Michal Rahman");
  }
  return leads;
}

export function scopeCustomers(role: Role) {
  if (role === "MARKETER") return companies.slice(0, 7);
  if (role === "SUPERVISOR") return companies.slice(0, 14);
  return companies;
}

export function activeUser(role: Role) {
  if (role === "ADMIN") return users[0];
  if (role === "SUPERVISOR") return users[1];
  return users[2];
}

export const rewardTimeline = [
  { event: "Lead Added", date: "May 23, 2026", points: 10 },
  { event: "Follow-up Completed", date: "May 23, 2026", points: 20 },
  { event: "Meeting Scheduled", date: "May 21, 2026", points: 30 },
  { event: "Sale Completed", date: "May 19, 2026", points: 100 },
];

export const systemSummary = [
  ["Total Users", "32"],
  ["Database Size", "1.8 GB"],
  ["System Uptime", "99.98%"],
  ["Active Sessions", "18"],
] as const;

export const settingsNav = [
  "Company Settings",
  "Lead Status Settings",
  "Product Category",
  "Reward Rules",
  "Target Rules",
  "Notification Settings",
  "Import / Export Settings",
  "System Configuration",
];

export const loginUsers = [
  { mobile: "01700000001", role: "ADMIN", name: "Admin User" },
  { mobile: "01700000002", role: "SUPERVISOR", name: "Sadia Akter" },
  { mobile: "01700000003", role: "MARKETER", name: "John Doe" },
] as const;

export const leadPipeline = [
  ["New", 12, "bg-blue-500"],
  ["Contacted", 20, "bg-cyan-500"],
  ["Interested", 18, "bg-emerald-500"],
  ["Quotation Sent", 15, "bg-amber-500"],
  ["Negotiation", 7, "bg-pink-500"],
  ["Won", 5, "bg-indigo-500"],
  ["Lost", 3, "bg-red-500"],
] as const;

export const miniKpi = [
  ["Total Leads", "3", Star],
  ["Total Communication", "5", MessageSquareText],
  ["Total Quotation", "2", ReceiptText],
  ["Current Progress", "Negotiation", TrendingUp],
] as const;
