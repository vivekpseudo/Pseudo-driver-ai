/**
 * Forward Road & Traffic Simulator Stream.
 * Generates an interactive synthetic dashcam video feed with animated highway traffic
 * for testing object detection, monocular distance calculation, and collision warnings.
 */

export class RoadSimulator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stream: MediaStream | null = null;
  private intervalId: number | null = null;

  // Road state
  private roadOffset: number = 0;
  private speedKmh: number = 72; // Ego speed
  private isEmergencyBraking: boolean = false;

  // Lead vehicle (center lane)
  private leadCarDistanceMeters: number = 28.0; // Starts at 28 meters
  private targetDistanceMeters: number = 28.0;

  // Side vehicle (truck in right lane)
  private sideTruckDistanceMeters: number = 38.0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 640;
    this.canvas.height = 480;
    this.ctx = this.canvas.getContext('2d')!;
  }

  public setApproaching(approaching: boolean) {
    this.isEmergencyBraking = approaching;
    this.targetDistanceMeters = approaching ? 5.2 : 28.0;
  }

  public getStream(): MediaStream {
    if (this.stream) return this.stream;

    this.renderFrame();
    this.intervalId = window.setInterval(() => {
      this.updateState();
      this.renderFrame();
    }, 33); // ~30 FPS

    this.stream = this.canvas.captureStream(30);
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
    // Animate road stripes
    this.roadOffset = (this.roadOffset + (this.speedKmh / 3.6) * 0.4) % 40;

    // Smoothly transition lead car distance toward target
    const distDiff = this.targetDistanceMeters - this.leadCarDistanceMeters;
    if (Math.abs(distDiff) > 0.1) {
      this.leadCarDistanceMeters += distDiff * (this.isEmergencyBraking ? 0.08 : 0.04);
    }

    // Side truck gently drifts
    this.sideTruckDistanceMeters += Math.sin(Date.now() / 2000) * 0.05;
  }

  private renderFrame(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const horizonY = h * 0.45;

    // 1. Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
    skyGrad.addColorStop(0, '#38bdf8');
    skyGrad.addColorStop(1, '#bae6fd');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, horizonY);

    // Sun / horizon haze
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(w * 0.7, horizonY - 40, 35, 0, Math.PI * 2);
    ctx.fill();

    // Distant mountains
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(w * 0.15, horizonY - 35);
    ctx.lineTo(w * 0.35, horizonY - 12);
    ctx.lineTo(w * 0.6, horizonY - 42);
    ctx.lineTo(w * 0.85, horizonY - 15);
    ctx.lineTo(w, horizonY - 25);
    ctx.lineTo(w, horizonY);
    ctx.fill();

    // 2. Road surface
    const roadGrad = ctx.createLinearGradient(0, horizonY, 0, h);
    roadGrad.addColorStop(0, '#475569');
    roadGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = roadGrad;
    ctx.fillRect(0, horizonY, w, h - horizonY);

    // Road asphalt edges (perspective trapezoid)
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(w * 0.42, horizonY);
    ctx.lineTo(w * 0.58, horizonY);
    ctx.lineTo(w * 0.98, h);
    ctx.lineTo(w * 0.02, h);
    ctx.fill();

    // Road side grass / gravel
    ctx.fillStyle = '#15803d'; // Left grass
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(w * 0.42, horizonY);
    ctx.lineTo(w * 0.02, h);
    ctx.lineTo(0, h);
    ctx.fill();

    ctx.fillStyle = '#15803d'; // Right grass
    ctx.beginPath();
    ctx.moveTo(w * 0.58, horizonY);
    ctx.lineTo(w, horizonY);
    ctx.lineTo(w, h);
    ctx.lineTo(w * 0.98, h);
    ctx.fill();

    // Road shoulder solid white lines
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.42, horizonY);
    ctx.lineTo(w * 0.02, h);
    ctx.moveTo(w * 0.58, horizonY);
    ctx.lineTo(w * 0.98, h);
    ctx.stroke();

    // Lane dividers (3-lane highway)
    this.drawDashedLane(w * 0.47, horizonY, w * 0.34, h);
    this.drawDashedLane(w * 0.53, horizonY, w * 0.66, h);

    // 3. Draw Vehicles on Highway
    // Draw Right Lane Truck (further back)
    this.drawTruck(w * 0.72, this.sideTruckDistanceMeters, horizonY);

    // Draw Center Lead Car (user's collision target)
    this.drawCar(w * 0.5, this.leadCarDistanceMeters, horizonY, this.isEmergencyBraking);

    // 4. Dashcam Hood Overlay / Watermark
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(16, 16, 230, 48);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('ROAD DASHCAM SIMULATOR', 26, 35);
    ctx.fillStyle = '#a7f3d0';
    ctx.fillText(`SPEED: ${this.speedKmh} km/h · FOV: 60°`, 26, 52);
  }

  private drawDashedLane(topX: number, topY: number, botX: number, botY: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 3.5;
    ctx.setLineDash([18, 16]);
    ctx.lineDashOffset = -this.roadOffset;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(botX, botY);
    ctx.stroke();
    ctx.restore();
  }

  // Draw perspective car with brake lights
  private drawCar(centerX: number, distanceM: number, horizonY: number, braking: boolean) {
    const ctx = this.ctx;
    const h = this.canvas.height;

    // Perspective scale inversely proportional to distance
    // At 5m: scale is large. At 35m: scale is small.
    const scale = Math.max(0.18, Math.min(1.4, 18.0 / distanceM));

    // Car position Y on road
    const roadDepth = h - horizonY;
    const normDist = Math.max(0.1, Math.min(1.0, distanceM / 40.0));
    const carY = horizonY + roadDepth * (1.0 - normDist * 0.85);

    const carW = 120 * scale;
    const carH = 75 * scale;
    const carX = centerX - carW / 2;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.ellipse(centerX, carY + carH * 0.88, carW * 0.55, 12 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tires
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(carX + carW * 0.05, carY + carH * 0.55, carW * 0.18, carH * 0.38);
    ctx.fillRect(carX + carW * 0.77, carY + carH * 0.55, carW * 0.18, carH * 0.38);

    // Car Body (Silver/Dark Blue Sedan)
    const bodyGrad = ctx.createLinearGradient(0, carY, 0, carY + carH);
    bodyGrad.addColorStop(0, '#1e3a8a');
    bodyGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.roundRect(carX + carW * 0.08, carY + carH * 0.32, carW * 0.84, carH * 0.55, 6 * scale);
    ctx.fill();

    // Cabin / Roof
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(carX + carW * 0.2, carY + carH * 0.05, carW * 0.6, carH * 0.35, 4 * scale);
    ctx.fill();

    // Rear Windshield Glass
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.roundRect(carX + carW * 0.24, carY + carH * 0.08, carW * 0.52, carH * 0.25, 3 * scale);
    ctx.fill();

    // License Plate
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(centerX - 16 * scale, carY + carH * 0.65, 32 * scale, 12 * scale);
    ctx.strokeStyle = '#000000';
    ctx.strokeRect(centerX - 16 * scale, carY + carH * 0.65, 32 * scale, 12 * scale);

    // Tail Lights (Glow bright red if braking!)
    if (braking) {
      // Glow
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 24 * scale;
      ctx.fillStyle = '#ff1f1f';
      ctx.fillRect(carX + carW * 0.1, carY + carH * 0.42, carW * 0.22, carH * 0.18);
      ctx.fillRect(carX + carW * 0.68, carY + carH * 0.42, carW * 0.22, carH * 0.18);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = '#b91c1c';
      ctx.fillRect(carX + carW * 0.12, carY + carH * 0.42, carW * 0.18, carH * 0.16);
      ctx.fillRect(carX + carW * 0.7, carY + carH * 0.42, carW * 0.18, carH * 0.16);
    }
  }

  // Draw truck in right lane
  private drawTruck(centerX: number, distanceM: number, horizonY: number) {
    const ctx = this.ctx;
    const h = this.canvas.height;
    const scale = Math.max(0.15, Math.min(1.2, 18.0 / distanceM));

    const roadDepth = h - horizonY;
    const normDist = Math.max(0.1, Math.min(1.0, distanceM / 45.0));
    const truckY = horizonY + roadDepth * (1.0 - normDist * 0.85);

    const truckW = 140 * scale;
    const truckH = 120 * scale;
    const truckX = centerX - truckW / 2;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(centerX, truckY + truckH * 0.95, truckW * 0.55, 14 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cargo Box
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(truckX, truckY, truckW, truckH * 0.75);
    ctx.strokeStyle = '#94a3b8';
    ctx.strokeRect(truckX, truckY, truckW, truckH * 0.75);

    // Hazard Stripes on bumper
    ctx.fillStyle = '#eab308';
    ctx.fillRect(truckX, truckY + truckH * 0.75, truckW, truckH * 0.12);

    // Tail lights
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(truckX + 8 * scale, truckY + truckH * 0.76, 16 * scale, 10 * scale);
    ctx.fillRect(truckX + truckW - 24 * scale, truckY + truckH * 0.76, 16 * scale, 10 * scale);
  }
}
