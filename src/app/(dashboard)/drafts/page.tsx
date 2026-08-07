import Link from "next/link";
import { FilePenLine, MessageSquareText } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listArticles } from "@/lib/db";

const formatter = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Shanghai",
});

export const metadata = { title: "微信草稿" };

export default function DraftsPage() {
  const drafts = listArticles().filter((article) => article.wechatDraftMediaId && article.status !== "published");
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Wechat drafts"
        title="微信草稿"
        description="这里展示由本系统同步过的草稿。“本地有修改”意味着微信端还不是最新版本。"
      />
      <Card className="editorial-shadow overflow-hidden">
        {drafts.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>文章</TableHead>
                <TableHead className="w-28">状态</TableHead>
                <TableHead className="hidden w-40 md:table-cell">最后同步</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {drafts.map((article) => (
                <TableRow key={article.id}>
                  <TableCell className="py-4">
                    <p className="font-medium">{article.title}</p>
                    <p className="mt-1 max-w-3xl truncate font-mono text-[10px] text-muted-foreground">
                      {article.wechatDraftMediaId}
                    </p>
                  </TableCell>
                  <TableCell><StatusBadge status={article.status} /></TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                    {article.lastSyncedAt ? formatter.format(new Date(article.lastSyncedAt)) : "—"}
                  </TableCell>
                  <TableCell>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/articles/${article.id}`}>继续处理</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-primary">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <h2 className="mt-4 font-semibold">还没有已同步的草稿</h2>
            <p className="mt-2 text-sm text-muted-foreground">在文章编辑页上传封面后，即可同步到微信。</p>
            <Button asChild className="mt-5" variant="outline">
              <Link href="/articles"><FilePenLine className="h-4 w-4" />选择文章</Link>
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
