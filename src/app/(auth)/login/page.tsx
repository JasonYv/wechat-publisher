import { redirect } from "next/navigation";
import { ArrowRight, BookOpenText, Server, ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { hasAdminSession, isAuthConfigured } from "@/lib/auth/session";
import { getBranding } from "@/lib/branding";

export const metadata = {
  title: "登录",
};

export default async function LoginPage() {
  if (await hasAdminSession()) redirect("/");
  const configured = isAuthConfigured();
  const branding = getBranding();

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,rgba(49,151,119,0.16),transparent_32%),radial-gradient(circle_at_85%_78%,rgba(220,177,73,0.12),transparent_28%)]" />
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border bg-card editorial-shadow lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative hidden min-h-[620px] flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
          <div className="absolute -right-24 -top-20 h-64 w-64 rounded-full border border-sidebar-border" />
          <div className="absolute -right-12 -top-8 h-40 w-40 rounded-full border border-sidebar-border" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
              <BookOpenText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">{branding.appName}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/55">
                {branding.appSubtitle}
              </p>
            </div>
          </div>
          <div className="relative max-w-md">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-sidebar-primary">
              One clear workflow
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.18] tracking-[-0.04em]">
              从写完一篇文章，
              <br />
              到安全地发出去。
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-7 text-sidebar-foreground/65">
              文章、图片、微信草稿、菜单和发布回执集中在一处。每次发表都经过人工确认。
            </p>
          </div>
          <div className="relative grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/35 p-4">
              <Server className="mb-3 h-4 w-4 text-sidebar-primary" />
              固定服务器出口 IP
            </div>
            <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/35 p-4">
              <ShieldCheck className="mb-3 h-4 w-4 text-sidebar-primary" />
              密钥仅服务端可见
            </div>
          </div>
        </section>

        <section className="flex min-h-[560px] items-center justify-center p-6 sm:p-10 lg:min-h-[620px]">
          <Card className="w-full max-w-sm border-0 bg-transparent shadow-none">
            <CardHeader className="px-0 pb-8">
              <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground lg:hidden">
                <BookOpenText className="h-5 w-5" />
              </div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
                Internal only
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">欢迎回来</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                登录后继续管理“{branding.accountName}”的公众号内容。
              </p>
            </CardHeader>
            <CardContent className="px-0">
              <LoginForm configured={configured} />
              <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
                <ArrowRight className="h-3.5 w-3.5 text-primary" />
                登录状态最多保留 12 小时
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
