import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Play,
  X,
} from 'lucide-react';
import { VehicleInputs, VehicleTelemetry } from '../types/trial';

export type TutorialHighlight = 'ignition' | 'clutch-gear' | 'handbrake' | null;

interface TutorialOverlayProps {
  inputs: VehicleInputs;
  telemetry: VehicleTelemetry;
  onHighlightChange: (highlight: TutorialHighlight) => void;
  onStartTrial: () => void;
  onWatchDemo: () => void;
  onSkip: () => void;
}

const TOTAL_STEPS = 4;

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  inputs,
  telemetry,
  onHighlightChange,
  onStartTrial,
  onWatchDemo,
  onSkip,
}) => {
  const [step, setStep] = useState(0);
  const [testedClutchBite, setTestedClutchBite] = useState(false);
  const [testedShiftedFirst, setTestedShiftedFirst] = useState(false);
  const [testedHandbrakePull, setTestedHandbrakePull] = useState(false);
  const [testedHandbrakeRelease, setTestedHandbrakeRelease] = useState(false);

  // Track interactive control milestones live
  useEffect(() => {
    if (inputs.gear === '1') {
      setTestedShiftedFirst(true);
    }
    if (telemetry.inBiteZone || inputs.clutch > 0.55) {
      setTestedClutchBite(true);
    }
    if (inputs.handbrake > 0.5) {
      setTestedHandbrakePull(true);
    }
    if (testedHandbrakePull && inputs.handbrake < 0.2) {
      setTestedHandbrakeRelease(true);
    }
  }, [inputs.gear, inputs.clutch, inputs.handbrake, telemetry.inBiteZone, testedHandbrakePull]);

  // Highlight corresponding cockpit section
  useEffect(() => {
    if (step === 0) onHighlightChange('ignition');
    else if (step === 1) onHighlightChange('clutch-gear');
    else if (step === 2) onHighlightChange('handbrake');
    else onHighlightChange(null);

    return () => onHighlightChange(null);
  }, [step, onHighlightChange]);

  const step1Done = inputs.seatbelt && telemetry.engineRunning;
  const step2Done = testedClutchBite && testedShiftedFirst;
  const step3Done = testedHandbrakeRelease;

  const stepTitles = [
    'Step 1 of 4 · Seatbelt & Ignition',
    'Step 2 of 4 · Clutch & H-Pattern Gearbox',
    'Step 3 of 4 · Handbrake & Ukalo Hill Start',
    'Step 4 of 4 · Nepal DOTM Trial Rules',
  ];

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[25] w-[min(560px,94%)] max-h-[calc(100%-24px)] overflow-y-auto pointer-events-auto">
      <div className="bg-[#11151c]/95 border border-white/15 rounded-xl shadow-2xl p-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-amber-400">
            <BookOpen className="w-4 h-4 shrink-0" />
            <span className="text-xs font-semibold tracking-wide">{stepTitles[step]}</span>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            <span>Skip Tutorial</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Step Progress Segments */}
        <div className="grid grid-cols-4 gap-1.5 mt-3">
          {Array.from({ length: TOTAL_STEPS }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setStep(idx)}
              aria-label={`Go to tutorial step ${idx + 1}`}
              className={`h-1.5 rounded-full transition-colors cursor-pointer ${
                idx === step
                  ? 'bg-amber-400'
                  : idx < step
                  ? 'bg-emerald-500/70'
                  : 'bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Step Body */}
        <div className="mt-4">
          {step === 0 && (
            <div>
              <h2 className="font-display text-lg font-bold text-white">
                Pre-Start Safety & Cranking the Engine
              </h2>
              <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                Use the live cockpit controls below to prepare the car before moving. In Nepal DOTM
                trials, starting without a seatbelt deducts points immediately.
              </p>

              <div className="mt-3.5 space-y-2 border-t border-white/10 pt-3">
                <TaskRow
                  done={inputs.seatbelt}
                  label="Fasten Seatbelt"
                  hint="Press B or click Belt Off in the center console"
                />
                <TaskRow
                  done={inputs.gear === 'N' || inputs.clutch > 0.65}
                  label="Keep Gearbox in Neutral (N) or hold Clutch"
                  hint="Hold Shift / C or click Clutch pedal if in gear"
                />
                <TaskRow
                  done={telemetry.engineRunning}
                  label="Crank the Ignition Key until engine idles (~850 RPM)"
                  hint="Hold I or press and hold Start (I)"
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="font-display text-lg font-bold text-white">
                Mastering the Clutch & H-Pattern Gearbox
              </h2>
              <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                This simulator models a real manual clutch. Shifting without pressing the clutch
                grinds the gears, and releasing the clutch too fast without gas stalls the engine.
              </p>

              <div className="mt-3.5 space-y-2 border-t border-white/10 pt-3">
                <TaskRow
                  done={testedClutchBite}
                  label="Press Clutch (Shift / C) or drag the Clutch pedal"
                  hint="Watch the Clutch Bite bar in the center — 28% to 72% is the friction bite zone"
                />
                <TaskRow
                  done={testedShiftedFirst}
                  label="While holding Clutch (> 55%), shift into 1st Gear"
                  hint="Press 1 on your keyboard or click gate 1 on the H-shifter"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-display text-lg font-bold text-white">
                Handbrake & Steering for the Ukalo Ramp
              </h2>
              <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                On the uphill Ukalo ramp, stop inside the yellow box and pull the Handbrake. To
                climb without rolling back, bring the clutch to the bite zone with gentle Gas, then
                release the Handbrake.
              </p>

              <div className="mt-3.5 space-y-2 border-t border-white/10 pt-3">
                <TaskRow
                  done={testedHandbrakePull}
                  label="Verify Handbrake Lever is Pulled (engaged)"
                  hint="Press Space or click the Handbrake lever on the right"
                />
                <TaskRow
                  done={testedHandbrakeRelease}
                  label="Practice releasing the Handbrake cleanly"
                  hint="Press Space or click the lever to toggle OFF (hold Brake S/↓ on slopes)"
                />
                <div className="text-xs text-slate-400 pt-1">
                  Steering tip: Drag the wheel or hold <span className="text-slate-200 font-medium">A / D</span> for 1.5 turns lock-to-lock. Use <span className="text-slate-200 font-medium">Z / X</span> for Left/Right indicators.
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="font-display text-lg font-bold text-white">
                Nepal DOTM 6-Stage Course & Scoring Rules
              </h2>
              <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                You begin with <span className="text-emerald-400 font-semibold">100 points</span>.
                Score <span className="text-emerald-400 font-semibold">70+ points</span> across all
                six stages to pass, or switch to Strict Mode in the top bar for zero-mistake rules.
              </p>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2 border-t border-white/10 pt-3 text-xs">
                <div className="space-y-1.5">
                  <div className="font-semibold text-slate-200">Course Flow</div>
                  <p className="text-slate-300">1. Figure-8 (८ आकार) — signal on entry</p>
                  <p className="text-slate-300">2. Speed Breakers — creep in 1st gear</p>
                  <p className="text-slate-300">3. Traffic Light & Zebra — stop on Red</p>
                  <p className="text-slate-300">4. U-Turn Bay — signal Left before turn</p>
                  <p className="text-slate-300">5. Ukalo / Oralo — stop in yellow box</p>
                  <p className="text-slate-300">6. L-Back Garage — reverse in R & park</p>
                </div>
                <div className="space-y-1.5">
                  <div className="font-semibold text-slate-200">Point Deductions</div>
                  <p className="flex justify-between text-slate-300">
                    <span>Seatbelt / Engine Stall</span>
                    <span className="font-mono-tabular text-red-400">-5 pts</span>
                  </p>
                  <p className="flex justify-between text-slate-300">
                    <span>Yellow Line Touch</span>
                    <span className="font-mono-tabular text-red-400">-10 pts</span>
                  </p>
                  <p className="flex justify-between text-slate-300">
                    <span>Missed Turn Indicator</span>
                    <span className="font-mono-tabular text-red-400">-10 pts</span>
                  </p>
                  <p className="flex justify-between text-slate-300">
                    <span>Traffic Cone Hit</span>
                    <span className="font-mono-tabular text-red-400">-15 pts</span>
                  </p>
                  <p className="flex justify-between text-slate-300">
                    <span>Red Light / Ukalo Rollback</span>
                    <span className="font-mono-tabular text-red-400">-15 pts</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-[#181e27] text-slate-200 border border-white/10 hover:bg-[#222a36] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          <div className="text-[11px] text-slate-400 hidden sm:block">
            {step === 0 && (step1Done ? 'Ready for next step' : 'Try the highlighted controls below')}
            {step === 1 && (step2Done ? 'Gearbox & clutch verified' : 'Hold Clutch + shift into 1st Gear')}
            {step === 2 && (step3Done ? 'Handbrake verified' : 'Try toggling the Handbrake below')}
            {step === 3 && 'Press Start Trial Run to begin at 100 pts'}
          </div>

          {step < TOTAL_STEPS - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1))}
              className="flex items-center gap-1 px-4 py-1.5 rounded-md text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Next Step</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onWatchDemo}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold bg-[#1d2532] text-amber-300 border border-amber-500/40 hover:bg-[#263142] transition-colors cursor-pointer whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Watch Demo</span>
              </button>
              <button
                type="button"
                onClick={onStartTrial}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Start Trial Run</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface TaskRowProps {
  done: boolean;
  label: string;
  hint: string;
}

const TaskRow: React.FC<TaskRowProps> = ({ done, label, hint }) => (
  <div className="flex items-start gap-2.5 text-xs">
    {done ? (
      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
    ) : (
      <Circle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
    )}
    <div>
      <div className={done ? 'text-emerald-300 font-semibold' : 'text-slate-100 font-medium'}>
        {label}
      </div>
      <div className="text-slate-400 text-[11px]">{hint}</div>
    </div>
  </div>
);
