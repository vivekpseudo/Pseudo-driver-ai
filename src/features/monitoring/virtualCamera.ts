/**
 * Virtual Camera Driver Stream Generator.
 * Provides a synthetic MediaStream using Canvas rendering for testing
 * when hardware cameras are restricted by iframe permissions, unavailable, or denied.
 */

export class VirtualDriverCamera {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stream: MediaStream | null = null;
  private intervalId: number | null = null;
  private blinkState: number = 1.0; // 1.0 = fully open, 0.0 = fully closed
  private isBlinking: boolean = false;
  private eyesForcedClosed: boolean = false;
  private headWiggle: number = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 640;
    this.canvas.height = 480;
    this.ctx = this.canvas.getContext('2d')!;
  }

  public setForcedClosed(closed: boolean) {
    this.eyesForcedClosed = closed;
  }

  public getStream(): MediaStream {
    if (this.stream) return this.stream;

    // Start render loop at 25 FPS
    this.renderFrame();
    this.intervalId = window.setInterval(() => {
      this.updateState();
      this.renderFrame();
    }, 40);

    this.stream = this.canvas.captureStream(25);
    return this.stream;
  }

  public stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  private updateState(): void {
    this.headWiggle = Math.sin(Date.now() / 800) * 4;

    if (this.eyesForcedClosed) {
      this.blinkState = Math.max(0.0, this.blinkState - 0.2);
      return;
    }

    // Natural occasional blink every 4-6 seconds
    if (!this.isBlinking && Math.random() < 0.02) {
      this.isBlinking = true;
    }

    if (this.isBlinking) {
      this.blinkState -= 0.35;
      if (this.blinkState <= 0.05) {
        this.blinkState = 0.05;
        this.isBlinking = false;
      }
    } else {
      if (this.blinkState < 1.0) {
        this.blinkState = Math.min(1.0, this.blinkState + 0.3);
      }
    }
  }

  private renderFrame(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Car interior / background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#1e293b');
    bgGrad.addColorStop(0.7, '#0f172a');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Car windshield view outline & dashboard glow
    ctx.fillStyle = '#0f2922';
    ctx.beginPath();
    ctx.ellipse(w / 2, h + 80, w * 0.7, 180, 0, 0, Math.PI * 2);
    ctx.fill();

    const cx = w / 2 + this.headWiggle;
    const cy = h / 2 - 20;

    // Driver body / shoulders
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 180, 150, 90, 0, 0, Math.PI * 2);
    ctx.fill();

    // Driver face (realistic warm skin tone for detector)
    ctx.fillStyle = '#dfa57e';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 95, 125, 0, 0, Math.PI * 2);
    ctx.fill();

    // Driver hair
    ctx.fillStyle = '#261b18';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 75, 100, 60, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyebrows
    ctx.strokeStyle = '#2d201c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx - 38, cy - 36, 26, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 38, cy - 36, 26, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();

    // Eyes
    const eyeH = 18 * Math.max(0.08, this.blinkState);
    const eyeW = 28;

    // Sclera (white of eyes)
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.ellipse(cx - 38, cy - 15, eyeW / 2, eyeH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 38, cy - 15, eyeW / 2, eyeH / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Iris & pupils (dark high contrast)
    if (this.blinkState > 0.25) {
      const pupilH = Math.min(eyeH / 2, 7);
      ctx.fillStyle = '#1e1b18';
      ctx.beginPath();
      ctx.ellipse(cx - 38, cy - 15, 6, pupilH, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 38, cy - 15, 6, pupilH, 0, 0, Math.PI * 2);
      ctx.fill();

      // Light reflection
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx - 36, cy - 17, 2, 0, Math.PI * 2);
      ctx.arc(cx + 40, cy - 17, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Eyelids / closed lines if blinking
    if (this.blinkState < 0.3) {
      ctx.strokeStyle = '#9c6644';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 52, cy - 15);
      ctx.quadraticCurveTo(cx - 38, cy - 10, cx - 24, cy - 15);
      ctx.moveTo(cx + 24, cy - 15);
      ctx.quadraticCurveTo(cx + 38, cy - 10, cx + 52, cy - 15);
      ctx.stroke();
    }

    // Nose
    ctx.strokeStyle = '#c48b64';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 10);
    ctx.lineTo(cx + 5, cy + 16);
    ctx.lineTo(cx - 4, cy + 20);
    ctx.stroke();

    // Mouth
    ctx.strokeStyle = '#b06f52';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(cx, cy + 46, 24, Math.PI * 0.1, Math.PI * 0.9);
    ctx.stroke();

    // Watermark overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('VIRTUAL DRIVER STREAM', 20, 32);
  }
}
