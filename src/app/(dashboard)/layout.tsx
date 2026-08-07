import { AppShell } from "@/components/app-shell";
import { requireAdminSession } from "@/lib/auth/session";
import { getBranding } from "@/lib/branding";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAdminSession();
  const branding = getBranding();
  return <AppShell {...branding}>{children}</AppShell>;
}
