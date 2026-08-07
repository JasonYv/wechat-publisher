import { Badge } from "@/components/ui/badge";
import type { ArticleStatus } from "@/lib/db/types";

const statusConfig: Record<
  ArticleStatus,
  { label: string; className: string }
> = {
  local: {
    label: "本地稿",
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
  modified: {
    label: "本地有修改",
    className: "border-sky-200 bg-sky-50 text-sky-800",
  },
  draft: {
    label: "微信草稿",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  publishing: {
    label: "发表中",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  published: {
    label: "已发表",
    className: "border-teal-200 bg-teal-50 text-teal-800",
  },
  failed: {
    label: "需处理",
    className: "border-red-200 bg-red-50 text-red-800",
  },
};

export function StatusBadge({ status }: { status: ArticleStatus }) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
