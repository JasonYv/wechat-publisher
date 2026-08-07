import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 border-b border-border/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
          {eyebrow}
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          {description}
        </p>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
