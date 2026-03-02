import { redirect } from "next/navigation";

import { Sidebar } from "@/components/layout/sidebar";
import { requireAccount } from "@/lib/auth";
import { getSidebarTabsForRole } from "@/lib/rbac";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const account = await requireAccount();
  if (account.forcePasswordChange) {
    redirect("/force-password");
  }

  const tabs = await getSidebarTabsForRole(account.roleId);

  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[18rem_1fr]">
      <Sidebar
        fullName={account.employee.fullName}
        roleName={account.role.name}
        tabs={tabs}
      />
      <main className="p-4 lg:p-6">{children}</main>
    </div>
  );
}
