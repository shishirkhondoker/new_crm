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
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.18, ease: "easeOut" }} className="h-full">
      <Card className={cn("flex h-full flex-col overflow-hidden", className)}>
        <CardHeader className="flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <CardTitle>{title}</CardTitle>
          {action}
        </CardHeader>
        <CardContent className="flex-1">{children}</CardContent>
      </Card>
    </motion.div>
  );
}
