import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-xl border-2 border-navy/10 bg-white/80 px-3.5 text-sm text-navy placeholder:text-ink-soft/50 transition-colors",
        "focus-visible:outline-none focus-visible:border-blue focus-visible:ring-4 focus-visible:ring-blue/10",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
