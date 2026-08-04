import { AppShell } from "@/components/app/app-shell";
import { TasksPage } from "@/components/crm/resource-pages";
import { getWorkspaceContext } from "@/lib/page-context";
import { getCompletedWorkItems, getTodayWorkQueue } from "@/lib/task-center";

export default async function Page() {
  const { user, workspace } = await getWorkspaceContext("ADMIN");
  const [initialActiveTasks, initialCompletedTasks] = user.id
    ? await Promise.all([
        getTodayWorkQueue({ id: user.id, role: "ADMIN", name: user.name }),
        getCompletedWorkItems({ id: user.id, role: "ADMIN", name: user.name }),
      ])
    : [undefined, undefined];
  return <AppShell role="ADMIN" user={user} unreadCount={workspace.unreadCount} followUpCount={workspace.followUpSummary.actionable} sidebarCounts={workspace.sidebarCounts}><TasksPage role="ADMIN" workspace={workspace} initialActiveTasks={initialActiveTasks} initialCompletedTasks={initialCompletedTasks} /></AppShell>;
}

