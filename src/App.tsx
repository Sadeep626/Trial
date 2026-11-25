import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CameraMode,
  ConeState,
  DeductionEntry,
  GearPosition,
  MapViewState,
  StageId,
  StrictnessMode,
  TrafficLightPhase,
  TrialMode,
  VehicleInputs,
  VehicleTelemetry,
} from './types/trial';
import {
  LBACK_BOX,
  STAGES,
  TRAFFIC_STOP_X,
  UKALO_STOP_BOX,
  buildCourseBoundaries,
  buildCourseCones,
  getStageForPosition,
} from './sim/courseData';
import {
  MAX_STEER_WHEEL_DEG,
  createInitialTelemetry,
  createPhysicsContext,
  stepVehiclePhysics,
} from './sim/vehiclePhysics';
import { EngineAudioSynth } from './audio/engineAudio';
import {
  DemoControllerState,
  createDemoState,
  stepDemoAutopilot,
} from './sim/demoAutopilot';
import { TrialCanvas } from './scene/TrialCanvas';
import { CockpitControls } from './components/CockpitControls';
import { TrialHeader, TrialStageOverlay } from './components/TrialHud';
import { TutorialHighlight, TutorialOverlay } from './components/TutorialOverlay';

function createInitialInputs(): VehicleInputs {
  return {
    steeringWheelDeg: 0,
    clutch: 0,
    brake: 0,
    throttle: 0,
    gear: 'N',
    handbrake: 1,
    ignition: 0,
    seatbelt: false,
    indicator: 0,
    hazard: false,
    headlights: false,
    horn: false,
  };
}

function getDefaultMapView(mode: CameraMode): MapViewState {
  if (mode === 'overhead') {
    return {
      yawOffsetRad: 0,
      pitchRad: 1.14,
      distance: 21,
      panX: 0,
      panZ: 0,
      followCar: true,
      compassDeg: 0,
    };
  }
  if (mode === 'cockpit') {
    return {
      yawOffsetRad: 0,
      pitchRad: 0,
      distance: 6.8,
      panX: 0,
      panZ: 0,
      followCar: true,
      compassDeg: 0,
    };
  }
  return {
    yawOffsetRad: 0,
    pitchRad: 0.36,
    distance: 6.8,
    panX: 0,
    panZ: 0,
    followCar: true,
    compassDeg: 0,
  };
}

export default function App() {
  const boundaries = useMemo(() => buildCourseBoundaries(), []);

  const initialSpawn = STAGES[0].spawn;
  const telemetryRef = useRef<VehicleTelemetry>(
    createInitialTelemetry(initialSpawn.x, initialSpawn.z, initialSpawn.yaw)
  );
  const inputsRef = useRef<VehicleInputs>(createInitialInputs());
  const physicsCtxRef = useRef(createPhysicsContext());
  const conesRef = useRef<ConeState[]>(buildCourseCones());
  const trafficLightRef = useRef<TrafficLightPhase>('green');
  const cameraModeRef = useRef<CameraMode>('chase');
  const mapViewRef = useRef<MapViewState>(getDefaultMapView('chase'));

  const keysDownRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<EngineAudioSynth | null>(null);

  // React UI state synced at ~20Hz for smooth gauges without hurting 60fps 3D loop
  const [inputsUi, setInputsUi] = useState<VehicleInputs>(() => ({ ...inputsRef.current }));
  const [telemetryUi, setTelemetryUi] = useState<VehicleTelemetry>(() => ({ ...telemetryRef.current }));
  const [mapViewUi, setMapViewUi] = useState<MapViewState>(() => ({ ...mapViewRef.current }));
  const [mode, setMode] = useState<TrialMode>('full');
  const [strictness, setStrictness] = useState<StrictnessMode>('dotm70');
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const [muted, setMuted] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [stage, setStage] = useState<StageId>('start');
  const [score, setScore] = useState(100);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [deductions, setDeductions] = useState<DeductionEntry[]>([]);
  const [trafficLightUi, setTrafficLightUi] = useState<TrafficLightPhase>('green');
  const [ukaloStoppedOk, setUkaloStoppedOk] = useState(false);
  const [trialOutcome, setTrialOutcome] = useState<'active' | 'passed' | 'failed'>('active');
  const [failReason, setFailReason] = useState<string | null>(null);
  const [gearGrindWarning, setGearGrindWarning] = useState(false);
  const [autoClutch, setAutoClutch] = useState(false);
  const [clutchLocked, setClutchLocked] = useState(false);
  const autoClutchDipRef = useRef(0);
  const [tutorialOpen, setTutorialOpen] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('nepal_trial_tutorial_seen') !== '1';
    } catch {
      return true;
    }
  });
  const [tutorialHighlight, setTutorialHighlight] = useState<TutorialHighlight>(null);
  const demoStateRef = useRef<DemoControllerState>(createDemoState());
  const [demoSpeed, setDemoSpeed] = useState<1 | 2>(1);
  const [demoCaption, setDemoCaption] = useState<string>(demoStateRef.current.caption);

  // Mutable rule-tracking refs for deterministic frame checks
  const ruleRef = useRef({
    mode: 'full' as TrialMode,
    strictness: 'dotm70' as StrictnessMode,
    stage: 'start' as StageId,
    score: 100,
    outcome: 'active' as 'active' | 'passed' | 'failed',
    runTime: 0,
    lastLineTouchAt: -10,
    lastIndicatorOnAt: -10,
    checkedSeatbelt: false,
    checkedFig8Signal: false,
    checkedTrafficRed: false,
    checkedTrafficTurnSignal: false,
    checkedUturnSignal: false,
    ukaloStopHoldSec: 0,
    ukaloStoppedOk: false,
    ukaloCheckedMissedStop: false,
    ukaloMinZ: 99,
    ukaloRollbackPenalized: false,
    lastIndicatorBeepStep: -1,
    uiSyncAccum: 0,
    tutorialOpen: true,
    demoSpeed: 1 as 1 | 2,
    autoClutch: false,
    clutchLocked: false,
  });

  ruleRef.current.mode = mode;
  ruleRef.current.strictness = strictness;
  ruleRef.current.tutorialOpen = tutorialOpen;
  ruleRef.current.demoSpeed = demoSpeed;
  ruleRef.current.autoClutch = autoClutch;
  ruleRef.current.clutchLocked = clutchLocked;

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new EngineAudioSynth();
    }
    audioRef.current.init();
  }, []);

  const recordDeduction = useCallback((reason: string, points: number, currentStage: StageId) => {
    const r = ruleRef.current;
    if (r.mode === 'free' || r.outcome !== 'active' || r.tutorialOpen) return;

    const entry: DeductionEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timeSec: r.runTime,
      stage: currentStage,
      reason,
      points,
    };

    r.score = Math.max(0, r.score - points);
    setScore(r.score);
    setDeductions((prev) => [...prev, entry]);

    if (r.strictness === 'strict' && points >= 10) {
      r.outcome = 'failed';
      setTrialOutcome('failed');
      setFailReason(`Strict Mode Failure: ${reason}`);
    } else if (r.score < 70 && r.strictness === 'dotm70') {
      // Allow finishing or fail immediately? Official DOTM continues or flags < 70 at end; let's allow finishing and show <70 fail at end unless strict!
    }
  }, []);

  const resetToSpawn = useCallback(
    (targetStage: StageId, keepRunning = false) => {
      const def = STAGES.find((s) => s.id === targetStage) ?? STAGES[0];
      telemetryRef.current = createInitialTelemetry(def.spawn.x, def.spawn.z, def.spawn.yaw);
      physicsCtxRef.current = createPhysicsContext();
      conesRef.current = buildCourseCones();
      demoStateRef.current = createDemoState();
      setDemoCaption(demoStateRef.current.caption);

      const nextInputs = createInitialInputs();
      if (keepRunning) {
        nextInputs.seatbelt = true;
        nextInputs.ignition = 1;
        nextInputs.gear = '1';
        nextInputs.handbrake = 0;
        telemetryRef.current.engineRunning = true;
        telemetryRef.current.rpm = 860;
      }
      inputsRef.current = nextInputs;

      const r = ruleRef.current;
      r.stage = targetStage;
      r.score = 100;
      r.outcome = 'active';
      r.runTime = 0;
      r.lastLineTouchAt = -10;
      r.lastIndicatorOnAt = -10;
      r.checkedSeatbelt = keepRunning;
      r.checkedFig8Signal = targetStage !== 'start' && targetStage !== 'figure8';
      r.checkedTrafficRed = false;
      r.checkedTrafficTurnSignal = false;
      r.checkedUturnSignal = false;
      r.ukaloStopHoldSec = 0;
      r.ukaloStoppedOk = false;
      r.ukaloCheckedMissedStop = false;
      r.ukaloMinZ = 99;
      r.ukaloRollbackPenalized = false;

      autoClutchDipRef.current = 0;
      setClutchLocked(false);
      setStage(targetStage);
      setScore(100);
      setElapsedSec(0);
      setDeductions([]);
      setUkaloStoppedOk(false);
      setTrialOutcome('active');
      setFailReason(null);
      setInputsUi({ ...inputsRef.current });
      setTelemetryUi({ ...telemetryRef.current });
    },
    []
  );

  // Control Handlers
  const handleShiftGear = useCallback(
    (gear: GearPosition, options?: { fromPointer?: boolean; shiftKeyHeld?: boolean }) => {
      ensureAudio();
      if (ruleRef.current.mode === 'demo' && !ruleRef.current.tutorialOpen) return;
      const inp = inputsRef.current;
      if (inp.gear === gear) return;

      const keys = keysDownRef.current;
      const clutchKeyDown =
        Boolean(options?.shiftKeyHeld) ||
        keys.has('ShiftLeft') ||
        keys.has('ShiftRight') ||
        keys.has('KeyC') ||
        keys.has('PointerClutch');

      const clutchReady =
        ruleRef.current.autoClutch ||
        ruleRef.current.clutchLocked ||
        Boolean(options?.fromPointer) ||
        clutchKeyDown ||
        inp.clutch >= 0.45;

      if (!clutchReady) {
        audioRef.current?.playGearGrind();
        setGearGrindWarning(true);
        window.setTimeout(() => setGearGrindWarning(false), 2000);
        return;
      }

      // If shifted via pointer click or Auto-Clutch without manually holding Clutch, smoothly dip clutch briefly
      if (inp.clutch < 0.75) {
        if (clutchKeyDown || ruleRef.current.clutchLocked) {
          inp.clutch = 1.0;
        } else {
          inp.clutch = 0.88;
          autoClutchDipRef.current = 0.22;
        }
      }

      inp.gear = gear;
      setGearGrindWarning(false);
      setInputsUi({ ...inp });
    },
    [ensureAudio]
  );

  const handleToggleHandbrake = useCallback(() => {
    ensureAudio();
    const inp = inputsRef.current;
    inp.handbrake = inp.handbrake > 0.5 ? 0 : 1;
    audioRef.current?.playHandbrakeRatchet();
    setInputsUi({ ...inp });
  }, [ensureAudio]);

  const handleCycleCamera = useCallback(() => {
    const order: CameraMode[] = ['chase', 'cockpit', 'overhead'];
    const next = order[(order.indexOf(cameraModeRef.current) + 1) % order.length];
    cameraModeRef.current = next;
    mapViewRef.current = getDefaultMapView(next);
    setCameraMode(next);
    setMapViewUi({ ...mapViewRef.current });
  }, []);

  const handleRotateMap = useCallback((deltaRad: number) => {
    const mv = mapViewRef.current;
    if (cameraModeRef.current === 'cockpit') {
      mv.yawOffsetRad = Math.max(-1.55, Math.min(1.55, mv.yawOffsetRad + deltaRad));
    } else {
      mv.yawOffsetRad += deltaRad;
    }
    setMapViewUi({ ...mv });
  }, []);

  const handleTiltMap = useCallback((deltaRad: number) => {
    const mv = mapViewRef.current;
    if (cameraModeRef.current === 'cockpit') {
      mv.pitchRad = Math.max(-0.32, Math.min(0.45, mv.pitchRad + deltaRad));
    } else {
      mv.pitchRad = Math.max(0.14, Math.min(1.46, mv.pitchRad + deltaRad));
    }
    setMapViewUi({ ...mv });
  }, []);

  const handleZoomMap = useCallback((deltaMeters: number) => {
    if (cameraModeRef.current === 'cockpit') return;
    const mv = mapViewRef.current;
    mv.distance = Math.max(4.2, Math.min(62, mv.distance + deltaMeters));
    setMapViewUi({ ...mv });
  }, []);

  const handleToggleFollowCar = useCallback(() => {
    const mv = mapViewRef.current;
    const tel = telemetryRef.current;
    if (mv.followCar) {
      mv.followCar = false;
      mv.panX = tel.x;
      mv.panZ = tel.z;
      if (cameraModeRef.current === 'cockpit') {
        cameraModeRef.current = 'overhead';
        setCameraMode('overhead');
        mv.pitchRad = 1.05;
        mv.distance = 22;
      }
    } else {
      mv.followCar = true;
      mv.panX = 0;
      mv.panZ = 0;
      mv.yawOffsetRad = 0;
    }
    setMapViewUi({ ...mv });
  }, []);

  const handleResetMapView = useCallback(() => {
    const defaults = getDefaultMapView(cameraModeRef.current);
    mapViewRef.current = defaults;
    setMapViewUi({ ...defaults });
  }, []);

  const handleInspectMapPoint = useCallback((worldX: number, worldZ: number) => {
    const mv = mapViewRef.current;
    mv.followCar = false;
    mv.panX = worldX;
    mv.panZ = worldZ;
    if (cameraModeRef.current === 'cockpit') {
      cameraModeRef.current = 'overhead';
      setCameraMode('overhead');
      mv.pitchRad = 1.05;
      mv.distance = 22;
    }
    setMapViewUi({ ...mv });
  }, []);

  const handleToggleMute = useCallback(() => {
    ensureAudio();
    setMuted((prev) => {
      const next = !prev;
      audioRef.current?.setMuted(next);
      return next;
    });
  }, [ensureAudio]);

  // Keyboard Listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(code)
      ) {
        e.preventDefault();
      }
      ensureAudio();
      keysDownRef.current.add(code);

      if (e.repeat) return;
      const inp = inputsRef.current;

      // Immediately engage clutch on keydown so Shift+1 / C+1 never lags behind a frame ramp
      if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyC') {
        inp.clutch = Math.max(inp.clutch, 0.92);
        setInputsUi({ ...inp });
      }

      if (code === 'Space') {
        handleToggleHandbrake();
      } else if (code === 'Digit1' || code === 'Numpad1') {
        handleShiftGear('1', { shiftKeyHeld: e.shiftKey });
      } else if (code === 'Digit2' || code === 'Numpad2') {
        handleShiftGear('2', { shiftKeyHeld: e.shiftKey });
      } else if (code === 'KeyN' || code === 'Digit0' || code === 'Numpad0') {
        handleShiftGear('N', { shiftKeyHeld: e.shiftKey });
      } else if (code === 'KeyR') {
        handleShiftGear('R', { shiftKeyHeld: e.shiftKey });
      } else if (code === 'KeyE') {
        const order: GearPosition[] = ['R', 'N', '1', '2'];
        const idx = order.indexOf(inp.gear);
        if (idx < order.length - 1) handleShiftGear(order[idx + 1], { shiftKeyHeld: e.shiftKey });
      } else if (code === 'KeyQ') {
        const order: GearPosition[] = ['R', 'N', '1', '2'];
        const idx = order.indexOf(inp.gear);
        if (idx > 0) handleShiftGear(order[idx - 1], { shiftKeyHeld: e.shiftKey });
      } else if (code === 'KeyB') {
        inp.seatbelt = !inp.seatbelt;
        setInputsUi({ ...inp });
      } else if (code === 'KeyZ') {
        inp.indicator = inp.indicator === -1 ? 0 : -1;
        setInputsUi({ ...inp });
      } else if (code === 'KeyX') {
        inp.indicator = inp.indicator === 1 ? 0 : 1;
        setInputsUi({ ...inp });
      } else if (code === 'KeyK') {
        inp.hazard = !inp.hazard;
        setInputsUi({ ...inp });
      } else if (code === 'KeyL') {
        inp.headlights = !inp.headlights;
        setInputsUi({ ...inp });
      } else if (code === 'KeyH') {
        inp.horn = true;
        setInputsUi({ ...inp });
      } else if (code === 'KeyI') {
        inp.ignition = 2;
        setInputsUi({ ...inp });
      } else if (code === 'KeyV') {
        handleCycleCamera();
      } else if (code === 'Tab') {
        setDockCollapsed((c) => !c);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      keysDownRef.current.delete(code);
      const inp = inputsRef.current;
      if (code === 'KeyH') {
        inp.horn = false;
        setInputsUi({ ...inp });
      } else if (code === 'KeyI') {
        inp.ignition = telemetryRef.current.engineRunning ? 1 : 0;
        setInputsUi({ ...inp });
      }
    };

    const onBlur = () => {
      keysDownRef.current.clear();
      inputsRef.current.horn = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      audioRef.current?.dispose();
    };
  }, [ensureAudio, handleCycleCamera, handleShiftGear, handleToggleHandbrake]);

  // Main per-frame simulation + DOTM rule check
  const handleStepFrame = useCallback(
    (dt: number, elapsed: number) => {
      const keys = keysDownRef.current;
      const inp = inputsRef.current;
      const tel = telemetryRef.current;
      const r = ruleRef.current;

      // 1. Input shaping: Demo Autopilot vs Keyboard/Pointer
      const simSteps = r.mode === 'demo' && !r.tutorialOpen && r.demoSpeed === 2 ? 2 : 1;

      for (let stepIdx = 0; stepIdx < simSteps; stepIdx++) {
        const cycle = (elapsed + stepIdx * dt) % 17;
        const nextLight: TrafficLightPhase =
          cycle < 8 ? 'green' : cycle < 10.5 ? 'amber' : 'red';
        trafficLightRef.current = nextLight;

        if (r.mode === 'demo' && !r.tutorialOpen) {
          stepDemoAutopilot(demoStateRef.current, tel, inp, nextLight, dt);
        } else if (stepIdx === 0) {
          const accelKey = keys.has('KeyW') || keys.has('ArrowUp');
          const brakeKey = keys.has('KeyS') || keys.has('ArrowDown');
          const clutchKey = keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyC');
          const leftKey = keys.has('KeyA') || keys.has('ArrowLeft');
          const rightKey = keys.has('KeyD') || keys.has('ArrowRight');

          if (accelKey) {
            inp.throttle = Math.min(1, inp.throttle + dt * 3.8);
          } else if (inp.throttle > 0 && !keys.has('PointerThrottle')) {
            inp.throttle = Math.max(0, inp.throttle - dt * 5.0);
          }

          if (brakeKey) {
            inp.brake = Math.min(1, inp.brake + dt * 5.2);
          } else if (inp.brake > 0 && !keys.has('PointerBrake')) {
            inp.brake = Math.max(0, inp.brake - dt * 6.5);
          }

          if (autoClutchDipRef.current > 0) {
            autoClutchDipRef.current = Math.max(0, autoClutchDipRef.current - dt);
            inp.clutch = Math.max(inp.clutch, 0.88);
          } else if (r.clutchLocked) {
            inp.clutch = 1.0;
          } else if (clutchKey) {
            inp.clutch = Math.min(1, inp.clutch + dt * 14);
          } else if (inp.clutch > 0 && !keys.has('PointerClutch')) {
            inp.clutch = Math.max(0, inp.clutch - dt * 2.1);
          }

          if (leftKey && !rightKey) {
            inp.steeringWheelDeg = Math.max(-MAX_STEER_WHEEL_DEG, inp.steeringWheelDeg - dt * 420);
          } else if (rightKey && !leftKey) {
            inp.steeringWheelDeg = Math.min(MAX_STEER_WHEEL_DEG, inp.steeringWheelDeg + dt * 420);
          } else if (Math.abs(tel.speedMs) > 0.45 && Math.abs(inp.steeringWheelDeg) > 1) {
            const returnStep =
              Math.sign(inp.steeringWheelDeg) *
              Math.min(Math.abs(inp.steeringWheelDeg), dt * 165 * Math.min(1, Math.abs(tel.speedMs) / 4));
            inp.steeringWheelDeg -= returnStep;
          }
        }

        // 3. Step Vehicle Physics
        if (r.outcome === 'active' && !r.tutorialOpen) {
          r.runTime += dt;
        }

        stepVehiclePhysics(tel, inp, physicsCtxRef.current, dt, boundaries, conesRef.current, {
          onEngineStart: () => {
            inp.ignition = 1;
            audioRef.current?.playCheckpointChime();
          },
          onStall: () => {
            recordDeduction('Engine stalled (improper clutch/throttle control)', 5, r.stage);
          },
          onAutoCancelIndicator: () => {
            if (r.mode !== 'demo') inp.indicator = 0;
          },
          onLineTouch: (kind) => {
            if (r.runTime - r.lastLineTouchAt > 1.8) {
              r.lastLineTouchAt = r.runTime;
              recordDeduction(
                kind === 'garage'
                  ? 'Touched L-Back garage boundary line'
                  : 'Wheel touched yellow course boundary line',
                10,
                r.stage
              );
            }
          },
          onConeHit: () => {
            audioRef.current?.playConeBump();
            recordDeduction('Hit traffic cone', 15, r.stage);
          },
        });

      // 4. Update Engine & Indicator Audio
      audioRef.current?.updateEngine(
        tel.rpm,
        tel.engineRunning,
        inp.ignition === 2 && !tel.engineRunning,
        inp.throttle,
        inp.horn
      );

      if (inp.indicator !== 0 || inp.hazard) {
        r.lastIndicatorOnAt = r.runTime;
        const beepStep = Math.floor(elapsed * 2.4);
        if (beepStep !== r.lastIndicatorBeepStep) {
          r.lastIndicatorBeepStep = beepStep;
          audioRef.current?.playIndicatorTick(beepStep % 2 === 0);
        }
      }

      // 5. Evaluate DOTM Stage Progression & Rules
      if (r.mode !== 'free' && r.outcome === 'active' && !r.tutorialOpen) {
        // Seatbelt check once moving
        if (!r.checkedSeatbelt && tel.speedKmh > 1.5) {
          r.checkedSeatbelt = true;
          if (!inp.seatbelt) {
            recordDeduction('Started driving without fastening seatbelt', 5, r.stage);
          }
        }

        // Stage advancement
        const nextStage = getStageForPosition(tel.x, tel.z, r.stage);
        if (nextStage !== r.stage) {
          // Check exit rules for stage just completed
          if (r.stage === 'start' && nextStage === 'figure8' && !r.checkedFig8Signal) {
            r.checkedFig8Signal = true;
            if (r.runTime - r.lastIndicatorOnAt > 4.5) {
              recordDeduction('Entered Figure-8 without turn indicator', 10, 'figure8');
            }
          }
          if (r.stage === 'traffic' && nextStage === 'uturn' && !r.checkedTrafficTurnSignal) {
            r.checkedTrafficTurnSignal = true;
            if (r.runTime - r.lastIndicatorOnAt > 4.5) {
              recordDeduction('Turned South at intersection without Right indicator', 10, 'traffic');
            }
          }
          if (r.stage === 'ukalo' && nextStage === 'lback' && !r.ukaloCheckedMissedStop) {
            r.ukaloCheckedMissedStop = true;
            if (!r.ukaloStoppedOk) {
              recordDeduction('Failed to stop inside Ukalo yellow box', 15, 'ukalo');
            }
          }

          r.stage = nextStage;
          setStage(nextStage);
          audioRef.current?.playCheckpointChime();
        }

        // Traffic Light Red-Line Violation
        if (
          r.stage === 'traffic' &&
          !r.checkedTrafficRed &&
          tel.x > TRAFFIC_STOP_X + 0.45 &&
          tel.x < 13.5 &&
          tel.z < -13.5 &&
          trafficLightRef.current === 'red'
        ) {
          r.checkedTrafficRed = true;
          recordDeduction('Crossed stop line on Red traffic signal', 15, 'traffic');
        }

        // U-Turn Signal Check
        if (r.stage === 'uturn' && !r.checkedUturnSignal && tel.z > 12.0) {
          r.checkedUturnSignal = true;
          if (r.runTime - r.lastIndicatorOnAt > 4.5) {
            recordDeduction('Executed U-Turn without indicator signal', 10, 'uturn');
          }
        }

        // Ukalo Stop Box & Rollback Check
        if (r.stage === 'ukalo') {
          const inStopBox =
            tel.x >= UKALO_STOP_BOX.minX &&
            tel.x <= UKALO_STOP_BOX.maxX &&
            tel.z >= UKALO_STOP_BOX.minZ &&
            tel.z <= UKALO_STOP_BOX.maxZ;

          if (inStopBox && Math.abs(tel.speedMs) < 0.08) {
            r.ukaloStopHoldSec += dt;
            if (r.ukaloStopHoldSec >= 0.55 && !r.ukaloStoppedOk) {
              r.ukaloStoppedOk = true;
              setUkaloStoppedOk(true);
              audioRef.current?.playCheckpointChime();
            }
          } else {
            r.ukaloStopHoldSec = 0;
          }

          // Rollback tracking on uphill slope (x in [27.2, 32.8], z in [-4.0, 4.8])
          if (tel.x >= 27.2 && tel.x <= 32.8 && tel.z <= 4.8 && tel.z >= -4.0) {
            if (tel.z < r.ukaloMinZ) {
              r.ukaloMinZ = tel.z;
            }
            const rollback = tel.z - r.ukaloMinZ;
            tel.ukaloRollbackM = Math.max(0, rollback);
            if (rollback > 0.25 && !r.ukaloRollbackPenalized) {
              r.ukaloRollbackPenalized = true;
              recordDeduction('Vehicle rolled backward on Ukalo slope (> 25cm)', 15, 'ukalo');
            }
          }
        }

        // L-Back Garage Completion Check
        if (r.stage === 'lback') {
          const inGarage =
            tel.x >= LBACK_BOX.minX + 0.35 &&
            tel.x <= LBACK_BOX.maxX - 0.35 &&
            tel.z >= LBACK_BOX.minZ + 1.0 &&
            tel.z <= LBACK_BOX.maxZ - 1.0;

          if (inGarage && Math.abs(tel.speedMs) < 0.08 && inp.handbrake > 0.5) {
            r.stage = 'finished';
            const passed = r.score >= 70;
            r.outcome = passed ? 'passed' : 'failed';
            setStage('finished');
            setTrialOutcome(r.outcome);
            if (!passed) {
              setFailReason(`Score ${r.score}/100 is below the 70-point DOTM pass threshold.`);
            }
            audioRef.current?.playCheckpointChime();
          }
        }
      }

      // Close loop for simSteps (Traffic light & physics updated per step)
      }

      // 6. Throttled React UI Sync (~20Hz)
      r.uiSyncAccum += dt;
      if (r.uiSyncAccum >= 0.05) {
        r.uiSyncAccum = 0;
        setInputsUi({ ...inp });
        setTelemetryUi({ ...tel });
        setMapViewUi({ ...mapViewRef.current });
        setElapsedSec(r.runTime);
        setTrafficLightUi(trafficLightRef.current);
        if (r.mode === 'demo') {
          setDemoCaption(demoStateRef.current.caption);
        }
      }
    },
    [boundaries, recordDeduction]
  );

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-[#0d1015]">
      <TrialHeader
        mode={mode}
        strictness={strictness}
        cameraMode={cameraMode}
        muted={muted}
        stage={stage}
        score={score}
        elapsedSec={elapsedSec}
        onChangeMode={(m) => {
          setMode(m);
          if (m === 'practice') {
            resetToSpawn('figure8', true);
          } else {
            resetToSpawn('start', false);
          }
        }}
        onChangeStrictness={(s) => setStrictness(s)}
        onCycleCamera={handleCycleCamera}
        onToggleMute={handleToggleMute}
        onReset={() => resetToSpawn('start', false)}
        onOpenTutorial={() => {
          setDockCollapsed(false);
          setTutorialOpen(true);
        }}
      />

      <div className="flex-1 flex flex-col lg:flex-row min-h-0 relative">
        {/* Left/Primary Pane: Unobstructed 3D Map & Vehicle */}
        <main className="relative flex-1 min-w-0 min-h-[240px]">
          <TrialCanvas
            telemetryRef={telemetryRef}
            inputsRef={inputsRef}
            conesRef={conesRef}
            trafficLightRef={trafficLightRef}
            cameraModeRef={cameraModeRef}
            mapViewRef={mapViewRef}
            boundaries={boundaries}
            onStepFrame={handleStepFrame}
          />

          <TrialStageOverlay
            mode={mode}
            stage={stage}
            score={score}
            elapsedSec={elapsedSec}
            deductions={deductions}
            trafficLight={trafficLightUi}
            ukaloStoppedOk={ukaloStoppedOk}
            trialOutcome={trialOutcome}
            failReason={failReason}
            inputs={inputsUi}
            telemetry={telemetryUi}
            onReset={() => resetToSpawn('start', false)}
            onJumpToStage={(s) => resetToSpawn(s, true)}
            tutorialOpen={tutorialOpen}
            demoCaption={demoCaption}
            demoSpeed={demoSpeed}
            onToggleDemoSpeed={() => setDemoSpeed((s) => (s === 1 ? 2 : 1))}
            onExitDemo={() => {
              setMode('full');
              resetToSpawn('start', false);
            }}
          />

          {tutorialOpen && (
            <TutorialOverlay
              inputs={inputsUi}
              telemetry={telemetryUi}
              onHighlightChange={setTutorialHighlight}
              onStartTrial={() => {
                try {
                  window.localStorage.setItem('nepal_trial_tutorial_seen', '1');
                } catch {
                  // ignore storage errors
                }
                setTutorialHighlight(null);
                setTutorialOpen(false);
                setMode('full');
                resetToSpawn('start', false);
              }}
              onWatchDemo={() => {
                try {
                  window.localStorage.setItem('nepal_trial_tutorial_seen', '1');
                } catch {
                  // ignore storage errors
                }
                setTutorialHighlight(null);
                setTutorialOpen(false);
                setMode('demo');
                resetToSpawn('start', false);
              }}
              onSkip={() => {
                try {
                  window.localStorage.setItem('nepal_trial_tutorial_seen', '1');
                } catch {
                  // ignore storage errors
                }
                setTutorialHighlight(null);
                setTutorialOpen(false);
                resetToSpawn('start', false);
              }}
            />
          )}
        </main>

        {/* Right/Side Pane: Live Overhead Map + Full Vehicle Controller */}
        <CockpitControls
          inputs={inputsUi}
          telemetry={telemetryUi}
          stage={stage}
          trafficLight={trafficLightUi}
          boundaries={boundaries}
          collapsed={dockCollapsed && !tutorialOpen}
          onToggleCollapsed={() => setDockCollapsed((c) => !c)}
          onSteerChange={(deg) => {
            ensureAudio();
            inputsRef.current.steeringWheelDeg = deg;
            setInputsUi({ ...inputsRef.current });
          }}
          onPedalChange={(pedal, val) => {
            ensureAudio();
            const keyToken =
              pedal === 'clutch' ? 'PointerClutch' : pedal === 'brake' ? 'PointerBrake' : 'PointerThrottle';
            if (val > 0) {
              keysDownRef.current.add(keyToken);
              if (pedal === 'clutch' && clutchLocked) {
                setClutchLocked(false);
              }
            } else {
              keysDownRef.current.delete(keyToken);
            }
            inputsRef.current[pedal] = val;
            setInputsUi({ ...inputsRef.current });
          }}
          onShiftGear={(gear, fromPointer) => handleShiftGear(gear, { fromPointer })}
          autoClutch={autoClutch}
          onToggleAutoClutch={() => setAutoClutch((v) => !v)}
          clutchLocked={clutchLocked}
          onToggleClutchLock={() => {
            ensureAudio();
            setClutchLocked((prev) => {
              const next = !prev;
              inputsRef.current.clutch = next ? 1 : 0;
              setInputsUi({ ...inputsRef.current });
              return next;
            });
          }}
          onToggleHandbrake={handleToggleHandbrake}
          onIgnitionPress={(active) => {
            ensureAudio();
            if (active) {
              inputsRef.current.ignition = 2;
            } else {
              inputsRef.current.ignition = telemetryRef.current.engineRunning ? 1 : 0;
            }
            setInputsUi({ ...inputsRef.current });
          }}
          onIgnitionOff={() => {
            ensureAudio();
            inputsRef.current.ignition = 0;
            telemetryRef.current.engineRunning = false;
            setInputsUi({ ...inputsRef.current });
          }}
          onToggleSeatbelt={() => {
            ensureAudio();
            inputsRef.current.seatbelt = !inputsRef.current.seatbelt;
            setInputsUi({ ...inputsRef.current });
          }}
          onSetIndicator={(dir) => {
            ensureAudio();
            inputsRef.current.indicator = dir;
            setInputsUi({ ...inputsRef.current });
          }}
          onToggleHazard={() => {
            ensureAudio();
            inputsRef.current.hazard = !inputsRef.current.hazard;
            setInputsUi({ ...inputsRef.current });
          }}
          onToggleHeadlights={() => {
            ensureAudio();
            inputsRef.current.headlights = !inputsRef.current.headlights;
            setInputsUi({ ...inputsRef.current });
          }}
          onHornChange={(pressed) => {
            ensureAudio();
            inputsRef.current.horn = pressed;
            setInputsUi({ ...inputsRef.current });
          }}
          gearGrindWarning={gearGrindWarning}
          tutorialHighlight={tutorialHighlight}
          mapView={mapViewUi}
          onRotateMap={handleRotateMap}
          onTiltMap={handleTiltMap}
          onZoomMap={handleZoomMap}
          onToggleFollowCar={handleToggleFollowCar}
          onResetMapView={handleResetMapView}
          onInspectMapPoint={handleInspectMapPoint}
        />
      </div>
    </div>
  );
}
