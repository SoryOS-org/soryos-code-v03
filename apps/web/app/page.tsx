"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { PWAInstallButton } from "@/components/pwa-install-button";
import { WorkspaceLauncher } from "@/components/workspace-launcher";
import { EnvironmentType, ProviderId } from "@/components/sandbox-selector";

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  const handleWorkspaceOpened = (sessionId: string, env: EnvironmentType, providerId: ProviderId) => {
    router.push(`/chat/${sessionId}`);
  };

  return (
    <div className="flex h-screen h-[100dvh] overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <AppSidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <main className="relative flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-[var(--background)] text-[var(--foreground)]">
        {/* Mobile Header Bar */}
        <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface-elevated)]/90 backdrop-blur-sm px-4 md:hidden">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--foreground)] active:bg-[var(--surface-hover)]"
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-black text-sm tracking-tight text-[var(--foreground)]">SoryOS-Code</span>
          </div>

          <div className="flex items-center gap-2">
            <PWAInstallButton />
          </div>
        </header>

        {/* Desktop Header Actions */}
        <div className="hidden md:flex relative z-10 w-full items-center justify-end p-4">
          <PWAInstallButton />
        </div>

        {/* Workspace Launcher Screen (NO_WORKSPACE State) */}
        <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center p-2 sm:p-4">
          <WorkspaceLauncher onWorkspaceOpened={handleWorkspaceOpened} />
        </div>
      </main>
    </div>
  );
}
