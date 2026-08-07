"use client";

import { useState } from "react";
import { CheckCircle2, LoaderCircle, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ConnectionState = {
  configured: boolean;
  connected: boolean;
  accountName: string;
  message: string;
};

export function WechatConnectionCard({
  initialConfigured,
  initialAccountName,
}: {
  initialConfigured: boolean;
  initialAccountName: string;
}) {
  const [state, setState] = useState<ConnectionState>({
    configured: initialConfigured,
    connected: false,
    accountName: initialAccountName,
    message: initialConfigured ? "已配置，尚未检测" : "尚未配置 AppID / AppSecret",
  });
  const [checking, setChecking] = useState(false);

  async function checkConnection() {
    setChecking(true);
    try {
      const response = await fetch(`/api/wechat/status?t=${Date.now()}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as ConnectionState & { message?: string };
      if (!response.ok) throw new Error(result.message || "状态接口请求失败");
      setState(result);
    } catch (error) {
      setState((current) => ({
        ...current,
        connected: false,
        message: error instanceof Error ? error.message : "无法连接服务器状态接口",
      }));
    } finally {
      setChecking(false);
    }
  }

  return (
    <Card className="editorial-shadow h-full">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">公众号连接</CardTitle>
            <CardDescription className="mt-1.5">密钥只在服务器内部使用</CardDescription>
          </div>
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              state.connected ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {state.connected ? <CheckCircle2 className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border bg-muted/45 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">账号</span>
            <span className="text-sm font-semibold">{state.accountName}</span>
          </div>
          <div className="mt-3 flex items-start justify-between gap-3 border-t pt-3">
            <span className="text-sm text-muted-foreground">状态</span>
            <span className="max-w-[70%] text-right text-sm leading-5">{state.message}</span>
          </div>
        </div>
        <Button variant="outline" className="w-full" onClick={checkConnection} disabled={checking}>
          {checking ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {checking ? "正在检测" : "检测连接"}
        </Button>
      </CardContent>
    </Card>
  );
}
