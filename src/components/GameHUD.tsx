import React from 'react';
import {
  BikeConfig,
  CourseConfig,
  DeviceMode,
  ResolvedDevice,
  TelemetrySnapshot,
} from '../game/types';
import { TouchInputControls } from './GameCanvas';

interface GameHUDProps {
  telemetry: TelemetrySnapshot;
  bike: BikeConfig;
  course: CourseConfig;
  deviceMode: DeviceMode;
  resolvedDevice: ResolvedDevice;
  isMuted: boolean;
  onSelectDeviceMode: (mode: DeviceMode) => void;
  onToggleMute: () => void;
  onPause: () => void;
  onOpenGarage: () => void;
  controlsRef: React.MutableRefObject<TouchInputControls | null>;
}

const vibrate = (ms: number = 10) => {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(ms);
    }
  } catch {
    // Ignore if vibration API is unsupported
  }
};

export const GameHUD: React.FC<GameHUDProps> = ({
  telemetry,
  bike,
  course,
  deviceMode,
  resolvedDevice,
  isMuted,
  onSelectDeviceMode,
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

  // Bind continuous hold button events for both multi-touch and mouse pointers
  const bindHoldEvents = (setter: (active: boolean) => void) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      vibrate(8);
      setter(true);
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      setter(false);
    },
    onPointerCancel: () => setter(false),
    onPointerLeave: () => setter(false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  // Determine explicit text state for accessibility (never hue-only)
  let balanceStateLabel = 'GROUNDED · HOLD CLUTCH + THROTTLE OR TAP STUNT';
  let balanceStateShort = 'GROUNDED';
  let balanceStateColor = 'text-slate-400';

  if (clutchPulled) {
    balanceStateLabel = `CLUTCH IN · REV ${Math.round(clutchCharge * 100)}% (RELEASE TO DUMP!)`;
    balanceStateShort = `CLUTCH ${Math.round(clutchCharge * 100)}%`;
    balanceStateColor = 'text-[#38BDF8]';
  } else if (isScraping) {
    balanceStateLabel = '12 O’CLOCK SCRAPE · TITANIUM SPARKS (4X)';
    balanceStateShort = '12 O’CLOCK SCRAPE!';
    balanceStateColor = 'text-[#FBBF24]';
  } else if (wheelieAngleDeg >= bike.scrapeAngleMin - 2) {
    balanceStateLabel = 'LOOP-OUT WARNING · TAP REAR BRAKE!';
    balanceStateShort = 'TAP REAR BRAKE!';
    balanceStateColor = 'text-[#EF4444]';
  } else if (inSweetSpot) {
    balanceStateLabel = 'BALANCE SWEET SPOT · SHIFT UP TO CHASE GEARS';
    balanceStateShort = 'SWEET SPOT';
    balanceStateColor = 'text-[#10B981]';
  } else if (inWheelie) {
    balanceStateLabel = 'CLIMBING · FEATHER THROTTLE TO SWEET SPOT';
    balanceStateShort = 'WHEELIE';
    balanceStateColor = 'text-[#F97316]';
  }

  const clampedAngle = Math.min(96, Math.max(0, wheelieAngleDeg));
  const needleRotation = -90 + (clampedAngle / 95) * 180;
  const rpmPercent = Math.min(100, Math.round((rpm / maxRpm) * 100));
  const clutchChargePercent = Math.min(100, Math.round(clutchCharge * 100));

  // ============================================================================
  // 1. MOBILE VERSION LAYOUT (Compact Top Bar + Dual-Thumb Arcade Deck)
  // ============================================================================
  if (resolvedDevice === 'MOBILE') {
    return (
      <div className="absolute inset-0 pointer-events-none select-none flex flex-col justify-between p-2.5">
        {/* Compact Top Mobile Telemetry Bar (<= 12% height) */}
        <div className="flex flex-col gap-1.5">
          <div className="bg-[#0B0D11]/92 border border-white/12 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
            {/* Score & Distance */}
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="font-display font-extrabold text-2xl leading-none text-white tabular-nums">
                  {score.toLocaleString()}
                </span>
                {comboMultiplier > 1 && (
                  <span className="font-mono font-bold text-xs text-[#10B981] tabular-nums">
                    ×{comboMultiplier}
                  </span>
                )}
              </div>
              <div className="text-[10px] font-mono tabular-nums text-slate-400 mt-0.5">
                {wheelieDistanceM}m · MAX {bestWheelieDistanceM}m
              </div>
            </div>

            {/* Compact Center Angle Gauge */}
            <div className="flex items-center gap-2 bg-[#141821] border border-white/10 rounded-lg px-2.5 py-1">
              <svg
                width="48"
                height="28"
                viewBox="0 0 124 64"
                className="overflow-visible shrink-0"
              >
                <path
                  d="M 12 56 A 50 50 0 0 1 112 56"
                  fill="none"
                  stroke="#1E293B"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                <path
                  d="M 70 10 A 50 50 0 0 1 103 30"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="12"
                />
                <path
                  d="M 103 30 A 50 50 0 0 1 111 48"
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="12"
                />
                <g transform={`translate(62, 56) rotate(${needleRotation})`}>
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="-46"
                    stroke="#FFFFFF"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                </g>
              </svg>
              <div className="text-left font-mono tabular-nums">
                <div className="text-base font-bold leading-none text-white">
                  {wheelieAngleDeg}°
                </div>
                <div className={`text-[9px] font-bold leading-tight ${balanceStateColor}`}>
                  {balanceStateShort}
                </div>
              </div>
            </div>

            {/* Speed & Gear + Action Triggers */}
            <div className="flex items-center gap-1.5 pointer-events-auto">
              <div className="text-right font-mono tabular-nums mr-1">
                <div className="text-sm font-bold leading-none text-white">
                  {speedKmh} <span className="text-[9px] text-slate-400">KM/H</span>
                </div>
                <div className="text-[10px] font-bold text-[#FF5500] mt-0.5">
                  G{gear} · {rpmPercent}% RPM
                </div>
              </div>

              <button
                type="button"
                onClick={onOpenGarage}
                className="min-h-[44px] min-w-[44px] px-2.5 bg-[#FF5500] active:bg-[#EA580C] rounded-lg text-[10px] font-mono font-bold text-white flex items-center justify-center cursor-pointer"
                title="Bikes & Maps Menu"
              >
                GARAGE
              </button>
              <button
                type="button"
                onClick={onPause}
                className="min-h-[44px] min-w-[44px] px-2.5 bg-[#181C26] active:bg-slate-700 border border-white/15 rounded-lg text-[10px] font-mono font-bold text-white flex items-center justify-center cursor-pointer"
                title="Pause"
              >
                II
              </button>
            </div>
          </div>

          {/* Device Switcher Pill Bar */}
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="pointer-events-auto inline-flex items-center gap-1 bg-[#0B0D11]/90 border border-white/10 rounded-lg p-0.5 text-[10px] font-mono">
              {(['MOBILE', 'TABLET', 'DESKTOP'] as DeviceMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onSelectDeviceMode(m)}
                  className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                    resolvedDevice === m
                      ? 'bg-[#FF5500] text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                vibrate(8);
                controlsRef.current?.toggleTransmission();
              }}
              className="pointer-events-auto px-2.5 py-1 bg-[#0B0D11]/90 border border-white/15 rounded-lg text-[10px] font-mono font-bold text-slate-200 cursor-pointer"
            >
              GEARBOX: {transmissionMode}
            </button>
          </div>
        </div>

        {/* Center Callouts & Hazard Telegraph */}
        <div className="flex flex-col items-center gap-1.5 my-auto pointer-events-none">
          {upcomingHazard && (
            <div className="bg-[#0B0D11]/90 border border-[#F59E0B]/60 rounded-md px-3 py-1 text-[11px] font-mono tabular-nums text-center">
              <span className="text-[#F59E0B] font-bold">
                {upcomingHazard.distanceM}M:
              </span>{' '}
              <span className="text-white">{upcomingHazard.label}</span>
            </div>
          )}

          {callouts.slice(0, 2).map((c) => (
            <div
              key={c.id}
              className="bg-[#0B0D11]/90 border border-white/15 rounded px-2.5 py-0.5 flex items-center gap-1.5 font-display font-bold text-base"
              style={{ color: c.color }}
            >
              <span>{c.title}</span>
              <span className="font-mono text-xs text-white tabular-nums">
                +{c.points.toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        {/* Bottom Ergonomic Dual-Thumb Mobile Control Deck */}
        <div className="grid grid-cols-2 gap-2.5 pointer-events-auto pb-1">
          {/* LEFT THUMB DECK: Lean Rocker, Hold Clutch & Oversized Rear Brake */}
          <div className="flex flex-col gap-2 bg-[#0B0D11]/92 border border-white/12 rounded-2xl p-2">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                {...bindHoldEvents((v) => controlsRef.current?.setLeanBack(v))}
                className="min-h-[46px] bg-[#161B26] active:bg-[#283144] border border-white/15 rounded-xl text-xs font-mono font-bold text-slate-200 flex items-center justify-center cursor-pointer"
              >
                ← LEAN BACK
              </button>
              <button
                type="button"
                {...bindHoldEvents((v) => controlsRef.current?.setLeanForward(v))}
                className="min-h-[46px] bg-[#161B26] active:bg-[#283144] border border-white/15 rounded-xl text-xs font-mono font-bold text-slate-200 flex items-center justify-center cursor-pointer"
              >
                LEAN FWD →
              </button>
            </div>

            {/* Hold Clutch Lever */}
            <button
              type="button"
              {...bindHoldEvents((v) => controlsRef.current?.setClutch(v))}
              className={`relative min-h-[48px] rounded-xl text-xs font-mono font-bold overflow-hidden border flex items-center justify-center cursor-pointer ${
                clutchPulled
                  ? 'bg-[#0284C7] border-[#38BDF8] text-white'
                  : 'bg-[#0F172A] border-[#38BDF8]/50 text-[#38BDF8]'
              }`}
            >
              <div
                className="absolute bottom-0 left-0 h-1.5 bg-[#FBBF24] transition-transform duration-75 origin-left w-full"
                style={{ transform: `scaleX(${clutchCharge})` }}
              />
              <span>
                {clutchPulled
                  ? `RELEASE TO DUMP (${clutchChargePercent}%)`
                  : 'HOLD CLUTCH LEVER'}
              </span>
            </button>

            {/* Primary Left-Thumb Pedal: Rear Brake */}
            <button
              type="button"
              {...bindHoldEvents((v) => controlsRef.current?.setBrake(v))}
              className="min-h-[60px] bg-[#2A1215] active:bg-[#EF4444] border-2 border-[#EF4444]/70 rounded-xl text-sm font-display font-extrabold tracking-wider text-[#FCA5A5] active:text-white flex flex-col items-center justify-center cursor-pointer"
            >
              <span>REAR BRAKE</span>
              <span className="text-[10px] font-mono font-normal opacity-80">
                TAP TO SAVE LOOP-OUT
              </span>
            </button>
          </div>

          {/* RIGHT THUMB DECK: Gear Shifter, Stunt Button & Oversized Throttle */}
          <div className="flex flex-col gap-2 bg-[#0B0D11]/92 border border-white/12 rounded-2xl p-2">
            {/* Sequential Gearshift Rocker */}
            <div className="grid grid-cols-3 gap-1.5 items-center bg-[#141821] rounded-xl p-1 border border-white/10">
              <button
                type="button"
                onClick={() => {
                  vibrate(12);
                  controlsRef.current?.shiftDown();
                }}
                disabled={gear <= 1}
                className="min-h-[44px] bg-[#1E2534] active:bg-[#FF5500] disabled:opacity-35 rounded-lg text-xs font-mono font-bold text-white flex items-center justify-center cursor-pointer"
              >
                GEAR −
              </button>
              <div className="text-center font-mono tabular-nums">
                <div className="text-[9px] text-slate-400 leading-none">GEAR</div>
                <div className="text-base font-bold text-[#FF5500] leading-tight">
                  {gear}/{maxGear}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  vibrate(12);
                  controlsRef.current?.shiftUp();
                }}
                disabled={gear >= maxGear}
                className="min-h-[44px] bg-[#1E2534] active:bg-[#FF5500] disabled:opacity-35 rounded-lg text-xs font-mono font-bold text-white flex items-center justify-center cursor-pointer"
              >
                GEAR +
              </button>
            </div>

            {/* Stunt / Quick Pop Button */}
            <button
              type="button"
              onClick={() => {
                vibrate(14);
                controlsRef.current?.triggerStunt();
              }}
              className="min-h-[48px] bg-[#1F1A10] active:bg-[#F59E0B] border border-[#F59E0B]/60 rounded-xl text-xs font-mono font-bold text-[#FBBF24] active:text-slate-950 flex items-center justify-center cursor-pointer"
            >
              {inWheelie ? 'PERFORM STUNT TRICK' : 'QUICK CLUTCH POP'}
            </button>

            {/* Primary Right-Thumb Pedal: Throttle */}
            <button
              type="button"
              {...bindHoldEvents((v) => controlsRef.current?.setThrottle(v))}
              className="min-h-[60px] bg-[#FF5500] active:bg-[#EA580C] rounded-xl text-base font-display font-extrabold tracking-wider text-white flex flex-col items-center justify-center cursor-pointer"
            >
              <span>THROTTLE / WHEELIE</span>
              <span className="text-[10px] font-mono font-normal opacity-90">
                HOLD TO LIFT FRONT WHEEL
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 2. TABLET VERSION LAYOUT (Cockpit Top Bar + Split-Bezel Ergonomic Thumb Pads)
  // ============================================================================
  if (resolvedDevice === 'TABLET') {
    return (
      <div className="absolute inset-0 pointer-events-none select-none flex flex-col justify-between p-4">
        {/* Tablet Top Cockpit Bar */}
        <div className="flex items-start justify-between gap-3">
          {/* Left Score & Machine Card */}
          <div className="bg-[#0B0D11]/92 border border-white/12 rounded-xl px-4 py-2.5 min-w-[190px]">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[11px] font-mono text-slate-400">SCORE</span>
              <span className="text-[11px] font-mono tabular-nums text-slate-400">
                BEST {bestScore.toLocaleString()}
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-display font-extrabold text-3xl text-white tabular-nums">
                {score.toLocaleString()}
              </span>
              {comboMultiplier > 1 && (
                <span className="font-mono font-bold text-xs text-[#10B981] tabular-nums">
                  ×{comboMultiplier}
                </span>
              )}
            </div>
            <div className="mt-1.5 pt-1.5 border-t border-white/10 flex items-center justify-between text-xs font-mono tabular-nums text-slate-300">
              <span>WHEELIE: {wheelieDistanceM}m</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>MAX: {bestWheelieDistanceM}m</span>
            </div>
          </div>

          {/* Center Tablet Angle Protractor */}
          <div className="bg-[#0B0D11]/92 border border-white/12 rounded-xl px-4 py-2 flex flex-col items-center">
            <div className="flex items-center gap-3.5">
              <svg
                width="104"
                height="54"
                viewBox="0 0 124 64"
                className="overflow-visible shrink-0"
              >
                <path
                  d="M 12 56 A 50 50 0 0 1 112 56"
                  fill="none"
                  stroke="#1E293B"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                <path
                  d="M 70 10 A 50 50 0 0 1 103 30"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="8"
                />
                <path
                  d="M 103 30 A 50 50 0 0 1 111 48"
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="8"
                />
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
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                  <circle cx="0" cy="0" r="4.5" fill="#F8FAFC" />
                </g>
              </svg>

              <div className="text-left font-mono tabular-nums">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-bold text-2xl text-white">
                    {wheelieAngleDeg}°
                  </span>
                  <span className="text-xs text-slate-400">
                    / {bike.scrapeAngleMin}°
                  </span>
                </div>
                <div className="text-[11px] text-slate-300">
                  {inWheelie
                    ? `+${currentWheelieScore.toLocaleString()} PTS`
                    : `SWEET ${bike.balanceSweetSpotMin}°–${bike.balanceSweetSpotMax}°`}
                </div>
              </div>
            </div>
            <div className={`mt-1 text-[10px] font-mono font-bold ${balanceStateColor}`}>
              {balanceStateLabel}
            </div>
          </div>

          {/* Right Tablet Tachometer & Quick Switchers */}
          <div className="flex flex-col items-end gap-1.5 pointer-events-auto">
            <div className="flex items-center gap-2">
              <div className="bg-[#0B0D11]/92 border border-white/12 rounded-xl px-3.5 py-2 min-w-[165px]">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono font-bold text-xl tabular-nums text-white">
                    {speedKmh} <span className="text-[10px] text-slate-400">KM/H</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => controlsRef.current?.toggleTransmission()}
                    className="px-2 py-0.5 bg-[#181C26] border border-white/15 rounded text-[10px] font-mono font-bold text-[#FF5500] cursor-pointer"
                  >
                    G{gear} · {transmissionMode}
                  </button>
                </div>
                <div className="mt-1.5 h-2 w-full bg-slate-800 rounded-xs overflow-hidden">
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
              </div>

              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={onOpenGarage}
                  className="min-h-[42px] px-3.5 bg-[#FF5500] hover:bg-[#EA580C] rounded-lg text-xs font-mono font-bold text-white cursor-pointer whitespace-nowrap"
                >
                  BIKES &amp; MAPS
                </button>
                <button
                  type="button"
                  onClick={onPause}
                  className="min-h-[38px] px-3.5 bg-[#0B0D11]/92 border border-white/15 rounded-lg text-xs font-mono font-bold text-white cursor-pointer"
                >
                  PAUSE
                </button>
              </div>
            </div>

            {/* Device Switcher */}
            <div className="inline-flex items-center gap-1 bg-[#0B0D11]/90 border border-white/10 rounded-lg p-0.5 text-[10px] font-mono">
              {(['MOBILE', 'TABLET', 'DESKTOP'] as DeviceMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onSelectDeviceMode(m)}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    resolvedDevice === m
                      ? 'bg-[#FF5500] text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center Callouts & Hazard Telegraph */}
        <div className="flex flex-col items-center gap-2 my-auto pointer-events-none">
          {upcomingHazard && (
            <div className="bg-[#0B0D11]/90 border border-[#F59E0B]/50 rounded-md px-3.5 py-1.5 flex items-center gap-2 text-xs font-mono tabular-nums">
              <span className="text-[#F59E0B] font-bold">
                HAZARD IN {upcomingHazard.distanceM}M
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-white">{upcomingHazard.label}</span>
            </div>
          )}

          {callouts.slice(0, 2).map((c) => (
            <div
              key={c.id}
              className="bg-[#0B0D11]/90 border border-white/15 rounded px-3 py-1 flex items-center gap-2 font-display font-bold text-lg"
              style={{ color: c.color }}
            >
              <span>{c.title}</span>
              <span className="font-mono text-sm text-white tabular-nums">
                +{c.points.toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        {/* Split-Bezel Left & Right Tablet Thumb Clusters */}
        <div className="flex items-end justify-between gap-6">
          {/* Left Tablet Bezel Thumb Pad */}
          <div className="pointer-events-auto w-[270px] bg-[#0B0D11]/92 border border-white/15 rounded-2xl p-3 space-y-2">
            <div className="text-[10px] font-mono text-slate-400 flex justify-between">
              <span>LEFT THUMB · BALANCE &amp; CLUTCH</span>
              <span>{clutchPulled ? `${clutchChargePercent}% REV` : 'READY'}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                {...bindHoldEvents((v) => controlsRef.current?.setLeanBack(v))}
                className="min-h-[52px] bg-[#161B26] active:bg-[#283144] border border-white/15 rounded-xl text-xs font-mono font-bold text-slate-200 cursor-pointer"
              >
                ← LEAN BACK
              </button>
              <button
                type="button"
                {...bindHoldEvents((v) => controlsRef.current?.setLeanForward(v))}
                className="min-h-[52px] bg-[#161B26] active:bg-[#283144] border border-white/15 rounded-xl text-xs font-mono font-bold text-slate-200 cursor-pointer"
              >
                LEAN FWD →
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                {...bindHoldEvents((v) => controlsRef.current?.setClutch(v))}
                className={`relative min-h-[64px] rounded-xl text-xs font-mono font-bold overflow-hidden border flex flex-col items-center justify-center cursor-pointer ${
                  clutchPulled
                    ? 'bg-[#0284C7] border-[#38BDF8] text-white'
                    : 'bg-[#0F172A] border-[#38BDF8]/50 text-[#38BDF8]'
                }`}
              >
                <div
                  className="absolute bottom-0 left-0 h-1.5 bg-[#FBBF24] transition-transform duration-75 origin-left w-full"
                  style={{ transform: `scaleX(${clutchCharge})` }}
                />
                <span>{clutchPulled ? 'DUMP!' : 'HOLD CLUTCH'}</span>
                <span className="text-[10px] opacity-80 mt-0.5">
                  {clutchChargePercent}% CHARGE
                </span>
              </button>

              <button
                type="button"
                {...bindHoldEvents((v) => controlsRef.current?.setBrake(v))}
                className="min-h-[64px] bg-[#2A1215] active:bg-[#EF4444] border-2 border-[#EF4444]/65 rounded-xl text-xs font-mono font-bold text-[#FCA5A5] active:text-white flex flex-col items-center justify-center cursor-pointer"
              >
                <span>REAR BRAKE</span>
                <span className="text-[10px] opacity-80 mt-0.5">ANTI-LOOP</span>
              </button>
            </div>
          </div>

          {/* Right Tablet Bezel Thumb Pad */}
          <div className="pointer-events-auto w-[280px] bg-[#0B0D11]/92 border border-white/15 rounded-2xl p-3 space-y-2">
            <div className="text-[10px] font-mono text-slate-400 flex justify-between">
              <span>RIGHT THUMB · SHIFTER &amp; DRIVE</span>
              <span>GEAR {gear}/{maxGear}</span>
            </div>

            {/* Gearshift Row */}
            <div className="grid grid-cols-3 gap-2 items-center bg-[#141821] p-1.5 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => {
                  vibrate(12);
                  controlsRef.current?.shiftDown();
                }}
                disabled={gear <= 1}
                className="min-h-[46px] bg-[#1E2534] active:bg-[#FF5500] disabled:opacity-35 rounded-lg text-xs font-mono font-bold text-white cursor-pointer"
              >
                GEAR −
              </button>
              <div className="text-center font-mono tabular-nums">
                <div className="text-[10px] text-slate-400">GEAR</div>
                <div className="text-xl font-bold text-[#FF5500] leading-none">
                  {gear}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  vibrate(12);
                  controlsRef.current?.shiftUp();
                }}
                disabled={gear >= maxGear}
                className="min-h-[46px] bg-[#1E2534] active:bg-[#FF5500] disabled:opacity-35 rounded-lg text-xs font-mono font-bold text-white cursor-pointer"
              >
                GEAR +
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  vibrate(14);
                  controlsRef.current?.triggerStunt();
                }}
                className="min-h-[64px] bg-[#1F1A10] active:bg-[#F59E0B] border border-[#F59E0B]/60 rounded-xl text-xs font-mono font-bold text-[#FBBF24] active:text-slate-950 flex flex-col items-center justify-center cursor-pointer"
              >
                <span>{inWheelie ? 'STUNT TRICK' : 'QUICK POP'}</span>
                <span className="text-[10px] opacity-80 mt-0.5">+BONUS PTS</span>
              </button>

              <button
                type="button"
                {...bindHoldEvents((v) => controlsRef.current?.setThrottle(v))}
                className="min-h-[64px] bg-[#FF5500] active:bg-[#EA580C] rounded-xl text-sm font-display font-extrabold tracking-wider text-white flex flex-col items-center justify-center cursor-pointer"
              >
                <span>THROTTLE</span>
                <span className="text-[10px] font-mono font-normal opacity-90">
                  WHEELIE UP
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 3. DESKTOP VERSION LAYOUT (Full Perimeter Telemetry + Pedals + Keyboard)
  // ============================================================================
  return (
    <div className="absolute inset-0 pointer-events-none select-none flex flex-col justify-between p-4 md:p-5">
      {/* Top Perimeter Row */}
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
              <path
                d="M 12 56 A 50 50 0 0 1 112 56"
                fill="none"
                stroke="#1E293B"
                strokeWidth="8"
                strokeLinecap="round"
              />
              <path
                d="M 70 10 A 50 50 0 0 1 103 30"
                fill="none"
                stroke="#10B981"
                strokeWidth="8"
              />
              <path
                d="M 103 30 A 50 50 0 0 1 111 48"
                fill="none"
                stroke="#F59E0B"
                strokeWidth="8"
              />
              <line
                x1="106"
                y1="54"
                x2="117"
                y2="54"
                stroke="#EF4444"
                strokeWidth="3"
              />
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

          <div
            className={`mt-1.5 text-[11px] font-mono font-bold tracking-wide ${balanceStateColor} whitespace-nowrap`}
          >
            {balanceStateLabel}
          </div>
        </div>

        {/* Right Perimeter: Speed, 6-Speed Gearbox, Tachometer, Device Switcher & Menu Buttons */}
        <div className="flex flex-col items-end gap-2">
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

          {/* Device Layout Switcher (Switch between Desktop, Tablet & Mobile versions anytime) */}
          <div className="pointer-events-auto flex items-center gap-1 bg-[#0B0D11]/90 border border-white/10 rounded-lg p-1 text-[11px] font-mono">
            <span className="text-slate-400 px-2">VIEW:</span>
            {(['AUTO', 'MOBILE', 'TABLET', 'DESKTOP'] as DeviceMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onSelectDeviceMode(m)}
                className={`px-2.5 py-0.5 rounded transition-colors cursor-pointer ${
                  deviceMode === m
                    ? 'bg-[#FF5500] text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {m}
              </button>
            ))}
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
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          <button
            type="button"
            {...bindHoldEvents((v) => controlsRef.current?.setLeanBack(v))}
            className="h-12 px-3.5 bg-[#0B0D11]/90 active:bg-[#1E293B] border border-white/15 rounded-lg text-xs font-mono font-bold text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
          >
            ← LEAN [A]
          </button>
          <button
            type="button"
            {...bindHoldEvents((v) => controlsRef.current?.setLeanForward(v))}
            className="h-12 px-3.5 bg-[#0B0D11]/90 active:bg-[#1E293B] border border-white/15 rounded-lg text-xs font-mono font-bold text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
          >
            LEAN [D] →
          </button>
          <button
            type="button"
            {...bindHoldEvents((v) => controlsRef.current?.setBrake(v))}
            className="h-12 px-4 bg-[#1F1215]/95 active:bg-[#EF4444] border border-[#EF4444]/50 rounded-lg text-xs font-mono font-bold text-[#FCA5A5] active:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            REAR BRAKE [S]
          </button>

          <button
            type="button"
            {...bindHoldEvents((v) => controlsRef.current?.setClutch(v))}
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

        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
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
            {...bindHoldEvents((v) => controlsRef.current?.setThrottle(v))}
            className="h-12 px-5 bg-[#FF5500] active:bg-[#EA580C] rounded-lg text-xs font-mono font-bold text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            THROTTLE [W]
          </button>
        </div>
      </div>
    </div>
  );
};
