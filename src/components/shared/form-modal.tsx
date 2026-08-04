"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

export function FormModal({
  open,
  title,
  children,
  onClose,
  panelClassName,
  contentClassName,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  panelClassName?: string;
  contentClassName?: string;
}) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal((
    <AnimatePresence>
      {open && (
        <motion.div
          key="form-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-3 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn("flex max-h-[calc(100vh-1.5rem)] w-[95vw] max-w-[600px] min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100vh-3rem)]", panelClassName)}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-5">
              <h2 className="text-lg font-black text-slate-950">{title}</h2>
              <Button variant="ghost" size="icon" onClick={onClose} type="button" aria-label="Close modal">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className={cn("min-h-0 flex-1 overflow-y-auto p-5", contentClassName)}>{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  ), document.body);
}
