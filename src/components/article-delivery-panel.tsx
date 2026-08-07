"use client";

import Image from "next/image";
import { useActionState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  ImagePlus,
  LoaderCircle,
  RefreshCw,
  Send,
  ShieldAlert,
} from "lucide-react";
import {
  publishArticleAction,
  refreshPublishStatusAction,
  resolveUnknownPublishAction,
  syncWechatDraftAction,
  uploadCoverAction,
  type DeliveryActionState,
} from "@/app/actions/delivery";
import { StatusBadge } from "@/components/status-badge";
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
import type { Article } from "@/lib/db/types";

const initialState: DeliveryActionState = { error: "", success: "" };

function ActionMessage({ state }: { state: DeliveryActionState }) {
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

export function ArticleDeliveryPanel({
  article,
  accountName,
  wechatConfigured,
}: {
  article: Article;
  accountName: string;
  wechatConfigured: boolean;
}) {
  const [coverState, coverAction, coverPending] = useActionState(uploadCoverAction, initialState);
  const [syncState, syncAction, syncPending] = useActionState(syncWechatDraftAction, initialState);
  const [publishState, publishAction, publishPending] = useActionState(
    publishArticleAction,
    initialState,
  );
  const [refreshState, refreshAction, refreshPending] = useActionState(
    refreshPublishStatusAction,
    initialState,
  );
  const [resolveState, resolveAction, resolvePending] = useActionState(
    resolveUnknownPublishAction,
    initialState,
  );
  const coverUrl = article.coverPath
    ? `/api/articles/${article.id}/cover?t=${new Date(article.updatedAt).getTime()}`
    : null;

  return (
    <Card className="editorial-shadow overflow-hidden">
      <div className="flex flex-col gap-3 border-b bg-[linear-gradient(90deg,rgba(14,111,87,0.08),transparent_72%)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
            Delivery controls
          </p>
          <h2 className="mt-1 text-base font-semibold">同步与发表</h2>
        </div>
        <StatusBadge status={article.status} />
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
        <div className="border-b p-5 lg:border-r lg:border-b-0">
          <div className="mb-4 flex items-center gap-2">
            <ImagePlus className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">文章封面</h3>
          </div>
          {coverUrl ? (
            <div className="relative aspect-[2.35/1] overflow-hidden rounded-xl border bg-muted">
              <Image src={coverUrl} alt="文章封面" fill unoptimized className="object-cover" />
            </div>
          ) : (
            <div className="flex aspect-[2.35/1] items-center justify-center rounded-xl border border-dashed bg-muted/45 text-sm text-muted-foreground">
              尚未上传封面
            </div>
          )}
          <form action={coverAction} className="mt-4 space-y-3">
            <input type="hidden" name="articleId" value={article.id} />
            <input
              type="file"
              name="cover"
              accept="image/jpeg,image/png,image/webp"
              required
              className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-xs file:font-medium file:text-secondary-foreground"
            />
            <Button type="submit" variant="outline" size="sm" disabled={coverPending}>
              {coverPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {coverUrl ? "更换封面" : "上传封面"}
            </Button>
            <p className="text-xs leading-5 text-muted-foreground">
              建议 2.35:1，系统会自动裁剪为 900×383 JPG 并压缩到微信限制内。
            </p>
            <ActionMessage state={coverState} />
          </form>
        </div>

        <div className="space-y-5 p-5">
          {!wechatConfigured ? (
            <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>服务器尚未配置公众号密钥，目前只能编辑和预览本地稿。</p>
            </div>
          ) : null}
          {article.status === "publishing" && !article.publishId ? (
            <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-semibold">提交结果不确定，系统已阻止重复发表</p>
              <p className="text-xs leading-5">请先到微信公众平台核对草稿箱与已发布记录。只有确认微信没有受理后，才可解除锁定。</p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={resolvePending}>我已确认未发表</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>已在微信后台完成核对？</AlertDialogTitle>
                    <AlertDialogDescription>
                      仅当微信草稿箱、发布中和已发布记录均没有这次任务时，才可恢复为可提交状态。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <form action={resolveAction}>
                      <input type="hidden" name="articleId" value={article.id} />
                      <AlertDialogAction type="submit">确认解除锁定</AlertDialogAction>
                    </form>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">草稿标识</p>
              <p className="mt-1 truncate font-mono text-xs font-medium">
                {article.wechatDraftMediaId ? `${article.wechatDraftMediaId.slice(0, 12)}…` : "尚未同步"}
              </p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">最后同步</p>
              <p className="mt-1 font-mono text-xs font-medium">
                {article.lastSyncedAt
                  ? new Intl.DateTimeFormat("zh-CN", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    }).format(new Date(article.lastSyncedAt))
                  : "—"}
              </p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">发表任务</p>
              <p className="mt-1 truncate font-mono text-xs font-medium">
                {article.publishId ? `${article.publishId.slice(0, 12)}…` : "—"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <form action={syncAction}>
              <input type="hidden" name="articleId" value={article.id} />
              <Button
                type="submit"
                variant="outline"
                disabled={!wechatConfigured || !article.coverPath || syncPending || article.status === "publishing"}
              >
                {syncPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {article.wechatDraftMediaId ? "重新同步草稿" : "同步到微信草稿"}
              </Button>
            </form>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={article.status !== "draft" || publishPending}>
                  {publishPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  确认发表
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确定发表这篇文章？</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <span className="block font-medium text-foreground">《{article.title}》</span>
                    <span className="block">
                      将提交到“{accountName}”公众号。提交后不能由本系统自动撤回，请先在微信草稿箱完成最终预览。
                    </span>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>再检查一下</AlertDialogCancel>
                  <form action={publishAction}>
                    <input type="hidden" name="articleId" value={article.id} />
                    <AlertDialogAction type="submit">提交发表</AlertDialogAction>
                  </form>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {article.publishId && article.status !== "published" ? (
              <form action={refreshAction}>
                <input type="hidden" name="articleId" value={article.id} />
                <Button type="submit" variant="secondary" disabled={refreshPending}>
                  {refreshPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  回查发表结果
                </Button>
              </form>
            ) : null}

            {article.status === "published" && article.articleUrl ? (
              <Button asChild variant="secondary">
                <a href={article.articleUrl} target="_blank" rel="noreferrer">
                  <CheckCircle2 className="h-4 w-4" />
                  查看已发表文章
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            ) : null}
          </div>

          <div className="space-y-2">
            <ActionMessage state={syncState} />
            <ActionMessage state={publishState} />
            <ActionMessage state={refreshState} />
            <ActionMessage state={resolveState} />
          </div>

          <p className="rounded-xl bg-muted px-4 py-3 text-xs leading-5 text-muted-foreground">
            系统不做自动发表：保存本地稿、同步微信草稿、确认发表是三个独立动作。
          </p>
        </div>
      </div>
    </Card>
  );
}
