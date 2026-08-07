import { Check, CircleDashed, RadioTower, Send } from "lucide-react";
import type { ArticleStatus } from "@/lib/db/types";
import { cn } from "@/lib/utils";

const steps = [
  { label: "本地稿", detail: "正在编辑", icon: CircleDashed },
  { label: "微信草稿", detail: "等待同步", icon: Send },
  { label: "确认发表", detail: "人工确认", icon: Check },
  { label: "已发表", detail: "保存回执", icon: RadioTower },
];

const statusStep: Record<ArticleStatus, number> = {
  local: 0,
  modified: 0,
  draft: 1,
  publishing: 2,
  failed: 2,
  published: 3,
};

export function PublishRail({ status }: { status?: ArticleStatus }) {
  const currentStep = status ? statusStep[status] : -1;
  return (
    <section className="editorial-shadow overflow-hidden rounded-2xl border bg-card">
      <div className="border-b bg-[linear-gradient(90deg,rgba(14,111,87,0.08),transparent_70%)] px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
              Publish rail
            </p>
            <h2 className="mt-1 text-base font-semibold">每篇内容都沿同一条轨道前进</h2>
          </div>
          <span className="hidden rounded-full border bg-background px-3 py-1 font-mono text-[11px] text-muted-foreground sm:inline-flex">
            人工确认后才发表
          </span>
        </div>
      </div>
      <div className="grid gap-0 sm:grid-cols-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div
              key={step.label}
              className={cn(
                "relative flex items-center gap-3 border-b px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0",
                currentStep === index && "bg-primary/[0.06]",
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-secondary text-primary",
                  currentStep > index && "border-primary bg-primary text-primary-foreground",
                  currentStep === index && "border-primary ring-4 ring-primary/10",
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">{step.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{step.detail}</p>
              </div>
              <span className="absolute right-3 top-3 font-mono text-[10px] text-muted-foreground/50">
                0{index + 1}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
