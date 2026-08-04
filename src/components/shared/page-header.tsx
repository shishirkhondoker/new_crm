import type { ReactNode } from "react";

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="text-xs font-bold uppercase tracking-wide text-blue-600">{eyebrow}</p> : null}
        <h1 className="mt-1 text-[1.6rem] font-black tracking-normal text-slate-950 sm:text-2xl md:text-3xl">{title}</h1>
        {description ? <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end">{actions}</div> : null}
    </div>
  );
}
