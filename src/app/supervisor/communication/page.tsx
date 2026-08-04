import { AppShell } from "@/components/app/app-shell";
import { CommunicationPage } from "@/components/crm/resource-pages";
import { getWorkspaceContext } from "@/lib/page-context";

function readSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const { user, workspace } = await getWorkspaceContext("SUPERVISOR");
  return (
    <AppShell role="SUPERVISOR" user={user} unreadCount={workspace.unreadCount} followUpCount={workspace.followUpSummary.actionable} sidebarCounts={workspace.sidebarCounts}>
      <CommunicationPage
        key={`${readSearchValue(params.activity)}|${readSearchValue(params.customer)}`}
        workspace={workspace}
        initialActivityQuery={readSearchValue(params.activity)}
        initialCustomerQuery={readSearchValue(params.customer)}
      />
    </AppShell>
  );
}

