import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  FilePenLine,
  MessageSquareText,
  Plus,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PublishRail } from "@/components/publish-rail";
import { StatusBadge } from "@/components/status-badge";
import { WechatConnectionCard } from "@/components/wechat-connection-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDashboardStats, listArticles, listOperationLogs } from "@/lib/db";
import { getBranding } from "@/lib/branding";

const formatter = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Shanghai",
});

export default function DashboardPage() {
  const [stats, articles, logs] = [getDashboardStats(), listArticles(5), listOperationLogs(4)];
  const configured = Boolean(process.env.WECHAT_APP_ID && process.env.WECHAT_APP_SECRET);
  const { accountName } = getBranding();

  const cards = [
    { label: "本地稿", value: stats.local, icon: FilePenLine, note: "可以继续编辑" },
    { label: "微信草稿", value: stats.draft, icon: MessageSquareText, note: "已同步到后台" },
    { label: "待处理", value: stats.pending, icon: AlertCircle, note: "发表中或失败" },
    { label: "已发表", value: stats.published, icon: CheckCircle2, note: "已有发布回执" },
  ];

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Editorial desk"
        title="今天要把什么发出去？"
        description="先把内容写清楚，再沿着固定轨道同步草稿、人工确认并保存发表结果。"
        actions={
          <Button asChild>
            <Link href="/articles/new">
              <Plus className="h-4 w-4" />
              新建文章
            </Link>
          </Button>
        }
      />

      <PublishRail />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="editorial-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                    <p className="mt-2 font-mono text-3xl font-semibold tracking-[-0.06em]">{card.value}</p>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">{card.note}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,0.55fr)]">
        <Card className="editorial-shadow overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h2 className="text-base font-semibold">最近文章</h2>
              <p className="mt-1 text-xs text-muted-foreground">按最后修改时间排序</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/articles">
                查看全部
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>文章</TableHead>
                <TableHead className="w-28">状态</TableHead>
                <TableHead className="hidden w-32 sm:table-cell">更新时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {articles.map((article) => (
                <TableRow key={article.id}>
                  <TableCell>
                    <Link href={`/articles/${article.id}`} className="font-medium hover:text-primary">
                      {article.title}
                    </Link>
                    <p className="mt-1 line-clamp-1 max-w-2xl text-xs text-muted-foreground">{article.digest}</p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={article.status} />
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">
                    {formatter.format(new Date(article.updatedAt))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        <WechatConnectionCard initialConfigured={configured} initialAccountName={accountName} />
      </section>

      <Card className="editorial-shadow overflow-hidden">
        <div className="border-b px-5 py-4">
          <h2 className="text-base font-semibold">最近操作</h2>
          <p className="mt-1 text-xs text-muted-foreground">这里只记录结果摘要，不保存微信密钥和 Token</p>
        </div>
        <div className="divide-y">
          {logs.map((log) => (
            <div key={log.id} className="flex items-center gap-4 px-5 py-3.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  log.status === "failed" ? "bg-red-500" : log.status === "success" ? "bg-emerald-500" : "bg-slate-400"
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{log.resultSummary}</p>
                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{log.action}</p>
              </div>
              <time className="shrink-0 font-mono text-[11px] text-muted-foreground">
                {formatter.format(new Date(log.createdAt))}
              </time>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
