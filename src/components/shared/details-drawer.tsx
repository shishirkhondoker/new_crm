"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DetailsDrawer({
  open,
  title,
  children,
  onClose,
  variant = "drawer",
  panelClassName = "",
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  variant?: "drawer" | "modal";
  panelClassName?: string;
}) {
  if (!open) return null;

  const isModal = variant === "modal";

  return (
    <div
      className={`fixed inset-0 z-50 flex bg-slate-950/40 ${isModal ? "items-center justify-center p-4" : "justify-end"}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <aside
        className={[
          "w-full overflow-y-auto bg-white p-5 shadow-2xl",
          isModal ? "max-h-[90vh] max-w-4xl rounded-[28px]" : "h-full max-w-md",
          panelClassName,
        ].filter(Boolean).join(" ")}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-950">{title}</h2>
          <Button variant="ghost" size="icon" type="button" onClick={onClose} aria-label="Close drawer">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-5">{children}</div>
      </aside>
    </div>
  );
}
