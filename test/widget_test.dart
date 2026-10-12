import 'package:flutter_test/flutter_test.dart';
import 'package:pseudo_driver_ai/main.dart';

void main() {
  testWidgets('shows dashboard, profile and alert controls', (tester) async {
    await tester.pumpWidget(const PseudoDriverApp());
    expect(find.text('Pseudo Driver AI'), findsOneWidget);
    expect(find.text('Stay alert.\nReach home safe.'), findsOneWidget);
    expect(find.text('Speak my name'), findsOneWidget);
    expect(find.text('Ringtone and vibration'), findsOneWidget);
    expect(find.text('Start camera monitoring'), findsOneWidget);
    expect(find.text('Test personalized alert'), findsOneWidget);
  });
}
