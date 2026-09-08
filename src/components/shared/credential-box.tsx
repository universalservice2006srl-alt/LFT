"use client";

import { useState } from "react";
import { Check, Copy, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Read-only credential display with copy buttons — used wherever a Super
 * Admin views an account's password (People page + Security portal).
 */
export function CredentialBox({
  email,
  password,
  footnote,
}: {
  email: string;
  password: string;
  footnote?: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="space-y-2 rounded-2xl border-2 border-green/40 bg-green/8 p-3.5">
      {[
        { label: "Email", value: email },
        { label: "Password", value: password },
      ].map((row) => (
        <div key={row.label} className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-[10px] font-bold uppercase tracking-wider text-navy/45">
            {row.label}
          </span>
          <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-2.5 py-2 font-mono text-[13px] font-semibold text-navy">
            {row.value}
          </code>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => copy(row.label, row.value)}
            aria-label={`Copy ${row.label}`}
          >
            {copied === row.label ? (
              <Check className="h-4 w-4 text-green-deep" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      ))}
      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-green-deep">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {footnote ??
          "Share these with the teammate. Only you (fleet manager) can reset it later."}
      </p>
    </div>
  );
}
