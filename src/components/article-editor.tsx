"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Eye, FileImage, FileText, LoaderCircle, Save, Send } from "lucide-react";
import {
  saveArticleAction,
  type ArticleActionState,
} from "@/app/actions/articles";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Article } from "@/lib/db/types";
import { wechatTextUnits } from "@/lib/wechat/limits";

const initialState: ArticleActionState = { error: "" };

const emptyContent = `# 在这里写文章标题

用一段具体的话说明发生了什么，以及读者为什么应该继续往下看。

## 第一个小标题

正文从一个真实问题开始。`;

export function ArticleEditor({ article, accountName }: { article?: Article; accountName: string }) {
  const [state, action, pending] = useActionState(saveArticleAction, initialState);
  const [title, setTitle] = useState(article?.title || "");
  const [digest, setDigest] = useState(article?.digest || "");
  const [content, setContent] = useState(article?.content || emptyContent);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const charCount = useMemo(() => content.replace(/\s/g, "").length, [content]);
  const titleUnits = useMemo(() => wechatTextUnits(title), [title]);

  async function uploadInlineImage(file: File) {
    if (!article?.id) return;
    setImageUploading(true);
    setImageError("");
    try {
      const formData = new FormData();
      formData.append("image", file);
      const response = await fetch(`/api/articles/${article.id}/images?t=${Date.now()}`, {
        method: "POST",
        body: formData,
        cache: "no-store",
      });
      const result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "正文图片上传失败");
      setContent((current) => `${current.trimEnd()}\n\n![正文图片](${result.url})\n\n`);
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "正文图片上传失败");
    } finally {
      setImageUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  return (
    <form action={action} className="space-y-5">
      {article?.id ? <input type="hidden" name="id" value={article.id} /> : null}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.04fr)_minmax(390px,0.96fr)]">
        <Card className="editorial-shadow overflow-hidden">
          <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">文章内容</span>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">{charCount} 字</span>
          </div>
          <div className="space-y-5 p-4 sm:p-5">
            <div className="space-y-2">
              <Label htmlFor="title">标题</Label>
              <Input
                id="title"
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="写一个准确、具体的标题"
                className="h-11 text-base font-medium"
                maxLength={64}
                required
              />
              <p className={`text-xs ${titleUnits > 32 ? "text-destructive" : "text-muted-foreground"}`}>
                {titleUnits}/32 字（英文与数字按半字计）
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="digest">摘要</Label>
              <Textarea
                id="digest"
                name="digest"
                value={digest}
                onChange={(event) => setDigest(event.target.value)}
                placeholder="在文章列表和分享卡片中说明核心内容"
                className="field-sizing-fixed min-h-20 min-w-0 resize-none"
                maxLength={120}
              />
              <p className="text-xs text-muted-foreground">{digest.length}/120</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="content">Markdown 正文</Label>
                <div className="flex items-center gap-2">
                  {article?.id ? (
                    <>
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/jpeg,image/png"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void uploadInlineImage(file);
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={imageUploading}
                        onClick={() => imageInputRef.current?.click()}
                      >
                        {imageUploading ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileImage className="h-4 w-4" />
                        )}
                        插入图片
                      </Button>
                    </>
                  ) : null}
                  <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:inline">
                    Local source
                  </span>
                </div>
              </div>
              {imageError ? <p className="text-xs text-destructive">{imageError}</p> : null}
              <Textarea
                id="content"
                name="content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                className="field-sizing-fixed min-h-[560px] min-w-0 resize-y font-mono text-[13px] leading-6"
                spellCheck={false}
                required
              />
            </div>
          </div>
        </Card>

        <div className="xl:sticky xl:top-6 xl:self-start">
          <Tabs defaultValue="preview" className="gap-3">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="preview">
                <Eye className="h-4 w-4" />
                微信预览
              </TabsTrigger>
              <TabsTrigger value="meta">
                <Send className="h-4 w-4" />
                发表检查
              </TabsTrigger>
            </TabsList>
            <TabsContent value="preview">
              <Card className="editorial-shadow overflow-hidden bg-[#edf0f2] p-3 sm:p-5">
                <div className="mx-auto max-w-[520px] overflow-hidden rounded-[22px] border border-black/8 bg-white shadow-[0_24px_70px_-38px_rgba(0,0,0,0.5)]">
                  <div className="flex items-center justify-between border-b bg-white px-5 py-3">
                    <span className="text-xs font-medium text-[#57616a]">{accountName}</span>
                    <span className="font-mono text-[10px] text-[#9aa2a8]">公众号预览</span>
                  </div>
                  <article className="wechat-prose min-h-[620px] px-6 py-7 sm:px-8">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                  </article>
                </div>
              </Card>
            </TabsContent>
            <TabsContent value="meta">
              <Card className="editorial-shadow p-5">
                <h3 className="font-semibold">保存前检查</h3>
                <div className="mt-5 space-y-3 text-sm">
                  {[
                    ["标题", title.trim().length >= 4, title.trim() || "尚未填写"],
                    ["摘要", digest.trim().length > 0, digest.trim() || "建议填写摘要"],
                    ["正文", charCount >= 20, `${charCount} 字`],
                    ["封面", Boolean(article?.coverPath), article?.coverPath || "尚未选择"],
                  ].map(([label, pass, detail]) => (
                    <div key={String(label)} className="flex items-start justify-between gap-4 border-b pb-3 last:border-b-0">
                      <span className="font-medium">{String(label)}</span>
                      <span className={`max-w-[70%] text-right ${pass ? "text-emerald-700" : "text-muted-foreground"}`}>
                        {String(detail)}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-5 rounded-xl bg-muted px-4 py-3 text-xs leading-5 text-muted-foreground">
                  保存只更新本地稿，不会自动同步到微信，也不会发表。
                </p>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border bg-card/95 p-3 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="px-2 text-sm text-muted-foreground">
          {state.error ? <span className="text-destructive">{state.error}</span> : "本地保存后再同步到微信草稿。"}
        </div>
        <Button type="submit" disabled={pending} className="sm:min-w-32">
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {pending ? "正在保存" : "保存本地稿"}
        </Button>
      </div>
    </form>
  );
}
