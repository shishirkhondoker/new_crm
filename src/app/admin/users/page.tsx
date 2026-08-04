import { AppShell } from "@/components/app/app-shell";
import { UsersPage } from "@/components/crm/resource-pages";
import { getWorkspaceContext } from "@/lib/page-context";

export default async function Page() {
  const { user, workspace } = await getWorkspaceContext("ADMIN");
  return <AppShell role="ADMIN" user={user} unreadCount={workspace.unreadCount} followUpCount={workspace.followUpSummary.actionable} sidebarCounts={workspace.sidebarCounts}><UsersPage workspace={workspace} currentUserId={user.id} /></AppShell>;
}

