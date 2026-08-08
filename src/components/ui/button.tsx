import * as React from "react";
import { motion } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(37,99,235,0.22)] hover:bg-blue-700 hover:shadow-[0_14px_30px_rgba(37,99,235,0.28)]",
        secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:shadow-sm",
        outline: "border border-border bg-white text-slate-700 shadow-sm hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md",
        ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
        destructive: "bg-destructive text-destructive-foreground shadow-[0_10px_24px_rgba(239,68,68,0.2)] hover:bg-red-700 hover:shadow-[0_14px_30px_rgba(239,68,68,0.25)]",
      },
      size: {
        sm: "h-10 px-3.5",
        md: "h-10 px-4",
        lg: "h-11 px-5",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, disabled, ...props },
  ref,
) {
  return (
    <motion.span
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.14, ease: "easeOut" }}
      className="inline-flex"
    >
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled}
        {...props}
      />
    </motion.span>
  );
});
