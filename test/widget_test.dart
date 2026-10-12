import 'package:flutter_test/flutter_test.dart';
import 'package:pseudo_driver_ai/main.dart';

void main() {
  testWidgets('shows driver safety dashboard and alert preferences', (tester) async {
    await tester.pumpWidget(const PseudoDriverApp());

    expect(find.text('Pseudo Driver AI'), findsOneWidget);
    expect(find.text('Stay alert.\nReach home safe.'), findsOneWidget);
    expect(find.text('Speak my name'), findsOneWidget);
    expect(find.text('Loud ringtone alarm'), findsOneWidget);
    expect(find.text('Set up monitoring'), findsOneWidget);
  });
}
