/**
 * Audio alerting system using Web Audio API oscillator synthesis.
 * Provides reliable, zero-latency looping alarm sound without requiring external WAV files.
 */

class AudioAlertManager {
  private audioCtx: AudioContext | null = null;
  private intervalId: number | null = null;
  private isPlaying: boolean = false;

  private initContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  public playAlarm(isCritical: boolean = false): void {
    this.initContext();
    if (!this.audioCtx) return;

    if (this.isPlaying) return;
    this.isPlaying = true;

    const beep = () => {
      if (!this.isPlaying || !this.audioCtx) return;
      try {
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = isCritical ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(isCritical ? 880 : 660, now);
        osc.frequency.exponentialRampToValueAtTime(isCritical ? 1100 : 880, now + 0.18);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.23);
      } catch {
        // Ignore audio playback errors if context blocked
      }
    };

    beep();
    this.intervalId = window.setInterval(beep, isCritical ? 260 : 450);
  }

  public stop(): void {
    this.isPlaying = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const audioAlert = new AudioAlertManager();
