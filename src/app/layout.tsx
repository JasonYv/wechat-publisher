import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";
import { getBranding } from "@/lib/branding";

export function generateMetadata(): Metadata {
  const { appName } = getBranding();
  return {
    title: { default: appName, template: `%s · ${appName}` },
    description: "可自托管的微信公众号内容、草稿、菜单与发布管理工具。",
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="min-h-full antialiased">
        <TooltipProvider>
          {children}
          <Toaster richColors position="top-center" />
        </TooltipProvider>
      </body>
    </html>
  );
}
