"use client";

import { useEffect, useState } from "react";
import { Download, Share, X, ShieldCheck } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface Props {
  variant?: "header-button" | "floating-banner" | "all";
}

export default function InstallPrompt({ variant = "all" }: Props) {
  const [mounted, setMounted] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);

      const isDisplayStandalone = window.matchMedia("(display-mode: standalone)").matches;
      const isNavStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      if (isDisplayStandalone || isNavStandalone) {
        setIsStandalone(true);
        return;
      }

      if (sessionStorage.getItem("disha_pwa_dismissed") === "true") {
        setIsDismissed(true);
      }

      const ua = window.navigator.userAgent;
      const isAppleDevice = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
      const isSafariBrowser = /WebKit/i.test(ua) && !/CriOS|FxiOS|OPiOS|mercury/i.test(ua);
      setIsIOS(isAppleDevice && isSafariBrowser);
    }, 0);

    // Listen for Chromium beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for appinstalled
    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setIsStandalone(true);
      console.log("[PWA] DISHA app installed successfully.");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    }
  };

  const handleDismissBanner = () => {
    setIsDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("disha_pwa_dismissed", "true");
    }
  };

  // Prevent any hydration mismatch by waiting until mounted on client
  if (!mounted || isStandalone || installed) {
    return null;
  }

  const isInstallable = Boolean(deferredPrompt || isIOS);

  // Render header button if requested and installable
  const renderHeaderButton = () => {
    if (!isInstallable) return null;

    return (
      <button
        onClick={handleInstallClick}
        title="Install DISHA Progressive Web App on this device"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
      >
        <Download size={14} className="text-sky-400" />
        <span className="hidden sm:inline">Install App</span>
        <span className="sm:hidden">Install</span>
      </button>
    );
  };

  // Render floating banner
  const renderFloatingBanner = () => {
    if (!isInstallable || isDismissed) return null;

    return (
      <div className="fixed bottom-16 sm:bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 bg-slate-900/95 border border-slate-700/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md z-50 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300">
        <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center flex-shrink-0 text-sky-400">
          <ShieldCheck size={22} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white tracking-wide">Install DISHA Control Room</h4>
            <button
              onClick={handleDismissBanner}
              className="text-slate-400 hover:text-white p-1 rounded-md"
              aria-label="Dismiss banner"
            >
              <X size={15} />
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Install to home screen for fullscreen telemetry, fast access, and field alerts.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition-colors"
            >
              <Download size={13} />
              {isIOS ? "How to Install" : "Install Now"}
            </button>
            <button
              onClick={handleDismissBanner}
              className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-xs"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {variant === "header-button" && renderHeaderButton()}
      {variant === "floating-banner" && renderFloatingBanner()}
      {variant === "all" && (
        <>
          {renderHeaderButton()}
          {renderFloatingBanner()}
        </>
      )}

      {/* iOS Safari Installation Instruction Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Install on iPhone / iPad</h3>
                  <p className="text-xs text-slate-400">Apple Safari Installation</p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                className="text-slate-400 hover:text-white p-1"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <ol className="text-xs text-slate-300 space-y-3.5 py-2">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-bold text-[11px] text-sky-400 flex-shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  Tap the <strong className="text-white">Share</strong> button <Share size={13} className="inline mx-1 text-sky-400" /> at the bottom of Safari.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-bold text-[11px] text-sky-400 flex-shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  Scroll down the share sheet and tap <strong className="text-white">Add to Home Screen</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-bold text-[11px] text-sky-400 flex-shrink-0 mt-0.5">
                  3
                </span>
                <span>
                  Tap <strong className="text-white">Add</strong> in the top-right corner. DISHA is now installed!
                </span>
              </li>
            </ol>

            <button
              onClick={() => setShowIOSModal(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
