import { AppShell } from "@/components/app/app-shell";
import { TodaysPlanPage } from "@/components/crm/resource-pages";
import { getPrisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth";
import { getCrmDayWindow } from "@/lib/crm-time";

export default async function Page() {
  const user = await requireCurrentUser("MARKETER");
  const prisma = getPrisma();
  const scopedUserIds = user.id ? [user.id] : [];
  const hasScope = scopedUserIds.length > 0;
  const { from: today, to: tomorrow } = getCrmDayWindow(new Date());

  const leadWhere = hasScope
    ? {
        OR: [
          { assignedToId: { in: scopedUserIds } },
          { AND: [{ assignedToId: null }, { createdById: { in: scopedUserIds } }] },
        ],
      }
    : {};
  const taskWhere = hasScope ? { OR: [{ assignedToId: { in: scopedUserIds } }, { assignedById: { in: scopedUserIds } }] } : {};
  const followUpWhere = hasScope ? { assignedToId: { in: scopedUserIds } } : {};
  const planWhere = hasScope ? { userId: { in: scopedUserIds } } : {};

  const [
    unreadCount,
    leadCount,
    customerCount,
    coldCustomerCount,
    todayTaskBadgeCount,
  followUpOverdueCount,
  followUpTodayCount,
  followUpUpcomingCount,
  followUpCompletedCount,
  followUpBadgeCount,
  todaysPlanCount,
  activeProductCount,
  rewardSum,
    employees,
    products,
  ] = await Promise.all([
    hasScope ? prisma.notification.count({ where: { recipientId: { in: scopedUserIds }, readAt: null } }) : Promise.resolve(0),
    hasScope ? prisma.lead.count({ where: leadWhere }) : Promise.resolve(0),
    hasScope ? prisma.customerCompany.count({ where: { assignedToId: { in: scopedUserIds }, isParked: false } }) : Promise.resolve(0),
    hasScope ? prisma.customerCompany.count({ where: { assignedToId: { in: scopedUserIds }, isParked: true } }) : Promise.resolve(0),
    hasScope
      ? prisma.task.count({
        where: {
          ...taskWhere,
          status: { not: "COMPLETED" },
          taskDate: { lt: tomorrow },
        },
      })
      : Promise.resolve(0),
    hasScope
      ? prisma.followUp.count({
        where: {
          ...followUpWhere,
          status: { not: "COMPLETED" },
          OR: [{ status: "OVERDUE" }, { followUpDate: { lt: today } }],
        },
      })
      : Promise.resolve(0),
    hasScope
      ? prisma.followUp.count({
        where: {
          ...followUpWhere,
          status: { notIn: ["COMPLETED", "OVERDUE"] },
          followUpDate: { gte: today, lt: tomorrow },
        },
      })
      : Promise.resolve(0),
    hasScope
      ? prisma.followUp.count({
        where: {
          ...followUpWhere,
          status: { notIn: ["COMPLETED", "OVERDUE"] },
          followUpDate: { gte: tomorrow },
        },
      })
      : Promise.resolve(0),
    hasScope ? prisma.followUp.count({ where: { ...followUpWhere, status: "COMPLETED" } }) : Promise.resolve(0),
    hasScope
      ? prisma.followUp.count({
        where: {
          ...followUpWhere,
          status: { not: "COMPLETED" },
          OR: [{ status: { in: ["DUE", "TODAY", "OVERDUE"] } }, { followUpDate: { lt: tomorrow } }],
        },
      })
      : Promise.resolve(0),
    hasScope ? prisma.todayPlan.count({ where: { ...planWhere, status: { not: "COMPLETED" }, plannedAt: { lt: tomorrow } } }) : Promise.resolve(0),
    prisma.productService.count({ where: { status: "ACTIVE" } }),
    hasScope ? prisma.reward.aggregate({ where: { userId: { in: scopedUserIds } }, _sum: { points: true } }) : Promise.resolve({ _sum: { points: null } }),
    hasScope
      ? prisma.user.findMany({
        where: { id: { in: scopedUserIds }, role: "MARKETER", status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          role: true,
          status: true,
          designation: true,
          supervisorId: true,
          supervisorAssignmentsAsMarketer: { select: { supervisorId: true } },
        },
        orderBy: { name: "asc" },
      })
      : Promise.resolve([] as Array<{ id: string; name: string; role: "ADMIN" | "SUPERVISOR" | "MARKETER"; status: "ACTIVE" | "INACTIVE"; designation: string | null; supervisorId: string | null; supervisorAssignmentsAsMarketer?: Array<{ supervisorId: string }> }>)
,
    prisma.productService.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const workspace = {
    user,
    unreadCount,
    employees: employees.map((employee) => {
      const supervisorIds = Array.from(
        new Set([
          ...(employee.supervisorAssignmentsAsMarketer?.map((assignment) => assignment.supervisorId) ?? []),
          ...(employee.supervisorId ? [employee.supervisorId] : []),
        ]),
      );

      return {
        id: employee.id,
        name: employee.name,
        role: employee.role,
        roleKey: employee.role,
        status: employee.status === "ACTIVE" ? "Active" : "Inactive",
        statusKey: employee.status,
        designation: employee.designation || "Marketer",
        supervisorId: employee.supervisorId,
        supervisorIds,
      };
    }),
    products,
  } as const;

  const followUpSummary = {
    overdue: followUpOverdueCount,
    today: followUpTodayCount,
    upcoming: followUpUpcomingCount,
    completed: followUpCompletedCount,
    actionable: followUpOverdueCount + followUpTodayCount + followUpUpcomingCount,
  };

  return (
    <AppShell
      role="MARKETER"
      user={user}
      unreadCount={unreadCount}
      followUpCount={followUpSummary.actionable}
      sidebarCounts={{
        followUps: followUpSummary.actionable,
        leads: leadCount,
        customers: customerCount,
        coldCustomers: coldCustomerCount,
        tasks: todayTaskBadgeCount,
        todaysPlan: todaysPlanCount + todayTaskBadgeCount + followUpBadgeCount,
        products: activeProductCount,
        rewards: rewardSum._sum.points ?? 0,
      }}
    >
      <TodaysPlanPage workspace={workspace} />
    </AppShell>
  );
}
