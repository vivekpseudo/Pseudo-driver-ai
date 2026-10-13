import React from 'react';
import { ShieldCheck, Bell, AlertTriangle, Eye } from 'lucide-react';

export type AlertLevel = 'normal' | 'warning' | 'critical';

interface StatusCardProps {
  level: AlertLevel;
  status: string;
  detail: string;
  eyeProbability?: number | null;
  closedForMs?: number;
  openForMs?: number;
  recoveryTargetMs?: number;
}

export const StatusCard: React.FC<StatusCardProps> = ({
  level,
  status,
  detail,
  eyeProbability,
  closedForMs = 0,
  openForMs = 0,
  recoveryTargetMs = 30000,
}) => {
  const getColors = () => {
    switch (level) {
      case 'critical':
        return {
          bg: 'bg-[#B42318]/[0.08]',
          border: 'border-[#B42318]/30',
          text: 'text-[#B42318]',
          iconColor: '#B42318',
        };
      case 'warning':
        return {
          bg: 'bg-[#B56A00]/[0.08]',
          border: 'border-[#B56A00]/30',
          text: 'text-[#B56A00]',
          iconColor: '#B56A00',
        };
      case 'normal':
      default:
        return {
          bg: 'bg-[#126B55]/[0.08]',
          border: 'border-[#126B55]/30',
          text: 'text-[#126B55]',
          iconColor: '#126B55',
        };
    }
  };

  const { bg, border, text, iconColor } = getColors();
  const isAlertActive = level !== 'normal';
  const openProgressPct = Math.min(100, Math.max(0, (openForMs / recoveryTargetMs) * 100));

  return (
    <div
      className={`p-4 rounded-[18px] border transition-all duration-300 ${bg} ${border} ${
        level === 'critical' ? 'animate-alert-pulse ring-2 ring-[#B42318]/20' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          {level === 'critical' ? (
            <AlertTriangle size={28} color={iconColor} className="animate-bounce" />
          ) : level === 'warning' ? (
            <Bell size={28} color={iconColor} />
          ) : (
            <ShieldCheck size={28} color={iconColor} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className={`font-extrabold text-[16px] leading-tight ${text}`}>
              {status}
            </h3>
            {eyeProbability !== undefined && eyeProbability !== null && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/80 border border-slate-200 text-slate-700 shadow-xs">
                Eyes: {Math.round(eyeProbability * 100)}%
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-700 leading-[1.35]">
            {detail}
          </p>

          {/* Active alert 30-second recovery timer */}
          {isAlertActive && (
            <div className="mt-2.5 pt-2 border-t border-slate-200/60">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                <span className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5 text-emerald-600" />
                  Eyes open to stop alert:
                </span>
                <span className="font-mono text-emerald-700">
                  {(openForMs / 1000).toFixed(1)}s / {(recoveryTargetMs / 1000).toFixed(0)}s
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-150"
                  style={{ width: `${openProgressPct}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Keep eyes open continuously for 30s to clear warning. Tracking is active.
              </p>
            </div>
          )}

          {closedForMs > 0 && (
            <div className="mt-2 text-xs font-mono font-bold text-amber-700 bg-amber-100/70 inline-block px-2 py-0.5 rounded">
              Closed for: {(closedForMs / 1000).toFixed(1)}s
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
