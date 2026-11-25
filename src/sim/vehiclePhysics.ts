import { ConeState, VehicleInputs, VehicleTelemetry } from '../types/trial';
import { LineSegment2D, groundHeightAt } from './courseData';

export const WHEELBASE = 2.36; // meters (Alto/i10 class hatchback)
export const TRACK_WIDTH = 1.44; // meters
export const CAR_LENGTH = 3.52;
export const CAR_WIDTH = 1.56;
export const WHEEL_RADIUS = 0.29;
export const MAX_STEER_WHEEL_DEG = 540; // 1.5 turns lock-to-lock
export const MAX_FRONT_WHEEL_RAD = (34 * Math.PI) / 180;

const FINAL_DRIVE = 4.35;
const GEAR_RATIOS: Record<string, number> = {
  '1': 3.55,
  '2': 1.95,
  R: -3.28,
  N: 0,
};

export interface PhysicsContext {
  stallTimer: number;
  crankTimer: number;
  prevWheelSteerPeak: number;
  indicatorArmed: boolean;
  ukaloMinZWhileStopped: number;
  ukaloStoppedInBox: boolean;
}

export function createInitialTelemetry(x: number, z: number, yaw: number): VehicleTelemetry {
  return {
    x,
    y: groundHeightAt(x, z),
    z,
    yaw,
    pitch: 0,
    roll: 0,
    speedMs: 0,
    speedKmh: 0,
    rpm: 0,
    engineRunning: false,
    stalled: false,
    frontSteerRad: 0,
    wheelSpinRad: 0,
    clutchEngagement: 1,
    inBiteZone: false,
    slopeRad: 0,
    gearGrindAt: 0,
    ukaloRollbackM: 0,
  };
}

export function createPhysicsContext(): PhysicsContext {
  return {
    stallTimer: 0,
    crankTimer: 0,
    prevWheelSteerPeak: 0,
    indicatorArmed: false,
    ukaloMinZWhileStopped: 0,
    ukaloStoppedInBox: false,
  };
}

function pointToSegmentDistSq(
  px: number,
  pz: number,
  x1: number,
  z1: number,
  x2: number,
  z2: number
): number {
  const vx = x2 - x1;
  const vz = z2 - z1;
  const wx = px - x1;
  const wz = pz - z1;
  const lenSq = vx * vx + vz * vz;
  if (lenSq < 1e-6) return wx * wx + wz * wz;
  let t = (wx * vx + wz * vz) / lenSq;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const dx = px - (x1 + t * vx);
  const dz = pz - (z1 + t * vz);
  return dx * dx + dz * dz;
}

export function stepVehiclePhysics(
  state: VehicleTelemetry,
  inputs: VehicleInputs,
  ctx: PhysicsContext,
  dt: number,
  boundaries: LineSegment2D[],
  cones: ConeState[],
  callbacks?: {
    onStall?: () => void;
    onEngineStart?: () => void;
    onAutoCancelIndicator?: () => void;
    onLineTouch?: (kind: LineSegment2D['kind']) => void;
    onConeHit?: (coneId: number) => void;
  }
): void {
  const clampedDt = Math.min(dt, 0.05);

  // 1. Ignition & Starter Cranking
  if (inputs.ignition === 0) {
    state.engineRunning = false;
    state.stalled = false;
    ctx.crankTimer = 0;
  } else if (inputs.ignition === 2 && !state.engineRunning) {
    ctx.crankTimer += clampedDt;
    // Cranking requires neutral OR clutch pressed to crank cleanly
    const canStart = inputs.gear === 'N' || inputs.clutch > 0.65;
    state.rpm = 280 + Math.sin(ctx.crankTimer * 28) * 35;
    if (ctx.crankTimer > 0.38 && canStart) {
      state.engineRunning = true;
      state.stalled = false;
      state.rpm = 920;
      ctx.stallTimer = 0;
      callbacks?.onEngineStart?.();
    }
  } else {
    ctx.crankTimer = 0;
  }

  // 2. Clutch coupling curve (0 = disengaged when pressed, 1 = engaged when released)
  let coupling = 1;
  if (inputs.clutch >= 0.72) {
    coupling = 0;
  } else if (inputs.clutch >= 0.28) {
    coupling = Math.pow((0.72 - inputs.clutch) / 0.44, 1.3);
  }
  state.clutchEngagement = coupling;
  state.inBiteZone = inputs.clutch >= 0.28 && inputs.clutch < 0.72;

  // 3. Slope & Terrain Pitch/Roll from 4 wheel sample points
  const sinY = Math.sin(state.yaw);
  const cosY = Math.cos(state.yaw);
  // Forward = (sinY, cosY), Left = (cosY, -sinY)
  const halfWb = WHEELBASE * 0.5;
  const halfTr = TRACK_WIDTH * 0.5;

  const hFront = groundHeightAt(state.x + sinY * halfWb, state.z + cosY * halfWb);
  const hRear = groundHeightAt(state.x - sinY * halfWb, state.z - cosY * halfWb);
  const hLeft = groundHeightAt(state.x + cosY * halfTr, state.z - sinY * halfTr);
  const hRight = groundHeightAt(state.x - cosY * halfTr, state.z + sinY * halfTr);

  const slopeRad = Math.atan2(hFront - hRear, WHEELBASE);
  state.slopeRad = slopeRad;
  state.pitch = -slopeRad; // Three.js X-rotation: negative tilts nose up when hFront > hRear
  state.roll = Math.atan2(hLeft - hRight, TRACK_WIDTH);

  // 4. Engine RPM & Drive Force
  const gearRatio = GEAR_RATIOS[inputs.gear] ?? 0;
  const effectiveRatio = gearRatio * FINAL_DRIVE;
  const wheelOmega = state.speedMs / WHEEL_RADIUS;
  const wheelBasedRpm = (wheelOmega * effectiveRatio * 60) / (2 * Math.PI);

  if (state.engineRunning) {
    const idleRpm = 840;
    const freeRevTarget = idleRpm + inputs.throttle * 4900;

    if (inputs.gear === 'N' || coupling < 0.02) {
      const rate = inputs.throttle > 0.05 ? 7.5 : 4.2;
      state.rpm += (freeRevTarget - state.rpm) * Math.min(1, rate * clampedDt);
      ctx.stallTimer = 0;
    } else {
      // Coupled engine + drivetrain
      const coupledTarget = Math.max(0, wheelBasedRpm) + inputs.throttle * (1 - coupling) * 2800;
      const blendedRpm = freeRevTarget * (1 - coupling * 0.85) + coupledTarget * (coupling * 0.85);
      state.rpm += (blendedRpm - state.rpm) * Math.min(1, 10 * clampedDt);

      // Check stall: in gear, heavily coupled, RPM pulled below 470
      if (coupling > 0.72 && wheelBasedRpm < 460 && inputs.throttle < 0.14) {
        ctx.stallTimer += clampedDt;
        if (ctx.stallTimer > 0.18) {
          state.engineRunning = false;
          state.stalled = true;
          state.rpm = 0;
          callbacks?.onStall?.();
        }
      } else {
        ctx.stallTimer = 0;
      }
    }
  } else if (inputs.ignition !== 2) {
    state.rpm = Math.max(0, state.rpm - 2400 * clampedDt);
  }

  // Clamp RPM
  state.rpm = Math.max(0, Math.min(6800, state.rpm));

  // 5. Longitudinal Forces
  let driveAccel = 0;
  if (state.engineRunning && gearRatio !== 0 && coupling > 0.01) {
    // Torque curve peaks around 2500-4000 RPM, strong idle creep torque
    const rpmNorm = Math.min(1, state.rpm / 2400);
    const baseTorque = 0.68 + 0.65 * rpmNorm + inputs.throttle * 1.45;
    const gearSign = Math.sign(gearRatio);
    const gearScale = Math.abs(gearRatio) / 3.55;
    // Target creep speed / max speed in gear
    const maxGearSpeed = inputs.gear === '1' ? 7.8 : inputs.gear === '2' ? 14.5 : 6.2;
    const currentInDir = state.speedMs * gearSign;
    const speedHeadroom = Math.max(0, 1 - Math.max(0, currentInDir) / maxGearSpeed);

    driveAccel = gearSign * coupling * baseTorque * gearScale * 3.1 * speedHeadroom;
  }

  // Gravity along slope (+slopeRad means nose uphill -> pulls backward)
  const gravityAccel = -9.81 * Math.sin(slopeRad);

  // Rolling resistance & engine braking
  let engineBrake = 0;
  if (gearRatio !== 0 && coupling > 0.25 && inputs.throttle < 0.05) {
    engineBrake = 0.65 * coupling * (Math.abs(gearRatio) / 3.55);
  }
  const rollingDrag = 0.18 + engineBrake;

  // Brakes (Foot brake + Handbrake)
  const brakeStrength = inputs.brake * 10.5 + inputs.handbrake * 7.2;

  // Integrate velocity
  let nextSpeed = state.speedMs + (driveAccel + gravityAccel) * clampedDt;

  // Apply drag + brakes against direction of motion (and static hold when near zero)
  const netStaticForce = driveAccel + gravityAccel;
  if (Math.abs(nextSpeed) < 0.08 && brakeStrength > Math.abs(netStaticForce)) {
    nextSpeed = 0;
  } else {
    const resistance = (brakeStrength + rollingDrag) * clampedDt;
    if (Math.abs(nextSpeed) <= resistance) {
      nextSpeed = brakeStrength > Math.abs(netStaticForce) ? 0 : nextSpeed * 0.5;
    } else {
      nextSpeed -= Math.sign(nextSpeed) * resistance;
    }
  }

  // Prevent reverse coasting when engine is running in 1st gear with full brake/handbrake
  state.speedMs = nextSpeed;
  state.speedKmh = Math.abs(state.speedMs) * 3.6;

  // 6. Steering & Bicycle Kinematics
  // Negative steeringWheelDeg = Left turn -> Positive frontSteerRad (+yaw)
  const steerNorm = -inputs.steeringWheelDeg / MAX_STEER_WHEEL_DEG;
  const targetFrontSteer = steerNorm * MAX_FRONT_WHEEL_RAD;
  state.frontSteerRad += (targetFrontSteer - state.frontSteerRad) * Math.min(1, 14 * clampedDt);

  // Auto-cancel indicator if straightened after turning
  if (inputs.indicator !== 0) {
    const absSteer = Math.abs(inputs.steeringWheelDeg);
    if (absSteer > 130) {
      ctx.indicatorArmed = true;
    } else if (ctx.indicatorArmed && absSteer < 32) {
      ctx.indicatorArmed = false;
      callbacks?.onAutoCancelIndicator?.();
    }
  } else {
    ctx.indicatorArmed = false;
  }

  // Bicycle model update
  if (Math.abs(state.speedMs) > 0.002) {
    const angularVel = (state.speedMs / WHEELBASE) * Math.tan(state.frontSteerRad);
    state.yaw += angularVel * clampedDt;
    const midYaw = state.yaw;
    state.x += Math.sin(midYaw) * state.speedMs * clampedDt;
    state.z += Math.cos(midYaw) * state.speedMs * clampedDt;
    state.wheelSpinRad += (state.speedMs * clampedDt) / WHEEL_RADIUS;
  }

  // Keep inside outer trial compound perimeter
  state.x = Math.max(-46, Math.min(46, state.x));
  state.z = Math.max(-36, Math.min(34, state.z));

  state.y = groundHeightAt(state.x, state.z);

  // 7. Wheel Line-Touch & Cone Collision Detection
  const sY = Math.sin(state.yaw);
  const cY = Math.cos(state.yaw);
  const wheelOffsets = [
    { fwd: halfWb, left: halfTr },
    { fwd: halfWb, left: -halfTr },
    { fwd: -halfWb, left: halfTr },
    { fwd: -halfWb, left: -halfTr },
  ];

  // Check if any wheel touches a painted boundary segment (tire width radius ~0.13m)
  const touchThresholdSq = 0.16 * 0.16;
  for (const w of wheelOffsets) {
    const wx = state.x + sY * w.fwd + cY * w.left;
    const wz = state.z + cY * w.fwd - sY * w.left;
    for (const seg of boundaries) {
      if (pointToSegmentDistSq(wx, wz, seg.x1, seg.z1, seg.x2, seg.z2) < touchThresholdSq) {
        callbacks?.onLineTouch?.(seg.kind);
        break;
      }
    }
  }

  // Check chassis corners/radius against traffic cones
  const carCheckPoints = [
    { fwd: CAR_LENGTH * 0.42, left: CAR_WIDTH * 0.44 },
    { fwd: CAR_LENGTH * 0.42, left: -CAR_WIDTH * 0.44 },
    { fwd: -CAR_LENGTH * 0.42, left: CAR_WIDTH * 0.44 },
    { fwd: -CAR_LENGTH * 0.42, left: -CAR_WIDTH * 0.44 },
    { fwd: 0, left: CAR_WIDTH * 0.46 },
    { fwd: 0, left: -CAR_WIDTH * 0.46 },
  ];

  for (const cone of cones) {
    if (cone.knocked) {
      if (cone.tiltAngle < Math.PI * 0.46) {
        cone.tiltAngle = Math.min(Math.PI * 0.46, cone.tiltAngle + clampedDt * 6.5);
      }
      continue;
    }
    const dxCenter = cone.x - state.x;
    const dzCenter = cone.z - state.z;
    if (dxCenter * dxCenter + dzCenter * dzCenter > 9) continue;

    for (const cp of carCheckPoints) {
      const px = state.x + sY * cp.fwd + cY * cp.left;
      const pz = state.z + cY * cp.fwd - sY * cp.left;
      const dx = cone.x - px;
      const dz = cone.z - pz;
      if (dx * dx + dz * dz < 0.24 * 0.24) {
        cone.knocked = true;
        const mag = Math.hypot(dx, dz) || 1;
        cone.tiltDirX = dx / mag;
        cone.tiltDirZ = dz / mag;
        callbacks?.onConeHit?.(cone.id);
        break;
      }
    }
  }
}
