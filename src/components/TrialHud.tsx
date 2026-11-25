import React from 'react';
import {
  Award,
  BookOpen,
  Camera,
  FastForward,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  CameraMode,
  DeductionEntry,
  StageId,
  StrictnessMode,
  TrafficLightPhase,
  TrialMode,
  VehicleInputs,
  VehicleTelemetry,
} from '../types/trial';
import { STAGES } from '../sim/courseData';

interface TrialHudProps {
  mode: TrialMode;
  strictness: StrictnessMode;
  cameraMode: CameraMode;
  muted: boolean;
  stage: StageId;
  score: number;
  elapsedSec: number;
  deductions: DeductionEntry[];
  trafficLight: TrafficLightPhase;
  ukaloStoppedOk: boolean;
  trialOutcome: 'active' | 'passed' | 'failed';
  failReason: string | null;
  inputs: VehicleInputs;
  telemetry: VehicleTelemetry;
  onChangeMode: (m: TrialMode) => void;
  onChangeStrictness: (s: StrictnessMode) => void;
  onCycleCamera: () => void;
  onToggleMute: () => void;
  onReset: () => void;
  onJumpToStage: (stageId: StageId) => void;
  tutorialOpen: boolean;
  onOpenTutorial: () => void;
  demoCaption: string;
  demoSpeed: 1 | 2;
  onToggleDemoSpeed: () => void;
  onExitDemo: () => void;
}

export const TrialHeader: React.FC<
  Pick<
    TrialHudProps,
    | 'mode'
    | 'strictness'
    | 'cameraMode'
    | 'muted'
    | 'stage'
    | 'score'
    | 'elapsedSec'
    | 'onChangeMode'
    | 'onChangeStrictness'
    | 'onCycleCamera'
    | 'onToggleMute'
    | 'onReset'
    | 'onOpenTutorial'
  >
> = ({
  mode,
  strictness,
  cameraMode,
  muted,
  stage,
  score,
  elapsedSec,
  onChangeMode,
  onChangeStrictness,
  onCycleCamera,
  onToggleMute,
  onReset,
  onOpenTutorial,
}) => {
  const stageDef = STAGES.find((s) => s.id === stage) ?? STAGES[0];
  const mins = Math.floor(elapsedSec / 60);
  const secs = Math.floor(elapsedSec % 60);
  const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <header className="relative shrink-0 z-20 flex items-center justify-between gap-6 px-5 py-2 bg-[#0f1319] border-b border-white/10">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-4 shrink-0">
          <span className="font-display text-base font-bold tracking-tight text-slate-100 whitespace-nowrap">
            Nepal Trial Ground
          </span>
          <div className="hidden sm:flex items-center gap-1 p-0.5 bg-[#181e27] rounded-md border border-white/10">
            {(
              [
                { id: 'full', label: 'Full Trial' },
                { id: 'practice', label: 'Practice' },
                { id: 'demo', label: 'Demo' },
                { id: 'free', label: 'Free Drive' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onChangeMode(m.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                  mode === m.id ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-300 hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Zone 2: Clean Unboxed Stage & Score Readout */}
        <div className="hidden md:flex items-center gap-3 text-xs text-slate-300 whitespace-nowrap">
          <span className="font-semibold text-white">{stageDef.name}</span>
          <span className="text-slate-500" aria-hidden="true">·</span>
          <span className="text-slate-400">{stageDef.nepaliName}</span>
          <span className="text-slate-500" aria-hidden="true">·</span>
          <span
            className={`font-mono-tabular font-semibold ${
              score >= 70 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {score} / 100 pts
          </span>
          <span className="text-slate-500" aria-hidden="true">·</span>
          <span className="font-mono-tabular text-slate-300">{timeFormatted}</span>
        </div>

        {/* Zone 3: Camera, Rules, Audio, Reset */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onChangeStrictness(strictness === 'dotm70' ? 'strict' : 'dotm70')}
            className="hidden sm:inline-flex px-2.5 py-1.5 text-xs font-medium rounded-md bg-[#181e27] text-slate-200 border border-white/10 hover:bg-[#222a36] transition-colors cursor-pointer whitespace-nowrap"
            title="Switch between Official 70-Mark DOTM Scoring and Strict Zero-Mistake Mode"
          >
            {strictness === 'dotm70' ? '70-Pt Rules' : 'Strict Mode'}
          </button>

          <button
            type="button"
            onClick={onCycleCamera}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#181e27] text-slate-100 border border-white/10 hover:bg-[#222a36] transition-colors cursor-pointer whitespace-nowrap"
            title="Switch Camera (V)"
          >
            <Camera className="w-3.5 h-3.5 text-amber-400" />
            <span className="capitalize">{cameraMode} (V)</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            className="p-1.5 rounded-md bg-[#181e27] text-slate-200 border border-white/10 hover:bg-[#222a36] transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          <button
            type="button"
            onClick={onOpenTutorial}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[#181e27] text-slate-200 border border-white/10 hover:bg-[#222a36] transition-colors cursor-pointer whitespace-nowrap"
            title="Open Interactive Controls & Rules Tutorial"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Tutorial</span>
          </button>

          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </header>
  );
};

export const TrialStageOverlay: React.FC<
  Pick<
    TrialHudProps,
    | 'mode'
    | 'stage'
    | 'score'
    | 'elapsedSec'
    | 'deductions'
    | 'trafficLight'
    | 'ukaloStoppedOk'
    | 'trialOutcome'
    | 'failReason'
    | 'inputs'
    | 'telemetry'
    | 'onReset'
    | 'onJumpToStage'
    | 'tutorialOpen'
    | 'demoCaption'
    | 'demoSpeed'
    | 'onToggleDemoSpeed'
    | 'onExitDemo'
  >
> = ({
  mode,
  stage,
  score,
  elapsedSec,
  deductions,
  trafficLight,
  ukaloStoppedOk,
  trialOutcome,
  failReason,
  inputs,
  telemetry,
  onReset,
  onJumpToStage,
  tutorialOpen,
  demoCaption,
  demoSpeed,
  onToggleDemoSpeed,
  onExitDemo,
}) => {
  const stageDef = STAGES.find((s) => s.id === stage) ?? STAGES[0];
  const mins = Math.floor(elapsedSec / 60);
  const secs = Math.floor(elapsedSec % 60);
  const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <>
      {/* TOP-LEFT COMPACT STAGE BRIEFING (Anchored inside 3D viewport) */}
      {!tutorialOpen && (
      <aside className="absolute top-3 left-3 z-10 w-[min(320px,88%)] bg-[#11151c]/90 border border-white/12 rounded-lg p-3 pointer-events-auto">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-amber-400">
            {mode === 'demo' ? 'Live Trial Demo' : `Stage ${stageDef.order + 1} of ${STAGES.length}`}
          </span>
          {stage === 'traffic' && (
            <span
              className={`text-xs font-mono-tabular font-bold ${
                trafficLight === 'green'
                  ? 'text-emerald-400'
                  : trafficLight === 'amber'
                  ? 'text-amber-400'
                  : 'text-red-400'
              }`}
            >
              Signal: {trafficLight.toUpperCase()}
            </span>
          )}
          {stage === 'ukalo' && (
            <span
              className={`text-xs font-semibold ${
                ukaloStoppedOk ? 'text-emerald-400' : 'text-amber-300'
              }`}
            >
              {ukaloStoppedOk ? 'Stop Box Verified' : 'Stop in Yellow Box'}
            </span>
          )}
        </div>

        <p className="text-xs text-slate-200 mt-1 leading-relaxed">
          {mode === 'demo' ? demoCaption : stageDef.instruction}
        </p>
        <p className="text-[11px] text-slate-400 mt-1.5">
          3D View: Drag to rotate · Scroll to zoom · Right-drag to pan
        </p>

        {mode === 'demo' && (
          <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onToggleDemoSpeed}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-[#181e27] text-slate-200 border border-white/10 hover:bg-[#222a36] transition-colors cursor-pointer whitespace-nowrap"
            >
              <FastForward className="w-3 h-3 text-amber-400" />
              <span>Speed: {demoSpeed}x</span>
            </button>
            <button
              type="button"
              onClick={onExitDemo}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Play className="w-3 h-3" />
              <span>Take Over / Start Trial</span>
            </button>
          </div>
        )}

        {/* Contextual Checklist for Pre-Start */}
        {stage === 'start' && !telemetry.engineRunning && (
          <div className="mt-2 pt-2 border-t border-white/10 grid grid-cols-2 gap-1 text-[11px] text-slate-300">
            <span>{inputs.seatbelt ? '✓' : '○'} Seatbelt (B)</span>
            <span>{inputs.clutch > 0.65 || inputs.gear === 'N' ? '✓' : '○'} Clutch / Neutral</span>
            <span>{telemetry.engineRunning ? '✓' : '○'} Hold Start (I)</span>
            <span>{inputs.handbrake < 0.2 ? '✓' : '○'} Release Brake</span>
          </div>
        )}

        {/* Practice Stage Selector */}
        {mode === 'practice' && (
          <div className="mt-2.5 pt-2 border-t border-white/10">
            <div className="text-[11px] text-slate-400 mb-1.5">Jump to Trial Stage</div>
            <div className="flex flex-wrap gap-1">
              {STAGES.filter((s) => s.id !== 'start').map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onJumpToStage(s.id)}
                  className={`px-2 py-1 text-[11px] rounded border transition-colors cursor-pointer ${
                    stage === s.id
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                      : 'bg-[#1a2029] text-slate-300 border-white/10 hover:bg-[#232b37]'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Latest Deduction Alert */}
        {deductions.length > 0 && (
          <div className="mt-2 pt-2 border-t border-white/10 text-[11px] text-red-300 flex items-center justify-between gap-2">
            <span className="truncate">{deductions[deductions.length - 1].reason}</span>
            <span className="font-mono-tabular font-semibold shrink-0">
              -{deductions[deductions.length - 1].points} pts
            </span>
          </div>
        )}
      </aside>
      )}

      {/* END OF TRIAL SCORECARD MODAL */}
      {trialOutcome !== 'active' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md bg-[#12161e] border border-white/15 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Award
                  className={`w-6 h-6 ${
                    trialOutcome === 'passed' ? 'text-emerald-400' : 'text-red-400'
                  }`}
                />
                <h2 className="font-display text-xl font-bold text-white">
                  {mode === 'demo'
                    ? 'Demo Run Complete'
                    : trialOutcome === 'passed'
                    ? 'DOTM Trial Passed'
                    : 'DOTM Trial Failed'}
                </h2>
              </div>
              <span
                className={`font-mono-tabular text-lg font-bold ${
                  trialOutcome === 'passed' ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {score} / 100
              </span>
            </div>

            <p className="text-sm text-slate-300 mt-2">
              {trialOutcome === 'passed'
                ? `Completed all Nepal DOTM trial stages in ${timeFormatted} with ${score} points (70 points required).`
                : failReason || `Final score ${score} is below the 70-point DOTM passing threshold.`}
            </p>

            <div className="mt-4 border-t border-white/10 pt-3">
              <div className="text-xs font-medium text-slate-400 mb-2">
                Examiner Evaluation Log ({deductions.length} {deductions.length === 1 ? 'note' : 'notes'})
              </div>
              {deductions.length === 0 ? (
                <p className="text-xs text-emerald-400">Clean run — zero line touches, stalls, or rule violations.</p>
              ) : (
                <ul className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {deductions.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between text-xs text-slate-300 py-1 border-b border-white/5"
                    >
                      <span>{d.reason}</span>
                      <span className="font-mono-tabular text-red-400 font-semibold shrink-0 ml-2">
                        -{d.points}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              {mode === 'demo' && (
                <button
                  type="button"
                  onClick={onExitDemo}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors cursor-pointer"
                >
                  Start Your Own Trial
                </button>
              )}
              <button
                type="button"
                onClick={onReset}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer"
              >
                {mode === 'demo' ? 'Replay Demo' : 'Retry Trial'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
