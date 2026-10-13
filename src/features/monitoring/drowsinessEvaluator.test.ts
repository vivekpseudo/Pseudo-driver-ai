import { DrowsinessEvaluator, DrowsinessStage } from './drowsinessEvaluator';

/**
 * Unit tests ported and updated:
 * - does not warn for a brief natural blink
 * - escalates prolonged closure from warning to critical
 * - clears only after 30 seconds of continuous open eyes
 * - reset clears accumulated temporal state
 */
export function runDrowsinessEvaluatorTests(): { passed: boolean; message: string }[] {
  const results: { passed: boolean; message: string }[] = [];
  const start = new Date(2026, 0, 1, 0, 0, 0, 0).getTime();

  // Test 1: does not warn for a brief natural blink
  {
    const evaluator = new DrowsinessEvaluator({ recoveryAfterMs: 1200 });
    const s1 = evaluator.update(0.1, start);
    const s2 = evaluator.update(0.9, start + 250);
    const s3 = evaluator.update(0.9, start + 1500);

    const pass =
      s1.stage === DrowsinessStage.possibleClosure &&
      s2.stage === DrowsinessStage.possibleClosure &&
      s3.stage === DrowsinessStage.attentive;
    results.push({
      passed: pass,
      message: 'does not warn for a brief natural blink',
    });
  }

  // Test 2: escalates prolonged closure from warning to critical
  {
    const evaluator = new DrowsinessEvaluator();
    const s1 = evaluator.update(0.1, start);
    const s2 = evaluator.update(0.1, start + 950);
    const s3 = evaluator.update(0.1, start + 1850);

    const pass =
      s1.stage === DrowsinessStage.possibleClosure &&
      s2.stage === DrowsinessStage.warning &&
      s3.stage === DrowsinessStage.critical;
    results.push({
      passed: pass,
      message: 'escalates prolonged closure from warning to critical',
    });
  }

  // Test 3: clears only after 30 seconds of continuous open eyes
  {
    const evaluator = new DrowsinessEvaluator({ recoveryAfterMs: 30000 });
    evaluator.update(0.1, start);
    evaluator.update(0.1, start + 2000); // reaches critical
    const s1 = evaluator.update(0.9, start + 2100);
    const s2 = evaluator.update(0.9, start + 15000); // 13s open - still critical
    const s3 = evaluator.update(0.9, start + 32100); // 30s open - returns attentive

    const pass =
      s1.stage === DrowsinessStage.critical &&
      s2.stage === DrowsinessStage.critical &&
      s3.stage === DrowsinessStage.attentive;
    results.push({
      passed: pass,
      message: 'clears only after 30 seconds of continuous open eyes',
    });
  }

  // Test 4: reset clears accumulated temporal state
  {
    const evaluator = new DrowsinessEvaluator();
    evaluator.update(0.1, start);
    evaluator.reset();
    const stageAfterReset = evaluator.stage;
    const s2 = evaluator.update(0.1, start + 4000);

    const pass =
      stageAfterReset === DrowsinessStage.attentive &&
      s2.stage === DrowsinessStage.possibleClosure;
    results.push({
      passed: pass,
      message: 'reset clears accumulated temporal state',
    });
  }

  return results;
}
