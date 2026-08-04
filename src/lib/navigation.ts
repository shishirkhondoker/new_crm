import {
  Award,
  BriefcaseBusiness,
  CalendarClock,
  ClipboardCheck,
  FileBarChart,
  LayoutDashboard,
  MessageSquare,
  Package,
  PhoneCall,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import type { Role } from "@/lib/utils";

const roleRoutePrefixes = new Set(["admin", "supervisor", "marketer"]);

function normalizePath(path: string) {
  const cleanPath = path.split(/[?#]/)[0]?.replace(/\/+$/, "") ?? "";
  return cleanPath || "/";
}

function getSectionSegments(path: string) {
  const segments = normalizePath(path).split("/").filter(Boolean);
  return roleRoutePrefixes.has(segments[0] ?? "") ? segments.slice(1) : segments;
}

export function isActiveRoute(pathname: string, href: string) {
  const currentPath = normalizePath(pathname);
  const targetPath = normalizePath(href);

  if (currentPath === targetPath) return true;
  if (currentPath.startsWith(`${targetPath}/`)) return true;

  const currentSegments = getSectionSegments(currentPath);
  const targetSegments = getSectionSegments(targetPath);

  if (!currentSegments.length || !targetSegments.length) return false;

  return currentSegments[0] === targetSegments[0];
}

export const sidebarMenus: Record<Role, { label: string; href: string; icon: typeof LayoutDashboard }[]> = {
  ADMIN: [
    { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Today's Task", href: "/admin/tasks", icon: ClipboardCheck },
    { label: "Follow-ups", href: "/admin/follow-ups", icon: CalendarClock },
    { label: "Products", href: "/admin/products", icon: Package },
    { label: "Customers", href: "/admin/customers", icon: BriefcaseBusiness },
    { label: "Leads", href: "/admin/leads", icon: Target },
    { label: "Communication", href: "/admin/notifications", icon: MessageSquare },
    { label: "Reports", href: "/admin/reports", icon: FileBarChart },
    { label: "Users", href: "/admin/users", icon: Users },
    { label: "Roles & Permissions", href: "/admin/permissions", icon: ShieldCheck },
    { label: "Rewards", href: "/admin/rewards", icon: Award },
  ],
  SUPERVISOR: [
    { label: "Dashboard", href: "/supervisor/dashboard", icon: LayoutDashboard },
    { label: "Today's Task", href: "/supervisor/tasks", icon: ClipboardCheck },
    { label: "Follow-ups", href: "/supervisor/follow-ups", icon: CalendarClock },
    { label: "Products", href: "/supervisor/products", icon: Package },
    { label: "Customers", href: "/supervisor/customers", icon: BriefcaseBusiness },
    { label: "Leads", href: "/supervisor/leads", icon: Target },
    { label: "Communication", href: "/supervisor/communication", icon: MessageSquare },
    { label: "Team", href: "/supervisor/team", icon: Users },
    { label: "Reports", href: "/supervisor/reports", icon: FileBarChart },
    { label: "Rewards", href: "/supervisor/rewards", icon: Award },
  ],
  MARKETER: [
    { label: "Dashboard", href: "/marketer/dashboard", icon: LayoutDashboard },
    { label: "Today's Task", href: "/marketer/tasks", icon: ClipboardCheck },
    { label: "Follow-ups", href: "/marketer/follow-ups", icon: PhoneCall },
    { label: "Products", href: "/marketer/products", icon: Package },
    { label: "Customers", href: "/marketer/customers", icon: BriefcaseBusiness },
    { label: "Leads", href: "/marketer/leads", icon: Target },
    { label: "Communication", href: "/marketer/communication", icon: MessageSquare },
    { label: "Reports", href: "/marketer/reports", icon: FileBarChart },
    { label: "Rewards", href: "/marketer/rewards", icon: Award },
  ],
};
