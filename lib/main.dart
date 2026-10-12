import 'package:flutter/material.dart';

void main() => runApp(const PseudoDriverApp());

class PseudoDriverApp extends StatelessWidget {
  const PseudoDriverApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Pseudo Driver AI',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF126B55),
          brightness: Brightness.light,
        ),
        scaffoldBackgroundColor: const Color(0xFFF4F7F6),
      ),
      home: const DriverHomePage(),
    );
  }
}

class DriverHomePage extends StatefulWidget {
  const DriverHomePage({super.key});

  @override
  State<DriverHomePage> createState() => _DriverHomePageState();
}

class _DriverHomePageState extends State<DriverHomePage> {
  final _nameController = TextEditingController();
  bool _monitoringRequested = false;
  bool _voiceAlerts = true;
  bool _ringtoneAlerts = true;

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final name = _nameController.text.trim().isEmpty
        ? 'Driver'
        : _nameController.text.trim();

    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.remove_red_eye_outlined),
            SizedBox(width: 10),
            Text('Pseudo Driver AI', style: TextStyle(fontWeight: FontWeight.w700)),
          ],
        ),
        backgroundColor: const Color(0xFFF4F7F6),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
          children: [
            Container(
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(
                color: const Color(0xFF123D34),
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.local_shipping_outlined, color: Colors.white, size: 34),
                  SizedBox(height: 18),
                  Text(
                    'Stay alert.
Reach home safe.',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 28,
                      height: 1.12,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  SizedBox(height: 10),
                  Text(
                    'Personalized voice and ringtone alerts for driver fatigue.',
                    style: TextStyle(color: Color(0xFFD5E9E2), fontSize: 14),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 22),
            const Text('Driver profile', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            TextField(
              controller: _nameController,
              textCapitalization: TextCapitalization.words,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                labelText: 'What should the app call you?',
                hintText: 'Enter driver name',
                prefixIcon: const Icon(Icons.person_outline),
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 22),
            const Text('Alert preferences', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            _PreferenceTile(
              icon: Icons.record_voice_over_outlined,
              title: 'Speak my name',
              subtitle: 'Voice warning such as “$name, please stay alert.”',
              value: _voiceAlerts,
              onChanged: (value) => setState(() => _voiceAlerts = value),
            ),
            _PreferenceTile(
              icon: Icons.notifications_active_outlined,
              title: 'Loud ringtone alarm',
              subtitle: 'Escalating sound and vibration on warning.',
              value: _ringtoneAlerts,
              onChanged: (value) => setState(() => _ringtoneAlerts = value),
            ),
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF4DB),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFF0D99E)),
              ),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline, color: Color(0xFF855B00)),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Prototype stage: live camera analysis and real drowsiness detection are not connected yet. Do not rely on this screen for driving safety.',
                      style: TextStyle(color: Color(0xFF694900), height: 1.35),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: () => setState(() => _monitoringRequested = !_monitoringRequested),
              icon: Icon(_monitoringRequested ? Icons.stop_circle_outlined : Icons.play_circle_outline),
              label: Text(_monitoringRequested ? 'Cancel setup' : 'Set up monitoring'),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(56),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
            ),
            if (_monitoringRequested) ...[
              const SizedBox(height: 12),
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Icon(Icons.construction_outlined, color: Color(0xFF126B55), size: 28),
                      SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Camera and on-device AI integration is the next milestone. Monitoring has not started.',
                          style: TextStyle(height: 1.35),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
            const SizedBox(height: 16),
            const Center(
              child: Text(
                'A safety aid prototype — never a substitute for rest.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.black54, fontSize: 12),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PreferenceTile extends StatelessWidget {
  const _PreferenceTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Colors.white,
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      child: SwitchListTile(
        secondary: Icon(icon, color: const Color(0xFF126B55)),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(subtitle),
        value: value,
        onChanged: onChanged,
      ),
    );
  }
}
