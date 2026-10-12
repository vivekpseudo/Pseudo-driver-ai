import 'dart:async';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:vibration/vibration.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const PseudoDriverApp());
}

class PseudoDriverApp extends StatelessWidget {
  const PseudoDriverApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Pseudo Driver AI', debugShowCheckedModeBanner: false,
    theme: ThemeData(useMaterial3: true, colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF126B55)), scaffoldBackgroundColor: const Color(0xFFF4F7F6)),
    home: const DriverHomePage(),
  );
}

enum AlertLevel { normal, warning, critical }

class DriverHomePage extends StatefulWidget {
  const DriverHomePage({super.key});
  @override
  State<DriverHomePage> createState() => _DriverHomePageState();
}

class _DriverHomePageState extends State<DriverHomePage> with WidgetsBindingObserver {
  final _nameController = TextEditingController();
  final _tts = FlutterTts();
  final _player = AudioPlayer();
  CameraController? _camera;
  FaceDetector? _detector;
  bool _monitoring = false, _busy = false, _voiceAlerts = true, _ringtoneAlerts = true;
  bool _cameraReady = false;
  String _status = 'Monitoring is off';
  String _detail = 'Set up your profile, then start monitoring while parked.';
  AlertLevel _level = AlertLevel.normal;
  DateTime? _lastAlertAt;
  final _drowsinessEvaluator = DrowsinessEvaluator();
  DrowsinessStage _lastDetectedStage = DrowsinessStage.attentive;
  int _missingFaceFrames = 0;
  String get _driverName => _nameController.text.trim().isEmpty ? 'Driver' : _nameController.text.trim();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadSettings();
    _detector = FaceDetector(options: FaceDetectorOptions(performanceMode: FaceDetectorMode.fast, enableClassification: true, enableLandmarks: false, enableContours: false, minFaceSize: 0.15));
    _tts.setLanguage('en-IN'); _tts.setSpeechRate(0.48); _tts.setVolume(1.0);
    _player.setReleaseMode(ReleaseMode.loop);
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() {
      _nameController.text = prefs.getString('driver_name') ?? '';
      _voiceAlerts = prefs.getBool('voice_alerts') ?? true;
      _ringtoneAlerts = prefs.getBool('ringtone_alerts') ?? true;
    });
  }
  Future<void> _saveSettings() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('driver_name', _nameController.text.trim());
    await prefs.setBool('voice_alerts', _voiceAlerts);
    await prefs.setBool('ringtone_alerts', _ringtoneAlerts);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if ((state == AppLifecycleState.inactive || state == AppLifecycleState.paused) && _monitoring) {
      _stopMonitoring(reason: 'Monitoring paused because the app left the foreground.');
    }
  }

  Future<void> _startMonitoring() async {
    try {
      await _saveSettings();
      final cameras = await availableCameras();
      final front = cameras.where((c) => c.lensDirection == CameraLensDirection.front);
      if (front.isEmpty) throw StateError('No front-facing camera is available.');
      final controller = CameraController(front.first, ResolutionPreset.medium, enableAudio: false, imageFormatGroup: ImageFormatGroup.nv21);
      _camera = controller;
      await controller.initialize();
      if (!mounted) return;
      setState(() { _monitoring = true; _cameraReady = true; _status = 'Monitoring active'; _detail = 'Keep the phone securely mounted and your face visible.'; _level = AlertLevel.normal; });
      await controller.startImageStream(_processCameraImage);
    } catch (e) {
      await _disposeCamera();
      if (!mounted) return;
      setState(() { _monitoring = false; _cameraReady = false; _status = 'Camera could not start'; _detail = 'Check camera permission and device compatibility. $e'; });
    }
  }

  InputImage? _toInputImage(CameraImage image, CameraDescription camera) {
    final rotation = InputImageRotationValue.fromRawValue(camera.sensorOrientation);
    if (rotation == null || image.planes.isEmpty) return null;
    final format = InputImageFormatValue.fromRawValue(image.format.raw);
    if (format == null) return null;
    // Metadata must match the actual native camera image format and byte layout.
    return InputImage.fromBytes(bytes: image.planes.first.bytes, metadata: InputImageMetadata(
      size: Size(image.width.toDouble(), image.height.toDouble()),
      rotation: rotation, format: format, bytesPerRow: image.planes.first.bytesPerRow,
    ));
  }

  Future<void> _processCameraImage(CameraImage image) async {
    if (_busy || !_monitoring || _camera == null || _detector == null) return;
    _busy = true;
    try {
      final input = _toInputImage(image, _camera!.description);
      if (input == null) { _setStatus('Camera format unsupported', 'This device camera stream could not be decoded.'); return; }
      final faces = await _detector!.processImage(input);
      if (faces.isEmpty) {
        _missingFaceFrames++;
        if (_missingFaceFrames >= 8) { _eyesClosedSince = null; _setStatus('Face not visible', 'Adjust the phone so your face is visible.'); }
        return;
      }
      _missingFaceFrames = 0;
      final face = faces.reduce((a, b) => a.boundingBox.width * a.boundingBox.height >= b.boundingBox.width * b.boundingBox.height ? a : b);
      final left = face.leftEyeOpenProbability, right = face.rightEyeOpenProbability;
      if (left == null || right == null) { _setStatus('Checking eye visibility', 'Eye-state confidence is unavailable; make sure eyes are visible.'); return; }
      final eyeOpen = (left + right) / 2;
      final snapshot = _drowsinessEvaluator.update(eyeOpen, DateTime.now());
      if (snapshot.stage != _lastDetectedStage) {
        _lastDetectedStage = snapshot.stage;
        if (snapshot.stage == DrowsinessStage.critical) {
          await _triggerAlert(AlertLevel.critical);
        } else if (snapshot.stage == DrowsinessStage.warning) {
          await _triggerAlert(AlertLevel.warning);
        } else if (snapshot.stage == DrowsinessStage.attentive) {
          if (_level != AlertLevel.normal) {
            await _clearAlert();
          } else {
            _setStatus('Eyes appear open', 'No prolonged eye closure detected in current frames.');
          }
        } else {
          _setStatus('Possible eye closure', 'Checking whether this is a blink or prolonged closure.');
        }
      } else if (snapshot.stage == DrowsinessStage.critical) {
        // Repeat a critical alarm at a controlled interval if closure persists.
        await _triggerAlert(AlertLevel.critical);
      }
    } catch (e) {
      _setStatus('Detection error', 'Camera analysis failed. Stop monitoring and restart if safe. $e');
    } finally { _busy = false; }
  }

  void _setStatus(String status, String detail) {
    if (!mounted) return;
    setState(() { _status = status; _detail = detail; });
  }

  Future<void> _triggerAlert(AlertLevel level) async {
    final now = DateTime.now();
    if (_level.index >= level.index && _lastAlertAt != null && now.difference(_lastAlertAt!).inSeconds < 8) return;
    _lastAlertAt = now;
    if (!mounted) return;
    setState(() {
      _level = level; _status = level == AlertLevel.critical ? 'DROWSINESS WARNING' : 'Stay alert';
      _detail = level == AlertLevel.critical ? '$_driverName, you may be drowsy. Please pull over safely and rest.' : '$_driverName, please stay alert.';
    });
    if (_ringtoneAlerts) {
      try { await _player.stop(); await _player.play(AssetSource('audio/alarm.wav')); } catch (_) {}
    }
    if (await Vibration.hasVibrator() ?? false) {
      Vibration.vibrate(pattern: level == AlertLevel.critical ? [0, 700, 250, 700, 250, 1000] : [0, 350, 200, 350]);
    }
    if (_voiceAlerts) {
      await _tts.stop();
      await _tts.speak(level == AlertLevel.critical ? '$_driverName, you may be drowsy. Please pull over safely and rest.' : '$_driverName, please stay alert.');
    }
  }

  Future<void> _clearAlert() async {
    await _player.stop(); await _tts.stop(); Vibration.cancel();
    if (!mounted) return;
    setState(() { _level = AlertLevel.normal; _status = 'Monitoring active'; _detail = 'Eyes appear open again. Continue only if fully alert.'; });
  }

  Future<void> _stopMonitoring({String reason = 'Monitoring stopped.'}) async {
    await _disposeCamera(); await _player.stop(); await _tts.stop(); Vibration.cancel();
    if (!mounted) return;
    setState(() { _monitoring = false; _cameraReady = false; _level = AlertLevel.normal; _status = 'Monitoring is off'; _detail = reason; });
  }
  Future<void> _disposeCamera() async {
    final camera = _camera; _camera = null;
    if (camera != null) {
      try { if (camera.value.isStreamingImages) await camera.stopImageStream(); } catch (_) {}
      await camera.dispose();
    }
  }
  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _nameController.dispose(); _detector?.close(); _camera?.dispose(); _player.dispose(); _tts.stop();
    super.dispose();
  }

  Color get _levelColor => switch (_level) {
    AlertLevel.normal => const Color(0xFF126B55),
    AlertLevel.warning => const Color(0xFFB56A00),
    AlertLevel.critical => const Color(0xFFB42318),
  };

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Row(children: [Icon(Icons.remove_red_eye_outlined), SizedBox(width: 10), Text('Pseudo Driver AI', style: TextStyle(fontWeight: FontWeight.w800))])),
    body: SafeArea(child: ListView(padding: const EdgeInsets.fromLTRB(18, 8, 18, 26), children: [
      Container(padding: const EdgeInsets.all(22), decoration: BoxDecoration(color: const Color(0xFF123D34), borderRadius: BorderRadius.circular(24)), child: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(Icons.local_shipping_outlined, color: Colors.white, size: 34), SizedBox(height: 14),
        Text('Stay alert.\nReach home safe.', style: TextStyle(color: Colors.white, fontSize: 28, height: 1.12, fontWeight: FontWeight.w800)),
        SizedBox(height: 8), Text('On-device face and eye monitoring with personalized warnings.', style: TextStyle(color: Color(0xFFD5E9E2), fontSize: 14)),
      ])),
      const SizedBox(height: 18),
      if (_cameraReady && _camera != null) ...[
        ClipRRect(borderRadius: BorderRadius.circular(20), child: AspectRatio(aspectRatio: _camera!.value.aspectRatio, child: CameraPreview(_camera!))),
        const SizedBox(height: 16),
      ],
      _statusCard(), const SizedBox(height: 20),
      const Text('Driver profile', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)), const SizedBox(height: 9),
      TextField(controller: _nameController, enabled: !_monitoring, textCapitalization: TextCapitalization.words, onChanged: (_) => setState(() {}),
        decoration: InputDecoration(labelText: 'What should the app call you?', hintText: 'Enter driver name', prefixIcon: const Icon(Icons.person_outline), filled: true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none))),
      const SizedBox(height: 18), const Text('Alert preferences', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)), const SizedBox(height: 8),
      _PreferenceTile(icon: Icons.record_voice_over_outlined, title: 'Speak my name', subtitle: 'Spoken warning through text-to-speech.', value: _voiceAlerts, onChanged: (v) { setState(() => _voiceAlerts = v); _saveSettings(); }),
      _PreferenceTile(icon: Icons.notifications_active_outlined, title: 'Ringtone and vibration', subtitle: 'Repeating alarm for escalating warnings.', value: _ringtoneAlerts, onChanged: (v) { setState(() => _ringtoneAlerts = v); _saveSettings(); }),
      const SizedBox(height: 14),
      FilledButton.icon(onPressed: _monitoring ? () => _stopMonitoring() : _startMonitoring, icon: Icon(_monitoring ? Icons.stop_circle_outlined : Icons.play_circle_outline), label: Text(_monitoring ? 'Stop monitoring' : 'Start camera monitoring'), style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(56), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)))),
      const SizedBox(height: 10),
      OutlinedButton.icon(onPressed: () => _triggerAlert(AlertLevel.warning), icon: const Icon(Icons.volume_up_outlined), label: const Text('Test personalized alert'), style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(50))),
      const SizedBox(height: 16),
      const Text('Experimental prototype, not an automotive-certified safety system. Detection may fail with sunglasses, poor lighting, camera movement, or device limitations. Never interact with the phone while driving; stop safely and rest if sleepy.', style: TextStyle(color: Colors.black54, fontSize: 12, height: 1.4)),
    ])),
  );

  Widget _statusCard() => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(color: _levelColor.withValues(alpha: 0.08), border: Border.all(color: _levelColor.withValues(alpha: 0.3)), borderRadius: BorderRadius.circular(18)),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Icon(_level == AlertLevel.critical ? Icons.warning_rounded : _level == AlertLevel.warning ? Icons.notifications_active : Icons.shield_outlined, color: _levelColor, size: 28),
      const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(_status, style: TextStyle(fontWeight: FontWeight.w800, color: _levelColor, fontSize: 16)), const SizedBox(height: 5), Text(_detail, style: const TextStyle(height: 1.35)),
      ])),
    ]),
  );
}

class _PreferenceTile extends StatelessWidget {
  const _PreferenceTile({required this.icon, required this.title, required this.subtitle, required this.value, required this.onChanged});
  final IconData icon; final String title; final String subtitle; final bool value; final ValueChanged<bool> onChanged;
  @override
  Widget build(BuildContext context) => Card(color: Colors.white, elevation: 0, margin: const EdgeInsets.only(bottom: 8), child: SwitchListTile(
    secondary: Icon(icon, color: const Color(0xFF126B55)), title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
    subtitle: Text(subtitle), value: value, onChanged: onChanged,
  ));
}
