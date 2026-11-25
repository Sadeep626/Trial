import React, { useRef } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  KeyRound,
  Lightbulb,
  ShieldCheck,
  Volume2,
} from 'lucide-react';
import {
  GearPosition,
  MapViewState,
  StageId,
  TrafficLightPhase,
  VehicleInputs,
  VehicleTelemetry,
} from '../types/trial';
import { LineSegment2D } from '../sim/courseData';
import { MAX_STEER_WHEEL_DEG } from '../sim/vehiclePhysics';
import { CourseMiniMap } from './CourseMiniMap';
import { TutorialHighlight } from './TutorialOverlay';

interface CockpitControlsProps {
  inputs: VehicleInputs;
  telemetry: VehicleTelemetry;
  stage: StageId;
  trafficLight: TrafficLightPhase;
  boundaries: LineSegment2D[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onSteerChange: (deg: number) => void;
  onPedalChange: (pedal: 'clutch' | 'brake' | 'throttle', value: number) => void;
  onShiftGear: (gear: GearPosition, fromPointer?: boolean) => void;
  autoClutch: boolean;
  onToggleAutoClutch: () => void;
  clutchLocked: boolean;
  onToggleClutchLock: () => void;
  onToggleHandbrake: () => void;
  onIgnitionPress: (active: boolean) => void;
  onIgnitionOff: () => void;
  onToggleSeatbelt: () => void;
  onSetIndicator: (dir: -1 | 0 | 1) => void;
  onToggleHazard: () => void;
  onToggleHeadlights: () => void;
  onHornChange: (pressed: boolean) => void;
  gearGrindWarning: boolean;
  tutorialHighlight?: TutorialHighlight;
  mapView: MapViewState;
  onRotateMap: (deltaRad: number) => void;
  onTiltMap: (deltaRad: number) => void;
  onZoomMap: (deltaMeters: number) => void;
  onToggleFollowCar: () => void;
  onResetMapView: () => void;
  onInspectMapPoint: (worldX: number, worldZ: number) => void;
}

export const CockpitControls: React.FC<CockpitControlsProps> = ({
  inputs,
  telemetry,
  stage,
  trafficLight,
  boundaries,
  collapsed,
  onToggleCollapsed,
  onSteerChange,
  onPedalChange,
  onShiftGear,
  autoClutch,
  onToggleAutoClutch,
  clutchLocked,
  onToggleClutchLock,
  onToggleHandbrake,
  onIgnitionPress,
  onIgnitionOff,
  onToggleSeatbelt,
  onSetIndicator,
  onToggleHazard,
  onToggleHeadlights,
  onHornChange,
  gearGrindWarning,
  tutorialHighlight = null,
  mapView,
  onRotateMap,
  onTiltMap,
  onZoomMap,
  onToggleFollowCar,
  onResetMapView,
  onInspectMapPoint,
}) => {
  const steerDragRef = useRef<{ startX: number; startDeg: number } | null>(null);

  const handleWheelPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    steerDragRef.current = { startX: e.clientX, startDeg: inputs.steeringWheelDeg };
  };

  const handleWheelPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!steerDragRef.current) return;
    const dx = e.clientX - steerDragRef.current.startX;
    const next = Math.max(
      -MAX_STEER_WHEEL_DEG,
      Math.min(MAX_STEER_WHEEL_DEG, steerDragRef.current.startDeg + dx * 3.2)
    );
    onSteerChange(next);
  };

  const handleWheelPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (steerDragRef.current) {
      steerDragRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  };

  const handlePedalPointer = (
    pedal: 'clutch' | 'brake' | 'throttle',
    e: React.PointerEvent<HTMLButtonElement>
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = Math.max(0.25, Math.min(1, (e.clientY - rect.top) / rect.height));
    onPedalChange(pedal, relY);
  };

  const rpmRatio = Math.min(1, telemetry.rpm / 7000);
  const rpmAngle = -125 + rpmRatio * 250;
  const speedRatio = Math.min(1, telemetry.speedKmh / 60);
  const speedAngle = -125 + speedRatio * 250;

  const frontWheelDeg = Math.round((telemetry.frontSteerRad * 180) / Math.PI);
  const wheelTurns = (inputs.steeringWheelDeg / 360).toFixed(1);

  if (collapsed) {
    return (
      <aside className="shrink-0 bg-[#11151c] border-t lg:border-t-0 lg:border-l border-white/12 flex items-center justify-center lg:w-11 h-10 lg:h-auto">
        <button
          type="button"
          onClick={onToggleCollapsed}
          title="Show Map & Vehicle Controller (Tab)"
          className="w-full h-full flex items-center justify-center gap-1.5 text-xs font-medium text-slate-200 hover:bg-[#1a2029] transition-colors cursor-pointer"
        >
          <span className="lg:hidden flex items-center gap-1.5">
            <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
            <span>Show Map & Controls (Tab)</span>
          </span>
          <span className="hidden lg:flex flex-col items-center gap-2 py-3">
            <ChevronLeft className="w-4 h-4 text-amber-400" />
            <span
              className="text-[11px] tracking-wide whitespace-nowrap"
              style={{ writingMode: 'vertical-rl' }}
            >
              Controls (Tab)
            </span>
          </span>
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-full lg:w-[412px] xl:w-[438px] shrink-0 max-h-[50vh] lg:max-h-none bg-[#11151c] border-t lg:border-t-0 lg:border-l border-white/12 flex flex-col min-h-0 z-20">
      {/* Dock Header */}
      <div className="shrink-0 flex items-center justify-between px-3.5 py-2 border-b border-white/10 bg-[#0f1319]">
        <span className="text-xs font-semibold text-slate-200 tracking-wide">
          Trial Map & Vehicle Controller
        </span>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-slate-300 hover:text-white hover:bg-[#1b222d] transition-colors cursor-pointer whitespace-nowrap"
        >
          <span className="lg:hidden">Hide</span>
          <ChevronDown className="w-3.5 h-3.5 lg:hidden" />
          <span className="hidden lg:inline">Hide (Tab)</span>
          <ChevronRight className="w-3.5 h-3.5 hidden lg:inline" />
        </button>
      </div>

      {/* Scroll-safe vertical stack fitting cleanly on standard desktop without scrolling */}
      <div className="flex-1 overflow-y-auto px-3 py-2.5 flex flex-col gap-2.5">
        {/* 1. LIVE OVERHEAD TRIAL MAP + 3D CAMERA DIRECTION */}
        <CourseMiniMap
          boundaries={boundaries}
          telemetry={telemetry}
          inputs={inputs}
          stage={stage}
          trafficLight={trafficLight}
          mapView={mapView}
          onRotateMap={onRotateMap}
          onTiltMap={onTiltMap}
          onZoomMap={onZoomMap}
          onToggleFollowCar={onToggleFollowCar}
          onResetMapView={onResetMapView}
          onInspectMapPoint={onInspectMapPoint}
        />

        {/* 2. STEERING WHEEL + TELEMETRY DIALS + SIGNALS */}
        <div className="bg-[#0b0e13]/70 border border-white/10 rounded-lg p-2.5 flex items-center justify-between gap-2.5">
          {/* Steering Wheel */}
          <div className="flex flex-col items-center shrink-0">
            <div
              onPointerDown={handleWheelPointerDown}
              onPointerMove={handleWheelPointerMove}
              onPointerUp={handleWheelPointerUp}
              onPointerCancel={handleWheelPointerUp}
              onDoubleClick={() => onSteerChange(0)}
              title="Drag left/right to steer (A/D or Arrow keys). Double-click to center."
              className="relative w-24 h-24 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
            >
              <svg
                viewBox="0 0 120 120"
                className="w-full h-full drop-shadow-md"
                style={{ transform: `rotate(${inputs.steeringWheelDeg}deg)` }}
              >
                <circle cx="60" cy="60" r="48" fill="none" stroke="#1e242d" strokeWidth="11" />
                <circle cx="60" cy="60" r="48" fill="none" stroke="#334155" strokeWidth="2" />
                <rect x="57" y="6.5" width="6" height="11" rx="1.5" fill="#f59e0b" />
                <path d="M 14 57 L 44 57 L 44 65 L 14 65 Z" fill="#2b3340" />
                <path d="M 76 57 L 106 57 L 106 65 L 76 65 Z" fill="#2b3340" />
                <path d="M 55 76 L 65 76 L 63 106 L 57 106 Z" fill="#2b3340" />
                <circle cx="60" cy="60" r="18" fill="#181c24" stroke="#475569" strokeWidth="1.5" />
                <circle cx="60" cy="60" r="5" fill="#475569" />
              </svg>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-300 font-mono-tabular">
              <span>{Math.round(inputs.steeringWheelDeg)}°</span>
              <span className="text-slate-600">·</span>
              <span>{wheelTurns}t</span>
              <button
                type="button"
                onClick={() => onSteerChange(0)}
                className="text-amber-400 hover:text-amber-300 underline underline-offset-2 cursor-pointer ml-0.5"
              >
                Center
              </button>
            </div>
            <div className="text-[10px] text-slate-500 font-mono-tabular">
              Tires: {frontWheelDeg > 0 ? `${frontWheelDeg}° L` : frontWheelDeg < 0 ? `${Math.abs(frontWheelDeg)}° R` : '0°'}
            </div>
          </div>

          {/* Right side of Cluster: Gauges + Signals */}
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            {/* Compact RPM, Gear & Speedometer Strip */}
            <div className="flex items-center justify-between gap-1 bg-[#11151c] border border-white/10 rounded-md px-2 py-1.5">
              {/* Tachometer */}
              <div className="flex flex-col items-center">
                <svg viewBox="0 0 100 84" className="w-16 h-12">
                  <path
                    d="M 16 70 A 40 40 0 1 1 84 70"
                    fill="none"
                    stroke="#262e3a"
                    strokeWidth="7"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 76 32 A 40 40 0 0 1 84 70"
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="7"
                    strokeLinecap="round"
                  />
                  <g transform={`translate(50 50) rotate(${rpmAngle})`}>
                    <line x1="0" y1="6" x2="0" y2="-33" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
                    <circle cx="0" cy="0" r="4.5" fill="#cbd5e1" />
                  </g>
                  <text x="50" y="73" textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="600">
                    RPM
                  </text>
                </svg>
                <span className="font-mono-tabular text-[11px] font-semibold text-slate-100 -mt-1">
                  {Math.round(telemetry.rpm)}
                </span>
              </div>

              {/* Active Gear + Telltales */}
              <div className="flex flex-col items-center gap-1">
                <div className="w-9 h-9 rounded-md bg-[#0a0d12] border border-white/15 flex items-center justify-center font-display text-lg font-bold text-amber-400">
                  {inputs.gear}
                </div>
                <div className="flex items-center gap-1 text-[9px] font-mono-tabular font-semibold">
                  <span
                    className={`px-1 py-0.5 rounded ${
                      inputs.seatbelt ? 'bg-emerald-950/80 text-emerald-400' : 'bg-red-950/80 text-red-400'
                    }`}
                  >
                    BELT
                  </span>
                  <span
                    className={`px-1 py-0.5 rounded ${
                      inputs.handbrake > 0.5 ? 'bg-red-950/80 text-red-400' : 'bg-slate-800/70 text-slate-500'
                    }`}
                  >
                    PARK
                  </span>
                </div>
              </div>

              {/* Speedometer */}
              <div className="flex flex-col items-center">
                <svg viewBox="0 0 100 84" className="w-16 h-12">
                  <path
                    d="M 16 70 A 40 40 0 1 1 84 70"
                    fill="none"
                    stroke="#262e3a"
                    strokeWidth="7"
                    strokeLinecap="round"
                  />
                  <g transform={`translate(50 50) rotate(${speedAngle})`}>
                    <line x1="0" y1="6" x2="0" y2="-33" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
                    <circle cx="0" cy="0" r="4.5" fill="#cbd5e1" />
                  </g>
                  <text x="50" y="73" textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="600">
                    KM/H
                  </text>
                </svg>
                <span className="font-mono-tabular text-[11px] font-semibold text-slate-100 -mt-1">
                  {telemetry.speedKmh.toFixed(1)}
                </span>
              </div>
            </div>

            {telemetry.stalled && (
              <div className="text-center text-[10px] font-semibold text-red-400">
                ENGINE STALLED — Hold Clutch/Neutral & Start (I)
              </div>
            )}

            {/* Signals, Hazard, Horn, Headlights */}
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => onSetIndicator(inputs.indicator === -1 ? 0 : -1)}
                title="Left Indicator (Z)"
                className={`py-1.5 px-1.5 rounded text-[11px] font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                  inputs.indicator === -1
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-[#1a2029] text-slate-300 border-white/10 hover:bg-[#232b37]'
                }`}
              >
                ◀ L (Z)
              </button>
              <button
                type="button"
                onClick={onToggleHazard}
                title="Hazard Lights (K)"
                className={`py-1.5 px-1.5 rounded text-[11px] font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                  inputs.hazard
                    ? 'bg-red-500 text-white border-red-400'
                    : 'bg-[#1a2029] text-slate-300 border-white/10 hover:bg-[#232b37]'
                }`}
              >
                ▲ Haz
              </button>
              <button
                type="button"
                onClick={() => onSetIndicator(inputs.indicator === 1 ? 0 : 1)}
                title="Right Indicator (X)"
                className={`py-1.5 px-1.5 rounded text-[11px] font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                  inputs.indicator === 1
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-[#1a2029] text-slate-300 border-white/10 hover:bg-[#232b37]'
                }`}
              >
                R (X) ▶
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onPointerDown={() => onHornChange(true)}
                onPointerUp={() => onHornChange(false)}
                onPointerLeave={() => onHornChange(false)}
                className={`flex items-center justify-center gap-1 py-1 px-2 rounded text-[11px] font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                  inputs.horn
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-[#1a2029] text-slate-200 border-white/10 hover:bg-[#232b37]'
                }`}
              >
                <Volume2 className="w-3 h-3" />
                <span>Horn (H)</span>
              </button>
              <button
                type="button"
                onClick={onToggleHeadlights}
                className={`flex items-center justify-center gap-1 py-1 px-2 rounded text-[11px] font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                  inputs.headlights
                    ? 'bg-sky-500 text-slate-950 border-sky-400'
                    : 'bg-[#1a2029] text-slate-200 border-white/10 hover:bg-[#232b37]'
                }`}
              >
                <Lightbulb className="w-3 h-3" />
                <span>Beam (L)</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3. SEATBELT, IGNITION & CLUTCH BITE GAUGE */}
        <div className="bg-[#0b0e13]/70 border border-white/10 rounded-lg p-2.5 flex flex-col gap-2">
          <div
            className={`flex items-center gap-1.5 rounded-md transition-shadow ${
              tutorialHighlight === 'ignition' ? 'ring-2 ring-amber-400 p-1 -m-1 bg-amber-500/10' : ''
            }`}
          >
            <button
              type="button"
              onClick={onToggleSeatbelt}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                inputs.seatbelt
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-red-500/20 text-red-300 border-red-500/40'
              }`}
              title="Fasten/Unfasten Seatbelt (B)"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{inputs.seatbelt ? 'Belt On' : 'Belt Off (B)'}</span>
            </button>

            <button
              type="button"
              onPointerDown={() => onIgnitionPress(true)}
              onPointerUp={() => onIgnitionPress(false)}
              onPointerLeave={() => onIgnitionPress(false)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                telemetry.engineRunning
                  ? 'bg-emerald-600/25 text-emerald-300 border-emerald-500/40'
                  : inputs.ignition === 2
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-[#1c232e] text-amber-300 border-amber-500/40 hover:bg-[#242d3b]'
              }`}
              title="Hold to crank starter (I)"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>
                {telemetry.engineRunning
                  ? 'Engine Running'
                  : inputs.ignition === 2
                  ? 'Cranking...'
                  : 'Hold Start (I)'}
              </span>
            </button>

            {telemetry.engineRunning && (
              <button
                type="button"
                onClick={onIgnitionOff}
                className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-[#1a2029] text-slate-300 border border-white/10 hover:bg-red-950/60 hover:text-red-300 transition-colors cursor-pointer"
                title="Turn Ignition Off"
              >
                Off
              </button>
            )}
          </div>

          {/* Clutch Bite Bar */}
          <div
            className={`flex items-center gap-2 text-[11px] rounded-md transition-shadow ${
              tutorialHighlight === 'clutch-gear' ? 'ring-2 ring-amber-400 p-1 -m-1 bg-amber-500/10' : ''
            }`}
          >
            <span className="text-slate-400 whitespace-nowrap">Clutch Bite</span>
            <div className="relative flex-1 h-2 bg-[#0a0d12] rounded overflow-hidden border border-white/10">
              <div
                className="absolute top-0 bottom-0 bg-amber-500/30 border-x border-amber-400/50"
                style={{ left: '28%', width: '44%' }}
              />
              <div
                className={`absolute top-0 bottom-0 w-1.5 ${
                  telemetry.inBiteZone ? 'bg-amber-400' : 'bg-sky-400'
                }`}
                style={{ left: `calc(${Math.round(inputs.clutch * 100)}% - 3px)` }}
              />
            </div>
            <span className="font-mono-tabular text-slate-300 w-12 text-right">
              {telemetry.inBiteZone ? 'BITE' : `${Math.round(inputs.clutch * 100)}%`}
            </span>
          </div>
        </div>

        {/* 4. H-PATTERN GEARBOX, HANDBRAKE & 3 ANALOG PEDALS */}
        <div className="bg-[#0b0e13]/70 border border-white/10 rounded-lg p-2.5 flex items-end justify-between gap-2.5">
          {/* H-Pattern Gear Shifter */}
          <div
            className={`relative flex flex-col items-center gap-1 rounded-lg transition-shadow ${
              tutorialHighlight === 'clutch-gear' ? 'ring-2 ring-amber-400 p-1 -m-1 bg-amber-500/10' : ''
            }`}
          >
            {gearGrindWarning && (
              <div className="absolute -top-9 left-0 z-30 bg-red-600 text-white text-[11px] font-semibold px-2.5 py-1 rounded shadow-lg whitespace-nowrap">
                Hold Shift / C (Clutch) to shift!
              </div>
            )}
            <div className="flex items-center justify-between w-full text-[11px] text-slate-400 gap-1">
              <span>Gearbox</span>
              <button
                type="button"
                onClick={onToggleAutoClutch}
                title="When ON, pressing 1/2/N/R shifts without holding Shift/C"
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                  autoClutch
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-[#181e27] text-slate-400 border-white/10 hover:text-slate-200'
                }`}
              >
                {autoClutch ? 'Auto-Clutch' : 'Manual'}
              </button>
            </div>
            <div className="relative bg-[#0b0e13] border border-white/15 rounded-lg p-1.5 w-[108px] h-[94px] grid grid-cols-2 grid-rows-3 gap-1">
              {(['1', 'N', '2', 'R'] as const).map((g) => {
                const posClass =
                  g === '1'
                    ? 'col-start-1 row-start-1'
                    : g === 'N'
                    ? 'col-start-2 row-start-2'
                    : g === '2'
                    ? 'col-start-1 row-start-3'
                    : 'col-start-2 row-start-3';
                const active = inputs.gear === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => onShiftGear(g, true)}
                    className={`${posClass} rounded text-xs font-display font-bold border transition-colors cursor-pointer ${
                      active
                        ? g === 'R'
                          ? 'bg-red-500 text-white border-red-400'
                          : 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-[#181e27] text-slate-300 border-white/10 hover:bg-[#232b37]'
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
              <span className="col-start-1 row-start-2 flex items-center justify-center text-[10px] text-slate-600 font-mono-tabular">
                |
              </span>
              <span className="col-start-2 row-start-1 flex items-center justify-center text-[9px] text-slate-500 font-mono-tabular">
                1/2/N/R
              </span>
            </div>
          </div>

          {/* Mechanical Handbrake Lever */}
          <div
            className={`flex flex-col items-center gap-1 rounded-lg transition-shadow ${
              tutorialHighlight === 'handbrake' ? 'ring-2 ring-amber-400 p-1 -m-1 bg-amber-500/10' : ''
            }`}
          >
            <span className="text-[11px] text-slate-400">Handbrake</span>
            <button
              type="button"
              onClick={onToggleHandbrake}
              title="Toggle Handbrake (Space)"
              className={`w-14 h-[94px] rounded-lg border flex flex-col items-center justify-between py-2 px-1 transition-colors cursor-pointer ${
                inputs.handbrake > 0.5
                  ? 'bg-red-950/60 border-red-500/60 text-red-200'
                  : 'bg-[#171d26] border-white/10 text-slate-300 hover:bg-[#1f2632]'
              }`}
            >
              <div
                className={`w-7 h-3 rounded-sm transition-transform ${
                  inputs.handbrake > 0.5 ? 'bg-red-500 -translate-y-0.5' : 'bg-slate-500 translate-y-6'
                }`}
              />
              <div className="text-center leading-tight">
                <div className="text-[10px] font-bold">{inputs.handbrake > 0.5 ? 'PULLED' : 'OFF'}</div>
                <div className="text-[9px] text-slate-400">Space</div>
              </div>
            </button>
          </div>

          {/* 3 Analog Pedals */}
          <div className="flex items-end gap-1.5">
            {(
              [
                { key: 'clutch', label: 'Clutch', hotkey: 'Shift', color: 'bg-sky-500' },
                { key: 'brake', label: 'Brake', hotkey: 'S / ↓', color: 'bg-red-500' },
                { key: 'throttle', label: 'Gas', hotkey: 'W / ↑', color: 'bg-emerald-500' },
              ] as const
            ).map((p) => {
              const val = inputs[p.key];
              return (
                <div key={p.key} className="flex flex-col items-center gap-1">
                  {p.key === 'clutch' ? (
                    <button
                      type="button"
                      onClick={onToggleClutchLock}
                      title="Latch Clutch pedal down for mouse/touch shifting"
                      className={`w-12 py-0.5 rounded text-[10px] font-semibold border transition-colors cursor-pointer ${
                        clutchLocked
                          ? 'bg-sky-500 text-slate-950 border-sky-400'
                          : 'bg-[#181e27] text-slate-400 border-white/10 hover:text-slate-200'
                      }`}
                    >
                      {clutchLocked ? 'Held' : 'Hold'}
                    </button>
                  ) : (
                    <span className="h-[19px]" />
                  )}
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      handlePedalPointer(p.key, e);
                    }}
                    onPointerMove={(e) => {
                      if (e.buttons > 0) handlePedalPointer(p.key, e);
                    }}
                    onPointerUp={(e) => {
                      onPedalChange(p.key, 0);
                      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                        e.currentTarget.releasePointerCapture(e.pointerId);
                      }
                    }}
                    onPointerCancel={() => onPedalChange(p.key, 0)}
                    className={`relative w-12 h-[94px] rounded-lg bg-[#0b0e13] border overflow-hidden flex flex-col justify-between p-1.5 cursor-pointer touch-none ${
                      tutorialHighlight === 'clutch-gear' && p.key === 'clutch'
                        ? 'border-amber-400 ring-2 ring-amber-400'
                        : 'border-white/15'
                    }`}
                  >
                    <div
                      className={`absolute bottom-0 left-0 right-0 ${p.color}/35 transition-all duration-75`}
                      style={{ height: `${Math.round(val * 100)}%` }}
                    />
                    <span className="relative z-10 text-[10px] font-semibold text-slate-200">{p.label}</span>
                    <span className="relative z-10 font-mono-tabular text-[10px] text-slate-300">
                      {Math.round(val * 100)}%
                    </span>
                    <span className="relative z-10 text-[9px] text-slate-500">{p.hotkey}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
};
