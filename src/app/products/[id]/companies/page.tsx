import { AppShell } from "@/components/app/app-shell";
import { ProductCompanyDeskPage } from "@/components/crm/resource-pages";
import { getProductDetail } from "@/lib/crm-data";
import { getWorkspaceContext } from "@/lib/page-context";
import { getCurrentRole } from "@/lib/server-role";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, filters, role] = await Promise.all([params, searchParams, getCurrentRole()]);
  const { user, workspace } = await getWorkspaceContext(role);
  const detail = await getProductDetail(id, role, user, filters);

  const normalizeValue = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

  return (
    <AppShell
      role={role}
      user={user}
      unreadCount={workspace.unreadCount}
      followUpCount={workspace.followUpSummary.actionable}
      sidebarCounts={workspace.sidebarCounts}
    >
      <ProductCompanyDeskPage
        role={role}
        workspace={detail.workspace}
        product={detail.product}
        productEngagement={detail.productEngagement}
        initialQuery={{
          bucket: normalizeValue(filters.bucket) as "total" | "shortlist" | "contacted" | "not-contacted" | "rest" | undefined,
          assignedUserId: normalizeValue(filters.assignedUserId),
          search: normalizeValue(filters.search),
        }}
      />
    </AppShell>
  );
}
