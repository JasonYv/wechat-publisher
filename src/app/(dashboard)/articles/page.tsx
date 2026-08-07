import Link from "next/link";
import { MoreHorizontal, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listArticles } from "@/lib/db";

const formatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Shanghai",
});

export default function ArticlesPage() {
  const articles = listArticles();
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Content library"
        title="文章"
        description="Markdown 是本地源稿。同步到微信前可以反复编辑、预览和保存版本。"
        actions={
          <Button asChild>
            <Link href="/articles/new">
              <Plus className="h-4 w-4" />
              新建文章
            </Link>
          </Button>
        }
      />
      <Card className="editorial-shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>标题与摘要</TableHead>
              <TableHead className="w-28">状态</TableHead>
              <TableHead className="hidden w-44 md:table-cell">最后修改</TableHead>
              <TableHead className="w-14" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {articles.map((article) => (
              <TableRow key={article.id}>
                <TableCell className="py-4">
                  <Link href={`/articles/${article.id}`} className="font-medium hover:text-primary">
                    {article.title}
                  </Link>
                  <p className="mt-1 line-clamp-1 max-w-3xl text-xs leading-5 text-muted-foreground">
                    {article.digest || "暂无摘要"}
                  </p>
                </TableCell>
                <TableCell>
                  <StatusBadge status={article.status} />
                </TableCell>
                <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                  {formatter.format(new Date(article.updatedAt))}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="文章操作">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/articles/${article.id}`}>编辑文章</Link>
                      </DropdownMenuItem>
                      {article.articleUrl ? (
                        <DropdownMenuItem asChild>
                          <a href={article.articleUrl} target="_blank" rel="noreferrer">
                            查看已发表文章
                          </a>
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
