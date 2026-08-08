import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  title,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <Card className="p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-500">{title}</p>
          <p className="mt-1.5 text-[1.65rem] font-black tracking-normal text-slate-950 sm:mt-2 sm:text-2xl">{value}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{helper}</p>
        </div>
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10", tone)}>
          <Icon className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
        </div>
      </div>
    </Card>
  );
}

export function DashboardMetricCard({
  title,
  value,
  helper,
  icon: Icon,
  tone,
  iconTone,
  className,
  href,
  tooltip,
}: {
  title: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone: string;
  iconTone?: string;
  className?: string;
  href?: string;
  tooltip?: string;
}) {
  const content = (
    <Card
      className={cn(
        "group relative h-full overflow-hidden rounded-[22px] border border-white/20 p-0 shadow-[0_18px_40px_rgba(15,23,42,0.12)] transition-all duration-300",
        href ? "cursor-pointer hover:-translate-y-1 hover:scale-[1.01] hover:shadow-[0_26px_54px_rgba(15,23,42,0.18)]" : "",
        className,
      )}
      style={{ background: tone }}
      title={tooltip ?? helper}
    >
      <div className="relative flex h-full min-h-[92px] flex-col justify-between p-3 text-white sm:min-h-[98px] sm:p-3.5">
        <div className="flex items-start justify-between gap-3">
          <p className="max-w-[12rem] text-[9px] font-black uppercase tracking-[0.12em] text-white/90 sm:text-[10px]">{title}</p>
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/15 text-white shadow-sm backdrop-blur-sm sm:h-9 sm:w-9", iconTone)}>
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
        </div>

        <div className="mt-1.5">
          <p className="text-[1.45rem] font-black leading-none tracking-[-0.04em] text-white sm:text-[1.65rem]">{value}</p>
          <p className="mt-1 line-clamp-1 text-[10px] font-medium leading-4 text-white/88 sm:text-[11px]">{helper}</p>
          {href ? (
            <p className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.1em] text-white/92 transition group-hover:text-white sm:text-[10px]">
              View Details
            </p>
          ) : null}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/10 to-transparent" />
    </Card>
  );

  if (!href) return content;

  return (
    <Link href={href} className="block h-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-[22px]">
      {content}
    </Link>
  );
}
