"use client";

import Link from "next/link";
import { Sparkles, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] px-4 text-center text-[var(--foreground)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary)] text-[var(--primary-foreground)] shadow-lg mb-4">
        <Sparkles className="h-6 w-6" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Page introuvable</h1>
      <p className="text-xs text-[var(--muted-foreground)] max-w-sm mb-6">
        La session ou la ressource demandée n&apos;existe pas ou a été déplacée.
      </p>
      <Link
        href="/"
        className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-[var(--primary-foreground)] shadow-sm hover:opacity-90 transition"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Retour au workbench</span>
      </Link>
    </div>
  );
}
