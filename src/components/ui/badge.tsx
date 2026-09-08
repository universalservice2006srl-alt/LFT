import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-navy/8 text-navy border-navy/10",
        navy: "bg-navy text-cream border-navy",
        blue: "bg-blue/10 text-blue border-blue/25",
        green: "bg-green/15 text-green-deep border-green/30",
        yellow: "bg-yellow/30 text-[#8a6210] border-yellow/70",
        amber: "bg-[#e8935e]/15 text-[#a95a1d] border-[#e8935e]/40",
        red: "bg-red/10 text-red border-red/30",
        purple: "bg-purple/10 text-purple border-purple/25",
        cyan: "bg-cyan/15 text-[#047795] border-cyan/35",
        outline: "text-ink-soft border-navy/15",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
