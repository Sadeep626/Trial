import {
  LBACK_BOX,
  TRAFFIC_STOP_X,
  UKALO_STOP_BOX,
} from './courseData';
import {
  MAX_FRONT_WHEEL_RAD,
  MAX_STEER_WHEEL_DEG,
  WHEELBASE,
} from './vehiclePhysics';
import {
  GearPosition,
  TrafficLightPhase,
  VehicleInputs,
  VehicleTelemetry,
} from '../types/trial';

interface Waypoint {
  x: number;
  z: number;
  targetSpeedMs: number;
  indicator?: -1 | 0 | 1;
}

const FORWARD_WAYPOINTS: Waypoint[] = [
  // Start Lane -> Figure-8 South Entry
  { x: -28.0, z: 18.0, targetSpeedMs: 2.3, indicator: -1 },
  { x: -28.0, z: 13.5, targetSpeedMs: 2.0, indicator: -1 },
  // South-East loop of Figure-8
  { x: -22.5, z: 11.2, targetSpeedMs: 1.9, indicator: 0 },
  { x: -20.0, z: 5.5, targetSpeedMs: 1.9 },
  { x: -22.5, z: -0.2, targetSpeedMs: 1.9 },
  // Crossover & North-West loop of Figure-8
  { x: -28.0, z: -2.0, targetSpeedMs: 1.9 },
  { x: -33.5, z: -3.8, targetSpeedMs: 1.9 },
  { x: -36.0, z: -9.5, targetSpeedMs: 1.9 },
  { x: -33.5, z: -15.2, targetSpeedMs: 1.9 },
  { x: -28.0, z: -17.5, targetSpeedMs: 1.9 },
  // Exit East into Speed Breakers
  { x: -21.5, z: -17.0, targetSpeedMs: 1.8 },
  { x: -15.5, z: -17.0, targetSpeedMs: 1.3 },
  { x: -8.0, z: -17.0, targetSpeedMs: 1.2 },
  { x: -1.0, z: -17.0, targetSpeedMs: 1.4 },
  // Traffic Light Stop Zone & Zebra Turn
  { x: 6.5, z: -17.0, targetSpeedMs: 1.6 },
  { x: 13.5, z: -17.0, targetSpeedMs: 1.7, indicator: 1 },
  { x: 17.6, z: -15.8, targetSpeedMs: 1.7, indicator: 1 },
  { x: 18.0, z: -11.0, targetSpeedMs: 2.2, indicator: 0 },
  { x: 18.0, z: 5.0, targetSpeedMs: 2.2, indicator: -1 },
  // U-Turn Bay around (24, 12.5)
  { x: 18.0, z: 12.5, targetSpeedMs: 1.8, indicator: -1 },
  { x: 19.8, z: 16.7, targetSpeedMs: 1.7, indicator: -1 },
  { x: 24.0, z: 18.5, targetSpeedMs: 1.7, indicator: -1 },
  { x: 28.2, z: 16.7, targetSpeedMs: 1.7, indicator: 0 },
  { x: 30.0, z: 12.5, targetSpeedMs: 2.0 },
  // Approach Ukalo Ramp
  { x: 30.0, z: 5.0, targetSpeedMs: 1.8 },
  { x: 30.0, z: -0.6, targetSpeedMs: 1.4 },
  // Crest & Oralo Descent
  { x: 30.0, z: -7.0, targetSpeedMs: 1.8 },
  { x: 30.0, z: -14.0, targetSpeedMs: 1.5 },
  { x: 30.0, z: -22.5, targetSpeedMs: 1.7, indicator: -1 },
  // Top Lane West past L-Back Garage
  { x: 28.2, z: -27.4, targetSpeedMs: 1.8, indicator: -1 },
  { x: 20.0, z: -28.0, targetSpeedMs: 2.1, indicator: 0 },
  { x: 10.0, z: -28.0, targetSpeedMs: 1.8 },
  { x: 3.8, z: -27.8, targetSpeedMs: 1.2 },
];

const REVERSE_WAYPOINTS: Waypoint[] = [
  { x: 6.0, z: -27.1, targetSpeedMs: 1.2 },
  { x: 7.5, z: -25.3, targetSpeedMs: 1.1 },
  { x: 8.0, z: -23.4, targetSpeedMs: 1.0 },
  { x: 8.0, z: -21.5, targetSpeedMs: 0.9 },
];

export type DemoPhase =
  | 'prestart'
  | 'drive_forward'
  | 'ukalo_hold'
  | 'ukalo_bite'
  | 'prepare_reverse'
  | 'reverse_park'
  | 'parked';

export interface DemoControllerState {
  phase: DemoPhase;
  phaseTime: number;
  wpIndex: number;
  ukaloCompleted: boolean;
  caption: string;
}

export function createDemoState(): DemoControllerState {
  return {
    phase: 'prestart',
    phaseTime: 0,
    wpIndex: 0,
    ukaloCompleted: false,
    caption: 'Starting Demo: Fastening seatbelt & engaging Clutch before Ignition.',
  };
}

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function steerTowardPoint(
  tel: VehicleTelemetry,
  tx: number,
  tz: number,
  reverse: boolean
): number {
  const dx = tx - tel.x;
  const dz = tz - tel.z;
  const dist = Math.hypot(dx, dz) || 1;
  // Desired travel heading (in our yaw convention, forward = (sin(yaw), cos(yaw)))
  const targetTravelYaw = Math.atan2(dx, dz);
  const carDesiredYaw = reverse ? wrapAngle(targetTravelYaw + Math.PI) : targetTravelYaw;
  const headingErr = wrapAngle(carDesiredYaw - tel.yaw);

  // Pure-pursuit curvature -> front wheel angle (tight lookAhead prevents cutting inner cones)
  const lookAhead = Math.max(1.6, Math.min(2.6, dist));
  const curvature = (2 * Math.sin(headingErr)) / lookAhead;
  let desiredFrontSteer = Math.atan(curvature * WHEELBASE);
  if (reverse) {
    desiredFrontSteer = -desiredFrontSteer;
  }
  desiredFrontSteer = Math.max(-MAX_FRONT_WHEEL_RAD, Math.min(MAX_FRONT_WHEEL_RAD, desiredFrontSteer));
  // Recall: steeringWheelDeg < 0 => frontSteerRad > 0 (Left)
  return (-desiredFrontSteer / MAX_FRONT_WHEEL_RAD) * MAX_STEER_WHEEL_DEG;
}

export function stepDemoAutopilot(
  demo: DemoControllerState,
  tel: VehicleTelemetry,
  inp: VehicleInputs,
  trafficLight: TrafficLightPhase,
  dt: number
): void {
  demo.phaseTime += dt;

  // 1. Pre-start cockpit sequence
  if (demo.phase === 'prestart') {
    inp.steeringWheelDeg = 0;
    inp.brake = 0.6;
    inp.throttle = 0;

    if (demo.phaseTime > 0.35) inp.seatbelt = true;
    if (demo.phaseTime > 0.75) inp.clutch = 1.0;
    if (demo.phaseTime > 1.1 && !tel.engineRunning) {
      inp.ignition = 2;
      demo.caption = 'Demo: Holding Clutch & cranking Ignition Key to start engine.';
    } else if (tel.engineRunning) {
      inp.ignition = 1;
    }

    if (demo.phaseTime > 1.85 && tel.engineRunning) {
      inp.gear = '1';
      demo.caption = 'Demo: Shifting to 1st Gear, releasing Handbrake, and signaling Left.';
    }
    if (demo.phaseTime > 2.25 && inp.gear === '1') {
      inp.handbrake = 0;
      inp.indicator = -1;
    }
    if (demo.phaseTime > 2.65 && tel.engineRunning && inp.gear === '1') {
      demo.phase = 'drive_forward';
      demo.phaseTime = 0;
      inp.brake = 0;
    }
    return;
  }

  // 2. Ukalo Stop Box Hold
  if (demo.phase === 'ukalo_hold') {
    inp.steeringWheelDeg = 0;
    inp.throttle = 0;
    inp.clutch = 0.95;
    inp.brake = 0.75;
    if (Math.abs(tel.speedMs) < 0.06 && demo.phaseTime > 0.35) {
      inp.handbrake = 1;
      inp.brake = 0;
      demo.caption = 'Demo (Ukalo): Stopped inside yellow box — Handbrake pulled.';
    }
    if (demo.phaseTime > 1.45) {
      demo.phase = 'ukalo_bite';
      demo.phaseTime = 0;
      demo.caption = 'Demo (Ukalo): Raising throttle & finding Clutch Bite Point before releasing Handbrake.';
    }
    return;
  }

  // 3. Ukalo Bite-Point Launch
  if (demo.phase === 'ukalo_bite') {
    inp.steeringWheelDeg = 0;
    inp.gear = '1';
    inp.throttle = 0.44;
    inp.clutch = 0.46; // Square in the 28%-72% bite zone!
    if (demo.phaseTime > 0.55) {
      inp.handbrake = 0;
      demo.caption = 'Demo (Ukalo): Handbrake released at Bite Point — climbing with zero rollback!';
    }
    if (tel.z < -2.6) {
      demo.phase = 'drive_forward';
      demo.phaseTime = 0;
    }
    return;
  }

  // 4. Prepare Reverse for L-Back Garage
  if (demo.phase === 'prepare_reverse') {
    inp.brake = 0.85;
    inp.throttle = 0;
    inp.clutch = 1.0;
    inp.steeringWheelDeg += (-470 - inp.steeringWheelDeg) * Math.min(1, dt * 6);
    if (Math.abs(tel.speedMs) < 0.05 && demo.phaseTime > 0.6) {
      inp.gear = 'R';
      demo.caption = 'Demo (L-Back): Shifted to Reverse (R) — backing smoothly into garage bay.';
    }
    if (demo.phaseTime > 1.25 && inp.gear === 'R') {
      demo.phase = 'reverse_park';
      demo.phaseTime = 0;
      demo.wpIndex = 0;
      inp.brake = 0;
    }
    return;
  }

  // 5. Reverse Parking into L-Back Garage
  if (demo.phase === 'reverse_park') {
    const wp = REVERSE_WAYPOINTS[demo.wpIndex];
    const dist = Math.hypot(wp.x - tel.x, wp.z - tel.z);
    if (dist < 1.15 && demo.wpIndex < REVERSE_WAYPOINTS.length - 1) {
      demo.wpIndex++;
    }

    const activeWp = REVERSE_WAYPOINTS[demo.wpIndex];
    const targetSteer = steerTowardPoint(tel, activeWp.x, activeWp.z, true);
    inp.steeringWheelDeg += (targetSteer - inp.steeringWheelDeg) * Math.min(1, dt * 7);

    const speed = Math.abs(tel.speedMs);
    if (speed < activeWp.targetSpeedMs) {
      inp.clutch = 0.48;
      inp.throttle = 0.12;
      inp.brake = 0;
    } else {
      inp.clutch = 0.85;
      inp.throttle = 0;
      inp.brake = 0.2;
    }

    const inGarageFinal =
      tel.x >= LBACK_BOX.minX + 0.45 &&
      tel.x <= LBACK_BOX.maxX - 0.45 &&
      tel.z >= LBACK_BOX.minZ + 1.2 &&
      tel.z <= LBACK_BOX.maxZ - 1.2 &&
      demo.wpIndex === REVERSE_WAYPOINTS.length - 1 &&
      Math.abs(tel.z - activeWp.z) < 0.45;

    if (inGarageFinal) {
      demo.phase = 'parked';
      demo.phaseTime = 0;
      demo.caption = 'Demo Complete: Parked cleanly inside L-Back Garage with Handbrake engaged!';
    }
    return;
  }

  // 6. Parked at Finish
  if (demo.phase === 'parked') {
    inp.clutch = 1.0;
    inp.brake = 0.5;
    inp.throttle = 0;
    inp.handbrake = 1;
    inp.steeringWheelDeg += (0 - inp.steeringWheelDeg) * Math.min(1, dt * 5);
    if (Math.abs(tel.speedMs) < 0.05) {
      inp.gear = 'N';
      inp.brake = 0;
      inp.clutch = 0;
    }
    return;
  }

  // 7. Forward Driving Through Course
  const wp = FORWARD_WAYPOINTS[demo.wpIndex];
  const distToWp = Math.hypot(wp.x - tel.x, wp.z - tel.z);
  if (distToWp < 1.65 && demo.wpIndex < FORWARD_WAYPOINTS.length - 1) {
    demo.wpIndex++;
  }

  const activeWp = FORWARD_WAYPOINTS[demo.wpIndex];
  if (activeWp.indicator !== undefined) {
    inp.indicator = activeWp.indicator;
  }

  // Check Traffic Light Stop Line
  const approachingRedLight =
    tel.z < -14 &&
    tel.z > -20 &&
    tel.x > TRAFFIC_STOP_X - 3.6 &&
    tel.x < TRAFFIC_STOP_X - 0.35 &&
    trafficLight !== 'green';

  // Check Ukalo Stop Box Trigger
  if (
    !demo.ukaloCompleted &&
    tel.x >= UKALO_STOP_BOX.minX &&
    tel.x <= UKALO_STOP_BOX.maxX &&
    tel.z <= 0.1 &&
    tel.z >= -1.6
  ) {
    demo.ukaloCompleted = true;
    demo.phase = 'ukalo_hold';
    demo.phaseTime = 0;
    return;
  }

  // Check L-Back Turnaround Trigger
  if (
    demo.wpIndex === FORWARD_WAYPOINTS.length - 1 &&
    Math.hypot(activeWp.x - tel.x, activeWp.z - tel.z) < 0.9
  ) {
    demo.phase = 'prepare_reverse';
    demo.phaseTime = 0;
    demo.caption = 'Demo (L-Back): Pulled past garage bay — braking to shift into Reverse.';
    return;
  }

  // Update contextual narrator caption
  if (tel.x < -18 && tel.z > -18) {
    demo.caption = 'Demo (Figure-8): Creeping in 1st Gear through both loops without touching yellow lines.';
  } else if (tel.z < -14 && tel.x >= -18 && tel.x <= 4) {
    demo.caption = 'Demo (Speed Breakers): Modulating clutch & throttle smoothly over speed bumps.';
  } else if (tel.z < -14 && tel.x > 4 && tel.x < 16) {
    demo.caption =
      trafficLight !== 'green'
        ? 'Demo (Traffic Signal): Holding Clutch + Brake behind stop line on Red/Amber.'
        : 'Demo (Traffic Signal): Green light — signaling Right and turning past zebra crossing.';
  } else if (tel.z > -10 && tel.x > 14 && tel.x < 27) {
    demo.caption = 'Demo (U-Turn): Signaling Left and rounding the U-Turn island.';
  } else if (tel.x >= 27 && tel.z > -4) {
    demo.caption = 'Demo (Ukalo): Climbing steep ramp toward the yellow stop box.';
  } else if (tel.x >= 27 && tel.z <= -4) {
    demo.caption = 'Demo (Oralo): Descending downhill under controlled engine braking.';
  } else if (tel.z < -24 && tel.x < 27) {
    demo.caption = 'Demo (L-Back): Pulling past the garage opening to line up for Reverse parking.';
  }

  // Steering & Longitudinal Control
  const targetSteer = steerTowardPoint(tel, activeWp.x, activeWp.z, false);
  inp.steeringWheelDeg += (targetSteer - inp.steeringWheelDeg) * Math.min(1, dt * 7);

  if (approachingRedLight) {
    inp.clutch = 0.95;
    inp.throttle = 0;
    inp.brake = 0.72;
    return;
  }

  const desiredSpeed = activeWp.targetSpeedMs;
  const speed = tel.speedMs;
  const isUphill = tel.slopeRad > 0.05;
  const isDownhill = tel.slopeRad < -0.05;

  if (isDownhill && speed > desiredSpeed + 0.15) {
    inp.clutch = 0.25;
    inp.throttle = 0;
    inp.brake = 0.28;
  } else if (speed < desiredSpeed - 0.15) {
    inp.clutch = isUphill ? 0.15 : 0.35;
    inp.throttle = isUphill ? 0.42 : 0.18;
    inp.brake = 0;
  } else if (speed > desiredSpeed + 0.25) {
    inp.clutch = 0.75;
    inp.throttle = 0;
    inp.brake = 0.2;
  } else {
    inp.clutch = isUphill ? 0.2 : 0.42;
    inp.throttle = isUphill ? 0.28 : 0.08;
    inp.brake = 0;
  }
}

export function getDemoGearLabel(gear: GearPosition): string {
  return gear;
}
