"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";

async function compressImage(file: File, maxWidth = 1000, quality = 0.72): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

export function PhotoUpload({
  label,
  hint,
  value,
  onChange,
  required,
}: {
  label: string;
  hint?: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await compressImage(file);
      onChange(dataUrl);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <p className="mb-1.5 flex items-center justify-between text-[13px] font-semibold text-navy/80">
        {label}
        {required ? (
          <span className="text-[10px] font-bold uppercase tracking-wider text-red">Required</span>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-wider text-navy/35">Recommended</span>
        )}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {value ? (
        <div className="group relative overflow-hidden rounded-2xl border-2 border-green/50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="h-36 w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-navy/45 opacity-0 backdrop-blur-[2px] transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-bold text-navy cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retake
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="flex items-center gap-1.5 rounded-xl bg-red px-3 py-2 text-xs font-bold text-white cursor-pointer"
            >
              <X className="h-3.5 w-3.5" /> Remove
            </button>
          </div>
          <span className="absolute left-2.5 top-2.5 rounded-full bg-green px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-navy">
            Captured
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex h-28 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed transition-all cursor-pointer",
            required
              ? "border-navy/25 bg-white/70 hover:border-blue hover:bg-blue/5"
              : "border-navy/18 bg-white/60 hover:border-blue/60 hover:bg-blue/5"
          )}
        >
          {busy ? (
            <Loader2 className="h-6 w-6 animate-spin text-blue" />
          ) : (
            <>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy/6 text-navy/60">
                <Camera className="h-5 w-5" />
              </span>
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-navy/70">
                <ImagePlus className="h-4 w-4" />
                {hint ?? "Snap a photo"}
              </span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
