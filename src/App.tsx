import { useCallback, useRef, useState } from 'react';
import {
  BIKES,
  BikeConfig,
  COURSES,
  CourseConfig,
  GameState,
  TelemetrySnapshot,
} from './game/types';
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
  wheelieAngleDeg: 0,
  angularVelocityDeg: 0,
  inWheelie: false,
  inSweetSpot: false,
  isScraping: false,
  activeTrick: 'NONE',
  rearBrakeHeat: 0,
  activeHazard: 'NONE',
  upcomingHazard: null,
  callouts: [],
  crashReason: null,
  scrapeCount: 0,
  tricksLanded: 0,
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [selectedBike, setSelectedBike] = useState<BikeConfig>(BIKES[0]);
  const [selectedCourse, setSelectedCourse] = useState<CourseConfig>(COURSES[0]);
  const [runNonce, setRunNonce] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>(INITIAL_TELEMETRY);

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

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0B0D11] select-none">
      {/* Isolated 60fps Canvas Simulation */}
      <GameCanvas
        gameState={gameState}
        bike={selectedBike}
        course={selectedCourse}
        runNonce={runNonce}
        onTelemetry={setTelemetry}
        onStateChange={handleStateChange}
        onToggleMute={handleToggleMute}
        controlsRef={controlsRef}
      />

      {/* World-Matched Perimeter HUD during Active Play */}
      {gameState === 'PLAYING' && (
        <GameHUD
          telemetry={telemetry}
          bike={selectedBike}
          course={selectedCourse}
          isMuted={isMuted}
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
        isMuted={isMuted}
        onSelectBike={handleSelectBike}
        onSelectCourse={handleSelectCourse}
        onStartGame={handleStartGame}
        onResumeGame={handleResumeGame}
        onOpenGarage={handleOpenGarage}
        onReturnToTitle={handleReturnToTitle}
        onToggleMute={handleToggleMute}
      />
    </main>
  );
}
