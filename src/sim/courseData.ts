import { ConeState, StageDefinition, StageId } from '../types/trial';

export interface LineSegment2D {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  kind: 'boundary' | 'stop' | 'ukaloBox' | 'garage';
}

export const STAGES: StageDefinition[] = [
  {
    id: 'start',
    order: 0,
    name: 'Pre-Start Check',
    nepaliName: 'प्रारम्भिक जाँच',
    instruction:
      'Fasten seatbelt, press Clutch, turn Ignition Key, select 1st Gear, release Handbrake, and drive North into the Figure-8.',
    spawn: { x: -28, z: 22, yaw: Math.PI },
  },
  {
    id: 'figure8',
    order: 1,
    name: 'Figure-8 Track',
    nepaliName: '८ आकार (एट)',
    instruction:
      'Signal Left/Right as you enter, navigate both loops of the Figure-8 without touching boundary lines or cones, then exit East.',
    spawn: { x: -28, z: 16, yaw: Math.PI },
  },
  {
    id: 'speedbreakers',
    order: 2,
    name: 'Speed Breakers',
    nepaliName: 'गति अवरोधक',
    instruction:
      'Keep in 1st Gear and feather the clutch smoothly over the 3 speed bumps without stalling or crossing the yellow corridor lines.',
    spawn: { x: -19, z: -17, yaw: -Math.PI / 2 },
  },
  {
    id: 'traffic',
    order: 3,
    name: 'Traffic Light & Zebra',
    nepaliName: 'ट्राफिक बत्ती',
    instruction:
      'Stop behind the white stop line if the light is Red or Amber. On Green, signal Right and turn South past the zebra crossing.',
    spawn: { x: 2, z: -17, yaw: -Math.PI / 2 },
  },
  {
    id: 'uturn',
    order: 4,
    name: 'U-Turn Bay',
    nepaliName: 'यू-टर्न',
    instruction:
      'Drive South, activate Left Indicator, and execute a controlled U-Turn around the island onto the Ukalo approach lane.',
    spawn: { x: 18, z: -4, yaw: 0 },
  },
  {
    id: 'ukalo',
    order: 5,
    name: 'Ukalo & Oralo Ramp',
    nepaliName: 'उकालो र ओरालो',
    instruction:
      'Climb the Ukalo ramp, stop completely inside the yellow box, engage Handbrake, then find Clutch Bite Point + Throttle to climb without rolling back.',
    spawn: { x: 30, z: 9, yaw: Math.PI },
  },
  {
    id: 'lback',
    order: 6,
    name: 'L-Back Garage',
    nepaliName: 'एल-ब्याक पार्किङ',
    instruction:
      'Pull past the garage bay on the left, shift to Reverse (R) with Clutch, and back smoothly into the marked L-Back box. Pull Handbrake to finish.',
    spawn: { x: 24, z: -28, yaw: Math.PI / 2 },
  },
];

// Course geometry constants
export const FIG8_CENTER_X = -28;
export const FIG8_SOUTH_Z = 5.5;
export const FIG8_NORTH_Z = -9.5;
export const FIG8_R_CENTER = 8.0;
export const FIG8_HALF_WIDTH = 2.2; // 4.4m lane width

export const SPEED_BREAKER_ZS = { z: -17, xs: [-13, -8, -3] };

export const TRAFFIC_STOP_X = 9.5;
export const TRAFFIC_LIGHT_POS = { x: 13.5, z: -13.5 };

export const UTURN_CENTER = { x: 24, z: 12.5 };
export const UTURN_R_CENTER = 6.0;

// Ukalo / Oralo along x = 30, driving North (-Z) from z = 6 to z = -22
export const UKALO_X = 30;
export const UKALO_UP_START_Z = 5;
export const UKALO_UP_END_Z = -4; // 9m climb -> 1.55m height (~17.2% grade)
export const UKALO_CREST_HEIGHT = 1.55;
export const UKALO_DOWN_START_Z = -10;
export const UKALO_DOWN_END_Z = -19; // 9m descent
export const UKALO_STOP_BOX = { minX: 28.0, maxX: 32.0, minZ: -2.6, maxZ: 0.8 };

// L-Back Parking Garage Bay (south off the top road z = -28)
export const LBACK_BOX = { minX: 6.2, maxX: 9.8, minZ: -24.5, maxZ: -19.0 };

/**
 * Exact continuous ground height at world (x, z) for wheels & props
 */
export function groundHeightAt(x: number, z: number): number {
  let y = 0;

  // Ukalo / Oralo concrete ramp corridor (x in [27.2, 32.8])
  if (x >= 27.2 && x <= 32.8 && z <= UKALO_UP_START_Z && z >= UKALO_DOWN_END_Z) {
    if (z > UKALO_UP_END_Z) {
      // Climbing from +5 to -4
      const t = (UKALO_UP_START_Z - z) / (UKALO_UP_START_Z - UKALO_UP_END_Z);
      y = Math.max(y, t * UKALO_CREST_HEIGHT);
    } else if (z >= UKALO_DOWN_START_Z) {
      // Flat crest plateau
      y = Math.max(y, UKALO_CREST_HEIGHT);
    } else {
      // Descending from -10 to -19
      const t = (z - UKALO_DOWN_END_Z) / (UKALO_DOWN_START_Z - UKALO_DOWN_END_Z);
      y = Math.max(y, t * UKALO_CREST_HEIGHT);
    }
  }

  // 3 Speed Breakers along z in [-19.4, -14.6]
  if (z >= -19.4 && z <= -14.6) {
    for (const bx of SPEED_BREAKER_ZS.xs) {
      const dx = Math.abs(x - bx);
      if (dx < 0.48) {
        const bump = Math.cos((dx / 0.48) * (Math.PI / 2)) * 0.11;
        y = Math.max(y, bump);
      }
    }
  }

  return y;
}

/**
 * Generate boundary line segments for collision detection and painted markings
 */
export function buildCourseBoundaries(): LineSegment2D[] {
  const segs: LineSegment2D[] = [];

  const addArc = (
    cx: number,
    cz: number,
    r: number,
    startAngle: number,
    endAngle: number,
    steps: number,
    kind: LineSegment2D['kind'] = 'boundary'
  ) => {
    for (let i = 0; i < steps; i++) {
      const a1 = startAngle + (i / steps) * (endAngle - startAngle);
      const a2 = startAngle + ((i + 1) / steps) * (endAngle - startAngle);
      segs.push({
        x1: cx + Math.cos(a1) * r,
        z1: cz + Math.sin(a1) * r,
        x2: cx + Math.cos(a2) * r,
        z2: cz + Math.sin(a2) * r,
        kind,
      });
    }
  };

  const rIn = FIG8_R_CENTER - FIG8_HALF_WIDTH; // 5.8
  const rOut = FIG8_R_CENTER + FIG8_HALF_WIDTH; // 10.2

  // Figure-8 inner islands (two circular hubs)
  addArc(FIG8_CENTER_X, FIG8_SOUTH_Z, rIn, 0, Math.PI * 2, 32);
  addArc(FIG8_CENTER_X, FIG8_NORTH_Z, rIn, 0, Math.PI * 2, 32);

  // Figure-8 outer curved boundary
  // South loop: open at bottom (+0.38*PI..+0.62*PI) for Start lane & top (-0.78*PI..-0.22*PI) for crossover
  addArc(FIG8_CENTER_X, FIG8_SOUTH_Z, rOut, Math.PI * 0.62, Math.PI * 1.22, 14);
  addArc(FIG8_CENTER_X, FIG8_SOUTH_Z, rOut, -Math.PI * 0.22, Math.PI * 0.38, 14);

  // North loop: open at bottom (+0.22*PI..+0.78*PI) for crossover & NE (-0.34*PI..+0.02*PI) for Speed Breaker exit
  addArc(FIG8_CENTER_X, FIG8_NORTH_Z, rOut, Math.PI * 0.78, Math.PI * 1.66, 22);
  addArc(FIG8_CENTER_X, FIG8_NORTH_Z, rOut, Math.PI * 0.02, Math.PI * 0.22, 6);

  // Start lane walls (x = -30.5 and x = -25.5, z from 15.2 to 26)
  segs.push({ x1: -30.5, z1: 15.2, x2: -30.5, z2: 26, kind: 'boundary' });
  segs.push({ x1: -25.5, z1: 15.2, x2: -25.5, z2: 26, kind: 'boundary' });
  segs.push({ x1: -30.5, z1: 26, x2: -25.5, z2: 26, kind: 'boundary' });

  // Speed breaker corridor (z = -19.3 and z = -14.7 from x = -20 to Traffic Intersection)
  segs.push({ x1: -20.0, z1: -19.3, x2: 20.6, z2: -19.3, kind: 'boundary' });
  segs.push({ x1: -18.2, z1: -14.7, x2: 15.4, z2: -14.7, kind: 'boundary' });

  // Traffic intersection South corridor (x = 15.4 and x = 20.6, z from -14.7/-19.3 to 12.5)
  segs.push({ x1: 15.4, z1: -14.7, x2: 15.4, z2: 12.5, kind: 'boundary' });
  segs.push({ x1: 20.6, z1: -19.3, x2: 20.6, z2: 12.5, kind: 'boundary' });

  // U-Turn Bay (center 24, 12.5, rIn=3.4, rOut=8.6)
  addArc(UTURN_CENTER.x, UTURN_CENTER.z, UTURN_R_CENTER - 2.6, 0, Math.PI, 18);
  addArc(UTURN_CENTER.x, UTURN_CENTER.z, UTURN_R_CENTER + 2.6, 0, Math.PI, 24);

  // Ukalo/Oralo divider & outer east boundary
  segs.push({ x1: 27.4, z1: 12.5, x2: 27.4, z2: -25.5, kind: 'boundary' });
  segs.push({ x1: 32.6, z1: 12.5, x2: 32.6, z2: -30.5, kind: 'boundary' });

  // Top exit lane from Oralo to L-Back (z = -30.5 and z = -25.5)
  segs.push({ x1: 32.6, z1: -30.5, x2: 2.0, z2: -30.5, kind: 'boundary' });
  segs.push({ x1: 27.4, z1: -25.5, x2: 10.2, z2: -25.5, kind: 'boundary' });
  segs.push({ x1: 5.8, z1: -25.5, x2: 2.0, z2: -25.5, kind: 'boundary' });
  segs.push({ x1: 2.0, z1: -30.5, x2: 2.0, z2: -25.5, kind: 'boundary' });

  // L-Back Garage Walls (x: 5.8..10.2, z: -25.5..-18.5)
  segs.push({ x1: 5.8, z1: -25.5, x2: 5.8, z2: -18.5, kind: 'garage' });
  segs.push({ x1: 10.2, z1: -25.5, x2: 10.2, z2: -18.5, kind: 'garage' });
  segs.push({ x1: 5.8, z1: -18.5, x2: 10.2, z2: -18.5, kind: 'garage' });

  return segs;
}

export function buildCourseCones(): ConeState[] {
  const cones: ConeState[] = [];
  let id = 1;
  const addCone = (x: number, z: number) => {
    cones.push({
      id: id++,
      x,
      z,
      baseY: groundHeightAt(x, z),
      knocked: false,
      tiltAngle: 0,
      tiltDirX: 0,
      tiltDirZ: 1,
    });
  };

  // Figure-8 inner hub cones
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    addCone(FIG8_CENTER_X + Math.cos(a) * 5.3, FIG8_SOUTH_Z + Math.sin(a) * 5.3);
    addCone(FIG8_CENTER_X + Math.cos(a) * 5.3, FIG8_NORTH_Z + Math.sin(a) * 5.3);
  }

  // Speed breaker corridor edge cones
  for (const x of [-15.5, -10.5, -5.5, -0.5, 4.5]) {
    addCone(x, -19.7);
    addCone(x, -14.3);
  }

  // U-Turn apex & outer cones
  for (let i = 0; i <= 5; i++) {
    const a = (i / 5) * Math.PI;
    addCone(UTURN_CENTER.x + Math.cos(a) * 3.1, UTURN_CENTER.z + Math.sin(a) * 3.1);
    addCone(UTURN_CENTER.x + Math.cos(a) * 9.0, UTURN_CENTER.z + Math.sin(a) * 9.0);
  }

  // Ukalo ramp side cones
  for (const z of [5, 0, -5, -10, -15, -19]) {
    addCone(27.0, z);
    addCone(33.0, z);
  }

  // L-Back garage corner & rear cones
  addCone(5.4, -25.2);
  addCone(10.6, -25.2);
  addCone(5.4, -21.8);
  addCone(10.6, -21.8);
  addCone(5.4, -18.2);
  addCone(8.0, -18.2);
  addCone(10.6, -18.2);

  return cones;
}

export function getStageForPosition(x: number, z: number, current: StageId): StageId {
  if (current === 'finished') return 'finished';

  if (current === 'start') {
    if (z < 16.5) return 'figure8';
    return 'start';
  }
  if (current === 'figure8') {
    if (x > -18.5 && z < -12) return 'speedbreakers';
    return 'figure8';
  }
  if (current === 'speedbreakers') {
    if (x > 1.5 && z < -12) return 'traffic';
    return 'speedbreakers';
  }
  if (current === 'traffic') {
    if (x > 14 && z > -10) return 'uturn';
    return 'traffic';
  }
  if (current === 'uturn') {
    if (x > 26.5 && z < 8.5) return 'ukalo';
    return 'uturn';
  }
  if (current === 'ukalo') {
    if (z < -22 && x < 26.5) return 'lback';
    return 'ukalo';
  }
  return current;
}
