"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function PWAInstallButton({ className = "" }: { className?: string }) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true
    );
  });

  const [isIOS] = useState(() => {
    if (typeof window === "undefined") return false;
    return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  });

  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showGeneralGuide, setShowGeneralGuide] = useState(false);

  useEffect(() => {
    const handlePrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (isInstalled) return null;

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      setShowGeneralGuide(true);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleInstall}
        className={`gap-1.5 border-[var(--border)] bg-[var(--surface-elevated)] text-xs font-semibold text-[var(--foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] hover:bg-[var(--surface-hover)] shadow-2xs ${className}`}
        title="Installer l'application sur Mobile, Tablette ou Bureau"
      >
        <Download className="h-3.5 w-3.5 text-[var(--primary)]" />
        <span>Installer l&apos;application</span>
      </Button>

      {/* iOS Installation Guide Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--foreground)] p-6 shadow-2xl">
            <button
              onClick={() => setShowIOSGuide(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 pb-3 border-b border-[var(--border)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--foreground)]">
                  Installer sur iPhone / iPad
                </h3>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Accédez à SoryOS-Code comme une vraie app
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-xs text-[var(--muted-foreground)] leading-relaxed">
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-hover)] font-bold text-[var(--primary)]">
                  1
                </span>
                <p className="text-[var(--foreground)]">
                  Touchez le bouton <strong className="text-[var(--foreground)]">Partager</strong> (icône carré avec flèche vers le haut) dans la barre de Safari.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-hover)] font-bold text-[var(--primary)]">
                  2
                </span>
                <p className="text-[var(--foreground)]">
                  Faites défiler et touchez <strong className="text-[var(--foreground)]">« Sur l&apos;écran d&apos;accueil »</strong>.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-hover)] font-bold text-[var(--primary)]">
                  3
                </span>
                <p className="text-[var(--foreground)]">
                  Touchez <strong className="text-[var(--foreground)]">Ajouter</strong> en haut à droite pour lancer l&apos;app en plein écran sans barre de navigateur !
                </p>
              </div>
            </div>

            <Button
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 font-semibold"
            >
              Compris
            </Button>
          </div>
        </div>
      )}

      {/* General / Desktop Installation Guide Modal */}
      {showGeneralGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--foreground)] p-6 shadow-2xl">
            <button
              onClick={() => setShowGeneralGuide(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 pb-3 border-b border-[var(--border)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
                <Download className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--foreground)]">
                  Installer SoryOS-Code
                </h3>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Application Web Progressive (PWA)
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-xs text-[var(--muted-foreground)] leading-relaxed">
              <p className="text-[var(--foreground)]">
                Pour installer l&apos;application sur votre ordinateur ou appareil :
              </p>
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-hover)] font-bold text-[var(--primary)]">
                  1
                </span>
                <p className="text-[var(--foreground)]">
                  Cliquez sur l&apos;icône <strong>Installer</strong> dans la barre d&apos;adresse de Chrome / Edge, ou via le menu du navigateur (<strong>⋮ &gt; Installer SoryOS-Code</strong>).
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-hover)] font-bold text-[var(--primary)]">
                  2
                </span>
                <p className="text-[var(--foreground)]">
                  L&apos;application s&apos;ouvrira alors dans sa propre fenêtre autonome avec support hors-ligne et accès direct.
                </p>
              </div>
            </div>

            <Button
              onClick={() => setShowGeneralGuide(false)}
              className="mt-5 w-full bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 font-semibold cursor-pointer"
            >
              Fermer
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
