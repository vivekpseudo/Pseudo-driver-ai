import React, { useState } from 'react';
import { Download, Share } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#126B55]/10 hover:bg-[#126B55]/20 text-[#126B55] border border-[#126B55]/20 transition-all cursor-pointer shadow-2xs"
        title="Install Pseudo Driver AI for 100% offline driving access"
      >
        <Download className="w-3.5 h-3.5" />
        Install App
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#126B55]/10 hover:bg-[#126B55]/20 text-[#126B55] border border-[#126B55]/20 transition-all cursor-pointer shadow-2xs"
        >
          <Share className="w-3.5 h-3.5" />
          Install on iOS
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">
                Install on iPhone / iPad for Offline Use
              </h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                1. Tap the <strong>Share</strong> button (box with arrow) in the Safari toolbar.<br />
                2. Scroll down and select <strong>Add to Home Screen</strong>.<br />
                3. The app will work completely offline, even without cellular coverage.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-xl bg-[#126B55] py-2.5 text-xs font-bold text-white hover:bg-[#0f5846] transition-all cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
