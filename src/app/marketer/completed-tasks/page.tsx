import { AppShell } from "@/components/app/app-shell";
import { CompletedTasksPage } from "@/components/crm/resource-pages";
import { getWorkspaceContext } from "@/lib/page-context";
import { getCompletedWorkItems } from "@/lib/task-center";

export default async function Page() {
  const { user, workspace } = await getWorkspaceContext("MARKETER");
  const initialCompletedTasks = user.id
    ? await getCompletedWorkItems({ id: user.id, role: "MARKETER", name: user.name })
    : undefined;

  return (
    <AppShell
      role="MARKETER"
      user={user}
      unreadCount={workspace.unreadCount}
      followUpCount={workspace.followUpSummary.actionable}
      sidebarCounts={workspace.sidebarCounts}
    >
      <CompletedTasksPage role="MARKETER" workspace={workspace} initialCompletedTasks={initialCompletedTasks} />
    </AppShell>
  );
}
