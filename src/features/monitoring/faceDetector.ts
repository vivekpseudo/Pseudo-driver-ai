/**
 * Web Face & Eye Open Probability Detector.
 * Powered by Google MediaPipe FaceLandmarker with blendshapes (eyeBlinkLeft / eyeBlinkRight)
 * matching Google ML Kit's eye-open probability classification.
 */

import { FilesetResolver, FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision';

export interface Point2D {
  x: number;
  y: number;
}

export interface Box2D {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceDetectionResult {
  faceFound: boolean;
  boundingBox?: Box2D;
  leftEyeBox?: Box2D;
  rightEyeBox?: Box2D;
  leftEyeLandmarks?: Point2D[];
  rightEyeLandmarks?: Point2D[];
  leftEyeOpenProbability: number;
  rightEyeOpenProbability: number;
  overallEyeOpenProbability: number;
  modelReady: boolean;
}

// MediaPipe landmark indices for left and right eyes
const LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 144, 159, 145];
const RIGHT_EYE_INDICES = [362, 385, 387, 263, 373, 380, 386, 374];

export class WebFaceDetector {
  private landmarker: FaceLandmarker | null = null;
  private isInitializing: boolean = false;
  private isReady: boolean = false;
  private lastVideoTime: number = -1;

  constructor() {
    this.initLandmarker();
  }

  private async initLandmarker(): Promise<void> {
    if (this.isInitializing || this.isReady) return;
    this.isInitializing = true;

    try {
      // Load wasm files from local public directory
      const vision = await FilesetResolver.forVisionTasks('/wasm');

      try {
        this.landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/face_landmarker.task',
            delegate: 'GPU',
          },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: false,
          runningMode: 'VIDEO',
          numFaces: 1,
          minFaceDetectionConfidence: 0.35,
          minFacePresenceConfidence: 0.35,
          minTrackingConfidence: 0.35,
        });
      } catch (gpuError) {
        console.warn('MediaPipe GPU initialization failed, falling back to CPU:', gpuError);
        this.landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/face_landmarker.task',
            delegate: 'CPU',
          },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: false,
          runningMode: 'VIDEO',
          numFaces: 1,
          minFaceDetectionConfidence: 0.35,
          minFacePresenceConfidence: 0.35,
          minTrackingConfidence: 0.35,
        });
      }

      this.isReady = true;
      console.log('MediaPipe FaceLandmarker successfully initialized.');
    } catch (err) {
      console.error('Failed to initialize MediaPipe FaceLandmarker:', err);
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Process video frame using MediaPipe FaceLandmarker
   */
  public async processVideoFrame(
    video: HTMLVideoElement,
    simulatedEyeOpen?: number | null
  ): Promise<FaceDetectionResult> {
    // If simulated eye open is explicitly passed, handle simulation
    if (typeof simulatedEyeOpen === 'number') {
      return {
        faceFound: true,
        leftEyeOpenProbability: simulatedEyeOpen,
        rightEyeOpenProbability: simulatedEyeOpen,
        overallEyeOpenProbability: simulatedEyeOpen,
        modelReady: this.isReady,
      };
    }

    if (!this.isReady || !this.landmarker || video.readyState < 2 || video.videoWidth === 0) {
      return {
        faceFound: false,
        leftEyeOpenProbability: 0.8,
        rightEyeOpenProbability: 0.8,
        overallEyeOpenProbability: 0.8,
        modelReady: this.isReady,
      };
    }

    try {
      const currentTime = video.currentTime;
      // Prevent duplicate detection on the exact same frame time
      if (currentTime === this.lastVideoTime) {
        return {
          faceFound: false,
          leftEyeOpenProbability: 0.8,
          rightEyeOpenProbability: 0.8,
          overallEyeOpenProbability: 0.8,
          modelReady: true,
        };
      }
      this.lastVideoTime = currentTime;

      const result: FaceLandmarkerResult = this.landmarker.detectForVideo(video, performance.now());

      if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
        return {
          faceFound: false,
          leftEyeOpenProbability: 0,
          rightEyeOpenProbability: 0,
          overallEyeOpenProbability: 0,
          modelReady: true,
        };
      }

      const landmarks = result.faceLandmarks[0];

      // Extract blendshapes for eye blink classification
      let leftEyeOpen = 0.85;
      let rightEyeOpen = 0.85;

      if (result.faceBlendshapes && result.faceBlendshapes.length > 0) {
        const blendshapes = result.faceBlendshapes[0].categories;
        const blinkLeftCat = blendshapes.find((c) => c.categoryName === 'eyeBlinkLeft');
        const blinkRightCat = blendshapes.find((c) => c.categoryName === 'eyeBlinkRight');

        if (blinkLeftCat && blinkRightCat) {
          // Score represents blink probability (1 = closed, 0 = open)
          // Therefore, eyeOpenProbability = 1 - blinkScore
          leftEyeOpen = Math.max(0, Math.min(1, 1 - blinkLeftCat.score));
          rightEyeOpen = Math.max(0, Math.min(1, 1 - blinkRightCat.score));
        }
      }

      // Also compute geometric Eye Aspect Ratio (EAR) for validation
      const leftEAR = this.calculateEAR(landmarks, LEFT_EYE_INDICES);
      const rightEAR = this.calculateEAR(landmarks, RIGHT_EYE_INDICES);

      // Normal open eye EAR is typically ~0.24-0.35, closed eye is <0.15
      // Fuse blendshape probability with EAR for maximum stability
      const leftEARProb = Math.max(0, Math.min(1, (leftEAR - 0.12) / 0.18));
      const rightEARProb = Math.max(0, Math.min(1, (rightEAR - 0.12) / 0.18));

      // 70% blendshape weight + 30% geometric EAR weight
      const finalLeft = Math.round((leftEyeOpen * 0.7 + leftEARProb * 0.3) * 100) / 100;
      const finalRight = Math.round((rightEyeOpen * 0.7 + rightEARProb * 0.3) * 100) / 100;
      const overall = Math.round(((finalLeft + finalRight) / 2) * 100) / 100;

      // Compute bounding boxes in normalized 0..1 coordinates
      const faceBox = this.getBoundingBox(landmarks);
      const leftEyeBox = this.getBoundingBox(LEFT_EYE_INDICES.map((i) => landmarks[i]), 0.03);
      const rightEyeBox = this.getBoundingBox(RIGHT_EYE_INDICES.map((i) => landmarks[i]), 0.03);

      return {
        faceFound: true,
        boundingBox: faceBox,
        leftEyeBox,
        rightEyeBox,
        leftEyeLandmarks: LEFT_EYE_INDICES.map((i) => ({ x: landmarks[i].x, y: landmarks[i].y })),
        rightEyeLandmarks: RIGHT_EYE_INDICES.map((i) => ({ x: landmarks[i].x, y: landmarks[i].y })),
        leftEyeOpenProbability: finalLeft,
        rightEyeOpenProbability: finalRight,
        overallEyeOpenProbability: overall,
        modelReady: true,
      };
    } catch (err) {
      console.warn('Detection frame error:', err);
      return {
        faceFound: false,
        leftEyeOpenProbability: 0.8,
        rightEyeOpenProbability: 0.8,
        overallEyeOpenProbability: 0.8,
        modelReady: true,
      };
    }
  }

  /**
   * Eye Aspect Ratio (EAR) computation
   * EAR = (||p2 - p6|| + ||p3 - p5||) / (2 * ||p1 - p4||)
   */
  private calculateEAR(
    landmarks: Array<{ x: number; y: number; z: number }>,
    indices: number[]
  ): number {
    if (indices.length < 6) return 0.25;
    const p1 = landmarks[indices[0]]; // outer corner
    const p2 = landmarks[indices[1]]; // top outer
    const p3 = landmarks[indices[2]]; // top inner
    const p4 = landmarks[indices[3]]; // inner corner
    const p5 = landmarks[indices[4]]; // bottom inner
    const p6 = landmarks[indices[5]]; // bottom outer

    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);

    const verticalA = dist(p2, p6);
    const verticalB = dist(p3, p5);
    const horizontal = dist(p1, p4);

    if (horizontal === 0) return 0.25;
    return (verticalA + verticalB) / (2 * horizontal);
  }

  /**
   * Calculate bounding box for a set of landmarks
   */
  private getBoundingBox(
    points: Array<{ x: number; y: number }>,
    padding: number = 0.02
  ): Box2D {
    let minX = 1;
    let maxX = 0;
    let minY = 1;
    let maxY = 0;

    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const x = Math.max(0, minX - padding);
    const y = Math.max(0, minY - padding);
    const width = Math.min(1 - x, maxX - minX + padding * 2);
    const height = Math.min(1 - y, maxY - minY + padding * 2);

    return { x, y, width, height };
  }
}
