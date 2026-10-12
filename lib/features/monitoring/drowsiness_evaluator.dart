/// Temporal smoothing for provisional eye-closure heuristics.
/// This is not a clinically or automotive validated drowsiness classifier.
enum DrowsinessStage { attentive, possibleClosure, warning, critical }

class DrowsinessSnapshot {
  const DrowsinessSnapshot(this.stage, {this.closedFor = Duration.zero});
  final DrowsinessStage stage;
  final Duration closedFor;
}

class DrowsinessEvaluator {
  DrowsinessEvaluator({
    this.eyeClosedThreshold = 0.28,
    this.warningAfter = const Duration(milliseconds: 900),
    this.criticalAfter = const Duration(milliseconds: 1800),
    this.recoveryAfter = const Duration(milliseconds: 1200),
  });

  final double eyeClosedThreshold;
  final Duration warningAfter;
  final Duration criticalAfter;
  final Duration recoveryAfter;

  DateTime? _closedSince;
  DateTime? _openSince;
  DrowsinessStage _stage = DrowsinessStage.attentive;

  DrowsinessStage get stage => _stage;

  DrowsinessSnapshot update(double eyeOpenProbability, DateTime now) {
    if (eyeOpenProbability < eyeClosedThreshold) {
      _openSince = null;
      _closedSince ??= now;
      final closedFor = now.difference(_closedSince!);
      if (closedFor >= criticalAfter) {
        _stage = DrowsinessStage.critical;
      } else if (closedFor >= warningAfter) {
        _stage = DrowsinessStage.warning;
      } else {
        _stage = DrowsinessStage.possibleClosure;
      }
      return DrowsinessSnapshot(_stage, closedFor: closedFor);
    }

    _closedSince = null;
    _openSince ??= now;
    if (now.difference(_openSince!) >= recoveryAfter) {
      _stage = DrowsinessStage.attentive;
    }
    return DrowsinessSnapshot(_stage);
  }

  void reset() {
    _closedSince = null;
    _openSince = null;
    _stage = DrowsinessStage.attentive;
  }
}
