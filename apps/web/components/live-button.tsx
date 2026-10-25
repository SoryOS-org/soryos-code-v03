"use client";

import { Radio } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LiveButtonProps {
  onClick: () => void;
  className?: string;
  size?: "default" | "sm" | "lg";
}

export function LiveButton({ onClick, className = "", size = "sm" }: LiveButtonProps) {
  return (
    <Button
      onClick={onClick}
      variant="outline"
      size={size}
      className={`group relative flex items-center gap-1.5 overflow-hidden rounded-full border border-red-500/30 bg-gradient-to-r from-red-500/10 via-amber-500/10 to-transparent px-2.5 py-1 h-8 text-xs font-semibold text-[#3d3830] transition-all duration-300 hover:border-red-500/60 hover:bg-red-500/15 hover:shadow-2xs cursor-pointer ${className}`}
      title="Démarrer une conversation vocale en direct avec Gemini Live"
    >
      {/* Pulsing live dot */}
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
      </span>

      <Radio className="h-3.5 w-3.5 text-red-600 shrink-0 transition-transform group-hover:scale-110" />

      <span className="tracking-wide uppercase text-[11px] font-bold text-red-600">
        Live
      </span>

      <span className="hidden sm:inline-block text-[11px] font-normal text-muted-foreground">
        (Vocale)
      </span>
    </Button>
  );
}
