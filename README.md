# Pseudo Driver AI (React)

A mobile-responsive web-based driver drowsiness detection and personalized alert prototype, rewritten from the original Flutter application to React with Vite and TypeScript.

## Features

- **Driver Dashboard**: Responsive layout with driver profile name and alert preferences stored in `localStorage`.
- **Front-Camera Monitoring**: Live front-facing camera preview with real-time face detection and eye-open probability tracking.
- **Eye-Closure Evaluation Engine**: Temporal smoothing and heuristic state machine matching the original specification (`DrowsinessEvaluator`):
  - Eye-open probability threshold: `< 0.28` begins closure timer.
  - Warning stage: `>= 900ms` of closure triggers caution alert.
  - Critical stage: `>= 1800ms` of closure triggers critical drowsiness escalation.
  - Recovery period: `>= 1200ms` of continuous open eyes restores attentive status.
- **Multimodal Alerts**:
  - **Text-to-Speech**: Personalized spoken warnings with driver name via Web Speech Synthesis API.
  - **Synthesized Ringtone**: Looping dual-frequency audio alarm via Web Audio API.
  - **Haptic Vibration**: Vibration escalation patterns via Web Vibration API.
- **Interactive Verification**: "Test personalized alert" button and in-preview "Simulate Eye Closure" control for quick end-to-end evaluation.
- **Foreground Lifecycle Safety**: Monitoring pauses immediately if the browser tab leaves the foreground.

## Technology Stack

- React 19 + TypeScript
- Vite 6
- Tailwind CSS v4
- Lucide React Icons
- Web Speech Synthesis API & Web Audio API

## Build and Run

```bash
npm install
npm run dev
```

Dev server runs on `http://0.0.0.0:3000`.

## Production Build

```bash
npm run build
```

## Important Safety Limitations

This is an experimental prototype and not an automotive-certified safety system. Do not rely on it while operating a motor vehicle. If feeling tired or fatigued, pull over safely and rest.
