export type GearPosition = 'R' | 'N' | '1' | '2';

export type CameraMode = 'chase' | 'cockpit' | 'overhead';

export interface MapViewState {
  /** Horizontal orbit offset in radians */
  yawOffsetRad: number;
  /** Vertical pitch angle in radians (0.08 low .. 1.48 top-down) */
  pitchRad: number;
  /** Camera distance from target in meters */
  distance: number;
  /** World pan offset X/Z for free 3D map exploration */
  panX: number;
  panZ: number;
  /** Whether camera follows the car automatically */
  followCar: boolean;
  /** Live camera compass heading in degrees (0 = North/-Z, 90 = East/+X) */
  compassDeg: number;
}

export type TrialMode = 'full' | 'practice' | 'free' | 'demo';

export type StrictnessMode = 'dotm70' | 'strict';

export type TrafficLightPhase = 'green' | 'amber' | 'red';

export type StageId =
  | 'start'
  | 'figure8'
  | 'speedbreakers'
  | 'traffic'
  | 'uturn'
  | 'ukalo'
  | 'lback'
  | 'finished';

export interface VehicleInputs {
  /** Steering wheel rotation in degrees: -540 (full left) to +540 (full right) */
  steeringWheelDeg: number;
  /** Clutch pedal depression: 0 (released/engaged) to 1 (fully pressed/disengaged) */
  clutch: number;
  /** Foot brake pedal depression: 0 to 1 */
  brake: number;
  /** Accelerator pedal depression: 0 to 1 */
  throttle: number;
  /** H-pattern gear stick position */
  gear: GearPosition;
  /** Handbrake lever ratio: 0 (off) to 1 (fully pulled) */
  handbrake: number;
  /** Ignition state: 0 = Off, 1 = On/Run, 2 = Cranking starter */
  ignition: 0 | 1 | 2;
  /** Seatbelt fastened */
  seatbelt: boolean;
  /** Turn indicator stalk: -1 = left, 0 = off, 1 = right */
  indicator: -1 | 0 | 1;
  /** Hazard lights */
  hazard: boolean;
  /** Headlights */
  headlights: boolean;
  /** Horn pressed */
  horn: boolean;
}

export interface VehicleTelemetry {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  speedMs: number;
  speedKmh: number;
  rpm: number;
  engineRunning: boolean;
  stalled: boolean;
  /** Front wheel steer angle in radians (+ left, - right in Three.js Y-up) */
  frontSteerRad: number;
  /** Wheel spin angle in radians */
  wheelSpinRad: number;
  /** Effective clutch coupling 0..1 */
  clutchEngagement: number;
  /** Whether clutch is currently in the friction bite zone */
  inBiteZone: boolean;
  /** Current road slope angle in radians (+ uphill, - downhill) */
  slopeRad: number;
  /** Gear grind warning timestamp */
  gearGrindAt: number;
  /** Rollback distance on Ukalo in meters */
  ukaloRollbackM: number;
}

export interface DeductionEntry {
  id: string;
  timeSec: number;
  stage: StageId;
  reason: string;
  points: number;
}

export interface ConeState {
  id: number;
  x: number;
  z: number;
  baseY: number;
  knocked: boolean;
  tiltAngle: number;
  tiltDirX: number;
  tiltDirZ: number;
}

export interface StageDefinition {
  id: StageId;
  order: number;
  name: string;
  nepaliName: string;
  instruction: string;
  spawn: { x: number; z: number; yaw: number };
}
