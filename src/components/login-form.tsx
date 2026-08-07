"use client";

import { useActionState } from "react";
import { LoaderCircle, LockKeyhole } from "lucide-react";
import { loginAction, type LoginState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginState = { error: "" };

export function LoginForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="password">管理密码</Label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="输入服务器配置的管理密码"
            className="h-11 pl-10"
            disabled={!configured || pending}
            required
          />
        </div>
      </div>
      {state.error ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {!configured ? (
        <p className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
          尚未配置登录参数。复制 <code className="font-mono">.env.example</code> 为
          <code className="font-mono"> .env.local</code> 后填写管理密码与会话密钥。
        </p>
      ) : null}
      <Button type="submit" className="h-11 w-full" disabled={!configured || pending}>
        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
        {pending ? "正在验证" : "进入内容台"}
      </Button>
    </form>
  );
}
