import { ArticleEditor } from "@/components/article-editor";
import { PageHeader } from "@/components/page-header";
import { getBranding } from "@/lib/branding";

export const metadata = { title: "新建文章" };

export default function NewArticlePage() {
  const { accountName } = getBranding();
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="New article"
        title="写一篇新文章"
        description="先保存为本地稿。同步微信草稿和正式发表是两个独立动作。"
      />
      <ArticleEditor accountName={accountName} />
    </div>
  );
}
