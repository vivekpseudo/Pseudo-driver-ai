import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 max-w-sm mx-auto z-50 flex items-center justify-between gap-2.5 rounded-xl bg-slate-900/95 text-white px-3.5 py-2 text-xs font-semibold shadow-xl border border-slate-700/80 backdrop-blur-xs animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center gap-2">
        <WifiOff className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>Offline Mode — On-device AI monitoring active</span>
      </div>
      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
    </div>
  );
};
