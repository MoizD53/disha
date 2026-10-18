"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DISHA Dashboard Error Boundary]:", error);
  }, [error]);

  const isNetworkOrDb =
    error.message?.includes("fetch failed") ||
    error.message?.includes("ENOTFOUND") ||
    error.message?.includes("turso.io") ||
    error.message?.includes("network");

  return (
    <div className="flex-1 min-h-[400px] flex items-center justify-center p-4 sm:p-6 bg-slate-950 text-slate-100">
      <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 text-center shadow-2xl backdrop-blur-sm">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={28} />
        </div>

        <h2 className="text-lg sm:text-xl font-bold text-white mb-2">
          {isNetworkOrDb ? "Database Connection Interrupted" : "Command Center Error"}
        </h2>

        <p className="text-xs sm:text-sm text-slate-400 mb-6 leading-relaxed">
          {isNetworkOrDb
            ? "The command center could not communicate with the database service. This usually occurs during a momentary internet or DNS interruption."
            : "An unexpected error occurred while rendering the tactical command center."}
        </p>

        {error.message && (
          <div className="mb-6 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400 text-left overflow-x-auto max-h-24">
            {error.message}
          </div>
        )}

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
            <RotateCcw size={15} />
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
}
