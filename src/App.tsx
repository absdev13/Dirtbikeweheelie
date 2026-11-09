import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BIKES,
  BikeConfig,
  CameraViewMode,
  COURSES,
  CourseConfig,
  DeviceMode,
  GameState,
  ResolvedDevice,
  TelemetrySnapshot,
} from './game/types';
import {
  DailyChallengeItem,
  findMatchingEquipForChallenge,
  loadDailyChallengeState,
  RewardCosmeticId,
} from './game/dailyChallenges';
import { GameCanvas, TouchInputControls } from './components/GameCanvas';
import { GameHUD } from './components/GameHUD';
import { GameModals } from './components/GameModals';
import { bikeAudio } from './game/audio';

const INITIAL_TELEMETRY: TelemetrySnapshot = {
  score: 0,
  bestScore: 0,
  comboMultiplier: 1,
  currentWheelieScore: 0,
  wheelieDistanceM: 0,
  bestWheelieDistanceM: 0,
  totalDistanceM: 0,
  speedKmh: 0,
  rpm: 2800,
  maxRpm: 10500,
  gear: 1,
  maxGear: 6,
  transmissionMode: 'AUTO',
  clutchPulled: false,
  clutchCharge: 0,
  boostCharge: 0.65,
  boostActive: false,
  wheelieAngleDeg: 0,
  angularVelocityDeg: 0,
  lateralOffsetM: 0,
  rollAngleDeg: 0,
  inWheelie: false,
  inSweetSpot: false,
  isScraping: false,
  isCoasting: false,
  riderStance: 'NORMAL',
  activeTrick: 'NONE',
  rearBrakeHeat: 0,
  activeHazard: 'NONE',
  upcomingHazard: null,
  activeChallenge: {
    title: 'HOLD A 50M WHEELIE',
    progress: 0,
    target: 50,
    unit: 'M',
    rewardPts: 1500,
  },
  dailyState: loadDailyChallengeState(),
  riderLevel: 1,
  riderRankTitle: 'LOT ROOKIE',
  callouts: [],
  crashReason: null,
  scrapeCount: 0,
  tricksLanded: 0,
};

function detectViewportDevice(width: number): ResolvedDevice {
  if (width < 640) return 'MOBILE';
  if (width <= 1040) return 'TABLET';
  return 'DESKTOP';
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [selectedBike, setSelectedBike] = useState<BikeConfig>(BIKES[0]);
  const [selectedCourse, setSelectedCourse] = useState<CourseConfig>(COURSES[0]);
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('CHASE');
  const [runNonce, setRunNonce] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>(INITIAL_TELEMETRY);

  const [deviceMode, setDeviceMode] = useState<DeviceMode>('AUTO');
  const [windowWidth, setWindowWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const resolvedDevice: ResolvedDevice =
    deviceMode === 'AUTO' ? detectViewportDevice(windowWidth) : deviceMode;

  // Determine whether we are previewing Mobile or Tablet mode on a wide desktop screen
  const isSimulatedFrameOnDesktop =
    windowWidth > 1040 &&
    (deviceMode === 'MOBILE' || deviceMode === 'TABLET');

  const controlsRef = useRef<TouchInputControls | null>(null);

  const handleToggleMute = useCallback(() => {
    bikeAudio.init();
    const nextMuted = !bikeAudio.getMuted();
    bikeAudio.setMuted(nextMuted);
    setIsMuted(nextMuted);
  }, []);

  const handleStartGame = useCallback(() => {
    bikeAudio.init();
    setRunNonce((n) => n + 1);
    setGameState('PLAYING');
  }, []);

  const handleResumeGame = useCallback(() => {
    bikeAudio.init();
    setGameState('PLAYING');
  }, []);

  const handleOpenGarage = useCallback(() => {
    bikeAudio.init();
    setGameState('GARAGE_MENU');
  }, []);

  const handleReturnToTitle = useCallback(() => {
    setRunNonce((n) => n + 1);
    setGameState('TITLE_MENU');
  }, []);

  const handleStateChange = useCallback((nextState: GameState) => {
    if (nextState === 'PLAYING') {
      bikeAudio.init();
    }
    setGameState((prev) => {
      if (
        (prev === 'TITLE_MENU' || prev === 'GAME_OVER' || prev === 'GARAGE_MENU') &&
        nextState === 'PLAYING'
      ) {
        setRunNonce((n) => n + 1);
      }
      return nextState;
    });
  }, []);

  const handleSelectBike = useCallback((bike: BikeConfig) => {
    bikeAudio.init();
    bikeAudio.playTrickChime(2);
    setSelectedBike(bike);
  }, []);

  const handleSelectCourse = useCallback((course: CourseConfig) => {
    bikeAudio.init();
    bikeAudio.playTrickChime(1);
    setSelectedCourse(course);
  }, []);

  const handleSelectDeviceMode = useCallback((mode: DeviceMode) => {
    bikeAudio.init();
    bikeAudio.playTrickChime(1);
    setDeviceMode(mode);
  }, []);

  const handleEquipAndRideChallenge = useCallback(
    (challenge: DailyChallengeItem) => {
      bikeAudio.init();
      bikeAudio.playTrickChime(3);
      const matched = findMatchingEquipForChallenge(
        challenge,
        selectedBike,
        selectedCourse
      );
      setSelectedBike(matched.bike);
      setSelectedCourse(matched.course);
      setRunNonce((n) => n + 1);
      setGameState('PLAYING');
    },
    [selectedBike, selectedCourse]
  );

  const handleRerollDailyChallenges = useCallback(() => {
    controlsRef.current?.rerollDailyChallenges();
  }, []);

  const handleSelectDailyCosmetic = useCallback(
    (cosmeticId: RewardCosmeticId) => {
      controlsRef.current?.selectDailyCosmetic(cosmeticId);
    },
    []
  );

  // Frame container styling when previewing Mobile or Tablet version on a large screen
  const frameClass = isSimulatedFrameOnDesktop
    ? resolvedDevice === 'MOBILE'
      ? 'relative w-[430px] h-[92dvh] max-h-[890px] rounded-[28px] border-4 border-slate-700/80 shadow-2xl overflow-hidden bg-[#0B0D11]'
      : 'relative w-[980px] max-w-[95vw] h-[88dvh] max-h-[760px] rounded-[24px] border-4 border-slate-700/80 shadow-2xl overflow-hidden bg-[#0B0D11]'
    : 'relative w-screen h-dvh overflow-hidden bg-[#0B0D11]';

  return (
    <main className="relative w-screen h-dvh overflow-hidden bg-[#07090D] flex flex-col items-center justify-center select-none">
      {/* Top Preview Switcher Bar when simulating Mobile/Tablet on Desktop */}
      {isSimulatedFrameOnDesktop && (
        <div className="mb-2 flex items-center gap-3 bg-[#11151E] border border-white/10 rounded-lg px-4 py-1.5 text-xs font-mono text-slate-300">
          <span className="text-[#FF5500] font-bold">
            {resolvedDevice === 'MOBILE'
              ? 'MOBILE HANDHELD VERSION (430×890)'
              : 'TABLET PRO ARCADE VERSION (980×760)'}
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <div className="flex items-center gap-1">
            {(['AUTO', 'MOBILE', 'TABLET', 'DESKTOP'] as DeviceMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleSelectDeviceMode(m)}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
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
      )}

      {/* Active Game Viewport Shell */}
      <div className={frameClass}>
        {/* Isolated 3D WebGL Simulation */}
        <GameCanvas
          gameState={gameState}
          bike={selectedBike}
          course={selectedCourse}
          cameraMode={cameraMode}
          runNonce={runNonce}
          onTelemetry={setTelemetry}
          onStateChange={handleStateChange}
          onCameraModeChange={setCameraMode}
          onToggleMute={handleToggleMute}
          controlsRef={controlsRef}
        />

        {/* World-Matched Perimeter HUD during Active Play */}
        {gameState === 'PLAYING' && (
          <GameHUD
            telemetry={telemetry}
            bike={selectedBike}
            course={selectedCourse}
            cameraMode={cameraMode}
            deviceMode={deviceMode}
            resolvedDevice={resolvedDevice}
            isMuted={isMuted}
            onSelectDeviceMode={handleSelectDeviceMode}
            onToggleMute={handleToggleMute}
            onPause={() => setGameState('PAUSED')}
            onOpenGarage={handleOpenGarage}
            controlsRef={controlsRef}
          />
        )}

        {/* Title Screen, Bikes & Maps Garage Menu, Pause, and Game Over Overlays */}
        <GameModals
          gameState={gameState}
          selectedBike={selectedBike}
          selectedCourse={selectedCourse}
          telemetry={telemetry}
          deviceMode={deviceMode}
          resolvedDevice={resolvedDevice}
          isMuted={isMuted}
          onSelectDeviceMode={handleSelectDeviceMode}
          onSelectBike={handleSelectBike}
          onSelectCourse={handleSelectCourse}
          onStartGame={handleStartGame}
          onResumeGame={handleResumeGame}
          onOpenGarage={handleOpenGarage}
          onReturnToTitle={handleReturnToTitle}
          onToggleMute={handleToggleMute}
          onEquipAndRideChallenge={handleEquipAndRideChallenge}
          onRerollDailyChallenges={handleRerollDailyChallenges}
          onSelectDailyCosmetic={handleSelectDailyCosmetic}
        />
      </div>
    </main>
  );
}
