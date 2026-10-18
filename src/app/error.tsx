"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DISHA Root Application Error]:", error);
  }, [error]);

  const isNetworkOrDb =
    error.message?.includes("fetch failed") ||
    error.message?.includes("ENOTFOUND") ||
    error.message?.includes("turso.io") ||
    error.message?.includes("network");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-950 text-slate-100">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-500/10 shadow-lg shadow-sky-500/10">
          <ShieldCheck className="h-8 w-8 text-sky-400" />
        </div>

        <h1 className="text-xl sm:text-2xl font-black tracking-widest text-white mb-2">DISHA</h1>
        <h2 className="text-sm sm:text-base font-semibold text-slate-300 mb-2">
          {isNetworkOrDb ? "Database Connection Interrupted" : "Tactical System Interruption"}
        </h2>

        <p className="text-xs sm:text-sm text-slate-400 mb-6 leading-relaxed">
          {isNetworkOrDb
            ? "The command center could not communicate with the database service. This usually occurs during a momentary internet or DNS interruption."
            : "An unexpected error occurred while communicating with system services."}
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={() => reset()}
            className="flex-1 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs sm:text-sm transition-all shadow-lg shadow-sky-500/20 cursor-pointer"
          >
            <RefreshCw size={15} />
            Retry Connection
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex-1 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm transition-all border border-slate-700 cursor-pointer"
          >
            Reload App
          </button>
        </div>
      </div>
    </div>
  );
}
