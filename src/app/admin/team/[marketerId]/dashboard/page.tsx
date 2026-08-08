import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { MarketerDashboard } from "@/components/crm/dashboard-pages";
import { MarketerDashboardPreviewPanel } from "@/components/crm/resource-pages";
import { requireCurrentUser } from "@/lib/auth";
import { getMarketerScopeUserIds } from "@/lib/customer-ownership";
import { getCrmWorkspace, getFollowUpPageData } from "@/lib/crm-data";
import { getPrisma } from "@/lib/prisma";
import { getCompletedWorkItems, getTodayWorkQueue, getUpcomingTasks } from "@/lib/task-center";

export default async function AdminMarketerDashboardPreviewPage({
  params,
}: {
  params: Promise<{ marketerId: string }>;
}) {
  const { marketerId } = await params;
  const viewer = await requireCurrentUser("ADMIN");
  const prisma = getPrisma();

  const scopeIds = await getMarketerScopeUserIds(prisma, { id: viewer.id ?? "", role: "ADMIN" });
  if (scopeIds && !scopeIds.includes(marketerId)) {
    notFound();
  }

  const marketer = await prisma.user.findUnique({
    where: { id: marketerId },
    select: { id: true, name: true, role: true, status: true },
  });

  if (!marketer || marketer.role !== "MARKETER") {
    notFound();
  }

  const marketerActor = { id: marketer.id, role: "MARKETER" as const, name: marketer.name };

  const [viewerWorkspace, marketerWorkspace, activeTasks, upcomingTasks, completedTasks, followUpPage] = await Promise.all([
    getCrmWorkspace("ADMIN", viewer),
    getCrmWorkspace("MARKETER", marketerActor),
    getTodayWorkQueue(marketerActor),
    getUpcomingTasks(marketerActor),
    getCompletedWorkItems(marketerActor),
    getFollowUpPageData("MARKETER", marketerActor, {}),
  ]);

  return (
    <AppShell
      role="ADMIN"
      user={viewer}
      unreadCount={viewerWorkspace.unreadCount}
      followUpCount={viewerWorkspace.followUpSummary.actionable}
      sidebarCounts={viewerWorkspace.sidebarCounts}
    >
      <MarketerDashboardPreviewPanel
        role="ADMIN"
        marketerId={marketer.id}
        marketerName={marketer.name}
        workspace={marketerWorkspace}
        initialActiveTasks={activeTasks}
        initialCompletedTasks={completedTasks}
        followUpPage={followUpPage}
        dashboardContent={
          <MarketerDashboard
            workspace={marketerWorkspace}
            initialTaskSnapshot={{ activeTasks, upcomingTasks, completedTasks }}
          />
        }
      />
    </AppShell>
  );
}
