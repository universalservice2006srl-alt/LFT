import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/60 focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98] cursor-pointer select-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-navy text-cream hover:bg-navy-2 shadow-[0_10px_24px_-12px_rgba(33,38,78,0.55)]",
        blue: "bg-blue text-white hover:bg-[#1d4ca8] shadow-[0_10px_24px_-12px_rgba(36,91,193,0.65)]",
        green: "bg-green text-navy hover:bg-green-deep hover:text-white font-bold",
        outline: "border-2 border-navy/15 bg-transparent text-navy hover:border-navy/35 hover:bg-navy/5",
        ghost: "text-navy hover:bg-navy/8",
        danger: "bg-red/10 text-red border border-red/25 hover:bg-red/15",
        yellow: "bg-yellow text-navy hover:brightness-95 font-bold",
        peach: "bg-peach text-navy hover:brightness-95",
      },
      size: {
        sm: "h-9 px-3.5 text-[13px] rounded-lg",
        default: "h-11 px-5",
        lg: "h-13 px-6 text-[15px] rounded-2xl",
        xl: "h-16 px-8 text-base rounded-2xl",
        icon: "h-10 w-10 rounded-xl",
        "icon-sm": "h-8 w-8 rounded-lg",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
