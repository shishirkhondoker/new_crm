import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function DashboardCard({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div whileHover={{ y: -2, scale: 1.002 }} transition={{ duration: 0.22, ease: "easeOut" }} className="h-full">
      <Card className={cn("flex h-full flex-col overflow-hidden rounded-[20px] border border-slate-200/80 bg-white shadow-[0_16px_42px_rgba(15,23,42,0.06)]", className)}>
        <CardHeader className="flex-col items-start justify-between gap-4 px-5 py-5 sm:flex-row sm:items-center">
          <CardTitle className="text-[24px] font-bold leading-tight tracking-[-0.03em] text-slate-950">{title}</CardTitle>
          {action}
        </CardHeader>
        <CardContent className="flex-1 px-5 pb-5">{children}</CardContent>
      </Card>
    </motion.div>
  );
}
