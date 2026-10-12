import 'package:flutter_test/flutter_test.dart';
import 'package:pseudo_driver_ai/features/monitoring/drowsiness_evaluator.dart';

void main() {
  group('DrowsinessEvaluator', () {
    final start = DateTime(2026, 1, 1);

    test('does not warn for a brief natural blink', () {
      final evaluator = DrowsinessEvaluator();
      expect(evaluator.update(0.1, start).stage, DrowsinessStage.possibleClosure);
      expect(evaluator.update(0.9, start.add(const Duration(milliseconds: 250))).stage, DrowsinessStage.possibleClosure);
      expect(evaluator.update(0.9, start.add(const Duration(milliseconds: 1500))).stage, DrowsinessStage.attentive);
    });

    test('escalates prolonged closure from warning to critical', () {
      final evaluator = DrowsinessEvaluator();
      expect(evaluator.update(0.1, start).stage, DrowsinessStage.possibleClosure);
      expect(evaluator.update(0.1, start.add(const Duration(milliseconds: 950))).stage, DrowsinessStage.warning);
      expect(evaluator.update(0.1, start.add(const Duration(milliseconds: 1850))).stage, DrowsinessStage.critical);
    });

    test('clears only after the configured recovery interval', () {
      final evaluator = DrowsinessEvaluator();
      evaluator.update(0.1, start);
      evaluator.update(0.1, start.add(const Duration(seconds: 2)));
      expect(evaluator.update(0.9, start.add(const Duration(seconds: 2, milliseconds: 100))).stage, DrowsinessStage.critical);
      expect(evaluator.update(0.9, start.add(const Duration(seconds: 3, milliseconds: 400))).stage, DrowsinessStage.attentive);
    });

    test('reset clears accumulated temporal state', () {
      final evaluator = DrowsinessEvaluator();
      evaluator.update(0.1, start);
      evaluator.reset();
      expect(evaluator.stage, DrowsinessStage.attentive);
      expect(evaluator.update(0.1, start.add(const Duration(seconds: 4))).stage, DrowsinessStage.possibleClosure);
    });
  });
}
