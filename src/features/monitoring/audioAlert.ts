import alarmUrl from '../../../assets/audio/alarm.wav';

class AudioAlertManager {
  private readonly audio = new Audio(alarmUrl);
  private isPlaying = false;

  constructor() {
    this.audio.loop = true;
  }

  public playAlarm(): void {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.audio.play().catch((error: unknown) => {
      this.isPlaying = false;
      console.error('Failed to play alarm audio:', error);
    });
  }

  public stop(): void {
    this.isPlaying = false;
    this.audio.pause();
    this.audio.currentTime = 0;
  }
}

export const audioAlert = new AudioAlertManager();
