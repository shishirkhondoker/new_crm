import { AppShell } from "@/components/app/app-shell";
import { SettingsPage } from "@/components/crm/resource-pages";
import { getCrmSettings } from "@/lib/crm-settings";
import { getWorkspaceContext } from "@/lib/page-context";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [{ user, workspace }, settings] = await Promise.all([
    getWorkspaceContext("ADMIN"),
    getCrmSettings(),
  ]);

  return <AppShell role="ADMIN" user={user} unreadCount={workspace.unreadCount} followUpCount={workspace.followUpSummary.actionable} sidebarCounts={workspace.sidebarCounts}><SettingsPage initialSettings={settings} /></AppShell>;
}

