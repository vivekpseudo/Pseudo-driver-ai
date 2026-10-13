import React, { useEffect, useRef } from 'react';
import { Camera, AlertCircle, RefreshCw, ExternalLink, Sparkles } from 'lucide-react';
import { FaceDetectionResult } from '../features/monitoring/faceDetector';

interface CameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  error?: string | null;
  isVirtual: boolean;
  onRequestPermissionAgain: () => void;
  detectionResult?: FaceDetectionResult | null;
  simulatedClosure: boolean;
  onToggleSimulatedClosure: () => void;
}

export const CameraView: React.FC<CameraViewProps> = ({
  videoRef,
  stream,
  error,
  isVirtual,
  onRequestPermissionAgain,
  detectionResult,
  simulatedClosure,
  onToggleSimulatedClosure,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  // Bind media stream to video element safely
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream) {
      video.srcObject = stream;
      video.muted = true;
      video.setAttribute('muted', 'true');
      video.setAttribute('playsinline', 'true');

      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((e) => {
          console.warn('Video playback warning:', e);
        });
      }
    }
  }, [stream, videoRef]);

  // High precision landmark and bounding box overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (detectionResult && detectionResult.faceFound && detectionResult.boundingBox) {
      const mirrorX = (normX: number) => {
        // If front camera is mirrored, flip X coordinate so it aligns with the mirrored video
        return isVirtual ? normX * w : (1 - normX) * w;
      };

      const mirrorBox = (box: { x: number; y: number; width: number; height: number }) => {
        const x1 = mirrorX(box.x);
        const x2 = mirrorX(box.x + box.width);
        const startX = Math.min(x1, x2);
        const startY = box.y * h;
        const width = Math.abs(x1 - x2);
        const height = box.height * h;
        return { x: startX, y: startY, width, height };
      };

      // 1. Draw Face Box (subtle rounded dashed outline)
      const fb = mirrorBox(detectionResult.boundingBox);
      ctx.save();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(fb.x, fb.y, fb.width, fb.height);
      ctx.restore();

      // 2. Draw Left & Right Eye Boxes & Badges
      const drawEye = (
        box: { x: number; y: number; width: number; height: number } | undefined,
        prob: number,
        label: string
      ) => {
        if (!box) return;
        const eb = mirrorBox(box);
        const isClosed = prob < 0.28;
        const color = isClosed ? '#ef4444' : '#10b981';
        const bgBadge = isClosed ? 'rgba(239, 68, 68, 0.85)' : 'rgba(16, 185, 129, 0.85)';

        // Eye box outline
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(eb.x, eb.y, eb.width, eb.height);

        // Readable text label tag above the box (not mirrored!)
        const text = `${label}: ${Math.round(prob * 100)}%`;
        ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
        const textWidth = ctx.measureText(text).width;
        const tagX = Math.max(4, Math.min(w - textWidth - 14, eb.x));
        const tagY = Math.max(18, eb.y - 6);

        ctx.fillStyle = bgBadge;
        ctx.beginPath();
        ctx.roundRect(tagX - 4, tagY - 14, textWidth + 8, 18, 4);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, tagX, tagY);
      };

      // In mirrored camera preview: the user's left eye appears on the screen's left
      // and user's right eye appears on screen's right
      drawEye(detectionResult.leftEyeBox, detectionResult.leftEyeOpenProbability, 'L');
      drawEye(detectionResult.rightEyeBox, detectionResult.rightEyeOpenProbability, 'R');
    }
  }, [detectionResult, isVirtual]);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-[20px] bg-slate-900 border border-slate-700 shadow-md"
    >
      {error && !stream ? (
        <div className="p-6 text-center text-slate-300 flex flex-col items-center justify-center min-h-[220px]">
          <AlertCircle className="w-10 h-10 text-amber-400 mb-2" />
          <p className="font-bold text-white text-base">Camera Permission Needed</p>
          <p className="text-xs text-slate-300 mt-1.5 max-w-xs leading-relaxed">
            {error}
          </p>

          <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center w-full max-w-xs">
            <button
              type="button"
              onClick={onRequestPermissionAgain}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#126B55] hover:bg-[#0e5544] text-white shadow-sm transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Request Camera Permission Again
            </button>

            {isInIframe && (
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in Full Window
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="relative aspect-4/3 w-full bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`w-full h-full object-cover ${!isVirtual ? 'transform -scale-x-100' : ''}`}
          />
          {/* Note: Canvas is NOT scaled via CSS - coordinate flipping is handled in drawing so text is unmirrored */}
          <canvas
            ref={canvasRef}
            width={640}
            height={480}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />

          {/* Top status badges */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-black/60 text-white backdrop-blur-xs">
              <span className={`w-2 h-2 rounded-full ${isVirtual ? 'bg-amber-400' : 'bg-emerald-400'} animate-pulse`} />
              {isVirtual ? 'Virtual Camera' : 'Hardware Camera Live'}
            </span>

            {detectionResult?.faceFound ? (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-200 border border-emerald-500/30 backdrop-blur-xs flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-300" />
                Face Tracked
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-950/80 text-amber-200 border border-amber-500/30 backdrop-blur-xs">
                Position Face in Center...
              </span>
            )}
          </div>

          {/* Bottom simulation trigger */}
          <div className="absolute bottom-3 right-3 z-10">
            <button
              type="button"
              onClick={onToggleSimulatedClosure}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md backdrop-blur-xs cursor-pointer ${
                simulatedClosure
                  ? 'bg-rose-600 text-white ring-2 ring-white/60 animate-pulse'
                  : 'bg-black/60 hover:bg-black/80 text-slate-200 border border-white/20'
              }`}
              title="Force eye closure to test drowsiness warning escalation"
            >
              {simulatedClosure ? '⚠️ Eyes Closed (Simulated)' : 'Simulate Eye Closure'}
            </button>
          </div>
        </div>
      )}

      {/* Camera hint strip */}
      <div className="bg-slate-900 px-3 py-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800">
        <span className="flex items-center gap-1">
          <Camera className="w-3.5 h-3.5 text-emerald-400" />
          Optimal distance: 35–60 cm
        </span>
        <span className="font-mono font-medium">
          Open: {detectionResult?.overallEyeOpenProbability !== undefined ? Math.round(detectionResult.overallEyeOpenProbability * 100) : '--'}%
        </span>
      </div>
    </div>
  );
};
