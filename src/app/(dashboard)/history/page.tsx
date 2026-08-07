import Link from "next/link";
import { Clock3, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getArticle, listPublishJobs } from "@/lib/db";

const formatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Asia/Shanghai",
});

const labels = {
  queued: "排队中",
  processing: "处理中",
  published: "已发表",
  failed: "失败",
  unknown: "需人工核对",
};

export const metadata = { title: "发布记录" };

export default function HistoryPage() {
  const jobs = listPublishJobs();
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Publish receipts"
        title="发布记录"
        description="每次正式发表都保存 publish_id、起止时间和微信回执，方便追溯失败原因。"
      />
      <Card className="editorial-shadow overflow-hidden">
        {jobs.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>文章</TableHead>
                <TableHead className="w-28">状态</TableHead>
                <TableHead className="hidden w-48 lg:table-cell">开始时间</TableHead>
                <TableHead className="hidden w-48 xl:table-cell">publish_id</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => {
                const article = getArticle(job.articleId);
                return (
                  <TableRow key={job.id}>
                    <TableCell className="py-4">
                      <Link href={`/articles/${job.articleId}`} className="font-medium hover:text-primary">
                        {job.articleTitle}
                      </Link>
                      {job.error ? <p className="mt-1 text-xs text-red-700">{job.error}</p> : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{labels[job.status]}</Badge>
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">
                      {formatter.format(new Date(job.startedAt))}
                    </TableCell>
                    <TableCell className="hidden truncate font-mono text-[10px] text-muted-foreground xl:table-cell">
                      {job.publishId || "—"}
                    </TableCell>
                    <TableCell>
                      {article?.articleUrl ? (
                        <Button asChild variant="ghost" size="icon">
                          <a href={article.articleUrl} target="_blank" rel="noreferrer" aria-label="查看文章">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      ) : (
                        <Button asChild variant="ghost" size="sm"><Link href={`/articles/${job.articleId}`}>查看</Link></Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-primary">
              <Clock3 className="h-5 w-5" />
            </div>
            <h2 className="mt-4 font-semibold">还没有发布任务</h2>
            <p className="mt-2 text-sm text-muted-foreground">当你确认发表第一篇文章后，这里会保存回执。</p>
          </div>
        )}
      </Card>
    </div>
  );
}
