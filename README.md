# Pseudo Driver AI (Flutter)

Mobile-only driver drowsiness detection prototype inspired by [DrishtiDrive AI](https://github.com/swapnil3104/Portable-AI-Based-Drowsiness-Detection-and-Alert-System-for-Indian-Truck-Drivers).

## Product scope
- Flutter app for Android first, with iOS considered where background/camera/audio constraints allow.
- Front-facing camera preview while a trip is actively monitored.
- On-device face/eye landmark inference planned; temporal logic should distinguish natural blinks from sustained eye closure and other fatigue signals.
- Escalating alerts: subtle prompt, loud repeating ringtone/vibration, then spoken driver-name warning.
- Configurable driver name, alert mode, sensitivity and sound test.
- Privacy-first: process frames on device; do not store or upload camera frames by default.

## Current implementation status
This repository starts with product architecture and implementation notes. A production-ready on-device model, Android/iOS camera lifecycle, and background execution behavior must be integrated and tested on real devices before this can be used for driving.

## Suggested architecture
- Flutter UI and app state: Material 3.
- Camera: `camera` package; keep monitoring session visible and foregrounded.
- On-device inference: MediaPipe Face Landmarker / face mesh via a maintained Flutter plugin or a small native platform channel; alternatively convert a validated model to TFLite/ONNX Mobile where supported.
- Detection pipeline: face presence and quality checks → eye openness / prolonged closure and optional yawn/head-pose features → time-window smoothing → alert state machine.
- Alerts: `flutter_tts` for personalized spoken alert, `audioplayers` for a bundled alarm tone, `vibration` for haptic escalation, `shared_preferences` for local configuration.
- No server required for core monitoring.

## Alert policy (initial values to validate)
1. **Attention**: show live status; no alarm.
2. **Warning**: suspected sustained eye closure triggers a short tone and voice: “{driver name}, please stay alert.”
3. **Critical**: persistent/repeated drowsiness triggers looping alarm, vibration and repeated spoken warning: “{driver name}, you may be drowsy. Please pull over safely and rest.”
4. **Recovery**: stop escalating only after the face/eyes indicate recovery for a configurable clear interval; provide a manual “I have stopped safely” action.
   
Thresholds are provisional and must be calibrated with real-world data. This is not an automotive-certified safety system and must not be treated as a substitute for sleep, breaks, or safe driving.

## Suggested app structure
```
lib/
  main.dart
  app/
    app.dart
    theme.dart
  features/
    onboarding/
    driver_profile/
    monitoring/
      camera_preview.dart
      drowsiness_detector.dart
      detection_state.dart
      alert_coordinator.dart
    settings/
  shared/
    services/
      speech_alert_service.dart
      alarm_service.dart
      preferences_service.dart
assets/
  audio/
    alarm_loop.mp3
```

## Milestones
1. Build driver profile, settings and monitor UI.
2. Add camera permissions, front camera lifecycle, no-frame-persistence policy.
3. Integrate and benchmark face/eye landmark model on target Android phones.
4. Implement temporal detection and staged alert state machine.
5. Add voice/ringtone/vibration alerting and interruption/recovery handling.
6. Validate in parked vehicles, day/night lighting, glasses, camera positions, phone overheating and battery tests.
7. Safety review and field evaluation before any real driving use.

## Local development
Install Flutter stable and Android Studio. Once a Flutter scaffold is added:
```bash
flutter pub get
flutter analyze
flutter test
flutter run
``

## Safety notice
This is an experimental driver-assistance prototype. A phone camera can be occluded, poorly positioned, or unable to detect eye state under sunglasses/low light. The app can miss drowsiness or produce false alarms. Drivers must stop at a safe location whenever sleepy and must not interact with the phone while driving.
