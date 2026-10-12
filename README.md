# Pseudo Driver AI (Flutter)

A mobile-only driver alert prototype inspired by [DrishtiDrive AI](https://github.com/swapnil3104/Portable-AI-Based-Drowsiness-Detection-and-Alert-System-for-Indian-Truck-Drivers). This repository is focused on Android-first phone-only use; it does not require Raspberry Pi hardware, a vehicle ECU, or a cloud backend for the camera analysis path.

## Implemented in the current prototype

- Flutter dashboard with driver name and alert preferences saved locally.
- Front-camera preview and image-stream processing.
- Google ML Kit face detection with eye-open probability classification where supported.
- Initial temporal eye-closure heuristic (provisional thresholds, not a validated fatigue model).
- Personalized text-to-speech warnings, vibration, and an optional looping audio asset.
- Visible warning/status panel and manual alert test button.
- Camera use stops when the app leaves the foreground.

## Latest implementation additions

- Extracted temporal eye-closure evaluation into `lib/features/monitoring/drowsiness_evaluator.dart` so its timing behavior can be unit-tested independently of the camera.
- Added `test/drowsiness_evaluator_test.dart` for short-blink handling, warning/critical escalation, recovery timing, and reset behavior.
- Added GitHub Actions workflow at `.github/workflows/flutter-ci.yml` to run `flutter pub get`, `flutter analyze`, and `flutter test` on pushes and pull requests. The workflow result must be checked after GitHub runs it; it has not been executed locally in this coding session.

## Important limitations

**This is not a production-ready or automotive-certified safety system. Do not rely on it while driving.** The eye-open probability is only a heuristic; it can be missing or inaccurate due to sunglasses, darkness, glare, face angle, camera quality, skin/eye appearance, or device-specific image formats. Prolonged eye closure is not, by itself, a validated drowsiness diagnosis. Thresholds need controlled evaluation and calibration.

The camera stream-to-ML-Kit image metadata is device/plugin dependent. The current implementation has not been built or tested on physical Android/iOS devices in this environment. Verify it with the exact target phones before any field evaluation.

## Technology

- Flutter / Dart
- `camera` for foreground camera streaming
- `google_mlkit_face_detection` for face detection and eye-open probability classification
- `flutter_tts` for spoken alerts
- `audioplayers` for ringtone-style audio
- `vibration` for haptic escalation
- `shared_preferences` for local driver settings

No camera frames are intentionally stored or sent to a server by this app.

## Build and run

1. Install the current stable Flutter SDK and Android Studio.
2. Clone this repository.
3. Add a properly licensed alarm sound at `assets/audio/alarm.wav` (see `assets/audio/README.md`). If omitted, ringtone playback is unavailable; spoken/visual alerts may still work.
4. Run:

   ```bash
   flutter pub get
   flutter analyze
   flutter test
   flutter run
   ```

5. Grant camera permission when prompted and test the camera preview and alert button while parked.

The iOS project needs the usual Flutter-generated Xcode project files and must be built on macOS. Camera image formats and ML Kit support should be validated independently for iOS before claiming platform support.

## Alert logic (experimental)

- Eye-open probability below 0.28 starts a provisional closure timer.
- At around 0.9 seconds, a warning may be triggered.
- At around 1.8 seconds, a critical voice/alarm warning may be triggered.
- The alert clears after the eyes appear open continuously for about 1.2 seconds.

These are engineering starting points only, not medically or automotive validated thresholds. Tune only against a labeled evaluation dataset and assess false negatives as well as false positives. Do not use this as a reason to continue driving while sleepy.

## Safety guidance

- Set up the phone securely before the trip; do not interact with it while moving.
- If sleepy, pull over at a safe place and rest. An alert cannot make drowsy driving safe.
- Keep the monitoring app in the foreground; background camera use is intentionally not implemented.
- Conduct controlled tests while parked, then formal evaluation with consent and safety supervision before considering any road use.
