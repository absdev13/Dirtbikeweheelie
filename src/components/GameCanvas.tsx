import React, { useEffect, useRef } from 'react';
import {
  BikeConfig,
  CourseConfig,
  GameState,
  TelemetrySnapshot,
} from '../game/types';
import { InputState, WheelieSimulation } from '../game/simulation';
import { WheelieRenderer } from '../game/renderer';
import { bikeAudio } from '../game/audio';

export interface TouchInputControls {
  setThrottle: (val: boolean) => void;
  setBrake: (val: boolean) => void;
  setLeanBack: (val: boolean) => void;
  setLeanForward: (val: boolean) => void;
  setClutch: (val: boolean) => void;
  shiftUp: () => void;
  shiftDown: () => void;
  toggleTransmission: () => void;
  triggerStunt: () => void;
}

interface GameCanvasProps {
  gameState: GameState;
  bike: BikeConfig;
  course: CourseConfig;
  runNonce: number;
  onTelemetry: (snapshot: TelemetrySnapshot) => void;
  onStateChange: (nextState: GameState) => void;
  onToggleMute: () => void;
  controlsRef: React.MutableRefObject<TouchInputControls | null>;
}

export const GameCanvas: React.FC<GameCanvasProps> = React.memo(
  ({
    gameState,
    bike,
    course,
    runNonce,
    onTelemetry,
    onStateChange,
    onToggleMute,
    controlsRef,
  }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const simRef = useRef<WheelieSimulation | null>(null);
    const rendererRef = useRef<WheelieRenderer | null>(null);
    const gameStateRef = useRef<GameState>(gameState);

    // Held keys and edge-triggered flags
    const inputRef = useRef<InputState>({
      throttle: false,
      brake: false,
      leanBack: false,
      leanForward: false,
      clutchHeld: false,
      justReleasedClutch: false,
      justPressedShiftUp: false,
      justPressedShiftDown: false,
      stuntHeld: false,
      justPressedStunt: false,
      justPressedTrick1: false,
      justPressedTrick2: false,
      justPressedTrick3: false,
    });

    const touchStateRef = useRef({
      throttle: false,
      brake: false,
      leanBack: false,
      leanForward: false,
      clutchHeld: false,
    });

    // Expose direct imperative touch/mouse controls
    useEffect(() => {
      controlsRef.current = {
        setThrottle: (val: boolean) => {
          bikeAudio.init();
          touchStateRef.current.throttle = val;
        },
        setBrake: (val: boolean) => {
          bikeAudio.init();
          touchStateRef.current.brake = val;
        },
        setLeanBack: (val: boolean) => {
          touchStateRef.current.leanBack = val;
        },
        setLeanForward: (val: boolean) => {
          touchStateRef.current.leanForward = val;
        },
        setClutch: (val: boolean) => {
          bikeAudio.init();
          if (touchStateRef.current.clutchHeld && !val) {
            inputRef.current.justReleasedClutch = true;
          }
          touchStateRef.current.clutchHeld = val;
        },
        shiftUp: () => {
          bikeAudio.init();
          inputRef.current.justPressedShiftUp = true;
        },
        shiftDown: () => {
          bikeAudio.init();
          inputRef.current.justPressedShiftDown = true;
        },
        toggleTransmission: () => {
          bikeAudio.init();
          if (simRef.current) {
            simRef.current.toggleTransmissionMode();
            onTelemetry(simRef.current.getTelemetry());
          }
        },
        triggerStunt: () => {
          bikeAudio.init();
          inputRef.current.justPressedStunt = true;
        },
      };
    }, [controlsRef, onTelemetry]);

    // Sync gameStateRef
    useEffect(() => {
      gameStateRef.current = gameState;
      if (simRef.current) {
        simRef.current.gameState = gameState;
      }
      if (gameState !== 'PLAYING') {
        bikeAudio.updateEngine(0, 10500, 0, true, false, false);
      }
    }, [gameState]);

    // Sync bike/course or reset run when runNonce increments
    useEffect(() => {
      if (!simRef.current) {
        simRef.current = new WheelieSimulation(bike, course);
        rendererRef.current = new WheelieRenderer();
      } else {
        simRef.current.setBikeAndCourse(bike, course);
        simRef.current.gameState = gameStateRef.current;
      }
      onTelemetry(simRef.current.getTelemetry());
    }, [bike, course, runNonce, onTelemetry]);

    // Keyboard & Window Blur Listeners
    useEffect(() => {
      const clearAllHeld = () => {
        inputRef.current.throttle = false;
        inputRef.current.brake = false;
        inputRef.current.leanBack = false;
        inputRef.current.leanForward = false;
        inputRef.current.clutchHeld = false;
        inputRef.current.stuntHeld = false;
        touchStateRef.current.throttle = false;
        touchStateRef.current.brake = false;
        touchStateRef.current.leanBack = false;
        touchStateRef.current.leanForward = false;
        touchStateRef.current.clutchHeld = false;
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        bikeAudio.init();
        const code = e.code;

        if (code === 'KeyM') {
          e.preventDefault();
          onToggleMute();
          return;
        }

        if (code === 'KeyB' || code === 'Tab') {
          e.preventDefault();
          if (gameStateRef.current === 'GARAGE_MENU') {
            onStateChange('PLAYING');
          } else {
            onStateChange('GARAGE_MENU');
          }
          return;
        }

        if (code === 'Escape') {
          e.preventDefault();
          if (gameStateRef.current === 'PLAYING') {
            onStateChange('PAUSED');
          } else if (
            gameStateRef.current === 'PAUSED' ||
            gameStateRef.current === 'GARAGE_MENU'
          ) {
            onStateChange('PLAYING');
          }
          return;
        }

        if (code === 'Enter' || code === 'Space') {
          if (
            gameStateRef.current === 'TITLE_MENU' ||
            gameStateRef.current === 'GAME_OVER'
          ) {
            e.preventDefault();
            onStateChange('PLAYING');
            return;
          }
        }

        if (gameStateRef.current !== 'PLAYING') return;

        if (code === 'KeyW' || code === 'ArrowUp') {
          e.preventDefault();
          inputRef.current.throttle = true;
        } else if (code === 'KeyS' || code === 'ArrowDown') {
          e.preventDefault();
          inputRef.current.brake = true;
        } else if (code === 'KeyA' || code === 'ArrowLeft') {
          e.preventDefault();
          inputRef.current.leanBack = true;
        } else if (code === 'KeyD' || code === 'ArrowRight') {
          e.preventDefault();
          inputRef.current.leanForward = true;
        } else if (code === 'KeyC' || code === 'ShiftLeft' || code === 'ShiftRight') {
          e.preventDefault();
          inputRef.current.clutchHeld = true;
        } else if (code === 'KeyE') {
          e.preventDefault();
          if (!e.repeat) {
            inputRef.current.justPressedShiftUp = true;
          }
        } else if (code === 'KeyQ') {
          e.preventDefault();
          if (!e.repeat) {
            inputRef.current.justPressedShiftDown = true;
          }
        } else if (code === 'Space') {
          e.preventDefault();
          if (!inputRef.current.stuntHeld) {
            inputRef.current.justPressedStunt = true;
          }
          inputRef.current.stuntHeld = true;
        } else if (code === 'Digit1') {
          inputRef.current.justPressedTrick1 = true;
        } else if (code === 'Digit2') {
          inputRef.current.justPressedTrick2 = true;
        } else if (code === 'Digit3') {
          inputRef.current.justPressedTrick3 = true;
        }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        const code = e.code;
        if (code === 'KeyW' || code === 'ArrowUp') {
          inputRef.current.throttle = false;
        } else if (code === 'KeyS' || code === 'ArrowDown') {
          inputRef.current.brake = false;
        } else if (code === 'KeyA' || code === 'ArrowLeft') {
          inputRef.current.leanBack = false;
        } else if (code === 'KeyD' || code === 'ArrowRight') {
          inputRef.current.leanForward = false;
        } else if (code === 'KeyC' || code === 'ShiftLeft' || code === 'ShiftRight') {
          if (inputRef.current.clutchHeld) {
            inputRef.current.justReleasedClutch = true;
          }
          inputRef.current.clutchHeld = false;
        } else if (code === 'Space') {
          inputRef.current.stuntHeld = false;
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      window.addEventListener('blur', clearAllHeld);

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        window.removeEventListener('blur', clearAllHeld);
      };
    }, [onStateChange, onToggleMute]);

    // Main 60fps RAF Simulation & Render Loop
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let animationFrameId: number;
      let lastTime = performance.now();
      let lastTelemetryTime = lastTime;

      const handleResize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(window.innerWidth * dpr);
        canvas.height = Math.floor(window.innerHeight * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };

      handleResize();
      window.addEventListener('resize', handleResize);

      const loop = (now: number) => {
        const rawDt = (now - lastTime) / 1000;
        lastTime = now;

        const sim = simRef.current;
        const renderer = rendererRef.current;

        if (sim && renderer) {
          // Step simulation when in TITLE_MENU / GARAGE_MENU (live showcase) or PLAYING
          if (
            gameStateRef.current === 'TITLE_MENU' ||
            gameStateRef.current === 'GARAGE_MENU' ||
            gameStateRef.current === 'PLAYING'
          ) {
            const combinedInput: InputState = {
              throttle:
                inputRef.current.throttle || touchStateRef.current.throttle,
              brake: inputRef.current.brake || touchStateRef.current.brake,
              leanBack:
                inputRef.current.leanBack || touchStateRef.current.leanBack,
              leanForward:
                inputRef.current.leanForward ||
                touchStateRef.current.leanForward,
              clutchHeld:
                inputRef.current.clutchHeld || touchStateRef.current.clutchHeld,
              justReleasedClutch: inputRef.current.justReleasedClutch,
              justPressedShiftUp: inputRef.current.justPressedShiftUp,
              justPressedShiftDown: inputRef.current.justPressedShiftDown,
              stuntHeld: inputRef.current.stuntHeld,
              justPressedStunt: inputRef.current.justPressedStunt,
              justPressedTrick1: inputRef.current.justPressedTrick1,
              justPressedTrick2: inputRef.current.justPressedTrick2,
              justPressedTrick3: inputRef.current.justPressedTrick3,
            };

            // Clear edge-triggered flags immediately after reading
            inputRef.current.justReleasedClutch = false;
            inputRef.current.justPressedShiftUp = false;
            inputRef.current.justPressedShiftDown = false;
            inputRef.current.justPressedStunt = false;
            inputRef.current.justPressedTrick1 = false;
            inputRef.current.justPressedTrick2 = false;
            inputRef.current.justPressedTrick3 = false;

            sim.step(rawDt, combinedInput);

            // Transition to GAME_OVER after crash ragdoll settles
            if (
              gameStateRef.current === 'PLAYING' &&
              sim.isCrashed &&
              sim.crashTimer > 1.15
            ) {
              onTelemetry(sim.getTelemetry());
              onStateChange('GAME_OVER');
            }
          }

          renderer.render(ctx, sim, window.innerWidth, window.innerHeight);

          // Throttle React HUD telemetry state updates to ~20Hz
          if (now - lastTelemetryTime >= 50) {
            lastTelemetryTime = now;
            onTelemetry(sim.getTelemetry());
          }
        }

        animationFrameId = requestAnimationFrame(loop);
      };

      animationFrameId = requestAnimationFrame(loop);

      return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', handleResize);
      };
    }, [onTelemetry, onStateChange]);

    return (
      <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-[#0B0D11]">
        <canvas
          ref={canvasRef}
          className="block w-full h-full"
        />
      </div>
    );
  }
);
