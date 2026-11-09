import React from 'react';
import {
  BikeConfig,
  CourseConfig,
  TelemetrySnapshot,
} from '../game/types';
import { TouchInputControls } from './GameCanvas';

interface GameHUDProps {
  telemetry: TelemetrySnapshot;
  bike: BikeConfig;
  course: CourseConfig;
  isMuted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onOpenGarage: () => void;
  controlsRef: React.MutableRefObject<TouchInputControls | null>;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  telemetry,
  bike,
  course,
  isMuted,
  onToggleMute,
  onPause,
  onOpenGarage,
  controlsRef,
}) => {
  const {
    score,
    bestScore,
    comboMultiplier,
    currentWheelieScore,
    wheelieDistanceM,
    bestWheelieDistanceM,
    speedKmh,
    rpm,
    maxRpm,
    gear,
    maxGear,
    transmissionMode,
    clutchPulled,
    clutchCharge,
    wheelieAngleDeg,
    inWheelie,
    inSweetSpot,
    isScraping,
    upcomingHazard,
    callouts,
  } = telemetry;

  // Determine explicit text state for accessibility (never hue-only)
  let balanceStateLabel = 'GROUNDED · HOLD CLUTCH [C] + THROTTLE OR TAP [SPACE]';
  let balanceStateColor = 'text-slate-400';

  if (clutchPulled) {
    balanceStateLabel = `CLUTCH PULLED IN · REV CHARGE ${Math.round(clutchCharge * 100)}% (RELEASE TO DUMP!)`;
    balanceStateColor = 'text-[#38BDF8]';
  } else if (isScraping) {
    balanceStateLabel = '12 O’CLOCK SCRAPE · TITANIUM SPARKS (4X)';
    balanceStateColor = 'text-[#FBBF24]';
  } else if (wheelieAngleDeg >= bike.scrapeAngleMin - 2) {
    balanceStateLabel = 'LOOP-OUT WARNING · TAP REAR BRAKE [S]';
    balanceStateColor = 'text-[#EF4444]';
  } else if (inSweetSpot) {
    balanceStateLabel = 'BALANCE POINT SWEET SPOT · SHIFT UP [E] TO CHASE GEARS';
    balanceStateColor = 'text-[#10B981]';
  } else if (inWheelie) {
    balanceStateLabel = 'CLIMBING · FEATHER THROTTLE TO SWEET SPOT';
    balanceStateColor = 'text-[#F97316]';
  }

  // SVG Balance Gauge math
  const clampedAngle = Math.min(96, Math.max(0, wheelieAngleDeg));
  const needleRotation = -90 + (clampedAngle / 95) * 180;
  const rpmPercent = Math.min(100, Math.round((rpm / maxRpm) * 100));
  const clutchChargePercent = Math.min(100, Math.round(clutchCharge * 100));

  return (
    <div className="fixed inset-0 pointer-events-none select-none flex flex-col justify-between p-4 md:p-5">
      {/* Top Perimeter Row: Left Score Cluster — Center Balance Arc — Right Tach, Gearbox & Menu */}
      <div className="flex items-start justify-between gap-3">
        {/* Left Perimeter: Score, Combo, Bike/Course Info & Wheelie Distance */}
        <div className="bg-[#0B0D11]/90 border border-white/10 rounded-lg px-4 py-3 min-w-[215px]">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-xs font-medium text-slate-400">SCORE</span>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              BEST {bestScore.toLocaleString()}
            </span>
          </div>
          <div className="flex items-baseline gap-2.5 mt-0.5">
            <span className="font-display font-extrabold text-3xl tracking-tight text-white tabular-nums">
              {score.toLocaleString()}
            </span>
            {comboMultiplier > 1 && (
              <span className="font-mono font-bold text-sm text-[#10B981] tabular-nums">
                ×{comboMultiplier} COMBO
              </span>
            )}
          </div>

          <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-xs font-mono tabular-nums text-slate-300">
            <span>WHEELIE: {wheelieDistanceM}m</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>MAX: {bestWheelieDistanceM}m</span>
          </div>

          <div className="mt-1 text-[11px] font-mono text-slate-400 truncate">
            {bike.name} · {course.name}
          </div>
        </div>

        {/* Center Perimeter: Bespoke SVG Wheelie Angle & Balance Point Protractor */}
        <div className="bg-[#0B0D11]/90 border border-white/10 rounded-lg px-5 py-2.5 flex flex-col items-center max-w-md">
          <div className="flex items-center gap-4">
            <svg
              width="124"
              height="64"
              viewBox="0 0 124 64"
              className="overflow-visible shrink-0"
              aria-label={`Wheelie angle ${wheelieAngleDeg} degrees`}
            >
              {/* Base Track Arc (0° to 95°) */}
              <path
                d="M 12 56 A 50 50 0 0 1 112 56"
                fill="none"
                stroke="#1E293B"
                strokeWidth="8"
                strokeLinecap="round"
              />
              {/* Sweet Spot Zone (56° to 81°) */}
              <path
                d="M 70 10 A 50 50 0 0 1 103 30"
                fill="none"
                stroke="#10B981"
                strokeWidth="8"
              />
              {/* 12 O'Clock Scrape Zone (82° to 92°) */}
              <path
                d="M 103 30 A 50 50 0 0 1 111 48"
                fill="none"
                stroke="#F59E0B"
                strokeWidth="8"
              />
              {/* Loop-Out Redline Tick */}
              <line
                x1="106"
                y1="54"
                x2="117"
                y2="54"
                stroke="#EF4444"
                strokeWidth="3"
              />
              {/* Dynamic Needle */}
              <g transform={`translate(62, 56) rotate(${needleRotation})`}>
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="-46"
                  stroke={
                    isScraping
                      ? '#FBBF24'
                      : inSweetSpot
                      ? '#10B981'
                      : '#F8FAFC'
                  }
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle cx="0" cy="0" r="4.5" fill="#F8FAFC" />
              </g>
            </svg>

            {/* Angle Numeric Readout */}
            <div className="text-left">
              <div className="flex items-baseline gap-2">
                <span className="font-mono font-bold text-3xl tabular-nums text-white">
                  {wheelieAngleDeg}°
                </span>
                <span className="text-xs font-mono tabular-nums text-slate-400">
                  / {bike.scrapeAngleMin}° SCRAPE
                </span>
              </div>
              <div className="text-xs font-mono tabular-nums text-slate-300 mt-0.5">
                {inWheelie
                  ? `+${currentWheelieScore.toLocaleString()} PTS ACTIVE`
                  : `SWEET SPOT ${bike.balanceSweetSpotMin}°–${bike.balanceSweetSpotMax}°`}
              </div>
            </div>
          </div>

          {/* Explicit Non-Hue-Only State Line */}
          <div
            className={`mt-1.5 text-[11px] font-mono font-bold tracking-wide ${balanceStateColor} whitespace-nowrap`}
          >
            {balanceStateLabel}
          </div>
        </div>

        {/* Right Perimeter: Speed, 6-Speed Gearbox, Tachometer & Action Menu Buttons */}
        <div className="flex items-start gap-2.5">
          <div className="bg-[#0B0D11]/90 border border-white/10 rounded-lg px-4 py-3 min-w-[215px]">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <span className="font-mono font-bold text-2xl tabular-nums text-white">
                  {speedKmh}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1">
                  KM/H
                </span>
              </div>

              {/* Gear & Transmission Mode Toggle */}
              <div className="flex items-center gap-2 pointer-events-auto">
                <span className="text-sm font-mono tabular-nums text-[#FF5500] font-bold">
                  GEAR {gear}/{maxGear}
                </span>
                <button
                  type="button"
                  onClick={() => controlsRef.current?.toggleTransmission()}
                  className="px-2 py-0.5 bg-[#181C26] hover:bg-slate-800 border border-white/15 rounded text-[10px] font-mono font-bold text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
                  title="Switch between Auto-Shift and Manual Sequential Gearbox"
                >
                  {transmissionMode}
                </button>
              </div>
            </div>

            {/* RPM Bar */}
            <div className="mt-2 h-2 w-full bg-slate-800 rounded-sm overflow-hidden">
              <div
                className="h-full transition-transform duration-75 origin-left"
                style={{
                  backgroundColor:
                    rpmPercent > 90
                      ? '#EF4444'
                      : rpmPercent > 70
                      ? '#F59E0B'
                      : '#10B981',
                  transform: `scaleX(${rpmPercent / 100})`,
                }}
              />
            </div>

            <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-400">
              <span>{rpm.toLocaleString()} RPM</span>
              <span aria-hidden="true">·</span>
              <span>
                {clutchPulled
                  ? `CLUTCH IN (${clutchChargePercent}%)`
                  : 'CLUTCH ENGAGED'}
              </span>
            </div>
          </div>

          {/* Bike & Map Menu, Pause & Audio Buttons */}
          <div className="flex flex-col gap-1.5 pointer-events-auto">
            <button
              type="button"
              onClick={onOpenGarage}
              className="h-9 px-3.5 bg-[#FF5500] hover:bg-[#EA580C] rounded-lg text-xs font-mono font-bold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Open Bike & Map Selector Menu (B or Tab)"
            >
              BIKES &amp; MAPS [B]
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onPause}
                className="h-9 px-3 bg-[#0B0D11]/90 hover:bg-[#181C26] border border-white/15 rounded-lg text-xs font-mono font-bold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Pause Game (Esc)"
              >
                PAUSE
              </button>
              <button
                type="button"
                onClick={onToggleMute}
                className="h-9 px-3 bg-[#0B0D11]/90 hover:bg-[#181C26] border border-white/15 rounded-lg text-xs font-mono font-bold text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Toggle Audio (M)"
              >
                {isMuted ? 'MUTE' : 'SOUND'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Area: Trick Callouts & Upcoming Hazard Telegraph */}
      <div className="flex flex-col items-center gap-2 my-auto pointer-events-none">
        {upcomingHazard && (
          <div className="bg-[#0B0D11]/90 border border-[#F59E0B]/50 rounded-md px-3.5 py-1.5 flex items-center gap-2.5 text-xs font-mono tabular-nums">
            <span className="text-[#F59E0B] font-bold">
              HAZARD IN {upcomingHazard.distanceM}M
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-white">{upcomingHazard.label}</span>
          </div>
        )}

        {callouts.length > 0 && (
          <div className="flex flex-col items-center gap-1 mt-1">
            {callouts.slice(0, 2).map((c) => (
              <div
                key={c.id}
                className="bg-[#0B0D11]/90 border border-white/15 rounded px-3 py-1 flex items-center gap-2 font-display font-bold tracking-wide text-lg"
                style={{ color: c.color }}
              >
                <span>{c.title}</span>
                <span className="font-mono text-sm text-white tabular-nums">
                  +{c.points.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Perimeter: Interactive Clutch, Gearshift, Lean, Brake & Throttle Controls */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        {/* Left Control Cluster: Lean Back/Fwd, Rear Brake & Hold Clutch Lever */}
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onPointerDown={() => controlsRef.current?.setLeanBack(true)}
            onPointerUp={() => controlsRef.current?.setLeanBack(false)}
            onPointerLeave={() => controlsRef.current?.setLeanBack(false)}
            className="h-12 px-3.5 bg-[#0B0D11]/90 active:bg-[#1E293B] border border-white/15 rounded-lg text-xs font-mono font-bold text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
          >
            ← LEAN [A]
          </button>
          <button
            type="button"
            onPointerDown={() => controlsRef.current?.setLeanForward(true)}
            onPointerUp={() => controlsRef.current?.setLeanForward(false)}
            onPointerLeave={() => controlsRef.current?.setLeanForward(false)}
            className="h-12 px-3.5 bg-[#0B0D11]/90 active:bg-[#1E293B] border border-white/15 rounded-lg text-xs font-mono font-bold text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
          >
            LEAN [D] →
          </button>
          <button
            type="button"
            onPointerDown={() => controlsRef.current?.setBrake(true)}
            onPointerUp={() => controlsRef.current?.setBrake(false)}
            onPointerLeave={() => controlsRef.current?.setBrake(false)}
            className="h-12 px-4 bg-[#1F1215]/95 active:bg-[#EF4444] border border-[#EF4444]/50 rounded-lg text-xs font-mono font-bold text-[#FCA5A5] active:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            REAR BRAKE [S]
          </button>

          {/* Interactive Hold-and-Release Clutch Lever Button */}
          <button
            type="button"
            onPointerDown={() => controlsRef.current?.setClutch(true)}
            onPointerUp={() => controlsRef.current?.setClutch(false)}
            onPointerLeave={() => controlsRef.current?.setClutch(false)}
            className={`relative h-12 px-4 rounded-lg text-xs font-mono font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer overflow-hidden border ${
              clutchPulled
                ? 'bg-[#0284C7] border-[#38BDF8] text-white'
                : 'bg-[#0F172A]/95 hover:bg-[#1E293B] border-[#38BDF8]/50 text-[#38BDF8]'
            }`}
          >
            <div
              className="absolute bottom-0 left-0 h-1 bg-[#FBBF24] transition-transform duration-75 origin-left w-full"
              style={{ transform: `scaleX(${clutchCharge})` }}
            />
            <span>
              {clutchPulled
                ? `DUMP CLUTCH (${clutchChargePercent}%)`
                : 'HOLD CLUTCH [C]'}
            </span>
          </button>
        </div>

        {/* Right Control Cluster: Gearshift Down / Up, Stunt Pop & Throttle */}
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          {/* Sequential Gearshift Buttons (GEAR - / GEAR +) */}
          <div className="flex items-center bg-[#0B0D11]/95 border border-white/15 rounded-lg p-1 gap-1">
            <button
              type="button"
              onClick={() => controlsRef.current?.shiftDown()}
              disabled={gear <= 1}
              className="h-10 px-3 bg-[#181C26] hover:bg-slate-800 active:bg-[#FF5500] disabled:opacity-40 rounded text-xs font-mono font-bold text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
              title="Shift Gear Down (Q)"
            >
              GEAR − [Q]
            </button>
            <div className="px-2.5 text-center font-mono tabular-nums">
              <div className="text-[10px] text-slate-400 leading-none">GEAR</div>
              <div className="text-base font-bold text-[#FF5500] leading-tight">
                {gear}
              </div>
            </div>
            <button
              type="button"
              onClick={() => controlsRef.current?.shiftUp()}
              disabled={gear >= maxGear}
              className="h-10 px-3 bg-[#181C26] hover:bg-slate-800 active:bg-[#FF5500] disabled:opacity-40 rounded text-xs font-mono font-bold text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
              title="Shift Gear Up (E)"
            >
              GEAR + [E]
            </button>
          </div>

          <button
            type="button"
            onClick={() => controlsRef.current?.triggerStunt()}
            className="h-12 px-4 bg-[#0B0D11]/90 hover:bg-[#1E293B] active:bg-[#F59E0B] border border-[#F59E0B]/50 rounded-lg text-xs font-mono font-bold text-[#FBBF24] active:text-slate-950 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {inWheelie ? 'STUNT TRICK [SPACE]' : 'QUICK POP [SPACE]'}
          </button>

          <button
            type="button"
            onPointerDown={() => controlsRef.current?.setThrottle(true)}
            onPointerUp={() => controlsRef.current?.setThrottle(false)}
            onPointerLeave={() => controlsRef.current?.setThrottle(false)}
            className="h-12 px-5 bg-[#FF5500] active:bg-[#EA580C] rounded-lg text-xs font-mono font-bold text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            THROTTLE [W]
          </button>
        </div>
      </div>
    </div>
  );
};
