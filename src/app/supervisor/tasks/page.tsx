import { AppShell } from "@/components/app/app-shell";
import { TasksPage } from "@/components/crm/resource-pages";
import { getWorkspaceContext } from "@/lib/page-context";
import { getCompletedWorkItems, getTodayWorkQueue } from "@/lib/task-center";

export default async function Page() {
  const { user, workspace } = await getWorkspaceContext("SUPERVISOR");
  const [initialActiveTasks, initialCompletedTasks] = user.id
    ? await Promise.all([
        getTodayWorkQueue({ id: user.id, role: "SUPERVISOR", name: user.name }),
        getCompletedWorkItems({ id: user.id, role: "SUPERVISOR", name: user.name }),
      ])
    : [undefined, undefined];
  return <AppShell role="SUPERVISOR" user={user} unreadCount={workspace.unreadCount} followUpCount={workspace.followUpSummary.actionable} sidebarCounts={workspace.sidebarCounts}><TasksPage role="SUPERVISOR" workspace={workspace} initialActiveTasks={initialActiveTasks} initialCompletedTasks={initialCompletedTasks} /></AppShell>;
}

