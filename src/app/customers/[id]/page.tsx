import { AppShell } from "@/components/app/app-shell";
import { CustomerProfilePage } from "@/components/crm/resource-pages";
import { getCustomerDetail } from "@/lib/crm-data";
import { getWorkspaceContext } from "@/lib/page-context";
import { getCurrentRole } from "@/lib/server-role";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, rawSearchParams, role] = await Promise.all([params, searchParams, getCurrentRole()]);
  const { user, workspace } = await getWorkspaceContext(role);
  const detail = await getCustomerDetail(id, role, user);
  const backHrefRaw = rawSearchParams.returnTo;
  const backHref = Array.isArray(backHrefRaw) ? backHrefRaw[0] : backHrefRaw;

  return <AppShell role={role} user={user} unreadCount={workspace.unreadCount} followUpCount={workspace.followUpSummary.actionable} sidebarCounts={workspace.sidebarCounts}><CustomerProfilePage role={role} workspace={detail.workspace} customer={detail.customer} history={detail.history} journey={detail.journey} backHref={typeof backHref === "string" && backHref.trim() ? backHref : undefined} /></AppShell>;
}

