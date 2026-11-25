import React, { useMemo } from 'react';
import {
  Compass,
  Crosshair,
  Move,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  LBACK_BOX,
  LineSegment2D,
  TRAFFIC_LIGHT_POS,
  UKALO_STOP_BOX,
} from '../sim/courseData';
import {
  MapViewState,
  StageId,
  TrafficLightPhase,
  VehicleInputs,
  VehicleTelemetry,
} from '../types/trial';

interface CourseMiniMapProps {
  boundaries: LineSegment2D[];
  telemetry: VehicleTelemetry;
  inputs: VehicleInputs;
  stage: StageId;
  trafficLight: TrafficLightPhase;
  mapView: MapViewState;
  onRotateMap: (deltaRad: number) => void;
  onTiltMap: (deltaRad: number) => void;
  onZoomMap: (deltaMeters: number) => void;
  onToggleFollowCar: () => void;
  onResetMapView: () => void;
  onInspectMapPoint: (worldX: number, worldZ: number) => void;
}

const VIEW_X = -42;
const VIEW_Y = -33;
const VIEW_W = 79;
const VIEW_H = 62;

export const CourseMiniMap: React.FC<CourseMiniMapProps> = ({
  boundaries,
  telemetry,
  inputs,
  stage,
  trafficLight,
  mapView,
  onRotateMap,
  onTiltMap,
  onZoomMap,
  onToggleFollowCar,
  onResetMapView,
  onInspectMapPoint,
}) => {
  const { boundaryLines, garageLines } = useMemo(() => {
    const b: LineSegment2D[] = [];
    const g: LineSegment2D[] = [];
    for (const seg of boundaries) {
      if (seg.kind === 'garage') g.push(seg);
      else b.push(seg);
    }
    return { boundaryLines: b, garageLines: g };
  }, [boundaries]);

  // Vehicle forward in world is (sin(yaw), cos(yaw)); SVG car points Up (0, -1), so rotate by (PI - yaw)
  const carDeg = ((Math.PI - telemetry.yaw) * 180) / Math.PI;
  const frontWheelDeg = (-telemetry.frontSteerRad * 180) / Math.PI;

  const compassCardinal = (() => {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const idx = Math.round(mapView.compassDeg / 45) % 8;
    return dirs[idx];
  })();
  const isViewModified = !mapView.followCar || Math.abs(mapView.yawOffsetRad) > 0.05;

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = Math.min(rect.width / VIEW_W, rect.height / VIEW_H);
    const renderedW = VIEW_W * scale;
    const renderedH = VIEW_H * scale;
    const offsetX = (rect.width - renderedW) / 2;
    const offsetY = (rect.height - renderedH) / 2;
    const worldX = VIEW_X + (e.clientX - rect.left - offsetX) / scale;
    const worldZ = VIEW_Y + (e.clientY - rect.top - offsetY) / scale;
    onInspectMapPoint(
      Math.max(-44, Math.min(38, worldX)),
      Math.max(-34, Math.min(30, worldZ))
    );
  };

  const lightColor =
    trafficLight === 'green' ? '#10b981' : trafficLight === 'amber' ? '#f59e0b' : '#ef4444';

  const stageMarkers: Array<{ id: StageId; label: string; x: number; z: number }> = [
    { id: 'figure8', label: '8', x: -28, z: -2 },
    { id: 'speedbreakers', label: 'SB', x: -8, z: -21.5 },
    { id: 'traffic', label: 'TL', x: 10, z: -21.5 },
    { id: 'uturn', label: 'U', x: 24, z: 18 },
    { id: 'ukalo', label: 'UK', x: 30, z: -7 },
    { id: 'lback', label: 'LB', x: 8, z: -28 },
  ];

  return (
    <div className="bg-[#0b0e13] border border-white/12 rounded-lg overflow-hidden">
      {/* Overhead Course Map SVG */}
      <div className="relative w-full h-[142px] bg-[#0a0d12]">
        <svg
          viewBox={`${VIEW_X} ${VIEW_Y} ${VIEW_W} ${VIEW_H}`}
          onClick={handleSvgClick}
          className="w-full h-full cursor-crosshair select-none"
          role="img"
          aria-label="Overhead map of the Nepal driving trial course and live vehicle location"
        >
          {/* Ukalo uphill zone */}
          <rect
            x={27.4}
            y={-19}
            width={5.2}
            height={24}
            fill="#1f2937"
            opacity={0.7}
          />
          {/* Ukalo yellow stop box */}
          <rect
            x={UKALO_STOP_BOX.minX}
            y={UKALO_STOP_BOX.minZ}
            width={UKALO_STOP_BOX.maxX - UKALO_STOP_BOX.minX}
            height={UKALO_STOP_BOX.maxZ - UKALO_STOP_BOX.minZ}
            fill="#f59e0b"
            fillOpacity={0.28}
            stroke="#fbbf24"
            strokeWidth={0.35}
          />

          {/* L-Back target garage */}
          <rect
            x={LBACK_BOX.minX}
            y={LBACK_BOX.minZ}
            width={LBACK_BOX.maxX - LBACK_BOX.minX}
            height={LBACK_BOX.maxZ - LBACK_BOX.minZ}
            fill="#10b981"
            fillOpacity={0.18}
          />

          {/* Track yellow boundary lines */}
          {boundaryLines.map((seg, idx) => (
            <line
              key={idx}
              x1={seg.x1}
              y1={seg.z1}
              x2={seg.x2}
              y2={seg.z2}
              stroke="#eab308"
              strokeWidth={0.48}
              strokeLinecap="round"
            />
          ))}

          {/* Garage lines */}
          {garageLines.map((seg, idx) => (
            <line
              key={idx}
              x1={seg.x1}
              y1={seg.z1}
              x2={seg.x2}
              y2={seg.z2}
              stroke="#38bdf8"
              strokeWidth={0.55}
              strokeLinecap="round"
            />
          ))}

          {/* Traffic light status dot */}
          <circle
            cx={TRAFFIC_LIGHT_POS.x}
            cy={TRAFFIC_LIGHT_POS.z}
            r={1.1}
            fill={lightColor}
            stroke="#0f172a"
            strokeWidth={0.35}
          />

          {/* Stage Markers */}
          {stageMarkers.map((m) => (
            <text
              key={m.id}
              x={m.x}
              y={m.z}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={2.6}
              fontWeight={700}
              fill={stage === m.id ? '#fbbf24' : '#64748b'}
            >
              {m.label}
            </text>
          ))}

          {/* Free-Map Camera Target Crosshair */}
          {!mapView.followCar && (
            <g transform={`translate(${mapView.panX} ${mapView.panZ})`}>
              <circle r={1.8} fill="none" stroke="#38bdf8" strokeWidth={0.4} />
              <line x1={-2.5} y1={0} x2={2.5} y2={0} stroke="#38bdf8" strokeWidth={0.35} />
              <line x1={0} y1={-2.5} x2={0} y2={2.5} stroke="#38bdf8" strokeWidth={0.35} />
            </g>
          )}

          {/* Live Vehicle Silhouette */}
          <g transform={`translate(${telemetry.x} ${telemetry.z}) rotate(${carDeg})`}>
            {/* Subtle sightline cone */}
            <polygon
              points="-0.9,-1.8 -2.1,-5.4 2.1,-5.4 0.9,-1.8"
              fill={inputs.headlights ? '#fde047' : '#38bdf8'}
              fillOpacity={inputs.headlights ? 0.28 : 0.16}
            />
            {/* Front wheels showing steer angle */}
            <rect
              x={-1.05}
              y={-1.45}
              width={0.35}
              height={0.75}
              rx={0.1}
              fill="#94a3b8"
              transform={`rotate(${frontWheelDeg} -0.87 -1.07)`}
            />
            <rect
              x={0.7}
              y={-1.45}
              width={0.35}
              height={0.75}
              rx={0.1}
              fill="#94a3b8"
              transform={`rotate(${frontWheelDeg} 0.87 -1.07)`}
            />
            {/* Car Body */}
            <rect
              x={-0.9}
              y={-1.8}
              width={1.8}
              height={3.6}
              rx={0.45}
              fill="#f8fafc"
              stroke="#0284c7"
              strokeWidth={0.35}
            />
            {/* Windshield */}
            <rect x={-0.65} y={-0.95} width={1.3} height={0.85} rx={0.2} fill="#0f172a" />
            {/* Brake tail bar */}
            {(inputs.brake > 0.08 || inputs.handbrake > 0.2) && (
              <rect x={-0.75} y={1.55} width={1.5} height={0.3} rx={0.1} fill="#ef4444" />
            )}
          </g>
        </svg>

        <div className="pointer-events-none absolute top-1.5 left-2 text-[10px] font-medium text-slate-400">
          Trial Map (Click to inspect 3D area)
        </div>
        <div className="pointer-events-none absolute top-1.5 right-2 text-[10px] font-mono-tabular text-slate-400">
          N ▲
        </div>
      </div>

      {/* Compact 3D View Direction Strip */}
      <div className="flex flex-wrap items-center justify-between gap-1 px-2 py-1.5 bg-[#12161d] border-t border-white/10 text-[11px] text-slate-300">
        <button
          type="button"
          onClick={onResetMapView}
          title="Compass heading — click to reset 3D map direction"
          className="flex items-center gap-1 pr-1.5 border-r border-white/10 hover:text-amber-400 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Compass
            className="w-3.5 h-3.5 text-amber-400 shrink-0"
            style={{ transform: `rotate(${-mapView.compassDeg}deg)` }}
          />
          <span className="font-mono-tabular font-semibold">
            {compassCardinal} {Math.round(mapView.compassDeg)}°
          </span>
        </button>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onRotateMap(Math.PI / 8)}
            title="Rotate 3D map counter-clockwise"
            className="p-1 rounded hover:bg-[#1f2734] text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onRotateMap(-Math.PI / 8)}
            title="Rotate 3D map clockwise"
            className="p-1 rounded hover:bg-[#1f2734] text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onTiltMap(0.16)}
            title="Tilt 3D view higher"
            className="px-1.5 py-0.5 rounded hover:bg-[#1f2734] font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={() => onTiltMap(-0.16)}
            title="Tilt 3D view lower"
            className="px-1.5 py-0.5 rounded hover:bg-[#1f2734] font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            ▼
          </button>
          <button
            type="button"
            onClick={() => onZoomMap(-2.5)}
            title="Zoom in"
            className="p-1 rounded hover:bg-[#1f2734] text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onZoomMap(2.5)}
            title="Zoom out"
            className="p-1 rounded hover:bg-[#1f2734] text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleFollowCar}
            title={mapView.followCar ? 'Switch to Free 3D Map Explore' : 'Lock camera back onto car'}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
              mapView.followCar
                ? 'bg-[#1a2029] text-slate-200 hover:bg-[#232b37]'
                : 'bg-amber-500 text-slate-950 font-semibold'
            }`}
          >
            {mapView.followCar ? <Move className="w-3 h-3" /> : <Crosshair className="w-3 h-3" />}
            <span>{mapView.followCar ? 'Free Map' : 'Follow Car'}</span>
          </button>
          {isViewModified && (
            <button
              type="button"
              onClick={onResetMapView}
              className="px-1.5 py-0.5 rounded text-[11px] font-medium text-amber-400 hover:bg-[#1f2734] transition-colors cursor-pointer whitespace-nowrap"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
