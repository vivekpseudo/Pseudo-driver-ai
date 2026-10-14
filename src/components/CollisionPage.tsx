import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldAlert,
  PlayCircle,
  StopCircle,
  Car,
  Gauge,
  Info,
  Radio,
} from 'lucide-react';
import { CollisionView } from './CollisionView';
import {
  RoadObjectDetector,
  CollisionFrameResult,
} from '../features/collision/objectDetector';
import { RoadSimulator } from '../features/collision/roadSimulator';
import { collisionRadarAudio } from '../features/collision/collisionRadarAudio';

interface CollisionPageProps {
  driverName: string;
}

export const CollisionPage: React.FC<CollisionPageProps> = ({ driverName }) => {
  // Monitoring & stream state
  const [active, setActive] = useState<boolean>(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isSimulator, setIsSimulator] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Radar sound toggle
  const [radarSoundEnabled, setRadarSoundEnabled] = useState<boolean>(true);

  // Simulation trigger
  const [simulatedBraking, setSimulatedBraking] = useState<boolean>(false);

  // Detection results
  const [frameResult, setFrameResult] = useState<CollisionFrameResult | null>(null);

  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const detectorRef = useRef<RoadObjectDetector | null>(null);
  const roadSimRef = useRef<RoadSimulator | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isBusyRef = useRef<boolean>(false);

  useEffect(() => {
    detectorRef.current = new RoadObjectDetector();

    return () => {
      collisionRadarAudio.stop();
      if (roadSimRef.current) {
        roadSimRef.current.stop();
      }
    };
  }, []);

  // Frame processing loop
  const processFrame = useCallback(async () => {
    if (!active || !videoRef.current || !detectorRef.current) return;

    if (!isBusyRef.current && videoRef.current.readyState >= 2) {
      isBusyRef.current = true;
      try {
        const result = await detectorRef.current.detectFrame(videoRef.current);
        setFrameResult(result);

        // Update acoustic radar alerts
        if (radarSoundEnabled) {
          collisionRadarAudio.updateRisk(
            result.overallRisk,
            result.closestObject?.distanceMeters,
            driverName
          );
        } else {
          collisionRadarAudio.stop();
        }
      } catch (err) {
        console.warn('Collision detection error:', err);
      } finally {
        isBusyRef.current = false;
      }
    }

    if (active) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
    }
  }, [active, radarSoundEnabled, driverName]);

  useEffect(() => {
    if (active) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
    }
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [active, processFrame]);

  // Start Hardware Dashcam (rear camera)
  const startHardwareDashcam = useCallback(async () => {
    setCameraError(null);
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    if (roadSimRef.current) {
      roadSimRef.current.stop();
      roadSimRef.current = null;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const msg = 'Camera API is not supported in this browser context. Switching to road simulator.';
      setCameraError(msg);
      startRoadSimulator();
      return;
    }

    let mediaStream: MediaStream | null = null;
    let lastErr: Error | null = null;

    // 1. Try back/environment camera for forward road view
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    } catch (e: unknown) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }

    // 2. Fallback to any camera
    if (!mediaStream) {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      } catch (e: unknown) {
        lastErr = e instanceof Error ? e : new Error(String(e));
      }
    }

    if (mediaStream) {
      setStream(mediaStream);
      setIsSimulator(false);
      setCameraError(null);
      setActive(true);
    } else {
      const errText =
        lastErr?.name === 'NotAllowedError'
          ? 'Dashcam permission denied. Switched to road simulator.'
          : 'No forward camera detected. Switched to road simulator.';
      setCameraError(errText);
      startRoadSimulator();
    }
  }, [stream]);

  // Start Road Simulator
  const startRoadSimulator = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }

    const sim = new RoadSimulator();
    roadSimRef.current = sim;
    sim.setApproaching(simulatedBraking);
    const simStream = sim.getStream();

    setStream(simStream);
    setIsSimulator(true);
    setCameraError(null);
    setActive(true);
  }, [simulatedBraking, stream]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    if (roadSimRef.current) {
      roadSimRef.current.stop();
      roadSimRef.current = null;
    }
    collisionRadarAudio.stop();
    setActive(false);
    setFrameResult(null);
    setSimulatedBraking(false);
  }, [stream]);

  const toggleSimulatedBraking = () => {
    setSimulatedBraking((prev) => {
      const next = !prev;
      if (roadSimRef.current) {
        roadSimRef.current.setApproaching(next);
      }
      return next;
    });
  };

  const closest = frameResult?.closestObject || null;
  const isEmergency = frameResult?.overallRisk === 'critical';
  const isWarning = frameResult?.overallRisk === 'warning';

  return (
    <div className="flex flex-col gap-4">
      {/* Collision Alert Banner Card */}
      <section
        className={`rounded-[24px] p-5 text-white shadow-md relative overflow-hidden transition-all duration-300 ${
          isEmergency
            ? 'bg-gradient-to-r from-rose-800 to-rose-900 ring-2 ring-rose-500 animate-pulse'
            : isWarning
            ? 'bg-gradient-to-r from-amber-800 to-amber-900'
            : 'bg-gradient-to-r from-slate-900 to-[#123D34]'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${isEmergency ? 'bg-rose-500 text-white animate-bounce' : 'bg-white/10 text-emerald-300'}`}>
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight leading-tight">
                {isEmergency
                  ? 'CRITICAL COLLISION WARNING'
                  : isWarning
                  ? 'CAUTION: VEHICLE AHEAD'
                  : 'Forward Collision Detection'}
              </h2>
              <p className="text-xs text-white/80 mt-0.5">
                {isEmergency
                  ? `Imminent crash risk at ${closest?.distanceMeters.toFixed(1)}m. Brake immediately!`
                  : isWarning
                  ? `Maintain safe following distance (${closest?.distanceMeters.toFixed(1)}m).`
                  : 'Real-time monocular distance & forward vehicle tracking.'}
              </p>
            </div>
          </div>
        </div>

        {/* Following Distance Gauge Bar */}
        <div className="mt-4 pt-3 border-t border-white/15">
          <div className="flex items-center justify-between text-xs font-mono mb-1.5">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              Lead Vehicle Gap:
            </span>
            <span className={`font-black text-sm ${isEmergency ? 'text-rose-300' : isWarning ? 'text-amber-300' : 'text-emerald-300'}`}>
              {closest ? `${closest.distanceMeters.toFixed(1)} meters` : 'Road Clear (> 40m)'}
            </span>
          </div>

          <div className="w-full bg-black/40 rounded-full h-2.5 overflow-hidden border border-white/10 flex">
            {/* Critical zone: 0 - 7m */}
            <div className="w-[18%] bg-rose-500/80 border-r border-black/40 h-full" title="Critical (< 7m)" />
            {/* Warning zone: 7 - 15m */}
            <div className="w-[20%] bg-amber-400/80 border-r border-black/40 h-full" title="Warning (7 - 15m)" />
            {/* Safe zone: > 15m */}
            <div className="w-[62%] bg-emerald-500/80 h-full" title="Safe (> 15m)" />
          </div>
          <div className="flex justify-between text-[10px] text-white/60 font-mono mt-1">
            <span className="text-rose-300 font-bold">0m (Impact)</span>
            <span className="text-amber-300 font-bold">7m (Caution)</span>
            <span className="text-emerald-300 font-bold">15m+ (Safe Gap)</span>
          </div>
        </div>
      </section>

      {/* Camera Preview Area (When active) */}
      {active && (
        <CollisionView
          videoRef={videoRef}
          stream={stream}
          error={cameraError}
          isSimulator={isSimulator}
          onSwitchToSimulator={startRoadSimulator}
          onRetryHardwareDashcam={startHardwareDashcam}
          result={frameResult}
          simulatedBraking={simulatedBraking}
          onToggleSimulatedBraking={toggleSimulatedBraking}
          radarSoundEnabled={radarSoundEnabled}
          onToggleRadarSound={() => setRadarSoundEnabled((prev) => !prev)}
        />
      )}

      {/* Main Start / Stop Button */}
      <section className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={active ? stopMonitoring : startHardwareDashcam}
          className={`w-full min-h-[56px] rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 shadow-sm transition-all duration-200 cursor-pointer ${
            active
              ? 'bg-rose-700 hover:bg-rose-800 text-white active:scale-[0.99]'
              : 'bg-[#126B55] hover:bg-[#0f5846] text-white active:scale-[0.99]'
          }`}
        >
          {active ? (
            <>
              <StopCircle className="w-5 h-5" />
              Stop Collision Detection
            </>
          ) : (
            <>
              <PlayCircle className="w-5 h-5" />
              Start Forward Collision Detection
            </>
          )}
        </button>

        {!active && (
          <button
            type="button"
            onClick={startRoadSimulator}
            className="w-full py-2.5 rounded-xl font-semibold text-xs text-[#126B55] bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Gauge className="w-3.5 h-3.5" />
            Launch Road Traffic Simulator (Demo / Highway Testing)
          </button>
        )}
      </section>

      {/* Detected Road Objects Telemetry Table (When active and objects present) */}
      {active && frameResult && frameResult.objects.length > 0 && (
        <section className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Car className="w-4 h-4 text-[#126B55]" />
              Tracked Road Objects ({frameResult.objects.length})
            </h3>
            <span className="text-[11px] font-mono text-slate-500">
              Inference: On-Device TFLite
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {frameResult.objects.map((obj) => (
              <div key={obj.id} className="py-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      obj.riskLevel === 'critical'
                        ? 'bg-rose-500 animate-ping'
                        : obj.riskLevel === 'warning'
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                  />
                  <span className="font-bold text-slate-800">{obj.displayName}</span>
                  <span className="text-[11px] text-slate-400 font-mono">{obj.confidence}% match</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {obj.distanceMeters.toFixed(1)} m
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      obj.riskLevel === 'critical'
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : obj.riskLevel === 'warning'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}
                  >
                    {obj.riskLevel}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ADAS Technical Info Card */}
      <section className="bg-slate-100/90 rounded-2xl p-4 border border-slate-200 text-slate-600 text-xs flex items-start gap-2.5">
        <Info className="w-4 h-4 text-[#126B55] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-800">
            Monocular Pinhole Camera Distance Model:
          </p>
          <p className="leading-relaxed">
            Calculates distance D = (f &times; H_real) / h_pixels using known vehicle heights (cars ~1.5m, trucks ~3.2m, pedestrians ~1.7m) with ground-plane perspective geometry. Time-to-Collision (TTC) tracks approaching speed v_rel = &Delta;D / &Delta;t to trigger instant audio radar beeps and spoken braking warnings.
          </p>
        </div>
      </section>
    </div>
  );
};
