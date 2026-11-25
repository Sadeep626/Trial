import * as THREE from 'three';
import {
  LBACK_BOX,
  LineSegment2D,
  SPEED_BREAKER_ZS,
  TRAFFIC_LIGHT_POS,
  TRAFFIC_STOP_X,
  UKALO_CREST_HEIGHT,
  UKALO_DOWN_END_Z,
  UKALO_DOWN_START_Z,
  UKALO_STOP_BOX,
  UKALO_UP_END_Z,
  UKALO_UP_START_Z,
  UKALO_X,
  groundHeightAt,
} from '../sim/courseData';
import { ConeState, TrafficLightPhase } from '../types/trial';
import {
  createAsphaltTexture,
  createBrickWallTexture,
  createRampConcreteTexture,
} from './textures';

export interface TrialWorldHandles {
  root: THREE.Group;
  coneGroups: THREE.Group[];
  redLampMat: THREE.MeshStandardMaterial;
  amberLampMat: THREE.MeshStandardMaterial;
  greenLampMat: THREE.MeshStandardMaterial;
  ukaloBoxMat: THREE.MeshBasicMaterial;
  lbackBoxMat: THREE.MeshBasicMaterial;
  updateTrafficLight: (phase: TrafficLightPhase) => void;
  syncCones: (cones: ConeState[]) => void;
}

export function createTrialWorld(
  boundaries: LineSegment2D[],
  cones: ConeState[],
  maxAnisotropy: number
): TrialWorldHandles {
  const root = new THREE.Group();

  // 1. Extended Kathmandu Valley Surround Ground (prevents floating box void)
  const valleyGeo = new THREE.CircleGeometry(320, 48);
  valleyGeo.rotateX(-Math.PI / 2);
  const valleyMat = new THREE.MeshStandardMaterial({
    color: 0x4b6043,
    roughness: 0.94,
    metalness: 0.0,
  });
  const valleyMesh = new THREE.Mesh(valleyGeo, valleyMat);
  valleyMesh.position.y = -0.06;
  valleyMesh.receiveShadow = true;
  root.add(valleyMesh);

  // Distant Himalayan Foothills Ring (multi-ridge silhouette)
  const hillMat = new THREE.MeshStandardMaterial({
    color: 0x3b4d54,
    roughness: 0.92,
    metalness: 0.0,
    flatShading: true,
  });
  const hillCount = 28;
  const hillGeo = new THREE.ConeGeometry(34, 28, 7);
  const hillInst = new THREE.InstancedMesh(hillGeo, hillMat, hillCount);
  const dummy = new THREE.Object3D();
  const cTmp = new THREE.Color();
  for (let i = 0; i < hillCount; i++) {
    const a = (i / hillCount) * Math.PI * 2;
    const dist = 145 + (i % 3) * 28;
    const scaleH = 0.8 + ((i * 37) % 100) / 80;
    const scaleW = 1.1 + ((i * 19) % 50) / 50;
    dummy.position.set(Math.cos(a) * dist, 12 * scaleH - 2, Math.sin(a) * dist);
    dummy.rotation.set(0, a + i * 0.4, 0);
    dummy.scale.set(scaleW, scaleH, scaleW);
    dummy.updateMatrix();
    hillInst.setMatrixAt(i, dummy.matrix);
    cTmp.setHex(i % 2 === 0 ? 0x3f535a : 0x4c6053);
    hillInst.setColorAt(i, cTmp);
  }
  hillInst.computeBoundingSphere();
  root.add(hillInst);

  // 2. Main Asphalt Trial Pad
  const asphaltTex = createAsphaltTexture(maxAnisotropy);
  const asphaltGeo = new THREE.PlaneGeometry(94, 72);
  asphaltGeo.rotateX(-Math.PI / 2);
  const asphaltMat = new THREE.MeshStandardMaterial({
    map: asphaltTex,
    roughness: 0.86,
    metalness: 0.04,
  });
  const asphalt = new THREE.Mesh(asphaltGeo, asphaltMat);
  asphalt.position.set(0, 0, -1);
  asphalt.receiveShadow = true;
  root.add(asphalt);

  // 3. 3D Ukalo / Oralo Concrete Ramp Structure
  const rampMat = new THREE.MeshStandardMaterial({
    map: createRampConcreteTexture(maxAnisotropy),
    roughness: 0.78,
    metalness: 0.04,
  });
  const rampWallMat = new THREE.MeshStandardMaterial({
    color: 0xb49e6b,
    roughness: 0.85,
  });

  // Side profile of ramp along Z: (+5,0) -> (-4, H) -> (-10, H) -> (-19, 0)
  const rampShape = new THREE.Shape();
  rampShape.moveTo(UKALO_UP_START_Z, 0);
  rampShape.lineTo(UKALO_UP_END_Z, UKALO_CREST_HEIGHT);
  rampShape.lineTo(UKALO_DOWN_START_Z, UKALO_CREST_HEIGHT);
  rampShape.lineTo(UKALO_DOWN_END_Z, 0);
  rampShape.closePath();

  const rampGeo = new THREE.ExtrudeGeometry(rampShape, {
    depth: 5.5,
    bevelEnabled: false,
  });
  // ExtrudeGeometry extrudes along +Z, shape is in X(=world Z) and Y(=world Y).
  // Rotate -PI/2 around Y so shape X maps to +Z? Let's verify:
  // RotationY(-PI/2): (x, y, z) -> (-z, y, x).
  // So shape X -> world +Z, shape Y -> world +Y, depth (0..5.5) -> world X (-5.5..0)!
  rampGeo.rotateY(-Math.PI / 2);
  const rampMesh = new THREE.Mesh(rampGeo, rampMat);
  rampMesh.position.set(UKALO_X + 2.75, 0.005, 0);
  rampMesh.castShadow = true;
  rampMesh.receiveShadow = true;
  root.add(rampMesh);

  // Concrete side curbs along Ukalo/Oralo
  [-2.68, 2.68].forEach((dx) => {
    const curbGeo = new THREE.ExtrudeGeometry(rampShape, { depth: 0.16, bevelEnabled: false });
    curbGeo.rotateY(-Math.PI / 2);
    const curb = new THREE.Mesh(curbGeo, rampWallMat);
    curb.position.set(UKALO_X + dx + 0.08, 0.12, 0);
    curb.castShadow = true;
    root.add(curb);
  });

  // Ukalo Yellow Stop Box Painted on Ramp Incline
  const boxSlopeAngle = Math.atan2(UKALO_CREST_HEIGHT, UKALO_UP_START_Z - UKALO_UP_END_Z);
  const boxLen = (UKALO_STOP_BOX.maxZ - UKALO_STOP_BOX.minZ) / Math.cos(boxSlopeAngle);
  const boxCenterZ = (UKALO_STOP_BOX.minZ + UKALO_STOP_BOX.maxZ) * 0.5;
  const boxCenterY = groundHeightAt(UKALO_X, boxCenterZ) + 0.028;

  const ukaloBoxMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    transparent: true,
    opacity: 0.42,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const ukaloStopPlane = new THREE.Mesh(new THREE.PlaneGeometry(3.8, boxLen), ukaloBoxMat);
  ukaloStopPlane.position.set(UKALO_X, boxCenterY, boxCenterZ);
  ukaloStopPlane.rotation.x = -Math.PI / 2 + boxSlopeAngle;
  root.add(ukaloStopPlane);

  // 4. Three Speed Breakers along z = -17
  const bumpMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.65 });
  const bumpDarkMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.75 });
  SPEED_BREAKER_ZS.xs.forEach((bx, idx) => {
    const speedBumpGeo = new THREE.BoxGeometry(0.85, 0.11, 4.4);
    const mesh = new THREE.Mesh(speedBumpGeo, idx % 2 === 0 ? bumpMat : bumpDarkMat);
    mesh.position.set(bx, 0.055, SPEED_BREAKER_ZS.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    // Yellow/black stripes on bump top
    for (let s = -1.6; s <= 1.6; s += 0.8) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.86, 0.015, 0.32),
        idx % 2 === 0 ? bumpDarkMat : bumpMat
      );
      stripe.position.set(bx, 0.112, SPEED_BREAKER_ZS.z + s);
      root.add(stripe);
    }
  });

  // 5. Painted Boundary Lines (yellow & white) from course segments
  const yellowLineMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const garageLineMat = new THREE.MeshBasicMaterial({
    color: 0xf8fafc,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  for (const seg of boundaries) {
    const dx = seg.x2 - seg.x1;
    const dz = seg.z2 - seg.z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) continue;
    const cx = (seg.x1 + seg.x2) * 0.5;
    const cz = (seg.z1 + seg.z2) * 0.5;
    const y1 = groundHeightAt(seg.x1, seg.z1);
    const y2 = groundHeightAt(seg.x2, seg.z2);
    const cy = (y1 + y2) * 0.5 + 0.024;
    const yaw = Math.atan2(dx, dz);
    const pitch = Math.atan2(y1 - y2, len);

    const lineGeo = new THREE.PlaneGeometry(0.14, len + 0.04);
    lineGeo.rotateX(-Math.PI / 2);
    const lineMesh = new THREE.Mesh(lineGeo, seg.kind === 'garage' ? garageLineMat : yellowLineMat);
    lineMesh.position.set(cx, cy, cz);
    lineMesh.rotation.order = 'YXZ';
    lineMesh.rotation.y = yaw;
    lineMesh.rotation.x = pitch;
    root.add(lineMesh);
  }

  // 6. Zebra Crossing & Stop Line at Traffic Light
  const whitePaintMat = new THREE.MeshBasicMaterial({
    color: 0xf1f5f9,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  // Stop line at x = TRAFFIC_STOP_X
  const stopLineGeo = new THREE.PlaneGeometry(0.32, 4.4);
  stopLineGeo.rotateX(-Math.PI / 2);
  const stopLine = new THREE.Mesh(stopLineGeo, whitePaintMat);
  stopLine.position.set(TRAFFIC_STOP_X, 0.025, -17);
  root.add(stopLine);

  // Zebra stripes across x = 10.6..12.6
  for (let z = -18.8; z <= -15.2; z += 0.72) {
    const stripeGeo = new THREE.PlaneGeometry(2.0, 0.36);
    stripeGeo.rotateX(-Math.PI / 2);
    const stripe = new THREE.Mesh(stripeGeo, whitePaintMat);
    stripe.position.set(11.6, 0.025, z);
    root.add(stripe);
  }

  // L-Back Target Parking Zone Highlight
  const lbackBoxMat = new THREE.MeshBasicMaterial({
    color: 0x22c55e,
    transparent: true,
    opacity: 0.28,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const lbackZone = new THREE.Mesh(
    new THREE.PlaneGeometry(LBACK_BOX.maxX - LBACK_BOX.minX, LBACK_BOX.maxZ - LBACK_BOX.minZ),
    lbackBoxMat
  );
  lbackZone.rotation.x = -Math.PI / 2;
  lbackZone.position.set(
    (LBACK_BOX.minX + LBACK_BOX.maxX) * 0.5,
    0.022,
    (LBACK_BOX.minZ + LBACK_BOX.maxZ) * 0.5
  );
  root.add(lbackZone);

  // 7. Traffic Light Pole & Lamps
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.35 });
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6 });

  const tlGroup = new THREE.Group();
  tlGroup.position.set(TRAFFIC_LIGHT_POS.x, 0, TRAFFIC_LIGHT_POS.z);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 4.4, 12), poleMat);
  pole.position.y = 2.2;
  pole.castShadow = true;
  tlGroup.add(pole);

  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2.2), poleMat);
  arm.position.set(0, 4.2, -1.0);
  tlGroup.add(arm);

  const signalBox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.15, 0.42), housingMat);
  signalBox.position.set(0, 3.85, -1.9);
  signalBox.castShadow = true;
  tlGroup.add(signalBox);

  const redLampMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, emissive: 0xef4444, emissiveIntensity: 0.1 });
  const amberLampMat = new THREE.MeshStandardMaterial({ color: 0x78350f, emissive: 0xf59e0b, emissiveIntensity: 0.1 });
  const greenLampMat = new THREE.MeshStandardMaterial({ color: 0x14532d, emissive: 0x22c55e, emissiveIntensity: 2.0 });

  const lampGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16);
  lampGeo.rotateZ(Math.PI / 2);

  const redLamp = new THREE.Mesh(lampGeo, redLampMat);
  redLamp.position.set(-0.2, 4.18, -1.9);
  const amberLamp = new THREE.Mesh(lampGeo, amberLampMat);
  amberLamp.position.set(-0.2, 3.85, -1.9);
  const greenLamp = new THREE.Mesh(lampGeo, greenLampMat);
  greenLamp.position.set(-0.2, 3.52, -1.9);

  tlGroup.add(redLamp, amberLamp, greenLamp);
  root.add(tlGroup);

  // 8. Knockable 3D Traffic Cones
  const coneOrangeMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.48 });
  const coneWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.42 });
  const coneBaseMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });

  const baseGeo = new THREE.BoxGeometry(0.32, 0.04, 0.32);
  const coneBodyGeo = new THREE.ConeGeometry(0.12, 0.52, 14);
  const coneBandGeo = new THREE.CylinderGeometry(0.068, 0.095, 0.14, 14);

  const coneGroups: THREE.Group[] = [];
  for (const c of cones) {
    const cg = new THREE.Group();
    cg.position.set(c.x, c.baseY, c.z);

    const base = new THREE.Mesh(baseGeo, coneBaseMat);
    base.position.y = 0.02;
    base.castShadow = true;

    const body = new THREE.Mesh(coneBodyGeo, coneOrangeMat);
    body.position.y = 0.28;
    body.castShadow = true;

    const band = new THREE.Mesh(coneBandGeo, coneWhiteMat);
    band.position.y = 0.31;

    cg.add(base, body, band);
    root.add(cg);
    coneGroups.push(cg);
  }

  // 9. Compound Brick Perimeter Walls & Examiner Tower
  const brickTex = createBrickWallTexture(maxAnisotropy);
  const wallMat = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.88 });

  const wallSpecs = [
    { x: 0, z: -37.2, w: 94, d: 0.45 },
    { x: 0, z: 35.2, w: 94, d: 0.45 },
    { x: -47.2, z: -1, w: 0.45, d: 72.4 },
    { x: 47.2, z: -1, w: 0.45, d: 72.4 },
  ];
  for (const ws of wallSpecs) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(ws.w, 1.9, ws.d), wallMat);
    wall.position.set(ws.x, 0.95, ws.z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    root.add(wall);
  }

  // Examiner Observation Booth near center-west
  const boothGroup = new THREE.Group();
  boothGroup.position.set(-6, 0, 12);
  const boothBase = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 2.8, 3.2),
    new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.82 })
  );
  boothBase.position.y = 1.4;
  boothBase.castShadow = true;
  boothBase.receiveShadow = true;

  const boothRoof = new THREE.Mesh(
    new THREE.BoxGeometry(4.8, 0.22, 3.8),
    new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.45, metalness: 0.25 })
  );
  boothRoof.position.y = 2.9;
  boothRoof.castShadow = true;

  const boothWindow = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 1.1, 3.24),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.15, metalness: 0.8 })
  );
  boothWindow.position.y = 1.95;

  boothGroup.add(boothBase, boothRoof, boothWindow);
  root.add(boothGroup);

  // Perimeter Trees (InstancedMesh outside compound wall)
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.92 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f6a34, roughness: 0.85 });
  const treeCoords: Array<[number, number]> = [];
  for (let i = -42; i <= 42; i += 14) {
    treeCoords.push([i, -42]);
    treeCoords.push([i, 40]);
  }
  for (let j = -32; j <= 32; j += 16) {
    treeCoords.push([-53, j]);
    treeCoords.push([53, j]);
  }

  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 2.4, 8);
  const canopyGeo = new THREE.DodecahedronGeometry(1.9, 1);
  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCoords.length);
  const canopyInst = new THREE.InstancedMesh(canopyGeo, leafMat, treeCoords.length);
  trunkInst.castShadow = true;
  canopyInst.castShadow = true;

  treeCoords.forEach(([tx, tz], idx) => {
    const s = 0.85 + ((idx * 23) % 30) / 100;
    dummy.position.set(tx, 1.2 * s, tz);
    dummy.rotation.set(0, idx * 0.7, 0);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(tx, 3.4 * s, tz);
    dummy.scale.set(s * 1.15, s * 1.05, s * 1.15);
    dummy.updateMatrix();
    canopyInst.setMatrixAt(idx, dummy.matrix);

    cTmp.setHex(idx % 3 === 0 ? 0x3b6632 : idx % 3 === 1 ? 0x4b773c : 0x34592c);
    canopyInst.setColorAt(idx, cTmp);
  });
  trunkInst.computeBoundingSphere();
  canopyInst.computeBoundingSphere();
  root.add(trunkInst, canopyInst);

  const updateTrafficLight = (phase: TrafficLightPhase) => {
    redLampMat.emissiveIntensity = phase === 'red' ? 2.4 : 0.08;
    amberLampMat.emissiveIntensity = phase === 'amber' ? 2.4 : 0.08;
    greenLampMat.emissiveIntensity = phase === 'green' ? 2.4 : 0.08;
  };

  const _axis = new THREE.Vector3();
  const syncCones = (latestCones: ConeState[]) => {
    for (let i = 0; i < latestCones.length; i++) {
      const c = latestCones[i];
      const cg = coneGroups[i];
      if (!cg) continue;
      if (c.knocked) {
        // Tilt orthogonal to impact direction
        _axis.set(-c.tiltDirZ, 0, c.tiltDirX).normalize();
        cg.quaternion.setFromAxisAngle(_axis, c.tiltAngle);
      } else {
        cg.quaternion.identity();
      }
    }
  };

  return {
    root,
    coneGroups,
    redLampMat,
    amberLampMat,
    greenLampMat,
    ukaloBoxMat,
    lbackBoxMat,
    updateTrafficLight,
    syncCones,
  };
}
