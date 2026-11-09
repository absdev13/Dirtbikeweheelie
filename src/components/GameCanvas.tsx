import React, { useEffect, useRef } from 'react';
import {
  BikeConfig,
  CameraViewMode,
  CourseConfig,
  GameState,
  RiderStance,
  TelemetrySnapshot,
} from '../game/types';
import { InputState, WheelieSimulation } from '../game/simulation';
import { RewardCosmeticId } from '../game/dailyChallenges';
import { isSoftwareGl, WheelieRenderer3D } from '../game/renderer3d';
import { bikeAudio } from '../game/audio';

export interface TouchInputControls {
  setThrottle: (val: boolean) => void;
  setBrake: (val: boolean) => void;
  setLeanBack: (val: boolean) => void;
  setLeanForward: (val: boolean) => void;
  setSteerLeft: (val: boolean) => void;
  setSteerRight: (val: boolean) => void;
  setClutch: (val: boolean) => void;
  setBoost: (val: boolean) => void;
  shiftUp: () => void;
  shiftDown: () => void;
  toggleTransmission: () => void;
  triggerStunt: () => void;
  cycleStance: () => void;
  setStance: (stance: RiderStance) => void;
  triggerSpecificTrick: (index: 1 | 2 | 3 | 4) => void;
  cycleCamera: () => void;
  rerollDailyChallenges: () => void;
  selectDailyCosmetic: (cosmeticId: RewardCosmeticId) => void;
}

interface GameCanvasProps {
  gameState: GameState;
  bike: BikeConfig;
  course: CourseConfig;
  cameraMode: CameraViewMode;
  runNonce: number;
  onTelemetry: (snapshot: TelemetrySnapshot) => void;
  onStateChange: (nextState: GameState) => void;
  onCameraModeChange: (nextMode: CameraViewMode) => void;
  onToggleMute: () => void;
  controlsRef: React.MutableRefObject<TouchInputControls | null>;
}

export const GameCanvas: React.FC<GameCanvasProps> = React.memo(
  ({
    gameState,
    bike,
    course,
    cameraMode,
    runNonce,
    onTelemetry,
    onStateChange,
    onCameraModeChange,
    onToggleMute,
    controlsRef,
  }) => {
    const canvasMountRef = useRef<HTMLDivElement | null>(null);
    const simRef = useRef<WheelieSimulation | null>(null);
    const renderer3dRef = useRef<WheelieRenderer3D | null>(null);
    const gameStateRef = useRef<GameState>(gameState);
    const onTelemetryRef = useRef(onTelemetry);
    const onStateChangeRef = useRef(onStateChange);
    const onCameraModeChangeRef = useRef(onCameraModeChange);

    useEffect(() => {
      onTelemetryRef.current = onTelemetry;
      onStateChangeRef.current = onStateChange;
      onCameraModeChangeRef.current = onCameraModeChange;
    }, [onTelemetry, onStateChange, onCameraModeChange]);

    // Held keys and edge-triggered flags
    const inputRef = useRef<InputState>({
      throttle: false,
      brake: false,
      leanBack: false,
      leanForward: false,
      steerLeft: false,
      steerRight: false,
      clutchHeld: false,
      justReleasedClutch: false,
      boostHeld: false,
      justPressedShiftUp: false,
      justPressedShiftDown: false,
      stuntHeld: false,
      justPressedStunt: false,
      justPressedStanceCycle: false,
      justPressedTrick1: false,
      justPressedTrick2: false,
      justPressedTrick3: false,
      justPressedTrick4: false,
    });

    const touchStateRef = useRef({
      throttle: false,
      brake: false,
      leanBack: false,
      leanForward: false,
      steerLeft: false,
      steerRight: false,
      clutchHeld: false,
      boostHeld: false,
    });

    // Sync cameraMode to 3D renderer
    useEffect(() => {
      if (renderer3dRef.current) {
        renderer3dRef.current.setCameraMode(cameraMode);
      }
    }, [cameraMode]);

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
        setSteerLeft: (val: boolean) => {
          touchStateRef.current.steerLeft = val;
        },
        setSteerRight: (val: boolean) => {
          touchStateRef.current.steerRight = val;
        },
        setClutch: (val: boolean) => {
          bikeAudio.init();
          if (touchStateRef.current.clutchHeld && !val) {
            inputRef.current.justReleasedClutch = true;
          }
          touchStateRef.current.clutchHeld = val;
        },
        setBoost: (val: boolean) => {
          bikeAudio.init();
          touchStateRef.current.boostHeld = val;
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
            onTelemetryRef.current(simRef.current.getTelemetry());
          }
        },
        triggerStunt: () => {
          bikeAudio.init();
          inputRef.current.justPressedStunt = true;
        },
        cycleStance: () => {
          bikeAudio.init();
          inputRef.current.justPressedStanceCycle = true;
        },
        setStance: (stance: RiderStance) => {
          bikeAudio.init();
          if (simRef.current) {
            simRef.current.setRiderStance(stance);
            onTelemetryRef.current(simRef.current.getTelemetry());
          }
        },
        triggerSpecificTrick: (index: 1 | 2 | 3 | 4) => {
          bikeAudio.init();
          if (index === 1) inputRef.current.justPressedTrick1 = true;
          else if (index === 2) inputRef.current.justPressedTrick2 = true;
          else if (index === 3) inputRef.current.justPressedTrick3 = true;
          else if (index === 4) inputRef.current.justPressedTrick4 = true;
        },
        cycleCamera: () => {
          if (renderer3dRef.current) {
            const nextMode = renderer3dRef.current.cycleCameraMode();
            onCameraModeChangeRef.current(nextMode);
          }
        },
        rerollDailyChallenges: () => {
          bikeAudio.init();
          if (simRef.current) {
            simRef.current.rerollDailyChallenges();
            onTelemetryRef.current(simRef.current.getTelemetry());
          }
        },
        selectDailyCosmetic: (cosmeticId: RewardCosmeticId) => {
          bikeAudio.init();
          if (simRef.current) {
            simRef.current.setActiveCosmetic(cosmeticId);
            onTelemetryRef.current(simRef.current.getTelemetry());
          }
        },
      };
    }, [controlsRef]);

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
      } else {
        simRef.current.setBikeAndCourse(bike, course);
        simRef.current.gameState = gameStateRef.current;
      }
      onTelemetryRef.current(simRef.current.getTelemetry());
    }, [bike, course, runNonce]);

    // Keyboard & Window Blur Listeners
    useEffect(() => {
      const clearAllHeld = () => {
        inputRef.current.throttle = false;
        inputRef.current.brake = false;
        inputRef.current.leanBack = false;
        inputRef.current.leanForward = false;
        inputRef.current.steerLeft = false;
        inputRef.current.steerRight = false;
        inputRef.current.clutchHeld = false;
        inputRef.current.boostHeld = false;
        inputRef.current.stuntHeld = false;
        touchStateRef.current.throttle = false;
        touchStateRef.current.brake = false;
        touchStateRef.current.leanBack = false;
        touchStateRef.current.leanForward = false;
        touchStateRef.current.steerLeft = false;
        touchStateRef.current.steerRight = false;
        touchStateRef.current.clutchHeld = false;
        touchStateRef.current.boostHeld = false;
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        bikeAudio.init();
        const code = e.code;

        if (code === 'KeyM') {
          e.preventDefault();
          onToggleMute();
          return;
        }

        if (code === 'KeyV') {
          e.preventDefault();
          if (renderer3dRef.current) {
            const nextMode = renderer3dRef.current.cycleCameraMode();
            onCameraModeChangeRef.current(nextMode);
          }
          return;
        }

        if (code === 'KeyB' || code === 'Tab') {
          e.preventDefault();
          if (gameStateRef.current === 'GARAGE_MENU') {
            onStateChangeRef.current('PLAYING');
          } else {
            onStateChangeRef.current('GARAGE_MENU');
          }
          return;
        }

        if (code === 'Escape') {
          e.preventDefault();
          if (gameStateRef.current === 'PLAYING') {
            onStateChangeRef.current('PAUSED');
          } else if (
            gameStateRef.current === 'PAUSED' ||
            gameStateRef.current === 'GARAGE_MENU'
          ) {
            onStateChangeRef.current('PLAYING');
          }
          return;
        }

        if (code === 'Enter' || code === 'Space') {
          if (
            gameStateRef.current === 'TITLE_MENU' ||
            gameStateRef.current === 'GAME_OVER'
          ) {
            e.preventDefault();
            onStateChangeRef.current('PLAYING');
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
        } else if (code === 'KeyZ') {
          e.preventDefault();
          inputRef.current.steerLeft = true;
        } else if (code === 'KeyX') {
          e.preventDefault();
          inputRef.current.steerRight = true;
        } else if (code === 'KeyC' || code === 'ShiftLeft' || code === 'ShiftRight') {
          e.preventDefault();
          inputRef.current.clutchHeld = true;
        } else if (code === 'KeyF') {
          e.preventDefault();
          inputRef.current.boostHeld = true;
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
        } else if (code === 'KeyG') {
          e.preventDefault();
          if (!e.repeat) {
            inputRef.current.justPressedStanceCycle = true;
          }
        } else if (code === 'Digit1') {
          if (!e.repeat) inputRef.current.justPressedTrick1 = true;
        } else if (code === 'Digit2') {
          if (!e.repeat) inputRef.current.justPressedTrick2 = true;
        } else if (code === 'Digit3') {
          if (!e.repeat) inputRef.current.justPressedTrick3 = true;
        } else if (code === 'Digit4') {
          if (!e.repeat) inputRef.current.justPressedTrick4 = true;
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
        } else if (code === 'KeyZ') {
          inputRef.current.steerLeft = false;
        } else if (code === 'KeyX') {
          inputRef.current.steerRight = false;
        } else if (code === 'KeyC' || code === 'ShiftLeft' || code === 'ShiftRight') {
          if (inputRef.current.clutchHeld) {
            inputRef.current.justReleasedClutch = true;
          }
          inputRef.current.clutchHeld = false;
        } else if (code === 'KeyF') {
          inputRef.current.boostHeld = false;
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
    }, [onToggleMute]);

    // Initialize 3D WebGLRenderer & Run Loop Once
    useEffect(() => {
      const container = canvasMountRef.current;
      if (!container) return;

      if (!simRef.current) {
        simRef.current = new WheelieSimulation(bike, course);
      }

      const renderer3d = new WheelieRenderer3D(container);
      renderer3d.setCameraMode(cameraMode);
      renderer3dRef.current = renderer3d;

      let frameId = 0;
      let isMounted = true;
      let lastTime = performance.now();
      let lastTelemetryTime = lastTime;
      let viewWidth = container.clientWidth || window.innerWidth;
      let viewHeight = container.clientHeight || window.innerHeight;

      const handleResize = () => {
        if (!container) return;
        viewWidth = container.clientWidth || window.innerWidth;
        viewHeight = container.clientHeight || window.innerHeight;
        renderer3d.setSize(viewWidth, viewHeight);
      };

      handleResize();
      const resizeObserver = new ResizeObserver(() => handleResize());
      resizeObserver.observe(container);
      window.addEventListener('resize', handleResize);

      const afterDraw = (cb: () => void) => {
        const gl = renderer3d.renderer.getContext() as WebGL2RenderingContext;
        if (!gl || typeof gl.fenceSync !== 'function') {
          frameId = window.setTimeout(cb, 80);
          return;
        }
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (!isMounted) return;
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      };

      const tick = () => {
        if (!isMounted) return;
        const now = performance.now();
        const rawDt = Math.min(0.05, (now - lastTime) / 1000);
        lastTime = now;

        const sim = simRef.current;
        if (sim) {
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
              steerLeft:
                inputRef.current.steerLeft || touchStateRef.current.steerLeft,
              steerRight:
                inputRef.current.steerRight || touchStateRef.current.steerRight,
              clutchHeld:
                inputRef.current.clutchHeld || touchStateRef.current.clutchHeld,
              justReleasedClutch: inputRef.current.justReleasedClutch,
              boostHeld:
                inputRef.current.boostHeld || touchStateRef.current.boostHeld,
              justPressedShiftUp: inputRef.current.justPressedShiftUp,
              justPressedShiftDown: inputRef.current.justPressedShiftDown,
              stuntHeld: inputRef.current.stuntHeld,
              justPressedStunt: inputRef.current.justPressedStunt,
              justPressedStanceCycle: inputRef.current.justPressedStanceCycle,
              justPressedTrick1: inputRef.current.justPressedTrick1,
              justPressedTrick2: inputRef.current.justPressedTrick2,
              justPressedTrick3: inputRef.current.justPressedTrick3,
              justPressedTrick4: inputRef.current.justPressedTrick4,
            };

            inputRef.current.justReleasedClutch = false;
            inputRef.current.justPressedShiftUp = false;
            inputRef.current.justPressedShiftDown = false;
            inputRef.current.justPressedStunt = false;
            inputRef.current.justPressedStanceCycle = false;
            inputRef.current.justPressedTrick1 = false;
            inputRef.current.justPressedTrick2 = false;
            inputRef.current.justPressedTrick3 = false;
            inputRef.current.justPressedTrick4 = false;

            sim.step(rawDt, combinedInput);

            if (
              gameStateRef.current === 'PLAYING' &&
              sim.isCrashed &&
              sim.crashTimer > 1.15
            ) {
              onTelemetryRef.current(sim.getTelemetry());
              onStateChangeRef.current('GAME_OVER');
            }
          }

          renderer3d.render(sim, viewWidth, viewHeight);

          if (now - lastTelemetryTime >= 50) {
            lastTelemetryTime = now;
            onTelemetryRef.current(sim.getTelemetry());
          }
        }

        if (isSoftwareGl) {
          afterDraw(tick);
        } else {
          frameId = requestAnimationFrame(tick);
        }
      };

      frameId = requestAnimationFrame(tick);

      return () => {
        isMounted = false;
        cancelAnimationFrame(frameId);
        clearTimeout(frameId);
        resizeObserver.disconnect();
        window.removeEventListener('resize', handleResize);
        renderer3d.dispose();
        if (container.contains(renderer3d.renderer.domElement)) {
          container.removeChild(renderer3d.renderer.domElement);
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <div
        ref={canvasMountRef}
        className="absolute inset-0 w-full h-full overflow-hidden bg-[#0B0D11]"
      />
    );
  }
);
