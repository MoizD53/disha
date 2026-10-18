"use client";

import { WifiOff, RefreshCw, ShieldAlert } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-6">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center mb-6">
          <WifiOff size={32} />
        </div>
        
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">Connection Lost</h1>
        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
          The DISHA command center requires an active network connection to receive real-time field telemetry and emergency SOS broadcasts.
        </p>

        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-xs text-left mb-6 space-y-2">
          <div className="flex items-center gap-2 text-rose-400 font-semibold">
            <ShieldAlert size={14} /> Security Notice
          </div>
          <p className="text-slate-400">
            Field personnel locations and emergency data are never cached locally on offline browsers to protect personnel confidentiality.
          </p>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm transition-colors shadow-lg shadow-sky-600/20"
        >
          <RefreshCw size={16} /> Reconnect to Command Center
        </button>
      </div>
    </div>
  );
}
