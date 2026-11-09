import React, { useEffect, useState } from 'react';
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
import {
  DailyChallengeItem,
  findMatchingEquipForChallenge,
  getTimeUntilNextDailyReset,
  RewardCosmeticId,
} from '../game/dailyChallenges';

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
  onEquipAndRideChallenge: (challenge: DailyChallengeItem) => void;
  onRerollDailyChallenges: () => void;
  onSelectDailyCosmetic: (cosmeticId: RewardCosmeticId) => void;
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
  onEquipAndRideChallenge,
  onRerollDailyChallenges,
  onSelectDailyCosmetic,
}) => {
  const [garageTab, setGarageTab] = useState<'BIKES' | 'MAPS' | 'DAILIES'>('BIKES');
  const [bikeCategoryFilter, setBikeCategoryFilter] = useState<
    'ALL' | 'SUPERMOTO' | 'DIRTBIKE'
  >('ALL');
  const [mapEnvFilter, setMapEnvFilter] = useState<'ALL' | 'STREET' | 'DIRT'>(
    'ALL'
  );
  const [resetCountdown, setResetCountdown] = useState<string>(() =>
    getTimeUntilNextDailyReset()
  );

  useEffect(() => {
    if (gameState === 'PLAYING') return;
    const id = window.setInterval(() => {
      setResetCountdown(getTimeUntilNextDailyReset());
    }, 1000);
    return () => window.clearInterval(id);
  }, [gameState]);

  if (gameState === 'PLAYING') return null;

  const isCompactMobile = resolvedDevice === 'MOBILE';
  const { dailyState } = telemetry;
  const completedCount = dailyState.challenges.filter((c) => c.completed).length;
  const rewardProgressPct = Math.round((completedCount / 3) * 100);

  const filteredBikes = BIKES.filter((b) =>
    bikeCategoryFilter === 'ALL' ? true : b.category === bikeCategoryFilter
  );

  const filteredCourses = COURSES.filter((c) =>
    mapEnvFilter === 'ALL' ? true : c.environmentType === mapEnvFilter
  );

  // Reusable Daily Challenges & Reward Tracker Component
  const renderDailyChallengesAndRewards = (compact: boolean = false) => (
    <div className="bg-[#12161F] border border-[#FBBF24]/30 rounded-xl p-3.5 sm:p-4 space-y-3 font-mono tabular-nums">
      {/* Header: Procedural Seed Date, Streak, Reset Timer & Bonus Reroll */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#FBBF24]">
              DAILY CHALLENGES · {dailyState.dateKey}
              {dailyState.seedOffset > 0 ? ` (BONUS SET #${dailyState.seedOffset + 1})` : ''}
            </span>
            <span className="px-2 py-0.5 bg-[#FBBF24]/15 border border-[#FBBF24]/40 rounded text-[10px] font-bold text-[#FBBF24]">
              {dailyState.streakDays}D STREAK
            </span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            PROCEDURAL OBJECTIVES · NEXT DAILY RESET IN {resetCountdown}
          </div>
        </div>

        <button
          type="button"
          onClick={onRerollDailyChallenges}
          className="px-2.5 py-1.5 bg-[#1A202E] hover:bg-[#252D40] border border-[#38BDF8]/40 rounded-lg text-[10px] font-mono font-bold text-[#38BDF8] transition-colors cursor-pointer whitespace-nowrap"
          title="Procedurally generate a fresh set of 3 bonus Daily Challenges"
        >
          NEW BONUS SET ↻
        </button>
      </div>

      {/* 3-Tier Daily Reward Tracker Bar */}
      <div className="bg-[#0B0D11] border border-white/10 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-white font-bold">
            DAILY REWARD TRACKER ({completedCount}/3 COMPLETED)
          </span>
          <span className="text-[#10B981] font-bold">
            ALL-TIME: {dailyState.completedTotalAllTime} CLEARED
          </span>
        </div>

        {/* Progress Track */}
        <div className="relative h-2.5 w-full bg-slate-800 rounded-sm overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#FF5500] via-[#FBBF24] to-[#10B981] transition-all duration-300"
            style={{ width: `${rewardProgressPct}%` }}
          />
        </div>

        {/* 3 Reward Crate Milestones + Cosmetic Equip Switcher */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          {dailyState.rewardTiers.map((tier) => {
            const isEquipped = dailyState.activeCosmetic === tier.cosmeticId;
            return (
              <div
                key={tier.tier}
                className={`p-2 rounded-lg border flex flex-col justify-between gap-1.5 ${
                  tier.unlocked
                    ? isEquipped
                      ? 'bg-[#17253B] border-[#38BDF8] text-white'
                      : 'bg-[#141C24] border-[#10B981]/50 text-slate-200'
                    : 'bg-[#0F131C] border-white/10 text-slate-400 opacity-80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className={tier.unlocked ? 'text-[#10B981]' : 'text-slate-400'}>
                      {tier.requiredCount}/3 · TIER {tier.tier}
                    </span>
                    <span className="text-[#FBBF24]">+{tier.xpBonus.toLocaleString()} XP</span>
                  </div>
                  <div className="text-[11px] font-bold text-white mt-0.5 truncate">
                    {tier.cosmeticName}
                  </div>
                </div>

                {tier.unlocked ? (
                  <button
                    type="button"
                    onClick={() =>
                      onSelectDailyCosmetic(isEquipped ? 'DEFAULT' : tier.cosmeticId)
                    }
                    className={`w-full py-1 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                      isEquipped
                        ? 'bg-[#38BDF8] text-slate-950'
                        : 'bg-[#1E293B] hover:bg-slate-700 text-white'
                    }`}
                  >
                    {isEquipped ? 'EQUIPPED ✓' : 'EQUIP COSMETIC'}
                  </button>
                ) : (
                  <div className="text-[10px] text-slate-500">
                    COMPLETE {tier.requiredCount} {tier.requiredCount === 1 ? 'DAILY' : 'DAILIES'} TO UNLOCK
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3 Procedurally Generated Daily Challenge Cards */}
      <div className="space-y-2">
        {dailyState.challenges.map((ch) => {
          const pct = Math.min(
            100,
            Math.round((ch.progress / Math.max(1, ch.target)) * 100)
          );
          const matched = findMatchingEquipForChallenge(
            ch,
            selectedBike,
            selectedCourse
          );
          const needsSwitch =
            matched.bike.id !== selectedBike.id ||
            matched.course.id !== selectedCourse.id;

          return (
            <div
              key={ch.id}
              className={`p-3 rounded-lg border transition-colors ${
                ch.completed
                  ? 'bg-[#0F241D] border-[#10B981]/60'
                  : 'bg-[#0B0D11] border-white/12'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        ch.completed
                          ? 'bg-[#10B981] text-slate-950'
                          : 'bg-[#FF5500]/20 text-[#FF5500]'
                      }`}
                    >
                      {ch.completed ? 'COMPLETED ✓' : `OBJ 0${ch.slotIndex + 1}`}
                    </span>
                    <span className="font-display font-bold text-base sm:text-lg text-white truncate">
                      {ch.title}
                    </span>
                  </div>
                  {!compact && (
                    <p className="text-[11px] text-slate-300 mt-0.5 font-sans">
                      {ch.subtitle}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-bold text-[#FBBF24]">
                      +{ch.rewardXp.toLocaleString()} XP
                    </div>
                    <div className="text-[10px] text-slate-300">
                      {ch.progress.toLocaleString()} / {ch.target.toLocaleString()} {ch.unit}
                    </div>
                  </div>

                  {!ch.completed && (
                    <button
                      type="button"
                      onClick={() => onEquipAndRideChallenge(ch)}
                      className="min-h-[34px] px-3 py-1 bg-[#FF5500] hover:bg-[#EA580C] text-white text-[10px] font-mono font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap"
                      title={
                        needsSwitch
                          ? `Auto-select ${matched.bike.name} on ${matched.course.name} and start run`
                          : 'Start run with current loadout'
                      }
                    >
                      {needsSwitch ? 'EQUIP & RIDE ►' : 'RIDE NOW ►'}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-2 h-1.5 w-full bg-slate-800 rounded-xs overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${
                    ch.completed ? 'bg-[#10B981]' : 'bg-[#FBBF24]'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Dedicated Bikes, Maps & Daily Challenges Menu (GARAGE_MENU)
  if (gameState === 'GARAGE_MENU') {
    const sweetSpotSpan =
      selectedBike.balanceSweetSpotMax - selectedBike.balanceSweetSpotMin;
    const torquePct = Math.min(100, Math.round((selectedBike.torqueMultiplier / 1.35) * 100));
    const brakePct = Math.min(100, Math.round((selectedBike.brakeAuthority / 1.38) * 100));
    const balancePct = Math.min(100, Math.round((sweetSpotSpan / 32) * 100));
    const speedPct = Math.min(100, Math.round((selectedBike.maxSpeedKmh / 170) * 100));

    return (
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 sm:p-5 md:p-8 bg-gradient-to-r from-[#0B0D11]/95 via-[#0B0D11]/85 to-transparent overflow-y-auto">
        {/* Header Bar */}
        <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 max-w-2xl bg-[#0B0D11]/95 border border-white/15 rounded-xl px-4 py-3">
          <div>
            <div className="text-[11px] font-mono font-bold text-[#FF5500]">
              SUPERMOTO &amp; DIRTBIKE PADDOCK
            </div>
            <h2 className="font-display font-extrabold text-2xl sm:text-3xl tracking-wide text-white">
              BIKES, MAPS &amp; DAILIES
            </h2>
          </div>

          {/* Primary Tab Switcher */}
          <div className="flex items-center gap-1 p-1 bg-[#141821] rounded-lg border border-white/10">
            <button
              type="button"
              onClick={() => setGarageTab('BIKES')}
              className={`min-h-[38px] px-3 py-1.5 rounded-md text-xs font-mono font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
              className={`min-h-[38px] px-3 py-1.5 rounded-md text-xs font-mono font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                garageTab === 'MAPS'
                  ? 'bg-[#FF5500] text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              MAPS ({COURSES.length})
            </button>
            <button
              type="button"
              onClick={() => setGarageTab('DAILIES')}
              className={`min-h-[38px] px-3 py-1.5 rounded-md text-xs font-mono font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                garageTab === 'DAILIES'
                  ? 'bg-[#FBBF24] text-slate-950'
                  : 'text-[#FBBF24] hover:text-white'
              }`}
            >
              DAILIES ({completedCount}/3)
            </button>
          </div>
        </div>

        {/* Main Selector Body */}
        <div className="pointer-events-auto w-full max-w-2xl bg-[#0B0D11]/95 border border-white/15 rounded-xl p-4 sm:p-5 space-y-4 my-auto max-h-[75vh] overflow-y-auto">
          {garageTab === 'DAILIES' ? (
            renderDailyChallengesAndRewards(false)
          ) : garageTab === 'BIKES' ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-mono font-bold text-slate-300">
                  SELECT SUPERMOTO OR DIRTBIKE
                </span>

                {/* Interactive Category Filter Tabs */}
                <div className="flex items-center gap-1 p-1 bg-[#141821] rounded-lg border border-white/10 text-[11px] font-mono">
                  {(
                    [
                      ['ALL', 'ALL (8)'],
                      ['SUPERMOTO', 'SUPERMOTOS (4)'],
                      ['DIRTBIKE', 'DIRTBIKES (4)'],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setBikeCategoryFilter(val)}
                      className={`px-2.5 py-1 rounded transition-colors cursor-pointer whitespace-nowrap ${
                        bikeCategoryFilter === val
                          ? 'bg-[#1F2533] text-white font-bold border border-white/15'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredBikes.map((b) => {
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
                        {b.category} · {b.displacement} · {b.strokeType} · {b.maxSpeedKmh} KM/H
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
                  <span className="truncate">
                    {selectedBike.name} ({selectedBike.category})
                  </span>
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-mono font-bold text-slate-300">
                  SELECT STREET MAP OR DIRT TRAIL
                </span>

                {/* Interactive Map Environment Filter Tabs */}
                <div className="flex items-center gap-1 p-1 bg-[#141821] rounded-lg border border-white/10 text-[11px] font-mono">
                  {(
                    [
                      ['ALL', 'ALL (8)'],
                      ['STREET', 'STREET MAPS (4)'],
                      ['DIRT', 'DIRT TRAILS (4)'],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setMapEnvFilter(val)}
                      className={`px-2.5 py-1 rounded transition-colors cursor-pointer whitespace-nowrap ${
                        mapEnvFilter === val
                          ? 'bg-[#1F2533] text-white font-bold border border-white/15'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {filteredCourses.map((c) => {
                  const active = c.id === selectedCourse.id;
                  const isStreetMap = c.environmentType === 'STREET';
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
                      {/* Mini SVG Map Swatch */}
                      <svg
                        width="76"
                        height="50"
                        viewBox="0 0 76 52"
                        className="rounded border border-white/15 shrink-0 overflow-hidden"
                      >
                        <rect width="76" height="52" fill={c.skyBottom} />
                        <circle cx="58" cy="14" r="8" fill={c.horizonGlow} opacity="0.85" />
                        {isStreetMap ? (
                          <>
                            <rect x="6" y="18" width="12" height="22" fill={c.mountainNear} />
                            <rect x="22" y="12" width="14" height="28" fill={c.mountainFar} />
                            <rect x="40" y="20" width="16" height="20" fill={c.mountainNear} />
                            <rect x="0" y="39" width="76" height="13" fill={c.groundSurface} />
                            <line
                              x1="4"
                              y1="45"
                              x2="72"
                              y2="45"
                              stroke="#FACC15"
                              strokeWidth="2"
                              strokeDasharray="8 6"
                            />
                          </>
                        ) : (
                          <>
                            <path
                              d="M 0 36 Q 22 24 44 34 T 76 28 L 76 52 L 0 52 Z"
                              fill={c.mountainNear}
                            />
                            <path
                              d="M 0 42 Q 38 35 76 41 L 76 52 L 0 52 Z"
                              fill={c.groundSurface}
                            />
                          </>
                        )}
                      </svg>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-display font-bold text-xl tracking-wide text-white truncate">
                            {c.name}
                          </span>
                          <span className="text-xs font-mono text-[#FBBF24] shrink-0">
                            {c.environmentType} · {c.difficulty}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-slate-400 mt-0.5">
                          {c.region} ·{' '}
                          {isStreetMap
                            ? 'CLEAN ASPHALT · NO OBSTACLES'
                            : `HAZARDS ×${c.hazardFrequency.toFixed(2)}`}
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

  // TITLE_MENU
  if (gameState === 'TITLE_MENU') {
    return (
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3.5 sm:p-6 md:p-8 bg-gradient-to-r from-[#0B0D11]/92 via-[#0B0D11]/60 to-transparent overflow-y-auto">
        {/* Top Row: Bespoke SVG Title Lockup & Device/Audio Toggles */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="pointer-events-auto max-w-xl">
            <svg
              width="380"
              height="86"
              viewBox="0 0 380 86"
              className="w-full max-w-[290px] sm:max-w-[380px] h-auto overflow-visible"
              role="img"
              aria-label="Twelve O'Clock Supermoto & Dirtbike Wheelie"
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
                letterSpacing="2.2"
              >
                SUPERMOTO &amp; DIRTBIKE WHEELIE SIMULATOR
              </text>
            </svg>

            {!isCompactMobile && (
              <p className="mt-1 text-xs sm:text-sm text-slate-300 max-w-md leading-relaxed">
                Rip 17-inch street Supermotos or knobby Dirtbikes across city boulevards and desert trails. Complete procedural Daily Challenges to unlock 3D stunt cosmetics.
              </p>
            )}
          </div>

          {/* Right Perimeter: Device Mode Switcher, Rider Rank, High Score & Mute Toggle */}
          <div className="pointer-events-auto flex flex-col items-end gap-2">
            <div className="flex items-center gap-3 bg-[#0B0D11]/90 border border-white/10 rounded-lg px-3.5 py-2">
              <div className="text-right font-mono tabular-nums">
                <div className="text-[10px] text-[#FF5500] font-bold">
                  LVL {telemetry.riderLevel} · {telemetry.riderRankTitle}
                </div>
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

        {/* Main 2-Column Content on Desktop / Stacked on Mobile: Loadout + Daily Challenges */}
        <div className="pointer-events-auto grid grid-cols-1 lg:grid-cols-12 gap-4 my-2 items-start max-w-6xl">
          {/* Left Column: Machine & Map Loadout */}
          <div className="lg:col-span-6 bg-[#0B0D11]/92 border border-white/12 rounded-xl p-4 sm:p-5 space-y-3.5">
            {/* Quick Bike Selector */}
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-xs font-mono font-bold text-slate-300">
                  01. MACHINE (4 SUPERMOTOS · 4 DIRTBIKES)
                </span>
                <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                  {selectedBike.category} · {selectedBike.displacement}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-[#141821] rounded-lg border border-white/5 max-h-[124px] overflow-y-auto">
                {BIKES.map((b) => {
                  const active = b.id === selectedBike.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => onSelectBike(b)}
                      className={`min-h-[42px] px-2.5 py-1.5 rounded-md text-left transition-colors cursor-pointer ${
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
                        {b.category === 'SUPERMOTO' ? 'SUMO' : 'DIRT'} · {b.displacement}
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
                  02. MAP (4 STREET MAPS · 4 DIRT TRAILS)
                </span>
                <span className="text-[11px] font-mono text-slate-400 truncate max-w-[180px]">
                  {selectedCourse.environmentType} · {selectedCourse.region}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-[#141821] rounded-lg border border-white/5 max-h-[124px] overflow-y-auto">
                {COURSES.map((c) => {
                  const active = c.id === selectedCourse.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onSelectCourse(c)}
                      className={`min-h-[42px] px-2.5 py-1.5 rounded-md text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#1F2533] text-white border border-white/15'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="font-display font-bold text-sm tracking-wide whitespace-nowrap truncate">
                        {c.name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                        {c.environmentType} · {c.difficulty}
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
                3D GARAGE &amp; MAPS
              </button>
            </div>
          </div>

          {/* Right Column: Procedural Daily Challenges & Reward Tracker */}
          <div className="lg:col-span-6">
            {renderDailyChallengesAndRewards(true)}
          </div>
        </div>

        {/* Single Flat Control-Hint Line */}
        <div className="pointer-events-auto flex items-center justify-between text-[11px] sm:text-xs font-mono text-slate-300 bg-[#0B0D11]/90 border border-white/10 rounded-lg px-4 py-2 max-w-2xl whitespace-nowrap overflow-x-auto gap-2">
          {resolvedDevice === 'DESKTOP' ? (
            <>
              <span>1-4 / G Foot on Seat</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>W/S Throttle/Brake</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>Z/X 3D Carve</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>C Clutch/Coast</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>SPACE Flair Trick</span>
            </>
          ) : (
            <>
              <span>Set Foot/Knee on Seat first · Then Throttle or Pop to Wheelie!</span>
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
      <div className="w-full max-w-2xl bg-[#11151E] border border-white/15 rounded-xl p-5 sm:p-6 space-y-4 my-auto max-h-[92vh] overflow-y-auto">
        <div className="border-b border-white/10 pb-3 flex items-start justify-between gap-2">
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono tabular-nums">
          <div className="bg-[#0B0D11] border border-white/10 rounded-lg p-3">
            <div className="text-[10px] text-slate-400">RUN SCORE</div>
            <div className="text-xl font-bold text-white mt-0.5">
              {telemetry.score.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              BEST: {telemetry.bestScore.toLocaleString()}
            </div>
          </div>

          <div className="bg-[#0B0D11] border border-white/10 rounded-lg p-3">
            <div className="text-[10px] text-slate-400">LONGEST WHEELIE</div>
            <div className="text-xl font-bold text-[#10B981] mt-0.5">
              {telemetry.bestWheelieDistanceM}m
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              RUN: {telemetry.totalDistanceM}m
            </div>
          </div>

          <div className="bg-[#0B0D11] border border-white/10 rounded-lg p-3">
            <div className="text-[10px] text-slate-400">12 O’CLOCK SCRAPES</div>
            <div className="text-xl font-bold text-[#FBBF24] mt-0.5">
              {telemetry.scrapeCount}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">TITANIUM SPARKS</div>
          </div>

          <div className="bg-[#0B0D11] border border-white/10 rounded-lg p-3">
            <div className="text-[10px] text-slate-400">STUNTS LANDED</div>
            <div className="text-xl font-bold text-[#38BDF8] mt-0.5">
              {telemetry.tricksLanded}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">COMBO TRICKS</div>
          </div>
        </div>

        {/* Daily Challenges & Reward Tracker Progress inside Pause / Game Over */}
        {renderDailyChallengesAndRewards(true)}

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
