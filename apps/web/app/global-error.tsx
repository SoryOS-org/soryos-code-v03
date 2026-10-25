"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body className="flex min-h-screen flex-col items-center justify-center bg-[#0d1117] text-white p-4">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-md">
          <h2 className="text-lg font-bold mb-2">Une erreur inattendue est survenue</h2>
          <p className="text-xs text-white/60 mb-6">
            Le système a rencontré une anomalie lors du chargement de l&apos;application.
          </p>
          <button
            onClick={() => reset()}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition cursor-pointer"
          >
            Recharger la session
          </button>
        </div>
      </body>
    </html>
  );
}
