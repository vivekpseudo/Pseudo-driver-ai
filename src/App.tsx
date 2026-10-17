import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Eye,
  Car,
  User,
  Volume2,
  BellRing,
  PlayCircle,
  StopCircle,
  Camera,
  RefreshCw,
  ExternalLink,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { StatusCard, AlertLevel } from './components/StatusCard';
import { PreferenceTile } from './components/PreferenceTile';
import { CameraView } from './components/CameraView';
import { CollisionPage } from './components/CollisionPage';
import {
  DrowsinessEvaluator,
  DrowsinessStage,
} from './features/monitoring/drowsinessEvaluator';
import {
  WebFaceDetector,
  FaceDetectionResult,
} from './features/monitoring/faceDetector';
import { VirtualDriverCamera } from './features/monitoring/virtualCamera';
import { audioAlert } from './features/monitoring/audioAlert';
import { speechAlert } from './features/monitoring/speechAlert';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';

export const App: React.FC = () => {
  // Navigation tab state
  const [currentTab, setCurrentTab] = useState<'drowsiness' | 'collision'>('drowsiness');

  // Settings & profile state
  const [driverName, setDriverName] = useState<string>('');
  const [voiceAlerts, setVoiceAlerts] = useState<boolean>(true);
  const [ringtoneAlerts, setRingtoneAlerts] = useState<boolean>(true);

  // Monitoring & camera state
  const [monitoring, setMonitoring] = useState<boolean>(false);
  const [cameraReady, setCameraReady] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isVirtualCamera, setIsVirtualCamera] = useState<boolean>(false);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);

  // Status & alert state
  const [status, setStatus] = useState<string>('Monitoring is off');
  const [detail, setDetail] = useState<string>(
    'Set up your profile, then start monitoring while parked.'
  );
  const [level, setLevel] = useState<AlertLevel>('normal');
  const [detectionResult, setDetectionResult] = useState<FaceDetectionResult | null>(null);
  const [simulatedClosure, setSimulatedClosure] = useState<boolean>(false);
  const [closedForMs, setClosedForMs] = useState<number>(0);
  const [openForMs, setOpenForMs] = useState<number>(0);

  // Evaluator & tracking references
  const evaluatorRef = useRef<DrowsinessEvaluator>(new DrowsinessEvaluator({ recoveryAfterMs: 30000 }));
  const detectorRef = useRef<WebFaceDetector | null>(null);
  const virtualCameraRef = useRef<VirtualDriverCamera | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastAlertAtRef = useRef<number | null>(null);
  const lastDetectedStageRef = useRef<DrowsinessStage>(DrowsinessStage.attentive);
  const missingFaceFramesRef = useRef<number>(0);
  const isBusyRef = useRef<boolean>(false);

  const effectiveDriverName = driverName.trim().length === 0 ? 'Driver' : driverName.trim();
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  // Load preferences from localStorage
  useEffect(() => {
    try {
      const savedName = localStorage.getItem('driver_name');
      const savedVoice = localStorage.getItem('voice_alerts');
      const savedRingtone = localStorage.getItem('ringtone_alerts');

      if (savedName !== null) setDriverName(savedName);
      if (savedVoice !== null) setVoiceAlerts(savedVoice === 'true');
      if (savedRingtone !== null) setRingtoneAlerts(savedRingtone === 'true');
    } catch {
      // LocalStorage access fallback
    }

    detectorRef.current = new WebFaceDetector();
  }, []);

  const savePreferences = useCallback(
    (name: string, voice: boolean, ringtone: boolean) => {
      try {
        localStorage.setItem('driver_name', name.trim());
        localStorage.setItem('voice_alerts', voice ? 'true' : 'false');
        localStorage.setItem('ringtone_alerts', ringtone ? 'true' : 'false');
      } catch {
        // Ignore
      }
    },
    []
  );

  const triggerVibration = useCallback((alertLvl: AlertLevel) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        if (alertLvl === 'critical') {
          navigator.vibrate([700, 250, 700, 250, 1000]);
        } else {
          navigator.vibrate([350, 200, 350]);
        }
      } catch {
        // Ignore vibration error
      }
    }
  }, []);

  // Non-blocking alert trigger: starts alarm and voice asynchronously without locking frame detection
  const triggerAlert = useCallback(
    (targetLevel: AlertLevel) => {
      const now = Date.now();
      const levelPriority = { normal: 0, warning: 1, critical: 2 };

      if (
        levelPriority[level] >= levelPriority[targetLevel] &&
        lastAlertAtRef.current !== null &&
        now - lastAlertAtRef.current < 6000
      ) {
        return;
      }

      lastAlertAtRef.current = now;
      setLevel(targetLevel);

      const alertTitle = targetLevel === 'critical' ? 'DROWSINESS WARNING' : 'Stay alert';
      const alertMsg =
        targetLevel === 'critical'
          ? `${effectiveDriverName}, you may be drowsy. Please pull over safely and rest.`
          : `${effectiveDriverName}, please stay alert.`;

      setStatus(alertTitle);
      setDetail(alertMsg);

      if (ringtoneAlerts) {
        audioAlert.playAlarm(targetLevel === 'critical');
      }

      triggerVibration(targetLevel);

      if (voiceAlerts) {
        // Fire-and-forget: do not await so frame tracking never freezes
        speechAlert.speak(alertMsg).catch(() => {});
      }
    },
    [effectiveDriverName, level, ringtoneAlerts, voiceAlerts, triggerVibration]
  );

  const clearAlert = useCallback(() => {
    audioAlert.stop();
    speechAlert.stop();
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(0);
    }
    setLevel('normal');
    setStatus('Monitoring active');
    setDetail('Eyes remained open for 30s. Alert stopped. Continuous tracking active.');
    setClosedForMs(0);
    setOpenForMs(0);
  }, []);

  const stopMonitoring = useCallback(
    (reason: string = 'Monitoring is off') => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }

      if (virtualCameraRef.current) {
        virtualCameraRef.current.stop();
        virtualCameraRef.current = null;
      }

      audioAlert.stop();
      speechAlert.stop();
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(0);
      }

      evaluatorRef.current.reset();
      lastDetectedStageRef.current = DrowsinessStage.attentive;
      missingFaceFramesRef.current = 0;
      setSimulatedClosure(false);
      setClosedForMs(0);
      setOpenForMs(0);

      setMonitoring(false);
      setCameraReady(false);
      setLevel('normal');
      setStatus('Monitoring is off');
      setDetail(reason);
      setDetectionResult(null);
    },
    [stream]
  );

  // App Lifecycle handling: stop ONLY when document visibility state is hidden (tab switched/minimized)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && monitoring) {
        stopMonitoring('Monitoring paused because the app left the foreground.');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [monitoring, stopMonitoring]);

  // Frame processing loop - runs continuously regardless of alert state
  const processFrame = useCallback(async () => {
    if (!monitoring || !videoRef.current || !detectorRef.current) return;

    if (!isBusyRef.current && videoRef.current.readyState >= 2) {
      isBusyRef.current = true;
      try {
        const simulatedProb = simulatedClosure ? 0.08 : null;
        const result = await detectorRef.current.processVideoFrame(
          videoRef.current,
          simulatedProb
        );
        setDetectionResult(result);

        if (!result.faceFound) {
          missingFaceFramesRef.current++;
          if (missingFaceFramesRef.current >= 12) {
            evaluatorRef.current.reset();
            if (level === 'normal') {
              setStatus('Face not visible');
              setDetail('Adjust camera so your face is visible.');
            }
            setClosedForMs(0);
            setOpenForMs(0);
          }
        } else {
          missingFaceFramesRef.current = 0;
          const eyeOpen = result.overallEyeOpenProbability;
          const snapshot = evaluatorRef.current.update(eyeOpen, Date.now());
          setClosedForMs(snapshot.closedForMs);
          setOpenForMs(snapshot.openForMs);

          // If an alert is currently active:
          if (level !== 'normal') {
            // Check if user has kept eyes open continuously for 30 seconds (30,000 ms)
            if (snapshot.openForMs >= 30000 || snapshot.stage === DrowsinessStage.attentive) {
              clearAlert();
            } else if (snapshot.openForMs > 0) {
              const remainingSec = Math.max(0, (30000 - snapshot.openForMs) / 1000).toFixed(1);
              setStatus('ALERT ACTIVE - Keep eyes open');
              setDetail(`Eyes open for ${(snapshot.openForMs / 1000).toFixed(1)}s. Keep open ${remainingSec}s more to stop alert.`);
            } else if (snapshot.closedForMs > 0) {
              // Eyes closed again during alert
              setStatus(level === 'critical' ? 'DROWSINESS WARNING' : 'Stay alert');
              setDetail(`${effectiveDriverName}, please open your eyes. Warning will stop after 30s open.`);
            }
          } else {
            // Normal monitoring state: evaluate for possible drowsiness
            if (snapshot.stage !== lastDetectedStageRef.current) {
              lastDetectedStageRef.current = snapshot.stage;
              if (snapshot.stage === DrowsinessStage.critical) {
                triggerAlert('critical');
              } else if (snapshot.stage === DrowsinessStage.warning) {
                triggerAlert('warning');
              } else if (snapshot.stage === DrowsinessStage.attentive) {
                setStatus('Eyes appear open');
                setDetail('No prolonged eye closure detected. Tracking active.');
              } else {
                setStatus('Possible eye closure');
                setDetail('Checking whether this is a blink or prolonged closure.');
              }
            } else if (snapshot.stage === DrowsinessStage.critical) {
              triggerAlert('critical');
            }
          }
        }
      } catch (err) {
        console.warn('Frame processing error:', err);
      } finally {
        isBusyRef.current = false;
      }
    }

    // Keep continuous frame request going indefinitely while monitoring
    if (monitoring) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
    }
  }, [monitoring, simulatedClosure, level, triggerAlert, clearAlert, effectiveDriverName]);

  // Start frame processing when monitoring becomes active and camera is ready
  useEffect(() => {
    if (monitoring && cameraReady) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
    }
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [monitoring, cameraReady, processFrame]);

  // Request Hardware Camera - always re-prompts permission if not granted
  const startHardwareCamera = useCallback(async () => {
    savePreferences(driverName, voiceAlerts, ringtoneAlerts);
    setCameraError(null);
    setPermissionDenied(false);
    evaluatorRef.current.reset();
    lastDetectedStageRef.current = DrowsinessStage.attentive;
    missingFaceFramesRef.current = 0;
    setOpenForMs(0);
    setClosedForMs(0);

    setStatus('Requesting camera permission...');
    setDetail('Please allow camera access in the browser prompt to start monitoring.');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const msg = 'Camera API is not supported or is blocked by your browser/iframe policy.';
      setCameraError(msg);
      setPermissionDenied(true);
      setStatus('Camera could not start');
      setDetail(msg);
      return;
    }

    let mediaStream: MediaStream | null = null;
    let lastError: Error | null = null;

    // 1. First try front-facing camera with ideal resolution
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
    } catch (e: unknown) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }

    // 2. Try with loose facingMode if device doesn't support exact 'user' facing mode
    if (!mediaStream) {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'user' },
          },
          audio: false,
        });
      } catch (e: unknown) {
        lastError = e instanceof Error ? e : new Error(String(e));
      }
    }

    // 3. Try any available video camera
    if (!mediaStream) {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      } catch (e: unknown) {
        lastError = e instanceof Error ? e : new Error(String(e));
      }
    }

    if (mediaStream) {
      if (virtualCameraRef.current) {
        virtualCameraRef.current.stop();
        virtualCameraRef.current = null;
      }
      setStream(mediaStream);
      setIsVirtualCamera(false);
      setCameraError(null);
      setPermissionDenied(false);
      setMonitoring(true);
      setCameraReady(true);
      setLevel('normal');
      setStatus('Monitoring active');
      setDetail('Hardware camera active. Continuous eye tracking is running.');
    } else {
      const isDenied =
        lastError?.name === 'NotAllowedError' ||
        lastError?.name === 'PermissionDeniedError';
      const isNotFound =
        lastError?.name === 'NotFoundError' ||
        lastError?.name === 'DevicesNotFoundError';

      let msg = '';
      if (isDenied) {
        msg = 'Camera permission was not granted. Please allow camera access in your browser prompt or address bar to proceed.';
      } else if (isNotFound) {
        msg = 'No physical webcam detected on this device. Please connect a camera and try again.';
      } else {
        msg = `Camera access error: ${lastError?.message || lastError?.name || 'Failed to initialize'}`;
      }

      setCameraError(msg);
      setPermissionDenied(true);
      setMonitoring(false);
      setCameraReady(false);
      setLevel('normal');
      setStatus('Camera permission needed');
      setDetail(msg);
    }
  }, [driverName, voiceAlerts, ringtoneAlerts, savePreferences]);

  // Optional virtual camera demo fallback
  const startVirtualCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }

    const vCam = new VirtualDriverCamera();
    virtualCameraRef.current = vCam;
    vCam.setForcedClosed(simulatedClosure);
    const vStream = vCam.getStream();

    setStream(vStream);
    setIsVirtualCamera(true);
    setCameraError(null);
    setPermissionDenied(false);
    setMonitoring(true);
    setCameraReady(true);
    setLevel('normal');
    setStatus('Monitoring active (Virtual Camera)');
    setDetail('Running simulated driver video stream for responsive evaluation.');
  }, [simulatedClosure, stream]);

  const toggleSimulatedClosure = () => {
    setSimulatedClosure((prev) => {
      const next = !prev;
      if (virtualCameraRef.current) {
        virtualCameraRef.current.setForcedClosed(next);
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#F4F7F6] text-slate-800 flex flex-col items-center">
      {/* App Bar */}
      <header className="w-full max-w-md bg-transparent px-5 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-[#126B55]">
          <Car className="w-6 h-6 stroke-[2.5]" />
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
            Pseudo Driver AI
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <PWAInstallButton />
          {monitoring && currentTab === 'drowsiness' && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-[#126B55] border border-emerald-300">
              <span className="w-2 h-2 rounded-full bg-[#126B55] animate-ping" />
              Tracking Active
            </span>
          )}
        </div>
      </header>

      {/* Mode Navigation Tabs */}
      <nav className="w-full max-w-md px-4 pt-1 pb-3">
        <div className="grid grid-cols-2 p-1 bg-slate-200/80 rounded-2xl border border-slate-300/60 shadow-inner">
          <button
            type="button"
            onClick={() => setCurrentTab('drowsiness')}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              currentTab === 'drowsiness'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Eye className="w-4 h-4 text-[#126B55]" />
            Drowsiness Alert
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('collision')}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              currentTab === 'collision'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            Collision Detection
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <main className="w-full max-w-md px-4 pb-8 flex flex-col gap-4">
        {currentTab === 'collision' ? (
          <CollisionPage driverName={effectiveDriverName} />
        ) : (
          <>
            {/* Banner Card */}
        <section className="bg-[#123D34] rounded-[20px] p-3 text-white shadow-md relative overflow-hidden">
          <div className="flex flex-col items-start">
            <h2 className="text-2xl font-extrabold leading-[1.12] tracking-tight">
              Stay alert - Reach home safe.
            </h2>
            <p className="mt-2 text-sm text-[#D5E9E2] font-normal leading-relaxed">
              On-device face and eye monitoring with continuous tracking and personalized warnings.
            </p>
          </div>
        </section>

        {/* Camera Preview Area (When monitoring active) */}
        {cameraReady && (
          <CameraView
            videoRef={videoRef}
            stream={stream}
            error={cameraError}
            isVirtual={isVirtualCamera}
            onRequestPermissionAgain={startHardwareCamera}
            detectionResult={detectionResult}
            simulatedClosure={simulatedClosure}
            onToggleSimulatedClosure={toggleSimulatedClosure}
          />
        )}

        {/* Permission Denied Card (When user needs to grant permission) */}
        {permissionDenied && !monitoring && (
          <section className="bg-amber-50 border border-amber-300/80 rounded-2xl p-4.5 shadow-xs">
            <div className="flex items-start gap-3">
              <Camera className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-bold text-amber-900 text-sm">
                  Hardware Camera Permission Required
                </h3>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  {cameraError || 'The browser blocked camera access. Please grant camera permission to begin monitoring.'}
                </p>

                <div className="mt-3 bg-white/80 p-2.5 rounded-xl border border-amber-200 text-[11px] text-amber-900 space-y-1">
                  <p className="font-semibold">How to allow camera:</p>
                  <ol className="list-decimal pl-4 space-y-0.5 text-slate-700">
                    <li>Look for the lock 🔒 or camera 📷 icon in your browser address bar</li>
                    <li>Toggle <strong>Camera</strong> to <strong>Allow</strong></li>
                    <li>Click <strong>Request Camera Permission Again</strong> below</li>
                  </ol>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={startHardwareCamera}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#126B55] hover:bg-[#0f5846] text-white shadow-xs transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Request Camera Permission Again
                  </button>

                  {isInIframe && (
                    <a
                      href={window.location.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                      Open App in New Tab
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={startVirtualCamera}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-[#126B55] hover:bg-emerald-100/60 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Or test with Virtual Camera Demo
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Status Card with 30s recovery indicator */}
        <StatusCard
          level={level}
          status={status}
          detail={detail}
          eyeProbability={
            monitoring ? detectionResult?.overallEyeOpenProbability : null
          }
          closedForMs={closedForMs}
          openForMs={openForMs}
          recoveryTargetMs={30000}
        />

        {/* Driver Profile Section */}
        <section className="mt-1">
          <h3 className="text-lg font-extrabold text-slate-900 mb-2">
            Driver profile
          </h3>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <User className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={driverName}
              disabled={monitoring}
              onChange={(e) => {
                setDriverName(e.target.value);
                savePreferences(e.target.value, voiceAlerts, ringtoneAlerts);
              }}
              placeholder="Enter driver name"
              aria-label="What should the app call you?"
              className={`w-full bg-white rounded-2xl py-3.5 pl-11 pr-4 text-sm font-medium text-slate-800 placeholder-slate-400 border border-slate-200/80 shadow-xs focus:outline-hidden focus:ring-2 focus:ring-[#126B55]/50 focus:border-[#126B55] transition-all ${
                monitoring ? 'bg-slate-100 opacity-70 cursor-not-allowed' : ''
              }`}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-1 pl-1">
            What should the app call you in audio warnings?
          </p>
        </section>

        {/* Alert Preferences Section */}
        <section className="mt-1">
          <h3 className="text-lg font-extrabold text-slate-900 mb-2">
            Alert preferences
          </h3>
          <PreferenceTile
            icon={<Volume2 className="w-5 h-5" />}
            title="Speak my name"
            subtitle="Spoken warning through text-to-speech."
            value={voiceAlerts}
            onChanged={(val) => {
              setVoiceAlerts(val);
              savePreferences(driverName, val, ringtoneAlerts);
            }}
          />
          <PreferenceTile
            icon={<BellRing className="w-5 h-5" />}
            title="Ringtone and vibration"
            subtitle="Repeating alarm for escalating warnings."
            value={ringtoneAlerts}
            onChanged={(val) => {
              setRingtoneAlerts(val);
              savePreferences(driverName, voiceAlerts, val);
            }}
          />
        </section>

        {/* Action Buttons */}
        <section className="flex flex-col gap-2.5 mt-2">
          <button
            type="button"
            onClick={monitoring ? () => stopMonitoring() : startHardwareCamera}
            className={`w-full min-h-[56px] rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 shadow-sm transition-all duration-200 cursor-pointer ${
              monitoring
                ? 'bg-rose-700 hover:bg-rose-800 text-white active:scale-[0.99]'
                : 'bg-[#126B55] hover:bg-[#0f5846] text-white active:scale-[0.99]'
            }`}
          >
            {monitoring ? (
              <>
                <StopCircle className="w-5 h-5" />
                Stop monitoring
              </>
            ) : (
              <>
                <PlayCircle className="w-5 h-5" />
                Start camera monitoring
              </>
            )}
          </button>

          {/* <button
            type="button"
            onClick={() => triggerAlert('warning')}
            className="w-full min-h-[50px] rounded-2xl font-bold text-sm text-[#126B55] border-2 border-[#126B55]/30 hover:border-[#126B55] hover:bg-[#126B55]/5 flex items-center justify-center gap-2 bg-transparent transition-all duration-200 active:scale-[0.99] cursor-pointer"
          >
            <Volume2 className="w-4 h-4" />
            Test personalized alert
          </button> */}
        </section>

        {/* Safety Disclaimer */}
        <footer className="mt-2 text-center">
          <p className="text-[12px] leading-[1.4] text-slate-500 font-normal">
            Experimental prototype, not an automotive-certified safety system.
            Detection may fail with sunglasses, poor lighting, camera movement,
            or device limitations. Never interact with the phone while driving;
            stop safely and rest if sleepy.
          </p>
        </footer>
          </>
        )}
      </main>

      {/* Offline Connectivity Banner */}
      <OfflineIndicator />
    </div>
  );
};

export default App;
