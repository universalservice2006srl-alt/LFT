import * as React from "react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

export function Avatar({
  name,
  color = "#245bc1",
  className,
  textClassName,
}: {
  name: string;
  color?: string | null;
  className?: string;
  textClassName?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-white select-none",
        className
      )}
      style={{
        backgroundColor: color ?? "#245bc1",
        backgroundImage: "linear-gradient(160deg, rgba(255,255,255,0.22), rgba(0,0,0,0.14))",
      }}
    >
      <span className={cn("text-[11px] tracking-wide", textClassName)}>
        {initials(name)}
      </span>
    </span>
  );
}
