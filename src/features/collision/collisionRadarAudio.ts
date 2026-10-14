/**
 * Automotive ADAS Forward Collision Warning (FCW) Radar Audio Synthesizer.
 * Generates pulse-frequency modulated warning beeps via Web Audio API.
 */

import { speechAlert } from '../monitoring/speechAlert';

class CollisionRadarAudio {
  private ctx: AudioContext | null = null;
  private intervalId: number | null = null;
  private currentUrgency: 'none' | 'warning' | 'critical' = 'none';
  private lastSpokenTime: number = 0;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(freq: number, durationSec: number) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSec);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + durationSec);
    } catch {
      // Ignore
    }
  }

  public updateRisk(risk: 'safe' | 'warning' | 'critical', distanceMeters?: number, driverName?: string) {
    if (risk === this.currentUrgency && this.intervalId !== null) return;
    this.currentUrgency = risk === 'safe' ? 'none' : risk;

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (risk === 'safe') return;

    const now = Date.now();
    const effectiveName = driverName && driverName.trim().length > 0 ? driverName.trim() : 'Driver';

    if (risk === 'critical') {
      // Rapid, urgent double beeps at 1100Hz every 140ms
      this.playTone(1100, 0.08);
      this.intervalId = window.setInterval(() => {
        this.playTone(1100, 0.07);
        setTimeout(() => this.playTone(1250, 0.07), 60);
      }, 160);

      // Voice warning (max once every 5 seconds)
      if (now - this.lastSpokenTime > 5000) {
        this.lastSpokenTime = now;
        const distStr = distanceMeters ? ` At ${distanceMeters.toFixed(0)} meters.` : '';
        speechAlert.speak(`Warning! Brake! Vehicle ahead.${distStr}`).catch(() => {});
      }
    } else if (risk === 'warning') {
      // Intermittent warning beep at 850Hz every 450ms
      this.playTone(850, 0.12);
      this.intervalId = window.setInterval(() => {
        this.playTone(850, 0.12);
      }, 450);

      if (now - this.lastSpokenTime > 8000) {
        this.lastSpokenTime = now;
        speechAlert.speak(`${effectiveName}, vehicle ahead is close.`).catch(() => {});
      }
    }
  }

  public stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.currentUrgency = 'none';
  }
}

export const collisionRadarAudio = new CollisionRadarAudio();
