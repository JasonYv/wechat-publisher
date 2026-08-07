"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/session";
import { saveArticle } from "@/lib/db";
import { isWechatTitleLengthValid } from "@/lib/wechat/limits";

const articleSchema = z.object({
  id: z.string().optional(),
  title: z
    .string()
    .trim()
    .min(4, "标题至少需要 4 个字符")
    .max(64, "标题过长")
    .refine(isWechatTitleLengthValid, "微信标题不能超过 32 字（ASCII 字符按半字计）"),
  digest: z.string().trim().max(120, "微信摘要不能超过 120 个字符"),
  content: z.string().trim().min(20, "正文至少需要 20 个字符"),
});

export type ArticleActionState = {
  error: string;
};

export async function saveArticleAction(
  _state: ArticleActionState,
  formData: FormData,
): Promise<ArticleActionState> {
  await requireAdminSession();
  const parsed = articleSchema.safeParse({
    id: String(formData.get("id") || "") || undefined,
    title: formData.get("title"),
    digest: formData.get("digest"),
    content: formData.get("content"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "文章内容不完整" };
  }

  const id = saveArticle(parsed.data);
  revalidatePath("/");
  revalidatePath("/articles");
  revalidatePath(`/articles/${id}`);
  redirect(`/articles/${id}?saved=1`);
}
