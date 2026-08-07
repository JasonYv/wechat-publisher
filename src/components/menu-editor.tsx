"use client";

import { useActionState, useMemo, useState } from "react";
import { LoaderCircle, Save, ShieldAlert, Smartphone, UploadCloud } from "lucide-react";
import {
  saveMenuAction,
  syncMenuAction,
  type MenuActionState,
} from "@/app/actions/menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { MenuConfig } from "@/lib/menu-store";

const initialState: MenuActionState = { error: "", success: "" };

function Message({ state }: { state: MenuActionState }) {
  if (!state.error && !state.success) return null;
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        state.error
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
    >
      {state.error || state.success}
    </div>
  );
}

export function MenuEditor({
  initialMenu,
  accountName,
  wechatConfigured,
}: {
  initialMenu: MenuConfig;
  accountName: string;
  wechatConfigured: boolean;
}) {
  const [menuJson, setMenuJson] = useState(JSON.stringify(initialMenu, null, 2));
  const [activeIndex, setActiveIndex] = useState(0);
  const [saveState, saveAction, savePending] = useActionState(saveMenuAction, initialState);
  const [syncState, syncAction, syncPending] = useActionState(syncMenuAction, initialState);
  const parsed = useMemo(() => {
    try {
      return { value: JSON.parse(menuJson) as MenuConfig, error: "" };
    } catch {
      return { value: null, error: "JSON 格式不正确，预览已暂停" };
    }
  }, [menuJson]);
  const buttons = parsed.value?.button || [];
  const active = buttons[Math.min(activeIndex, Math.max(0, buttons.length - 1))];

  return (
    <div className="space-y-5">
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.12fr)_minmax(380px,0.88fr)]">
        <form action={saveAction} className="min-w-0">
          <Card className="editorial-shadow min-w-0 overflow-hidden">
            <div className="flex items-center justify-between border-b bg-muted/30 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold">菜单配置</h2>
                <p className="mt-1 text-xs text-muted-foreground">支持 view、click、miniprogram 和 article_view_limited</p>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                JSON source
              </span>
            </div>
            <div className="space-y-4 p-5">
              <Textarea
                name="menuJson"
                value={menuJson}
                onChange={(event) => setMenuJson(event.target.value)}
                spellCheck={false}
                className="field-sizing-fixed min-h-[620px] min-w-0 max-w-full resize-y font-mono text-[12px] leading-6"
              />
              {parsed.error ? <p className="text-sm text-destructive">{parsed.error}</p> : null}
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" variant="outline" disabled={savePending || Boolean(parsed.error)}>
                  {savePending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  保存本地配置
                </Button>
                <span className="text-xs text-muted-foreground">保存不会改动微信端菜单。</span>
              </div>
              <Message state={saveState} />
            </div>
          </Card>
        </form>

        <div className="min-w-0 xl:sticky xl:top-6 xl:self-start">
          <Card className="editorial-shadow overflow-hidden bg-[#e9edeb] p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#2d3b37]">
              <Smartphone className="h-4 w-4" />
              微信客户端预览
            </div>
            <div className="mx-auto flex min-h-[640px] max-w-[390px] flex-col overflow-hidden rounded-[28px] border-[7px] border-[#26312e] bg-white shadow-2xl">
              <div className="border-b px-5 py-4 text-center text-sm font-semibold">{accountName}</div>
              <div className="flex-1 bg-[#f4f5f5] p-5">
                {active?.sub_button?.length ? (
                  <div className="ml-auto mt-auto w-[62%] overflow-hidden rounded-xl border bg-white shadow-lg">
                    {active.sub_button.map((item) => (
                      <div key={item.name} className="border-b px-4 py-3 text-center text-sm last:border-b-0">
                        {item.name}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-center text-xs leading-5 text-muted-foreground">
                    {active ? `点击“${active.name}”后将直接执行 ${active.type || "菜单"}` : "尚未配置菜单"}
                  </div>
                )}
              </div>
              <div className="grid min-h-14 border-t bg-white" style={{ gridTemplateColumns: `repeat(${Math.max(buttons.length, 1)}, minmax(0, 1fr))` }}>
                {buttons.map((button, index) => (
                  <button
                    type="button"
                    key={`${button.name}-${index}`}
                    onClick={() => setActiveIndex(index)}
                    className={`border-r px-2 text-xs last:border-r-0 ${activeIndex === index ? "bg-emerald-50 font-semibold text-emerald-800" : "text-slate-700"}`}
                  >
                    {button.name}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Card className="editorial-shadow flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold">同步会完整覆盖当前默认菜单</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              系统会先读取并备份现有菜单，再发布当前配置。
            </p>
          </div>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={!wechatConfigured || Boolean(parsed.error) || syncPending}>
              {syncPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              同步到微信
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>覆盖微信当前菜单？</AlertDialogTitle>
              <AlertDialogDescription>
                系统会备份旧菜单，然后发布当前 {buttons.length} 个一级菜单。客户端可能需要几分钟才刷新。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <form action={syncAction}>
                <input type="hidden" name="menuJson" value={menuJson} />
                <AlertDialogAction type="submit">备份并覆盖</AlertDialogAction>
              </form>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
      {!wechatConfigured ? (
        <p className="text-xs text-amber-700">未配置公众号密钥，目前只能保存和预览本地配置。</p>
      ) : null}
      <Message state={syncState} />
    </div>
  );
}
