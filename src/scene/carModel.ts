import * as THREE from 'three';
import { TRACK_WIDTH, WHEELBASE, WHEEL_RADIUS } from '../sim/vehiclePhysics';
import { createContactShadowTexture, createLearnerBoardTexture } from './textures';

export interface CarRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  roofMesh: THREE.Mesh;
  steeringWheelMesh: THREE.Group;
  frontLeftPivot: THREE.Group;
  frontRightPivot: THREE.Group;
  wheelMeshes: THREE.Group[];
  headlightMat: THREE.MeshStandardMaterial;
  brakeLightMat: THREE.MeshStandardMaterial;
  reverseLightMat: THREE.MeshStandardMaterial;
  leftBlinkerMat: THREE.MeshStandardMaterial;
  rightBlinkerMat: THREE.MeshStandardMaterial;
  headLightSpotL: THREE.SpotLight;
  headLightSpotR: THREE.SpotLight;
}

export function createDrivingSchoolCar(maxAnisotropy: number, isSoftwareGl: boolean): CarRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // Materials
  const paintMat = new THREE.MeshPhysicalMaterial({
    color: 0xf1f5f9, // Clean Pearl White Nepali driving school car
    metalness: 0.25,
    roughness: 0.28,
    clearcoat: 0.85,
    clearcoatRoughness: 0.14,
  });

  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0xd97706, // Saffron/Amber training stripe
    roughness: 0.42,
    metalness: 0.1,
  });

  const bumperMat = new THREE.MeshStandardMaterial({
    color: 0x1e242b,
    roughness: 0.72,
    metalness: 0.12,
  });

  const interiorMat = new THREE.MeshStandardMaterial({
    color: 0x252a32,
    roughness: 0.82,
    metalness: 0.08,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xd4d8de,
    metalness: 0.9,
    roughness: 0.18,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x99b8cc,
    metalness: 0.05,
    roughness: 0.08,
    transparent: true,
    opacity: isSoftwareGl ? 0.34 : 0.42,
    depthWrite: false,
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x181a1e,
    roughness: 0.88,
    metalness: 0.05,
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.24,
    metalness: 0.8,
  });

  // Ground contact shadow plane
  const shadowGeo = new THREE.PlaneGeometry(2.35, 4.15);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: createContactShadowTexture(),
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.position.y = 0.015;
  root.add(shadowPlane);

  // 1. Lower Chassis / Floorpan (local +Z is Front, -X is Right/Driver side)
  const lowerBodyGeo = new THREE.BoxGeometry(1.56, 0.52, 3.46);
  const lowerBody = new THREE.Mesh(lowerBodyGeo, paintMat);
  lowerBody.position.set(0, 0.46, 0);
  lowerBody.castShadow = true;
  lowerBody.receiveShadow = true;
  bodyGroup.add(lowerBody);

  // Front Hood Slope
  const hoodGeo = new THREE.BoxGeometry(1.48, 0.14, 0.96);
  const hood = new THREE.Mesh(hoodGeo, paintMat);
  hood.position.set(0, 0.72, 1.18);
  hood.rotation.x = 0.08;
  hood.castShadow = true;
  bodyGroup.add(hood);

  // Side Training Stripe
  const stripeGeo = new THREE.BoxGeometry(1.58, 0.08, 3.12);
  const stripe = new THREE.Mesh(stripeGeo, stripeMat);
  stripe.position.set(0, 0.48, 0);
  bodyGroup.add(stripe);

  // Front & Rear Bumpers
  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.24, 0.18), bumperMat);
  frontBumper.position.set(0, 0.31, 1.72);
  frontBumper.castShadow = true;
  bodyGroup.add(frontBumper);

  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.26, 0.18), bumperMat);
  rearBumper.position.set(0, 0.32, -1.72);
  rearBumper.castShadow = true;
  bodyGroup.add(rearBumper);

  // Front Grille
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.18, 0.05), bumperMat);
  grille.position.set(0, 0.5, 1.74);
  bodyGroup.add(grille);

  // 2. Cabin Pillars & Roof (allowing clear cockpit view from inside)
  const pillarPositions = [
    { x: 0.64, z: 0.56, rx: -0.45, h: 0.66 }, // A-pillar L
    { x: -0.64, z: 0.56, rx: -0.45, h: 0.66 }, // A-pillar R
    { x: 0.64, z: -0.18, rx: 0, h: 0.6 }, // B-pillar L
    { x: -0.64, z: -0.18, rx: 0, h: 0.6 }, // B-pillar R
    { x: 0.62, z: -1.18, rx: 0.38, h: 0.65 }, // C-pillar L
    { x: -0.62, z: -1.18, rx: 0.38, h: 0.65 }, // C-pillar R
  ];
  for (const p of pillarPositions) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.08, p.h, 0.09), interiorMat);
    pillar.position.set(p.x, 1.0, p.z);
    pillar.rotation.x = p.rx;
    pillar.castShadow = true;
    bodyGroup.add(pillar);
  }

  // Roof panel
  const roofMesh = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.06, 1.66), paintMat);
  roofMesh.position.set(0, 1.3, -0.34);
  roofMesh.castShadow = true;
  bodyGroup.add(roofMesh);

  // Windshield & Rear Window
  const windshield = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.66), glassMat);
  windshield.position.set(0, 1.02, 0.56);
  windshield.rotation.x = -Math.PI * 0.34;
  windshield.renderOrder = 3;
  bodyGroup.add(windshield);

  const rearGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), glassMat);
  rearGlass.position.set(0, 1.02, -1.24);
  rearGlass.rotation.x = Math.PI * 0.32;
  rearGlass.rotation.y = Math.PI;
  rearGlass.renderOrder = 3;
  bodyGroup.add(rearGlass);

  // Side Mirrors (crucial visual reference!)
  const mirrorHousingGeo = new THREE.BoxGeometry(0.18, 0.11, 0.09);
  const mirrorGlassGeo = new THREE.PlaneGeometry(0.15, 0.08);
  const mirrorGlassMat = new THREE.MeshStandardMaterial({ color: 0xa5d8ff, metalness: 0.95, roughness: 0.05 });

  [-1, 1].forEach((side) => {
    const mGroup = new THREE.Group();
    mGroup.position.set(side * 0.85, 0.82, 0.56);
    const housing = new THREE.Mesh(mirrorHousingGeo, bumperMat);
    const mFace = new THREE.Mesh(mirrorGlassGeo, mirrorGlassMat);
    mFace.position.z = -0.046;
    mFace.rotation.y = Math.PI;
    mGroup.add(housing, mFace);
    bodyGroup.add(mGroup);
  });

  // 3. Roof "L TRIAL" Board
  const lBoardGroup = new THREE.Group();
  lBoardGroup.position.set(0, 1.43, -0.15);
  const lBoardMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.22, 0.08),
    [
      paintMat,
      paintMat,
      paintMat,
      paintMat,
      new THREE.MeshStandardMaterial({ map: createLearnerBoardTexture(maxAnisotropy), roughness: 0.4 }),
      new THREE.MeshStandardMaterial({ map: createLearnerBoardTexture(maxAnisotropy), roughness: 0.4 }),
    ]
  );
  lBoardMesh.castShadow = true;
  lBoardGroup.add(lBoardMesh);
  bodyGroup.add(lBoardGroup);

  // 4. Right-Hand-Drive Cockpit Interior (Driver sits at x = -0.34 in Nepal!)
  const dash = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.28, 0.42), interiorMat);
  dash.position.set(0, 0.72, 0.52);
  bodyGroup.add(dash);

  const driverSeat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.55, 0.44), interiorMat);
  driverSeat.position.set(-0.34, 0.65, -0.2);
  bodyGroup.add(driverSeat);

  // 3D Steering Wheel inside cabin (RHD: x = -0.34)
  const steeringWheelMesh = new THREE.Group();
  steeringWheelMesh.position.set(-0.34, 0.83, 0.29);
  steeringWheelMesh.rotation.x = -0.38;

  const rimTorus = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.018, 10, 28), bumperMat);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 16), interiorMat);
  hub.rotation.x = Math.PI / 2;
  const spokeL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.025, 0.015), chromeMat);
  const spokeB = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.14, 0.015), chromeMat);
  spokeB.position.y = -0.07;
  // Top-center alignment marker
  const centerMarker = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.04, 0.04), stripeMat);
  centerMarker.position.y = 0.155;

  steeringWheelMesh.add(rimTorus, hub, spokeL, spokeB, centerMarker);
  bodyGroup.add(steeringWheelMesh);

  // 5. Reactive Vehicle Lights
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xfef3c7,
    emissiveIntensity: 0.2,
    roughness: 0.15,
  });
  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    emissive: 0xef4444,
    emissiveIntensity: 0.15,
    roughness: 0.2,
  });
  const reverseLightMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    emissive: 0xffffff,
    emissiveIntensity: 0.0,
    roughness: 0.2,
  });
  const leftBlinkerMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.0,
    roughness: 0.2,
  });
  const rightBlinkerMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.0,
    roughness: 0.2,
  });

  // Front Headlights & Blinkers
  [-1, 1].forEach((side) => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.06), headlightMat);
    hl.position.set(side * 0.56, 0.55, 1.73);
    bodyGroup.add(hl);

    const fb = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.1, 0.06),
      side > 0 ? leftBlinkerMat : rightBlinkerMat
    );
    fb.position.set(side * 0.72, 0.55, 1.72);
    bodyGroup.add(fb);

    // Rear Taillight + Brake
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.06), brakeLightMat);
    tl.position.set(side * 0.62, 0.58, -1.73);
    bodyGroup.add(tl);

    // Rear Reverse light
    const rl = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.06), reverseLightMat);
    rl.position.set(side * 0.44, 0.54, -1.73);
    bodyGroup.add(rl);

    // Rear Amber Blinker
    const rb = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.08, 0.06),
      side > 0 ? leftBlinkerMat : rightBlinkerMat
    );
    rb.position.set(side * 0.44, 0.62, -1.73);
    bodyGroup.add(rb);
  });

  // Headlight Spotlights (off by default until L pressed)
  const headLightSpotL = new THREE.SpotLight(0xfff4d6, 0, 26, Math.PI / 5, 0.45, 1.4);
  headLightSpotL.position.set(0.54, 0.58, 1.76);
  headLightSpotL.target.position.set(0.54, 0.1, 12);
  bodyGroup.add(headLightSpotL, headLightSpotL.target);

  const headLightSpotR = new THREE.SpotLight(0xfff4d6, 0, 26, Math.PI / 5, 0.45, 1.4);
  headLightSpotR.position.set(-0.54, 0.58, 1.76);
  headLightSpotR.target.position.set(-0.54, 0.1, 12);
  bodyGroup.add(headLightSpotR, headLightSpotR.target);

  // 6. Four Wheels (Front Left = +X, +Z; Front Right = -X, +Z)
  const halfWb = WHEELBASE * 0.5;
  const halfTr = TRACK_WIDTH * 0.5;

  const createWheel = (): THREE.Group => {
    const wGroup = new THREE.Group();
    const tireGeo = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.19, 24);
    tireGeo.rotateZ(Math.PI / 2);
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.castShadow = true;

    const rimGeo = new THREE.CylinderGeometry(WHEEL_RADIUS * 0.6, WHEEL_RADIUS * 0.6, 0.2, 16);
    rimGeo.rotateZ(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, rimMat);

    // Spokes to visualize wheel rotation clearly
    const spoke1 = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.28, 0.045), bumperMat);
    const spoke2 = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.045, 0.28), bumperMat);

    wGroup.add(tire, rim, spoke1, spoke2);
    return wGroup;
  };

  const frontLeftPivot = new THREE.Group();
  frontLeftPivot.position.set(halfTr, WHEEL_RADIUS, halfWb);
  const flWheel = createWheel();
  frontLeftPivot.add(flWheel);

  const frontRightPivot = new THREE.Group();
  frontRightPivot.position.set(-halfTr, WHEEL_RADIUS, halfWb);
  const frWheel = createWheel();
  frontRightPivot.add(frWheel);

  const rlWheel = createWheel();
  rlWheel.position.set(halfTr, WHEEL_RADIUS, -halfWb);

  const rrWheel = createWheel();
  rrWheel.position.set(-halfTr, WHEEL_RADIUS, -halfWb);

  root.add(frontLeftPivot, frontRightPivot, rlWheel, rrWheel);

  return {
    root,
    bodyGroup,
    roofMesh,
    steeringWheelMesh,
    frontLeftPivot,
    frontRightPivot,
    wheelMeshes: [flWheel, frWheel, rlWheel, rrWheel],
    headlightMat,
    brakeLightMat,
    reverseLightMat,
    leftBlinkerMat,
    rightBlinkerMat,
    headLightSpotL,
    headLightSpotR,
  };
}
