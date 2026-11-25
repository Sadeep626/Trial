import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CameraMode,
  ConeState,
  MapViewState,
  TrafficLightPhase,
  VehicleInputs,
  VehicleTelemetry,
} from '../types/trial';
import { LineSegment2D } from '../sim/courseData';
import { createDrivingSchoolCar } from './carModel';
import { createTrialWorld } from './trialWorld';

interface TrialCanvasProps {
  telemetryRef: React.MutableRefObject<VehicleTelemetry>;
  inputsRef: React.MutableRefObject<VehicleInputs>;
  conesRef: React.MutableRefObject<ConeState[]>;
  trafficLightRef: React.MutableRefObject<TrafficLightPhase>;
  cameraModeRef: React.MutableRefObject<CameraMode>;
  mapViewRef: React.MutableRefObject<MapViewState>;
  boundaries: LineSegment2D[];
  onStepFrame: (dt: number, elapsed: number) => void;
}

// Pre-allocated math helpers (zero GC inside animation loop)
const _desiredCamPos = new THREE.Vector3();
const _desiredLookAt = new THREE.Vector3();
const _currentLookAt = new THREE.Vector3();
const _carForward = new THREE.Vector3();
const _carRight = new THREE.Vector3();

export const TrialCanvas: React.FC<TrialCanvasProps> = ({
  telemetryRef,
  inputsRef,
  conesRef,
  trafficLightRef,
  cameraModeRef,
  mapViewRef,
  boundaries,
  onStepFrame,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stepFrameRef = useRef(onStepFrame);
  stepFrameRef.current = onStepFrame;
  const boundariesRef = useRef(boundaries);
  boundariesRef.current = boundaries;

  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Software WebGL Guard
    const isSoftwareGl = (() => {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const skyColor = new THREE.Color(0xc2d5e6);
    scene.background = skyColor;
    scene.fog = new THREE.Fog(skyColor, 75, 240);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const camera = new THREE.PerspectiveCamera(54, width / height, 0.12, 440);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'grab';
    container.appendChild(canvas);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    // 3. Direct 3D Map Pointer Orbit, Pan & Pinch/Wheel Zoom
    const activePointers = new Map<number, { x: number; y: number }>();
    let dragMode: 'none' | 'orbit' | 'pan' | 'pinch' = 'none';
    let lastX = 0;
    let lastY = 0;
    let lastPinchDist = 0;

    const getCurrentOrbitYaw = () => {
      const camMode = cameraModeRef.current;
      const mv = mapViewRef.current;
      const tel = telemetryRef.current;
      const inp = inputsRef.current;
      if (!mv.followCar || camMode === 'overhead') {
        return Math.PI + mv.yawOffsetRad;
      }
      const base = tel.yaw + (inp.gear === 'R' ? Math.PI : 0);
      return base + mv.yawOffsetRad;
    };

    const applyPanDelta = (dx: number, dy: number) => {
      const mv = mapViewRef.current;
      const tel = telemetryRef.current;
      const orbitYaw = getCurrentOrbitYaw();
      // If user pans while following car, initialize pan relative to world and switch to free map explore
      if (mv.followCar) {
        mv.followCar = false;
        mv.panX = tel.x;
        mv.panZ = tel.z;
        mv.yawOffsetRad = orbitYaw - Math.PI;
      }
      const panSpeed = Math.max(0.015, mv.distance * 0.0018);
      const fwdX = Math.sin(orbitYaw);
      const fwdZ = Math.cos(orbitYaw);
      const rightX = -fwdZ;
      const rightZ = fwdX;

      mv.panX = THREE.MathUtils.clamp(mv.panX - rightX * dx * panSpeed + fwdX * dy * panSpeed, -48, 48);
      mv.panZ = THREE.MathUtils.clamp(mv.panZ - rightZ * dx * panSpeed + fwdZ * dy * panSpeed, -38, 36);
    };

    const onPointerDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointers.size === 1) {
        lastX = e.clientX;
        lastY = e.clientY;
        const isPan = e.button === 2 || e.button === 1 || e.shiftKey;
        dragMode = isPan ? 'pan' : 'orbit';
        canvas.style.cursor = 'grabbing';
      } else if (activePointers.size === 2) {
        const pts = Array.from(activePointers.values());
        lastPinchDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        lastX = (pts[0].x + pts[1].x) * 0.5;
        lastY = (pts[0].y + pts[1].y) * 0.5;
        dragMode = 'pinch';
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const mv = mapViewRef.current;
      const camMode = cameraModeRef.current;

      if (dragMode === 'pinch' && activePointers.size >= 2) {
        const pts = Array.from(activePointers.values());
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const cx = (pts[0].x + pts[1].x) * 0.5;
        const cy = (pts[0].y + pts[1].y) * 0.5;
        if (lastPinchDist > 0 && camMode !== 'cockpit') {
          const zoomDelta = (lastPinchDist - dist) * 0.045;
          mv.distance = THREE.MathUtils.clamp(mv.distance + zoomDelta, 4.2, 62);
        }
        applyPanDelta(cx - lastX, cy - lastY);
        lastPinchDist = dist;
        lastX = cx;
        lastY = cy;
        return;
      }

      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      if (dragMode === 'pan' && camMode !== 'cockpit') {
        applyPanDelta(dx, dy);
      } else if (dragMode === 'orbit') {
        if (camMode === 'cockpit') {
          mv.yawOffsetRad = THREE.MathUtils.clamp(mv.yawOffsetRad - dx * 0.005, -1.55, 1.55);
          mv.pitchRad = THREE.MathUtils.clamp(mv.pitchRad - dy * 0.004, -0.32, 0.45);
        } else {
          mv.yawOffsetRad -= dx * 0.0065;
          mv.pitchRad = THREE.MathUtils.clamp(mv.pitchRad + dy * 0.005, 0.14, 1.46);
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      activePointers.delete(e.pointerId);
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
      if (activePointers.size === 0) {
        dragMode = 'none';
        canvas.style.cursor = 'grab';
      } else if (activePointers.size === 1) {
        const remaining = Array.from(activePointers.values())[0];
        lastX = remaining.x;
        lastY = remaining.y;
        dragMode = 'orbit';
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (cameraModeRef.current === 'cockpit') return;
      const mv = mapViewRef.current;
      mv.distance = THREE.MathUtils.clamp(mv.distance + e.deltaY * 0.015, 4.2, 62);
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);

    // 4. Studio Environment Reflection (RoomEnvironment) + Morning Valley Lighting
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x5d5646, 0.72);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff1d6, 1.95);
    sunLight.position.set(36, 54, 28);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 140;
    sunLight.shadow.camera.left = -48;
    sunLight.shadow.camera.right = 48;
    sunLight.shadow.camera.top = 48;
    sunLight.shadow.camera.bottom = -48;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.025;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0xc7dcf5, 0.48);
    rimLight.position.set(-40, 22, -35);
    scene.add(rimLight);

    // 5. World & Vehicle Rig
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const world = createTrialWorld(boundariesRef.current, conesRef.current, maxAniso);
    scene.add(world.root);

    const car = createDrivingSchoolCar(maxAniso, isSoftwareGl);
    scene.add(car.root);

    const initTel = telemetryRef.current;
    camera.position.set(initTel.x, initTel.y + 3.4, initTel.z + 6.8);
    _currentLookAt.set(initTel.x, initTel.y + 0.8, initTel.z - 2.0);
    camera.lookAt(_currentLookAt);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 6. Resize Handling (supports side-by-side dock collapse/expand + window resize)
    const onResize = () => {
      if (!container) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    // 7. Simulation & Render Loop with Software-WebGL Pacing
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let lastCamMode: CameraMode = cameraModeRef.current;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;

      stepFrameRef.current(dt, elapsed);

      const tel = telemetryRef.current;
      const inp = inputsRef.current;
      const camMode = cameraModeRef.current;
      const mv = mapViewRef.current;

      // Sync Car Transform
      car.root.position.set(tel.x, tel.y, tel.z);
      car.root.rotation.order = 'YXZ';
      car.root.rotation.y = tel.yaw;
      car.root.rotation.x = tel.pitch;
      car.root.rotation.z = tel.roll;

      // Sync Steering Wheel & 4 Wheels
      car.steeringWheelMesh.rotation.z = THREE.MathUtils.degToRad(-inp.steeringWheelDeg);
      car.frontLeftPivot.rotation.y = tel.frontSteerRad;
      car.frontRightPivot.rotation.y = tel.frontSteerRad;
      for (let i = 0; i < car.wheelMeshes.length; i++) {
        car.wheelMeshes[i].rotation.x = tel.wheelSpinRad;
      }

      // Sync Car Lights
      const blinkOn = Math.floor(elapsed * 2.4) % 2 === 0;
      const leftOn = (inp.indicator === -1 || inp.hazard) && blinkOn;
      const rightOn = (inp.indicator === 1 || inp.hazard) && blinkOn;
      car.leftBlinkerMat.emissiveIntensity = leftOn ? 2.8 : 0.0;
      car.rightBlinkerMat.emissiveIntensity = rightOn ? 2.8 : 0.0;

      const braking = inp.brake > 0.08 || inp.handbrake > 0.2;
      car.brakeLightMat.emissiveIntensity = braking ? 2.5 : inp.headlights ? 0.65 : 0.12;
      car.reverseLightMat.emissiveIntensity = inp.gear === 'R' && inp.ignition > 0 ? 2.2 : 0.0;

      car.headlightMat.emissiveIntensity = inp.headlights ? 2.2 : 0.15;
      car.headLightSpotL.intensity = inp.headlights ? 4.5 : 0;
      car.headLightSpotR.intensity = inp.headlights ? 4.5 : 0;

      world.updateTrafficLight(trafficLightRef.current);
      world.syncCones(conesRef.current);

      // Update Camera with 3D Orbit, Tilt, Zoom & Pan
      const sinY = Math.sin(tel.yaw);
      const cosY = Math.cos(tel.yaw);
      _carForward.set(sinY, 0, cosY);
      _carRight.set(-cosY, 0, sinY);

      if (camMode === 'cockpit') {
        car.roofMesh.visible = true;
        if (lastCamMode !== 'cockpit') {
          camera.fov = 62;
          camera.updateProjectionMatrix();
        }
        const lookYaw = tel.yaw + mv.yawOffsetRad;
        const lookSin = Math.sin(lookYaw);
        const lookCos = Math.cos(lookYaw);
        _desiredCamPos
          .set(tel.x, tel.y + 1.07, tel.z)
          .addScaledVector(_carRight, 0.34)
          .addScaledVector(_carForward, -0.06);
        _desiredLookAt.set(
          _desiredCamPos.x + lookSin * 6.0,
          _desiredCamPos.y - 0.14 + Math.sin(mv.pitchRad) * 3.2,
          _desiredCamPos.z + lookCos * 6.0
        );
        camera.position.copy(_desiredCamPos);
        _currentLookAt.copy(_desiredLookAt);
        camera.lookAt(_currentLookAt);

        mv.compassDeg =
          ((Math.atan2(lookSin, -lookCos) * 180) / Math.PI + 360) % 360;
      } else {
        car.roofMesh.visible = true;
        const targetFov = camMode === 'overhead' ? 48 : 54;
        if (camera.fov !== targetFov) {
          camera.fov = targetFov;
          camera.updateProjectionMatrix();
        }

        const orbitYaw =
          !mv.followCar || camMode === 'overhead'
            ? Math.PI + mv.yawOffsetRad
            : tel.yaw + (inp.gear === 'R' ? Math.PI : 0) + mv.yawOffsetRad;

        const targetX = mv.followCar ? tel.x : mv.panX;
        const targetY = mv.followCar ? tel.y + 0.75 : 0.6;
        const targetZ = mv.followCar ? tel.z : mv.panZ;

        const horizDist = Math.cos(mv.pitchRad) * mv.distance;
        const vertDist = Math.sin(mv.pitchRad) * mv.distance;
        const oSin = Math.sin(orbitYaw);
        const oCos = Math.cos(orbitYaw);

        _desiredLookAt.set(targetX, targetY, targetZ);
        _desiredCamPos.set(
          targetX - oSin * horizDist,
          targetY + vertDist,
          targetZ - oCos * horizDist
        );

        if (lastCamMode === 'cockpit') {
          camera.position.copy(_desiredCamPos);
          _currentLookAt.copy(_desiredLookAt);
        } else {
          const dampSpeed = dragMode !== 'none' ? 18 : 8.5;
          camera.position.x = THREE.MathUtils.damp(camera.position.x, _desiredCamPos.x, dampSpeed, dt);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, _desiredCamPos.y, dampSpeed, dt);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, _desiredCamPos.z, dampSpeed, dt);
          _currentLookAt.x = THREE.MathUtils.damp(_currentLookAt.x, _desiredLookAt.x, dampSpeed + 1.5, dt);
          _currentLookAt.y = THREE.MathUtils.damp(_currentLookAt.y, _desiredLookAt.y, dampSpeed + 1.5, dt);
          _currentLookAt.z = THREE.MathUtils.damp(_currentLookAt.z, _desiredLookAt.z, dampSpeed + 1.5, dt);
        }
        camera.lookAt(_currentLookAt);

        mv.compassDeg = ((Math.atan2(oSin, -oCos) * 180) / Math.PI + 360) % 360;
      }

      lastCamMode = camMode;
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);

      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => mat.dispose());
          } else {
            m.material.dispose();
          }
        }
      });
      envTex.dispose();
      renderer.dispose();
      if (canvas.parentElement === container) {
        container.removeChild(canvas);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full" />
      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0d1015]/95 text-slate-200 z-30">
          <div className="text-center max-w-sm px-6">
            <p className="font-display text-lg font-semibold">Graphics Context Paused</p>
            <p className="text-sm text-slate-400 mt-1">
              Restoring WebGL rendering surface for the trial ground.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
