import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { ArticleEditor } from "@/components/article-editor";
import { ArticleDeliveryPanel } from "@/components/article-delivery-panel";
import { PageHeader } from "@/components/page-header";
import { PublishRail } from "@/components/publish-rail";
import { StatusBadge } from "@/components/status-badge";
import { getArticle } from "@/lib/db";
import { getBranding } from "@/lib/branding";

export default async function EditArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const article = getArticle(id);
  if (!article) notFound();
  const { accountName } = getBranding();

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Article workspace"
        title="编辑文章"
        description="右侧预览只渲染安全 Markdown；最终微信 HTML 会在同步草稿时生成。"
        actions={<StatusBadge status={article.status} />}
      />
      {query.saved === "1" ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          本地稿已保存，尚未同步到微信。
        </div>
      ) : null}
      <PublishRail status={article.status} />
      <ArticleEditor article={article} accountName={accountName} />
      <ArticleDeliveryPanel
        article={article}
        accountName={accountName}
        wechatConfigured={Boolean(process.env.WECHAT_APP_ID && process.env.WECHAT_APP_SECRET)}
      />
    </div>
  );
}
