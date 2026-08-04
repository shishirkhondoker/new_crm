import { AppShell } from "@/components/app/app-shell";
import { TeamPage } from "@/components/crm/resource-pages";
import { getWorkspaceContext } from "@/lib/page-context";

export default async function Page() {
  const { user, workspace } = await getWorkspaceContext("SUPERVISOR");
  return <AppShell role="SUPERVISOR" user={user} unreadCount={workspace.unreadCount} followUpCount={workspace.followUpSummary.actionable} sidebarCounts={workspace.sidebarCounts}><TeamPage role="SUPERVISOR" workspace={workspace} currentUserId={user.id} /></AppShell>;
}

