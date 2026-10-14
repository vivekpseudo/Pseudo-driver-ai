/**
 * Road Object Detector & Monocular Distance / Collision Risk Estimator.
 * Powered by Google MediaPipe ObjectDetector (EfficientDet-Lite).
 * Calculates real-world distance in meters, relative velocity, and Time-To-Collision (TTC).
 */

import { FilesetResolver, ObjectDetector, Detection } from '@mediapipe/tasks-vision';

export type CollisionRiskLevel = 'safe' | 'warning' | 'critical';

export interface DetectedRoadObject {
  id: string;
  category: string;
  displayName: string;
  confidence: number;
  // Normalized 0..1 bounding box
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  // Estimated distance in meters
  distanceMeters: number;
  // Approaching velocity in m/s (positive = closing in, negative = moving away)
  approachingSpeedMps: number;
  // Time To Collision in seconds (null if moving away or stationary)
  ttcSeconds: number | null;
  // Risk evaluation
  riskLevel: CollisionRiskLevel;
}

export interface CollisionFrameResult {
  objects: DetectedRoadObject[];
  closestObject: DetectedRoadObject | null;
  overallRisk: CollisionRiskLevel;
  modelReady: boolean;
  fps: number;
}

// Typical real-world physical dimensions (width & height in meters)
const PHYSICAL_DIMENSIONS: Record<string, { width: number; height: number; label: string }> = {
  car: { width: 1.8, height: 1.5, label: 'Car' },
  truck: { width: 2.5, height: 3.2, label: 'Truck' },
  bus: { width: 2.6, height: 3.2, label: 'Bus' },
  motorcycle: { width: 0.8, height: 1.3, label: 'Motorcycle' },
  bicycle: { width: 0.6, height: 1.1, label: 'Bicycle' },
  person: { width: 0.5, height: 1.7, label: 'Pedestrian' },
  default: { width: 1.5, height: 1.5, label: 'Obstacle' },
};

// Target categories relevant to forward automotive collision warning
const ROAD_CATEGORIES = new Set([
  'car',
  'truck',
  'bus',
  'motorcycle',
  'bicycle',
  'person',
  'dog',
  'cat',
  'horse',
]);

export class RoadObjectDetector {
  private detector: ObjectDetector | null = null;
  private isInitializing: boolean = false;
  private isReady: boolean = false;
  private previousTracks: Map<string, { distance: number; time: number; x: number; y: number }> = new Map();
  private frameCount: number = 0;
  private currentFps: number = 0;
  private fpsLastTime: number = performance.now();

  constructor() {
    this.initDetector();
  }

  private async initDetector(): Promise<void> {
    if (this.isInitializing || this.isReady) return;
    this.isInitializing = true;

    try {
      const vision = await FilesetResolver.forVisionTasks('/wasm');

      try {
        this.detector = await ObjectDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/efficientdet_lite0.tflite',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          scoreThreshold: 0.35,
          maxResults: 8,
        });
      } catch (gpuError) {
        console.warn('ObjectDetector GPU init failed, falling back to CPU:', gpuError);
        this.detector = await ObjectDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/efficientdet_lite0.tflite',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          scoreThreshold: 0.35,
          maxResults: 8,
        });
      }

      this.isReady = true;
      console.log('MediaPipe ObjectDetector initialized successfully.');
    } catch (err) {
      console.error('Failed to initialize MediaPipe ObjectDetector:', err);
    } finally {
      this.isInitializing = false;
    }
  }

  public async detectFrame(video: HTMLVideoElement): Promise<CollisionFrameResult> {
    const now = performance.now();

    // Calculate FPS
    this.frameCount++;
    if (now - this.fpsLastTime >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / (now - this.fpsLastTime));
      this.frameCount = 0;
      this.fpsLastTime = now;
    }

    if (!this.isReady || !this.detector || video.readyState < 2 || video.videoWidth === 0) {
      return {
        objects: [],
        closestObject: null,
        overallRisk: 'safe',
        modelReady: this.isReady,
        fps: this.currentFps,
      };
    }

    try {
      const result = this.detector.detectForVideo(video, now);
      const detections: Detection[] = result.detections || [];
      const vw = video.videoWidth;
      const vh = video.videoHeight;

      const detectedObjects: DetectedRoadObject[] = [];
      const currentTracks = new Map<string, { distance: number; time: number; x: number; y: number }>();

      for (let i = 0; i < detections.length; i++) {
        const d = detections[i];
        if (!d.categories || d.categories.length === 0 || !d.boundingBox) continue;

        const cat = d.categories[0];
        const catName = cat.categoryName.toLowerCase();

        // Filter for road users/vehicles/pedestrians
        if (!ROAD_CATEGORIES.has(catName) && cat.score < 0.5) continue;

        const bb = d.boundingBox;
        // Normalized coordinates (0..1)
        const normBox = {
          x: Math.max(0, bb.originX / vw),
          y: Math.max(0, bb.originY / vh),
          width: Math.min(1, bb.width / vw),
          height: Math.min(1, bb.height / vh),
        };

        // Ignore small background noise
        if (normBox.width < 0.04 || normBox.height < 0.04) continue;

        const dim = PHYSICAL_DIMENSIONS[catName] || PHYSICAL_DIMENSIONS.default;

        // Monocular Distance Estimation:
        // Pinhole camera focal length model: D = (f * H_real) / h_pixels
        // For standard smartphone horizontal/vertical camera FOV ~60°:
        // distanceH = (0.866 * real_height) / normalized_height
        // distanceW = (1.15 * real_width) / normalized_width
        const distFromHeight = (0.88 * dim.height) / normBox.height;
        const distFromWidth = (1.12 * dim.width) / normBox.width;

        // Ground-plane perspective weighting:
        // Objects lower in the camera frame (larger y + height) are closer to vehicle bumper
        const groundFactor = 1.0 - Math.min(0.9, normBox.y + normBox.height * 0.5);
        const distFromGround = 3.0 + groundFactor * 45.0;

        // Fuse measurements (weighted average)
        let estimatedDistance = distFromHeight * 0.45 + distFromWidth * 0.45 + distFromGround * 0.1;
        // Clamp to sensible physical range (1m to 80m)
        estimatedDistance = Math.max(1.2, Math.min(80.0, estimatedDistance));
        estimatedDistance = Math.round(estimatedDistance * 10) / 10;

        // Spatial ID tracking for velocity & TTC
        const trackKey = `${catName}_${Math.round(normBox.x * 4)}_${Math.round(normBox.y * 4)}`;
        let approachingSpeed = 0;
        let ttc: number | null = null;

        const prev = this.previousTracks.get(trackKey);
        if (prev && now > prev.time) {
          const dt = (now - prev.time) / 1000;
          if (dt > 0.05 && dt < 1.5) {
            // Rate of distance decrease (positive = approaching)
            approachingSpeed = (prev.distance - estimatedDistance) / dt;
            // Filter noise
            if (approachingSpeed > 1.0) {
              ttc = estimatedDistance / approachingSpeed;
              ttc = Math.round(ttc * 10) / 10;
            }
          }
        }
        currentTracks.set(trackKey, { distance: estimatedDistance, time: now, x: normBox.x, y: normBox.y });

        // Risk classification
        // Critical: Distance < 6.5 meters OR Time-To-Collision < 1.6 seconds
        // Warning: Distance < 14 meters OR Time-To-Collision < 3.0 seconds
        let risk: CollisionRiskLevel = 'safe';
        if (estimatedDistance < 6.5 || (ttc !== null && ttc < 1.6)) {
          risk = 'critical';
        } else if (estimatedDistance < 14.0 || (ttc !== null && ttc < 3.0)) {
          risk = 'warning';
        }

        detectedObjects.push({
          id: `obj_${i}_${catName}`,
          category: catName,
          displayName: dim.label,
          confidence: Math.round(cat.score * 100),
          boundingBox: normBox,
          distanceMeters: estimatedDistance,
          approachingSpeedMps: Math.round(approachingSpeed * 10) / 10,
          ttcSeconds: ttc,
          riskLevel: risk,
        });
      }

      this.previousTracks = currentTracks;

      // Find closest object
      let closest: DetectedRoadObject | null = null;
      let worstRisk: CollisionRiskLevel = 'safe';

      for (const obj of detectedObjects) {
        if (!closest || obj.distanceMeters < closest.distanceMeters) {
          closest = obj;
        }
        if (obj.riskLevel === 'critical') {
          worstRisk = 'critical';
        } else if (obj.riskLevel === 'warning' && worstRisk !== 'critical') {
          worstRisk = 'warning';
        }
      }

      return {
        objects: detectedObjects,
        closestObject: closest,
        overallRisk: worstRisk,
        modelReady: true,
        fps: this.currentFps,
      };
    } catch (err) {
      console.warn('Object detection frame error:', err);
      return {
        objects: [],
        closestObject: null,
        overallRisk: 'safe',
        modelReady: true,
        fps: this.currentFps,
      };
    }
  }
}
