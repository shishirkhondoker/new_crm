import { AppShell } from "@/components/app/app-shell";
import { MarketerDashboard } from "@/components/crm/dashboard-pages";
import { requireCurrentUser } from "@/lib/auth";
import { getDashboardWorkspace } from "@/lib/crm-data";
import { getCompletedWorkItems, getTodayWorkQueue, getUpcomingTasks } from "@/lib/task-center";

export default async function MarketerDashboardPage() {
  const user = await requireCurrentUser("MARKETER");
  const actor = user.id ? { id: user.id, role: "MARKETER" as const, name: user.name } : null;
  const [workspace, activeTasks, upcomingTasks, completedTasks] = await Promise.all([
    getDashboardWorkspace("MARKETER", user),
    actor ? getTodayWorkQueue(actor) : Promise.resolve([]),
    actor ? getUpcomingTasks(actor) : Promise.resolve([]),
    actor ? getCompletedWorkItems(actor) : Promise.resolve([]),
  ]);

  return (
    <AppShell role="MARKETER" user={user} unreadCount={workspace.unreadCount} followUpCount={workspace.followUpSummary.actionable} sidebarCounts={workspace.sidebarCounts}>
      <MarketerDashboard
        workspace={workspace}
        initialTaskSnapshot={{
          activeTasks,
          upcomingTasks,
          completedTasks,
        }}
      />
    </AppShell>
  );
}

