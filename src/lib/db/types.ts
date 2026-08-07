export const articleStatuses = [
  "local",
  "modified",
  "draft",
  "publishing",
  "published",
  "failed",
] as const;

export type ArticleStatus = (typeof articleStatuses)[number];

export type Article = {
  id: string;
  title: string;
  digest: string;
  content: string;
  status: ArticleStatus;
  coverPath: string | null;
  wechatDraftMediaId: string | null;
  publishId: string | null;
  articleId: string | null;
  articleUrl: string | null;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt: string | null;
  publishedAt: string | null;
};

export type ArticleAsset = {
  id: string;
  articleId: string;
  kind: "cover" | "inline";
  localPath: string;
  fileHash: string | null;
  wechatMediaId: string | null;
  wechatUrl: string | null;
  createdAt: string;
};

export type PublishJob = {
  id: string;
  articleId: string;
  articleTitle: string;
  publishId: string | null;
  status: "queued" | "processing" | "published" | "failed" | "unknown";
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export type OperationLog = {
  id: number;
  action: string;
  targetType: string;
  targetId: string | null;
  status: "success" | "failed" | "info";
  resultSummary: string;
  createdAt: string;
};

export type DashboardStats = {
  local: number;
  draft: number;
  pending: number;
  published: number;
};
