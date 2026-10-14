import React, { useEffect, useRef } from 'react';
import {
  AlertTriangle,
  Car,
  Truck,
  User,
  ShieldAlert,
  Gauge,
  Radio,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { CollisionFrameResult } from '../features/collision/objectDetector';

interface CollisionViewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  error?: string | null;
  isSimulator: boolean;
  onSwitchToSimulator: () => void;
  onRetryHardwareDashcam: () => void;
  result: CollisionFrameResult | null;
  simulatedBraking: boolean;
  onToggleSimulatedBraking: () => void;
  radarSoundEnabled: boolean;
  onToggleRadarSound: () => void;
}

export const CollisionView: React.FC<CollisionViewProps> = ({
  videoRef,
  stream,
  error,
  isSimulator,
  onSwitchToSimulator,
  onRetryHardwareDashcam,
  result,
  simulatedBraking,
  onToggleSimulatedBraking,
  radarSoundEnabled,
  onToggleRadarSound,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Attach media stream to video
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream) {
      video.srcObject = stream;
      video.muted = true;
      video.setAttribute('muted', 'true');
      video.setAttribute('playsinline', 'true');

      video.play().catch((e) => {
        console.warn('Dashcam video play warning:', e);
      });
    }
  }, [stream, videoRef]);

  // Render bounding boxes, distance tags, and collision crosshairs
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!result || !result.objects || result.objects.length === 0) {
      // Draw idle horizon guide
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w * 0.35, h * 0.48);
      ctx.lineTo(w * 0.65, h * 0.48);
      ctx.stroke();
      return;
    }

    // Draw detected vehicles and distance indicators
    for (const obj of result.objects) {
      const bb = obj.boundingBox;
      const x = bb.x * w;
      const y = bb.y * h;
      const bw = bb.width * w;
      const bh = bb.height * h;

      const isCritical = obj.riskLevel === 'critical';
      const isWarning = obj.riskLevel === 'warning';

      const strokeColor = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981';
      const bgBadge = isCritical
        ? 'rgba(239, 68, 68, 0.9)'
        : isWarning
        ? 'rgba(245, 158, 11, 0.9)'
        : 'rgba(16, 185, 129, 0.85)';

      // 1. Bounding box corners (modern automotive HUD style)
      ctx.save();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = isCritical ? 3.5 : 2.5;

      const cornerLen = Math.min(18, bw * 0.25);
      // Top-left
      ctx.beginPath();
      ctx.moveTo(x, y + cornerLen);
      ctx.lineTo(x, y);
      ctx.lineTo(x + cornerLen, y);
      ctx.stroke();

      // Top-right
      ctx.beginPath();
      ctx.moveTo(x + bw - cornerLen, y);
      ctx.lineTo(x + bw, y);
      ctx.lineTo(x + bw, y + cornerLen);
      ctx.stroke();

      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(x, y + bh - cornerLen);
      ctx.lineTo(x, y + bh);
      ctx.lineTo(x + cornerLen, y + bh);
      ctx.stroke();

      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(x + bw - cornerLen, y + bh);
      ctx.lineTo(x + bw, y + bh);
      ctx.lineTo(x + bw, y + bh - cornerLen);
      ctx.stroke();

      // Subtle translucent box fill
      ctx.fillStyle = isCritical ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.05)';
      ctx.fillRect(x, y, bw, bh);

      // 2. Distance and Risk Tag
      const ttcText = obj.ttcSeconds ? ` · TTC: ${obj.ttcSeconds}s` : '';
      const tagText = `${obj.displayName} · ${obj.distanceMeters.toFixed(1)}m${ttcText}`;

      ctx.font = 'bold 12px monospace';
      const textWidth = ctx.measureText(tagText).width;
      const tagH = 22;
      const tagX = Math.max(4, Math.min(w - textWidth - 14, x));
      const tagY = Math.max(tagH + 4, y - 6);

      ctx.fillStyle = bgBadge;
      ctx.beginPath();
      ctx.roundRect(tagX - 4, tagY - tagH + 4, textWidth + 12, tagH, 5);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.fillText(tagText, tagX + 2, tagY - 2);

      // Warning marker if critical
      if (isCritical) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('⚠️ BRAKE', x + bw / 2 - 24, y + bh + 16);
      }

      ctx.restore();
    }
  }, [result]);

  const closest = result?.closestObject || null;
  const isEmergency = result?.overallRisk === 'critical';
  const isWarning = result?.overallRisk === 'warning';

  return (
    <div className="relative overflow-hidden rounded-[24px] bg-slate-900 border border-slate-700 shadow-lg">
      {/* Critical Crash Warning Flashing Banner */}
      {isEmergency && (
        <div className="absolute top-0 inset-x-0 z-30 bg-rose-600 text-white py-2 px-4 flex items-center justify-center gap-2 font-black text-sm tracking-wide uppercase animate-pulse shadow-md">
          <ShieldAlert className="w-5 h-5 animate-bounce" />
          <span>COLLISION ALERT: BRAKE NOW ({closest?.distanceMeters.toFixed(1)}m)</span>
        </div>
      )}

      {error && !stream ? (
        <div className="p-8 text-center text-slate-300 flex flex-col items-center justify-center min-h-[260px]">
          <AlertTriangle className="w-12 h-12 text-amber-400 mb-3" />
          <p className="font-bold text-white text-base">Forward Dashcam Unavailable</p>
          <p className="text-xs text-slate-300 mt-1 max-w-xs leading-relaxed">
            {error}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            <button
              type="button"
              onClick={onSwitchToSimulator}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#126B55] hover:bg-[#0e5544] text-white shadow-sm transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Use Road Traffic Simulator
            </button>
            <button
              type="button"
              onClick={onRetryHardwareDashcam}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Dashcam
            </button>
          </div>
        </div>
      ) : (
        <div className="relative aspect-4/3 w-full bg-black flex items-center justify-center overflow-hidden">
          {/* Dashcam video stream */}
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="w-full h-full object-cover"
          />

          {/* Canvas overlays */}
          <canvas
            ref={canvasRef}
            width={640}
            height={480}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />

          {/* Top HUD bar */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-black/70 text-white backdrop-blur-xs border border-white/10">
              <span className={`w-2 h-2 rounded-full ${isEmergency ? 'bg-rose-500 animate-ping' : isWarning ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              {isSimulator ? 'Road Simulator (Dashcam)' : 'Forward Road Camera'}
            </span>

            {/* FPS and detected count */}
            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-black/70 text-slate-300 border border-white/10 backdrop-blur-xs">
              {result?.objects.length || 0} Objects · {result?.fps || 0} FPS
            </span>
          </div>

          {/* Mini Proximity Radar & Distance Gauge Widget */}
          <div className="absolute top-12 left-3 z-10 bg-black/75 backdrop-blur-md rounded-xl p-2.5 border border-white/15 text-white flex flex-col gap-1.5 w-36 pointer-events-none">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span className="flex items-center gap-1">
                <Radio className="w-3 h-3 text-emerald-400" />
                RADAR
              </span>
              <span>{closest ? `${closest.distanceMeters.toFixed(1)}m` : '--'}</span>
            </div>

            {/* Proximity Distance Bar */}
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-white/10">
              <div
                className={`h-full transition-all duration-150 rounded-full ${
                  isEmergency ? 'bg-rose-500' : isWarning ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
                style={{
                  width: closest
                    ? `${Math.max(8, Math.min(100, (1 - closest.distanceMeters / 40) * 100))}%`
                    : '0%',
                }}
              />
            </div>

            <div className="text-[10px] flex items-center justify-between text-slate-300 font-mono">
              <span>BUMPER</span>
              <span>40M+</span>
            </div>
          </div>

          {/* Bottom Controls Strip */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-20 gap-2">
            <button
              type="button"
              onClick={isSimulator ? onRetryHardwareDashcam : onSwitchToSimulator}
              className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-black/70 hover:bg-black/90 text-slate-200 border border-white/20 backdrop-blur-xs transition-all cursor-pointer"
            >
              {isSimulator ? 'Switch to Real Dashcam' : 'Switch to Simulator'}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleRadarSound}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer backdrop-blur-xs ${
                  radarSoundEnabled
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                    : 'bg-black/70 text-slate-400 border-white/15'
                }`}
              >
                {radarSoundEnabled ? '🔊 Radar On' : '🔇 Muted'}
              </button>

              {isSimulator && (
                <button
                  type="button"
                  onClick={onToggleSimulatedBraking}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
                    simulatedBraking
                      ? 'bg-rose-600 text-white ring-2 ring-white/60 animate-pulse'
                      : 'bg-black/70 hover:bg-black/90 text-amber-300 border border-amber-400/30'
                  }`}
                  title="Simulate vehicle ahead braking hard to test collision alert"
                >
                  {simulatedBraking ? '⚠️ Approaching Vehicle!' : 'Simulate Approach'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Telemetry bottom status banner */}
      <div className="bg-slate-900 px-4 py-3 border-t border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          {closest ? (
            closest.category === 'truck' ? (
              <Truck className="w-4 h-4 text-emerald-400" />
            ) : closest.category === 'person' ? (
              <User className="w-4 h-4 text-emerald-400" />
            ) : (
              <Car className="w-4 h-4 text-emerald-400" />
            )
          ) : (
            <Gauge className="w-4 h-4 text-slate-400" />
          )}

          <div>
            <span className="font-bold text-white">
              {closest ? `Lead ${closest.displayName}: ` : 'Road Ahead Clear: '}
            </span>
            <span
              className={`font-mono font-bold ${
                isEmergency ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {closest ? `${closest.distanceMeters.toFixed(1)} meters` : 'No vehicle < 40m'}
            </span>
          </div>
        </div>

        {closest && closest.ttcSeconds && (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-slate-800 border border-slate-700 text-slate-300">
            TTC: {closest.ttcSeconds}s
          </span>
        )}
      </div>
    </div>
  );
};
