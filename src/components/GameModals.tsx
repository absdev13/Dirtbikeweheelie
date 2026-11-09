import React, { useState } from 'react';
import {
  BIKES,
  BikeConfig,
  COURSES,
  CourseConfig,
  DeviceMode,
  GameState,
  ResolvedDevice,
  TelemetrySnapshot,
} from '../game/types';

interface GameModalsProps {
  gameState: GameState;
  selectedBike: BikeConfig;
  selectedCourse: CourseConfig;
  telemetry: TelemetrySnapshot;
  deviceMode: DeviceMode;
  resolvedDevice: ResolvedDevice;
  isMuted: boolean;
  onSelectDeviceMode: (mode: DeviceMode) => void;
  onSelectBike: (bike: BikeConfig) => void;
  onSelectCourse: (course: CourseConfig) => void;
  onStartGame: () => void;
  onResumeGame: () => void;
  onOpenGarage: () => void;
  onReturnToTitle: () => void;
  onToggleMute: () => void;
}

export const GameModals: React.FC<GameModalsProps> = ({
  gameState,
  selectedBike,
  selectedCourse,
  telemetry,
  deviceMode,
  resolvedDevice,
  isMuted,
  onSelectDeviceMode,
  onSelectBike,
  onSelectCourse,
  onStartGame,
  onResumeGame,
  onOpenGarage,
  onReturnToTitle,
  onToggleMute,
}) => {
  const [garageTab, setGarageTab] = useState<'BIKES' | 'MAPS'>('BIKES');

  if (gameState === 'PLAYING') return null;

  const isCompactMobile = resolvedDevice === 'MOBILE';

  // Dedicated Bikes & Maps Menu (GARAGE_MENU)
  if (gameState === 'GARAGE_MENU') {
    const sweetSpotSpan =
      selectedBike.balanceSweetSpotMax - selectedBike.balanceSweetSpotMin;
    const torquePct = Math.min(100, Math.round((selectedBike.torqueMultiplier / 1.35) * 100));
    const brakePct = Math.min(100, Math.round((selectedBike.brakeAuthority / 1.35) * 100));
    const balancePct = Math.min(100, Math.round((sweetSpotSpan / 32) * 100));
    const speedPct = Math.min(100, Math.round((selectedBike.maxSpeedKmh / 160) * 100));

    return (
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 sm:p-5 md:p-8 bg-gradient-to-r from-[#0B0D11]/95 via-[#0B0D11]/85 to-transparent overflow-y-auto">
        {/* Header Bar */}
        <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 max-w-2xl bg-[#0B0D11]/95 border border-white/15 rounded-xl px-4 py-3">
          <div>
            <div className="text-[11px] font-mono font-bold text-[#FF5500]">
              PADDOCK &amp; TRAIL SELECTOR
            </div>
            <h2 className="font-display font-extrabold text-2xl sm:text-3xl tracking-wide text-white">
              BIKES &amp; MAPS MENU
            </h2>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center gap-1 p-1 bg-[#141821] rounded-lg border border-white/10">
            <button
              type="button"
              onClick={() => setGarageTab('BIKES')}
              className={`min-h-[40px] px-4 py-1.5 rounded-md text-xs font-mono font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                garageTab === 'BIKES'
                  ? 'bg-[#FF5500] text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              BIKES ({BIKES.length})
            </button>
            <button
              type="button"
              onClick={() => setGarageTab('MAPS')}
              className={`min-h-[40px] px-4 py-1.5 rounded-md text-xs font-mono font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                garageTab === 'MAPS'
                  ? 'bg-[#FF5500] text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              MAPS ({COURSES.length})
            </button>
          </div>
        </div>

        {/* Main Selector Body */}
        <div className="pointer-events-auto w-full max-w-2xl bg-[#0B0D11]/95 border border-white/15 rounded-xl p-4 sm:p-5 space-y-4 my-auto max-h-[75vh] overflow-y-auto">
          {garageTab === 'BIKES' ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-mono font-bold text-slate-300">
                  SELECT DIRTBIKE CHASSIS &amp; ENGINE
                </span>
                <span className="text-xs font-mono text-slate-400 tabular-nums">
                  ACTIVE: {selectedBike.name}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {BIKES.map((b) => {
                  const active = b.id === selectedBike.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => onSelectBike(b)}
                      className={`p-3.5 rounded-lg text-left transition-colors cursor-pointer border ${
                        active
                          ? 'bg-[#1A202E] border-[#FF5500] text-white'
                          : 'bg-[#12161F] border-white/10 text-slate-300 hover:border-white/25 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display font-bold text-xl tracking-wide text-white truncate">
                          {b.name}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className="w-3.5 h-3.5 rounded-xs border border-white/20"
                            style={{ backgroundColor: b.primaryColor }}
                          />
                          <span
                            className="w-2.5 h-3.5 rounded-xs border border-white/20"
                            style={{ backgroundColor: b.rimColor }}
                          />
                        </div>
                      </div>

                      <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
                        {b.displacement} · {b.strokeType} · TOP {b.maxSpeedKmh} KM/H
                      </div>
                      <p className="mt-1.5 text-xs text-slate-300 line-clamp-2 leading-relaxed">
                        {b.tagline}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Selected Bike Telemetry Specs */}
              <div className="bg-[#12161F] border border-white/10 rounded-lg p-3.5 space-y-2.5 font-mono text-xs tabular-nums">
                <div className="flex items-center justify-between text-slate-200 font-bold">
                  <span className="truncate">{selectedBike.name} SPECS</span>
                  <span className="text-[#10B981] shrink-0">
                    SWEET SPOT {selectedBike.balanceSweetSpotMin}°–{selectedBike.balanceSweetSpotMax}°
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span>WHEELIE TORQUE</span>
                      <span>{torquePct}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-xs overflow-hidden">
                      <div
                        className="h-full bg-[#FF5500]"
                        style={{ width: `${torquePct}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span>REAR BRAKE AUTHORITY</span>
                      <span>{brakePct}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-xs overflow-hidden">
                      <div
                        className="h-full bg-[#38BDF8]"
                        style={{ width: `${brakePct}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span>BALANCE WINDOW</span>
                      <span>{sweetSpotSpan}° ARC</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-xs overflow-hidden">
                      <div
                        className="h-full bg-[#10B981]"
                        style={{ width: `${balancePct}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span>6TH GEAR TOP SPEED</span>
                      <span>{selectedBike.maxSpeedKmh} KM/H</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-xs overflow-hidden">
                      <div
                        className="h-full bg-[#FBBF24]"
                        style={{ width: `${speedPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-mono font-bold text-slate-300">
                  SELECT RIDING ENVIRONMENT &amp; TERRAIN
                </span>
                <span className="text-xs font-mono text-slate-400">
                  ACTIVE: {selectedCourse.name}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {COURSES.map((c) => {
                  const active = c.id === selectedCourse.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onSelectCourse(c)}
                      className={`p-3 rounded-lg text-left transition-colors cursor-pointer border flex items-center gap-3.5 ${
                        active
                          ? 'bg-[#1A202E] border-[#FF5500] text-white'
                          : 'bg-[#12161F] border-white/10 text-slate-300 hover:border-white/25 hover:text-white'
                      }`}
                    >
                      <svg
                        width="72"
                        height="48"
                        viewBox="0 0 76 52"
                        className="rounded border border-white/15 shrink-0 overflow-hidden"
                      >
                        <rect width="76" height="52" fill={c.skyBottom} />
                        <circle cx="56" cy="16" r="9" fill={c.horizonGlow} opacity="0.85" />
                        <path
                          d="M 0 36 Q 22 24 44 34 T 76 28 L 76 52 L 0 52 Z"
                          fill={c.mountainNear}
                        />
                        <path
                          d="M 0 42 Q 38 35 76 41 L 76 52 L 0 52 Z"
                          fill={c.groundSurface}
                        />
                      </svg>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-display font-bold text-xl tracking-wide text-white truncate">
                            {c.name}
                          </span>
                          <span className="text-xs font-mono text-[#FBBF24] shrink-0">
                            {c.difficulty}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-slate-400 mt-0.5">
                          {c.region} · HAZARDS ×{c.hazardFrequency.toFixed(2)}
                        </div>
                        <p className="text-xs text-slate-300 mt-1 line-clamp-1">
                          {c.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Footer Action Row */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
            <button
              type="button"
              onClick={onStartGame}
              className="w-full min-h-[48px] py-3 px-6 bg-[#FF5500] hover:bg-[#EA580C] text-white font-display font-extrabold text-xl tracking-wider rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              RIDE {selectedBike.name} ON {selectedCourse.name}
            </button>
            <button
              type="button"
              onClick={onReturnToTitle}
              className="w-full sm:w-auto min-h-[48px] py-3 px-5 bg-[#141821] hover:bg-slate-800 border border-white/15 text-slate-300 font-display font-bold text-lg tracking-wider rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              TITLE SCREEN
            </button>
          </div>
        </div>

        {/* Bottom Device Mode Bar */}
        <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-300 bg-[#0B0D11]/90 border border-white/10 rounded-lg px-4 py-2 max-w-2xl">
          <span>DEVICE VERSION:</span>
          <div className="flex items-center gap-1">
            {(['AUTO', 'MOBILE', 'TABLET', 'DESKTOP'] as DeviceMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onSelectDeviceMode(m)}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
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
    );
  }

  // TITLE_MENU (Adapts cleanly across Mobile, Tablet & Desktop)
  if (gameState === 'TITLE_MENU') {
    return (
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3.5 sm:p-6 md:p-10 bg-gradient-to-r from-[#0B0D11]/92 via-[#0B0D11]/60 to-transparent overflow-y-auto">
        {/* Top Row: Bespoke SVG Title Lockup & Device/Audio Toggles */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="pointer-events-auto max-w-xl">
            <svg
              width="380"
              height="86"
              viewBox="0 0 380 86"
              className="w-full max-w-[290px] sm:max-w-[380px] h-auto overflow-visible"
              role="img"
              aria-label="Twelve O'Clock Dirtbike Wheelie"
            >
              <g transform="translate(8, 12)">
                <path
                  d="M 0 54 A 46 46 0 0 1 64 10"
                  fill="none"
                  stroke="#334155"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                <path
                  d="M 38 11 A 46 46 0 0 1 64 26"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="6"
                />
                <line
                  x1="32"
                  y1="54"
                  x2="54"
                  y2="8"
                  stroke="#FF5500"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <circle cx="32" cy="54" r="9" fill="#0B0D11" stroke="#F8FAFC" strokeWidth="3.5" />
                <circle cx="54" cy="8" r="7" fill="#0B0D11" stroke="#FF5500" strokeWidth="3" />
              </g>

              <text
                x="84"
                y="46"
                fill="#FFFFFF"
                fontFamily="Barlow Condensed, sans-serif"
                fontWeight="800"
                fontStyle="italic"
                fontSize="48"
                letterSpacing="1"
              >
                TWELVE O’CLOCK
              </text>
              <text
                x="86"
                y="69"
                fill="#FF5500"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="700"
                fontSize="13"
                letterSpacing="2.5"
              >
                DIRTBIKE BALANCE &amp; STUNT SIMULATOR
              </text>
            </svg>

            {!isCompactMobile && (
              <p className="mt-1.5 text-xs sm:text-sm text-slate-300 max-w-md leading-relaxed">
                Hold the clutch to rev-bomb into the {selectedBike.balanceSweetSpotMin}°–
                {selectedBike.balanceSweetSpotMax}° balance window, chase 1st through 6th gear mid-wheelie, and feather the rear brake to prevent looping out.
              </p>
            )}
          </div>

          {/* Right Perimeter: Device Mode Switcher, High Score & Mute Toggle */}
          <div className="pointer-events-auto flex flex-col items-end gap-2">
            <div className="flex items-center gap-3 bg-[#0B0D11]/90 border border-white/10 rounded-lg px-3.5 py-2">
              <div className="text-right font-mono tabular-nums">
                <div className="text-[10px] text-slate-400">PERSONAL RECORD</div>
                <div className="text-xs sm:text-sm font-bold text-white">
                  {telemetry.bestScore.toLocaleString()} PTS · {telemetry.bestWheelieDistanceM}M
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleMute}
                className="min-h-[38px] px-3 py-1.5 bg-[#181C26] hover:bg-slate-800 border border-white/10 rounded text-xs font-mono font-bold text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isMuted ? 'SOUND: OFF' : 'SOUND: ON'}
              </button>
            </div>

            {/* Interactive Mobile / Tablet / Desktop Version Switcher */}
            <div className="flex items-center gap-1 bg-[#0B0D11]/92 border border-white/15 rounded-lg p-1 text-[11px] font-mono">
              <span className="text-slate-400 px-2 hidden sm:inline">VERSION:</span>
              {(['AUTO', 'MOBILE', 'TABLET', 'DESKTOP'] as DeviceMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onSelectDeviceMode(m)}
                  className={`min-h-[32px] px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    deviceMode === m
                      ? 'bg-[#FF5500] text-white font-bold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Left-Aligned Configuration Panel */}
        <div className="pointer-events-auto w-full max-w-xl bg-[#0B0D11]/92 border border-white/12 rounded-xl p-4 sm:p-5 space-y-3.5 my-2">
          {/* Quick Bike Selector */}
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-xs font-mono font-bold text-slate-300">
                01. MACHINE ({BIKES.length} BIKES)
              </span>
              <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                {selectedBike.displacement} · {selectedBike.strokeType}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-1 bg-[#141821] rounded-lg border border-white/5">
              {BIKES.map((b) => {
                const active = b.id === selectedBike.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onSelectBike(b)}
                    className={`min-h-[44px] px-2.5 py-1.5 rounded-md text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#1F2533] text-white border border-white/15'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-display font-bold text-sm tracking-wide whitespace-nowrap truncate">
                        {b.name}
                      </span>
                      <span
                        className="w-2 h-2 rounded-xs shrink-0"
                        style={{ backgroundColor: b.primaryColor }}
                      />
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 tabular-nums whitespace-nowrap">
                      {b.displacement} · {b.strokeType}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Course Selector */}
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-xs font-mono font-bold text-slate-300">
                02. MAP ({COURSES.length} COURSES)
              </span>
              <span className="text-[11px] font-mono text-slate-400 truncate max-w-[180px]">
                {selectedCourse.region}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-1 bg-[#141821] rounded-lg border border-white/5">
              {COURSES.map((c) => {
                const active = c.id === selectedCourse.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelectCourse(c)}
                    className={`min-h-[44px] px-2.5 py-1.5 rounded-md text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#1F2533] text-white border border-white/15'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-display font-bold text-sm tracking-wide whitespace-nowrap truncate">
                      {c.name}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                      {c.difficulty}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Primary Start & Full Garage Menu Buttons */}
          <div className="pt-1 flex flex-col sm:flex-row items-center gap-2.5">
            <button
              type="button"
              onClick={onStartGame}
              className="w-full min-h-[48px] py-3 px-6 bg-[#FF5500] hover:bg-[#EA580C] active:bg-[#C2410C] text-white font-display font-extrabold text-xl tracking-wider rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              START RUN ({resolvedDevice} MODE)
            </button>
            <button
              type="button"
              onClick={onOpenGarage}
              className="w-full sm:w-auto min-h-[48px] py-3 px-5 bg-[#181C26] hover:bg-slate-800 border border-white/15 text-white font-display font-bold text-lg tracking-wider rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              BIKES &amp; MAPS MENU
            </button>
          </div>
        </div>

        {/* Single Flat Control-Hint Line */}
        <div className="pointer-events-auto flex items-center justify-between text-[11px] sm:text-xs font-mono text-slate-300 bg-[#0B0D11]/90 border border-white/10 rounded-lg px-4 py-2 max-w-xl whitespace-nowrap overflow-x-auto">
          {resolvedDevice === 'DESKTOP' ? (
            <>
              <span>W/↑ Throttle</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>S/↓ Rear Brake</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>C/Shift Clutch</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>Q/E Gearshift</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>Space Stunts</span>
            </>
          ) : (
            <>
              <span>Left Thumb: Rear Brake · Hold Clutch · Lean</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>Right Thumb: Throttle · Gear ± · Stunts</span>
            </>
          )}
        </div>
      </div>
    );
  }

  // PAUSED or GAME_OVER Modal
  const isGameOver = gameState === 'GAME_OVER';

  return (
    <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6 bg-[#0B0D11]/85 overflow-y-auto">
      <div className="w-full max-w-lg bg-[#11151E] border border-white/15 rounded-xl p-5 sm:p-7 space-y-5">
        <div className="border-b border-white/10 pb-3.5 flex items-start justify-between gap-2">
          <div>
            <div className="text-xs font-mono font-bold text-[#FF5500]">
              {isGameOver ? 'RUN TERMINATED' : 'SIMULATION PAUSED'}
            </div>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl tracking-wide text-white mt-0.5">
              {isGameOver ? 'WIPEOUT SUMMARY' : 'PAUSED'}
            </h2>
            {isGameOver && telemetry.crashReason && (
              <p className="mt-1 text-xs font-mono text-[#FCA5A5]">
                {telemetry.crashReason}
              </p>
            )}
          </div>

          <span className="text-[11px] font-mono text-slate-400">
            {resolvedDevice} VIEW
          </span>
        </div>

        {/* Tabular Telemetry Readout Grid */}
        <div className="grid grid-cols-2 gap-3 font-mono tabular-nums">
          <div className="bg-[#0B0D11] border border-white/10 rounded-lg p-3">
            <div className="text-[11px] text-slate-400">RUN SCORE</div>
            <div className="text-xl sm:text-2xl font-bold text-white mt-0.5">
              {telemetry.score.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              BEST: {telemetry.bestScore.toLocaleString()}
            </div>
          </div>

          <div className="bg-[#0B0D11] border border-white/10 rounded-lg p-3">
            <div className="text-[11px] text-slate-400">LONGEST WHEELIE</div>
            <div className="text-xl sm:text-2xl font-bold text-[#10B981] mt-0.5">
              {telemetry.bestWheelieDistanceM}m
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              TOTAL RUN: {telemetry.totalDistanceM}m
            </div>
          </div>

          <div className="bg-[#0B0D11] border border-white/10 rounded-lg p-3">
            <div className="text-[11px] text-slate-400">12 O’CLOCK SCRAPES</div>
            <div className="text-lg sm:text-xl font-bold text-[#FBBF24] mt-0.5">
              {telemetry.scrapeCount} SCRAPES
            </div>
          </div>

          <div className="bg-[#0B0D11] border border-white/10 rounded-lg p-3">
            <div className="text-[11px] text-slate-400">STUNTS LANDED</div>
            <div className="text-lg sm:text-xl font-bold text-[#38BDF8] mt-0.5">
              {telemetry.tricksLanded} TRICKS
            </div>
          </div>
        </div>

        {/* Device Mode Switcher inside Pause/Wipeout Modal */}
        <div className="flex items-center justify-between bg-[#0B0D11] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono">
          <span className="text-slate-400">LAYOUT VERSION:</span>
          <div className="flex items-center gap-1">
            {(['AUTO', 'MOBILE', 'TABLET', 'DESKTOP'] as DeviceMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onSelectDeviceMode(m)}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
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

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
          {!isGameOver && (
            <button
              type="button"
              onClick={onResumeGame}
              className="w-full min-h-[48px] py-3 px-5 bg-[#FF5500] hover:bg-[#EA580C] text-white font-display font-bold text-lg tracking-wider rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              RESUME RUN
            </button>
          )}
          <button
            type="button"
            onClick={onStartGame}
            className={`w-full min-h-[48px] py-3 px-5 font-display font-bold text-lg tracking-wider rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              isGameOver
                ? 'bg-[#FF5500] hover:bg-[#EA580C] text-white'
                : 'bg-[#1E293B] hover:bg-slate-700 text-white'
            }`}
          >
            {isGameOver ? 'PLAY AGAIN' : 'RESTART RUN'}
          </button>
          <button
            type="button"
            onClick={onOpenGarage}
            className="w-full sm:w-auto min-h-[48px] py-3 px-5 bg-[#0B0D11] hover:bg-slate-900 border border-white/15 text-slate-200 font-display font-bold text-lg tracking-wider rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            BIKES &amp; MAPS
          </button>
        </div>
      </div>
    </div>
  );
};
