/**
 * Temporal smoothing for provisional eye-closure heuristics.
 * Ported from Flutter lib/features/monitoring/drowsiness_evaluator.dart.
 * Updated to require 30 seconds of continuous open eyes to clear alert.
 */

export enum DrowsinessStage {
  attentive = 'attentive',
  possibleClosure = 'possibleClosure',
  warning = 'warning',
  critical = 'critical',
}

export interface DrowsinessSnapshot {
  stage: DrowsinessStage;
  closedForMs: number;
  openForMs: number;
}

export interface DrowsinessEvaluatorOptions {
  eyeClosedThreshold?: number; // default 0.28
  warningAfterMs?: number;     // default 900ms
  criticalAfterMs?: number;    // default 1800ms
  recoveryAfterMs?: number;    // default 30000ms (30 seconds)
}

export class DrowsinessEvaluator {
  public readonly eyeClosedThreshold: number;
  public readonly warningAfterMs: number;
  public readonly criticalAfterMs: number;
  public readonly recoveryAfterMs: number;

  private _closedSince: number | null = null;
  private _openSince: number | null = null;
  private _stage: DrowsinessStage = DrowsinessStage.attentive;

  constructor(options?: DrowsinessEvaluatorOptions) {
    this.eyeClosedThreshold = options?.eyeClosedThreshold ?? 0.28;
    this.warningAfterMs = options?.warningAfterMs ?? 900;
    this.criticalAfterMs = options?.criticalAfterMs ?? 1800;
    // 30 seconds of continuous open eyes required to recover from drowsiness alert
    this.recoveryAfterMs = options?.recoveryAfterMs ?? 30000;
  }

  public get stage(): DrowsinessStage {
    return this._stage;
  }

  public get closedSince(): number | null {
    return this._closedSince;
  }

  public get openSince(): number | null {
    return this._openSince;
  }

  public update(eyeOpenProbability: number, now: Date | number = Date.now()): DrowsinessSnapshot {
    const nowMs = typeof now === 'number' ? now : now.getTime();

    if (eyeOpenProbability < this.eyeClosedThreshold) {
      // Eyes are closed: reset open timer
      this._openSince = null;
      if (this._closedSince === null) {
        this._closedSince = nowMs;
      }
      const closedFor = nowMs - this._closedSince;

      if (closedFor >= this.criticalAfterMs) {
        this._stage = DrowsinessStage.critical;
      } else if (closedFor >= this.warningAfterMs) {
        this._stage = DrowsinessStage.warning;
      } else {
        this._stage = DrowsinessStage.possibleClosure;
      }

      return {
        stage: this._stage,
        closedForMs: closedFor,
        openForMs: 0,
      };
    }

    // Eyes are open: reset closed timer and track continuous open duration
    this._closedSince = null;
    if (this._openSince === null) {
      this._openSince = nowMs;
    }
    const openFor = nowMs - this._openSince;

    // Only clear back to attentive once eyes have been continuously open for recoveryAfterMs (30s)
    if (openFor >= this.recoveryAfterMs) {
      this._stage = DrowsinessStage.attentive;
    }

    return {
      stage: this._stage,
      closedForMs: 0,
      openForMs: openFor,
    };
  }

  public reset(): void {
    this._closedSince = null;
    this._openSince = null;
    this._stage = DrowsinessStage.attentive;
  }
}
