import {
  BikeConfig,
  CourseConfig,
  GameState,
  HazardType,
  TelemetrySnapshot,
  TrickCallout,
  TrickType,
} from './types';
import { bikeAudio } from './audio';

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  kind: 'dirt' | 'spark' | 'smoke' | 'dust';
}

export interface HazardSegment {
  id: number;
  type: HazardType;
  label: string;
  startX: number; // world pixels (40px = 1 meter)
  endX: number;
  intensity: number;
}

export interface InputState {
  throttle: boolean; // W or ArrowUp
  brake: boolean; // S or ArrowDown
  leanBack: boolean; // A or ArrowLeft
  leanForward: boolean; // D or ArrowRight
  clutchHeld: boolean; // C or ShiftLeft or Hold Clutch button
  justReleasedClutch: boolean; // Edge trigger when clutch is dumped
  justPressedShiftUp: boolean; // E or Gear + button
  justPressedShiftDown: boolean; // Q or Gear - button
  stuntHeld: boolean; // Space
  justPressedStunt: boolean;
  justPressedTrick1: boolean;
  justPressedTrick2: boolean;
  justPressedTrick3: boolean;
}

export const PX_PER_METER = 42;

export class WheelieSimulation {
  public bike: BikeConfig;
  public course: CourseConfig;
  public gameState: GameState = 'TITLE_MENU';

  // World & Bike kinematics
  public x: number = 0; // rear wheel contact X in world pixels
  public y: number = 0; // rear wheel contact Y in world pixels
  public vx: number = 220; // px/s
  public vy: number = 0; // px/s
  public isAirborne: boolean = false;

  // Pitch angle in radians (positive = nose up CCw from right-facing horizontal)
  public angle: number = 0;
  public angularVel: number = 0;

  // Suspension & Rider
  public rearComp: number = 0; // 0..1 compression
  public rearCompVel: number = 0;
  public frontComp: number = 0; // 0..1 compression
  public frontCompVel: number = 0;
  public riderLean: number = 0; // -1 (back) to +1 (forward)
  public riderSquash: number = 0; // -0.3 to +0.3

  // Drivetrain, Clutch & 6-Speed Gearbox
  public rpm: number = 2800;
  public maxRpm: number = 10500;
  public gear: number = 1;
  public maxGear: number = 6;
  public transmissionMode: 'MANUAL' | 'AUTO' = 'AUTO';
  public clutchPulled: boolean = false;
  public clutchCharge: number = 0; // 0..1 rev-bomb energy built while clutch is held
  public clutchCooldown: number = 0;
  public rearWheelSpinAngle: number = 0;
  public frontWheelSpinAngle: number = 0;
  public rearBrakeHeat: number = 0;

  // Wheelie & Scoring
  public score: number = 0;
  public bestScore: number = 0;
  public currentWheelieScore: number = 0;
  public comboMultiplier: number = 1;
  public wheelieStartX: number = 0;
  public wheelieDistanceM: number = 0;
  public bestWheelieDistanceM: number = 0;
  public inWheelie: boolean = false;
  public inSweetSpot: boolean = false;
  public isScraping: boolean = false;
  public scrapeTimer: number = 0;
  public scrapeCount: number = 0;
  public tricksLanded: number = 0;

  // Stunts
  public activeTrick: TrickType = 'NONE';
  public trickTimer: number = 0;
  public trickCycleIndex: number = 0;
  public callouts: TrickCallout[] = [];
  private nextCalloutId: number = 1;

  // Crash / Ragdoll state
  public isCrashed: boolean = false;
  public crashReason: string | null = null;
  public crashTimer: number = 0;
  public ragdollX: number = 0;
  public ragdollY: number = 0;
  public ragdollVx: number = 0;
  public ragdollVy: number = 0;
  public ragdollAngle: number = 0;

  // Camera & Feel
  public camX: number = 0;
  public camY: number = 0;
  public camZoom: number = 1;
  public shakeTrauma: number = 0;
  public hitstopTimer: number = 0;
  public screenFlash: number = 0;
  public screenFlashColor: string = '#FFFFFF';

  // Hazards & Particles
  public hazards: HazardSegment[] = [];
  public particles: Particle[] = [];
  private nextHazardEndX: number = 900;
  private hazardCounter: number = 1;

  constructor(bike: BikeConfig, course: CourseConfig) {
    this.bike = bike;
    this.course = course;

    try {
      const savedScore = localStorage.getItem('twelve_oclock_best_score');
      const savedDist = localStorage.getItem('twelve_oclock_best_dist');
      if (savedScore) this.bestScore = parseInt(savedScore, 10) || 0;
      if (savedDist) this.bestWheelieDistanceM = parseInt(savedDist, 10) || 0;
    } catch {
      // Ignore storage errors
    }

    // Pre-allocate pooled particles
    for (let i = 0; i < 360; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 3,
        life: 0,
        maxLife: 1,
        color: '#FF5500',
        kind: 'dirt',
      });
    }

    this.resetRun();
  }

  public setBikeAndCourse(bike: BikeConfig, course: CourseConfig) {
    this.bike = bike;
    this.course = course;
    this.resetRun();
  }

  public resetRun() {
    this.x = 0;
    this.y = this.getTerrainHeight(0);
    this.vx = 180;
    this.vy = 0;
    this.isAirborne = false;
    this.angle = 0.04;
    this.angularVel = 0;
    this.rearComp = 0.15;
    this.rearCompVel = 0;
    this.frontComp = 0.15;
    this.frontCompVel = 0;
    this.riderLean = 0;
    this.riderSquash = 0;

    this.rpm = 3200;
    this.gear = 1;
    this.rearBrakeHeat = 0;
    this.clutchPulled = false;
    this.clutchCharge = 0;
    this.clutchCooldown = 0;

    this.score = 0;
    this.currentWheelieScore = 0;
    this.comboMultiplier = 1;
    this.wheelieStartX = 0;
    this.wheelieDistanceM = 0;
    this.inWheelie = false;
    this.inSweetSpot = false;
    this.isScraping = false;
    this.scrapeTimer = 0;
    this.scrapeCount = 0;
    this.tricksLanded = 0;

    this.activeTrick = 'NONE';
    this.trickTimer = 0;
    this.callouts = [];

    this.isCrashed = false;
    this.crashReason = null;
    this.crashTimer = 0;

    this.shakeTrauma = 0;
    this.hitstopTimer = 0;
    this.screenFlash = 0;

    this.hazards = [];
    this.nextHazardEndX = 1100;
    this.hazardCounter = 1;
    this.ensureHazardsAhead();

    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].active = false;
    }

    this.camX = this.x + 220;
    this.camY = this.y - 120;
    this.camZoom = 1;
  }

  public toggleTransmissionMode() {
    this.transmissionMode = this.transmissionMode === 'AUTO' ? 'MANUAL' : 'AUTO';
  }

  public shiftGear(delta: number, isManualAction: boolean = true) {
    const nextGear = Math.max(1, Math.min(this.maxGear, this.gear + delta));
    if (nextGear === this.gear) return;

    const up = nextGear > this.gear;
    this.gear = nextGear;
    bikeAudio.playGearShift(up);

    if (up) {
      this.rpm = Math.max(2600, this.rpm * 0.72);
      // Award Gear Chase bonus when shifting up mid-wheelie!
      const angleDeg = (this.angle * 180) / Math.PI;
      if (isManualAction && angleDeg >= 42 && !this.isCrashed) {
        const bonus = 250 * this.comboMultiplier;
        this.currentWheelieScore += bonus;
        this.addCallout(`GEAR ${this.gear} WHEELIE SHIFT!`, bonus, '#38BDF8');
      }
    } else {
      this.rpm = Math.min(this.maxRpm, this.rpm * 1.28);
      // Slight engine-braking pitch dip on downshift unless clutch is pulled
      if (!this.clutchPulled && !this.isAirborne) {
        this.angularVel -= 0.22;
      }
    }
  }

  private ensureHazardsAhead() {
    while (this.nextHazardEndX < this.x + 5500) {
      const gap = (380 + Math.random() * 440) / this.course.hazardFrequency;
      const startX = this.nextHazardEndX + gap;
      const roll = (this.hazardCounter * 37 + Math.floor(startX * 0.01)) % 5;

      let type: HazardType = 'WHOOPS';
      let label = 'RHYTHM WHOOPS — KEEP FRONT WHEEL HIGH';
      let length = 750;
      let intensity = 1.0;

      if (roll === 0) {
        type = 'WHOOPS';
        label = 'RHYTHM WHOOPS — FEATHER THROTTLE';
        length = 760;
        intensity = 1.0;
      } else if (roll === 1) {
        type = 'KICKER_RAMP';
        label = 'DIRT KICKER — LAND ON REAR WHEEL';
        length = 340;
        intensity = 1.15;
      } else if (roll === 2) {
        type = 'MUD_PIT';
        label = 'DEEP SILT BED — WHEELIE THROUGH TO KEEP SPEED';
        length = 640;
        intensity = 1.0;
      } else if (roll === 3) {
        type = 'WIND_GUST';
        label = 'CANYON UPDRAFT — TAP REAR BRAKE (S)';
        length = 820;
        intensity = 1.1;
      } else {
        type = 'TABLETOP';
        label = 'MESA TABLETOP — STUNT JUMP BONUS';
        length = 620;
        intensity = 1.2;
      }

      this.hazards.push({
        id: this.hazardCounter++,
        type,
        label,
        startX,
        endX: startX + length,
        intensity,
      });

      this.nextHazardEndX = startX + length;
    }

    // Prune old hazards far behind camera
    if (this.hazards.length > 14) {
      this.hazards = this.hazards.filter((h) => h.endX > this.x - 1600);
    }
  }

  public getHazardAt(worldX: number): HazardSegment | null {
    for (let i = 0; i < this.hazards.length; i++) {
      const h = this.hazards[i];
      if (worldX >= h.startX && worldX <= h.endX) {
        return h;
      }
    }
    return null;
  }

  public getTerrainHeight(worldX: number): number {
    // Base gentle rolling desert dunes (in screen space where +Y is downward)
    const base =
      Math.sin(worldX * 0.0011) * 32 +
      Math.sin(worldX * 0.00043 + 1.2) * 58 +
      Math.cos(worldX * 0.0024) * 10;

    // Add hazard geometry
    const haz = this.getHazardAt(worldX);
    let mod = 0;
    if (haz) {
      const t = (worldX - haz.startX) / (haz.endX - haz.startX); // 0..1
      if (haz.type === 'WHOOPS') {
        const envelope = Math.sin(t * Math.PI);
        mod = Math.sin((worldX - haz.startX) * 0.055) * 19 * envelope;
      } else if (haz.type === 'KICKER_RAMP') {
        if (t < 0.65) {
          const r = t / 0.65;
          mod = -Math.pow(r, 1.7) * 74;
        } else {
          const r = (t - 0.65) / 0.35;
          mod = -74 * (1 - r * r);
        }
      } else if (haz.type === 'TABLETOP') {
        if (t < 0.25) {
          mod = -(t / 0.25) * 68;
        } else if (t < 0.75) {
          mod = -68;
        } else {
          mod = -68 * (1 - (t - 0.75) / 0.25);
        }
      } else if (haz.type === 'MUD_PIT') {
        mod = Math.sin(t * Math.PI) * 12;
      }
    }

    return 420 + base + mod;
  }

  public getTerrainSlope(worldX: number): number {
    const delta = 6;
    const y1 = this.getTerrainHeight(worldX - delta);
    const y2 = this.getTerrainHeight(worldX + delta);
    // Since +Y is down, a rising slope has y2 < y1, so positive elevation angle is atan2(y1 - y2, 2*delta)
    return Math.atan2(y1 - y2, delta * 2);
  }

  public addCallout(title: string, points: number, color: string) {
    this.callouts.unshift({
      id: this.nextCalloutId++,
      title,
      points,
      color,
      timestamp: performance.now(),
    });
    if (this.callouts.length > 4) {
      this.callouts.pop();
    }
  }

  public spawnParticle(
    x: number,
    y: number,
    vx: number,
    vy: number,
    size: number,
    maxLife: number,
    color: string,
    kind: Particle['kind']
  ) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = x;
        p.y = y;
        p.vx = vx;
        p.vy = vy;
        p.size = size;
        p.life = maxLife;
        p.maxLife = maxLife;
        p.color = color;
        p.kind = kind;
        return;
      }
    }
  }

  public step(rawDt: number, input: InputState) {
    const dt = Math.min(rawDt, 0.05);

    // Decay hitstop and screen flash
    if (this.screenFlash > 0) {
      this.screenFlash = Math.max(0, this.screenFlash - dt * 3.8);
    }
    if (this.shakeTrauma > 0) {
      this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 1.9);
    }
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateParticles(dt * 0.25);
      return;
    }

    // Expire old callouts
    const now = performance.now();
    this.callouts = this.callouts.filter((c) => now - c.timestamp < 1900);

    // If on TITLE_MENU or GARAGE_MENU, run autonomous showcase AI rider!
    const effectiveInput: InputState =
      this.gameState === 'TITLE_MENU' || this.gameState === 'GARAGE_MENU'
        ? this.computeShowcaseAIInput()
        : input;

    if (this.isCrashed) {
      this.stepCrashed(dt);
      return;
    }

    this.ensureHazardsAhead();

    // 1. Rider body weight lean (-1 lean back, +1 lean forward)
    let targetLean = 0;
    if (effectiveInput.leanBack) targetLean -= 1;
    if (effectiveInput.leanForward) targetLean += 1;
    this.riderLean += (targetLean - this.riderLean) * Math.min(1, dt * 11);

    // 2. Manual Gearshift inputs (E / Gear+ and Q / Gear-)
    if (effectiveInput.justPressedShiftUp) {
      this.shiftGear(1, true);
    } else if (effectiveInput.justPressedShiftDown) {
      this.shiftGear(-1, true);
    }

    // 3. Clutch Lever Physics (Hold C / Shift or Hold Clutch Button -> Release to Dump Clutch!)
    const angleDeg = (this.angle * 180) / Math.PI;
    const gearRatioFactor = 1.52 - (this.gear - 1) * 0.145;

    this.clutchPulled = effectiveInput.clutchHeld;
    if (this.clutchCooldown > 0) {
      this.clutchCooldown = Math.max(0, this.clutchCooldown - dt);
    }

    if (this.clutchPulled) {
      // Disengaged from wheel: rev engine freely to build clutch bite charge!
      const revRate = effectiveInput.throttle ? 2.8 : 1.5;
      this.clutchCharge = Math.min(1, this.clutchCharge + dt * revRate);
      const revTarget = effectiveInput.throttle ? this.maxRpm : 8800;
      this.rpm += (revTarget - this.rpm) * Math.min(1, dt * 18);
    } else if (effectiveInput.justReleasedClutch && this.clutchCharge > 0.15 && !this.isAirborne) {
      // CLUTCH DUMP! Deliver stored flywheel angular momentum into rear tire
      const dumpPower = 0.45 + this.clutchCharge * 0.75;
      const liftImpulse =
        ((2.45 * dumpPower * this.bike.torqueMultiplier * gearRatioFactor) /
          this.bike.rotationalInertia) *
        (angleDeg < 55 ? 1.0 : 0.55);

      this.angularVel += liftImpulse;
      this.vx += 52 * dumpPower;
      this.activeTrick = 'CLUTCH_POP';
      this.trickTimer = 0.65;
      this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.25 * dumpPower);
      bikeAudio.playClutchPop();

      const pts = Math.round(150 * dumpPower * this.comboMultiplier);
      this.currentWheelieScore += pts;
      this.addCallout(
        this.clutchCharge > 0.75 ? 'REDLINE CLUTCH DUMP!' : 'CLUTCH KICK!',
        pts,
        '#FF5500'
      );

      // Kick up extra dirt roost clods on clutch dump
      for (let i = 0; i < 8; i++) {
        this.spawnParticle(
          this.x - 18,
          this.y - 4,
          -this.vx * (0.4 + Math.random() * 0.5),
          -Math.random() * 190 - 40,
          4 + Math.random() * 4,
          0.45,
          this.course.groundSurface,
          'dirt'
        );
      }
      this.clutchCharge = 0;
    } else {
      this.clutchCharge = Math.max(0, this.clutchCharge - dt * 3.5);
    }

    // 4. Stunt Tricks (Spacebar or 1/2/3)
    if (effectiveInput.justPressedStunt) {
      if (angleDeg < 34 && this.clutchCooldown <= 0 && !this.isAirborne) {
        // Quick Clutch Pop + Throttle Blip combo
        this.clutchCooldown = 0.85;
        this.rpm = Math.min(this.maxRpm, this.rpm + 3400);
        this.angularVel +=
          (2.35 * this.bike.torqueMultiplier * gearRatioFactor) /
          this.bike.rotationalInertia;
        this.vx += 45;
        this.activeTrick = 'CLUTCH_POP';
        this.trickTimer = 0.65;
        this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.22);
        bikeAudio.playClutchPop();
        this.addCallout('CLUTCH POP!', 150, '#FF5500');
        this.currentWheelieScore += 150;
      } else if (angleDeg >= 34) {
        // Cycle wheelie stunt pose!
        const tricks: TrickType[] = ['ONE_HANDER', 'SEAT_STAND', 'NAC_NAC'];
        const chosen = tricks[this.trickCycleIndex % tricks.length];
        this.trickCycleIndex++;
        this.triggerWheelieStunt(chosen);
      }
    } else if (effectiveInput.justPressedTrick1 && angleDeg >= 30) {
      this.triggerWheelieStunt('ONE_HANDER');
    } else if (effectiveInput.justPressedTrick2 && angleDeg >= 30) {
      this.triggerWheelieStunt('SEAT_STAND');
    } else if (effectiveInput.justPressedTrick3 && angleDeg >= 30) {
      this.triggerWheelieStunt('NAC_NAC');
    }

    if (this.trickTimer > 0) {
      this.trickTimer -= dt;
      if (this.trickTimer <= 0 && this.activeTrick !== 'FENDER_SCRAPE') {
        this.activeTrick = 'NONE';
      }
    }

    // 5. Drivetrain, 6-Speed Gear Ratios & RPM
    const speedKmh = (this.vx / PX_PER_METER) * 3.6;
    const maxSpd = this.bike.maxSpeedKmh;
    const gearMaxSpeeds = [
      maxSpd * 0.27,
      maxSpd * 0.43,
      maxSpd * 0.59,
      maxSpd * 0.74,
      maxSpd * 0.88,
      maxSpd,
    ];

    if (
      this.transmissionMode === 'AUTO' ||
      this.gameState === 'TITLE_MENU' ||
      this.gameState === 'GARAGE_MENU'
    ) {
      if (speedKmh > gearMaxSpeeds[this.gear - 1] * 0.92 && this.gear < this.maxGear) {
        this.shiftGear(1, false);
      } else if (
        speedKmh < (this.gear > 1 ? gearMaxSpeeds[this.gear - 2] * 0.66 : 0) &&
        this.gear > 1
      ) {
        this.shiftGear(-1, false);
      }
    }

    const gearMax = gearMaxSpeeds[this.gear - 1];
    const throttleVal = effectiveInput.throttle ? 1 : 0;

    if (!this.clutchPulled) {
      const wheelRpm = 2100 + (speedKmh / gearMax) * 7900;
      const targetRpm = Math.min(
        this.maxRpm,
        Math.max(2100, wheelRpm + throttleVal * 1650)
      );
      this.rpm += (targetRpm - this.rpm) * Math.min(1, dt * 12);
    }

    // 6. Active Hazard lookup
    const currentHazard = this.getHazardAt(this.x);
    const inMud = currentHazard?.type === 'MUD_PIT' && !this.isAirborne;
    const inWind = currentHazard?.type === 'WIND_GUST';

    // 7. Longitudinal acceleration & braking
    let forwardAccel = 0;
    const revLimiterCut = this.rpm >= this.maxRpm * 0.98 && speedKmh >= gearMax;

    if (
      effectiveInput.throttle &&
      !this.clutchPulled &&
      !this.isAirborne &&
      !revLimiterCut &&
      speedKmh < this.bike.maxSpeedKmh
    ) {
      forwardAccel += 395 * this.bike.torqueMultiplier * gearRatioFactor;
    }

    // Rear brake slows bike down slightly and heats rotor
    if (effectiveInput.brake) {
      if (this.rearBrakeHeat < 0.15) {
        bikeAudio.playBrakeTap();
      }
      this.rearBrakeHeat = Math.min(1, this.rearBrakeHeat + dt * 3.4);
      if (!this.isAirborne) {
        forwardAccel -= 310 * this.bike.brakeAuthority;
      }
    } else {
      this.rearBrakeHeat = Math.max(0, this.rearBrakeHeat - dt * 2.2);
    }

    // Mud drag: heavy drag if front wheel is down in the mud, light drag if wheelieing over it!
    const baseDrag = inMud ? (angleDeg > 28 ? 0.35 : 2.15) : 0.22;
    forwardAccel -= this.vx * baseDrag;

    // Keep minimum rolling speed so gameplay stays fluid
    this.vx = Math.max(95, this.vx + forwardAccel * dt);
    this.x += this.vx * dt;

    // Spin wheels
    this.rearWheelSpinAngle += (this.vx / 26) * dt;
    this.frontWheelSpinAngle +=
      ((this.angle > 0.18 || this.isAirborne ? this.vx * 0.38 : this.vx) / 26) * dt;

    // 8. Vertical terrain contact & suspension physics
    const terrainY = this.getTerrainHeight(this.x);
    const terrainSlope = this.getTerrainSlope(this.x);

    if (!this.isAirborne) {
      const nextTerrainY = this.getTerrainHeight(this.x + this.vx * dt);
      const terrainVelY = (nextTerrainY - terrainY) / dt;

      // Launch airborne off steep kicker lips
      if (terrainVelY > 240 && this.vx > 240) {
        this.isAirborne = true;
        this.vy = -Math.sin(Math.max(0.18, terrainSlope)) * this.vx * 0.92 - 95;
      } else {
        // Follow terrain & compress rear suspension on bumps
        const prevY = this.y;
        this.y = terrainY;
        const bumpImpulse = (prevY - this.y) / Math.max(0.008, dt);
        this.rearCompVel += bumpImpulse * 0.0018;
      }
    } else {
      // Airborne gravity
      this.vy += 860 * dt;
      this.y += this.vy * dt;

      if (this.y >= terrainY) {
        // Touchdown!
        const impactSpeed = Math.abs(this.vy);
        this.y = terrainY;
        this.vy = 0;
        this.isAirborne = false;
        this.rearComp = Math.min(0.95, 0.25 + impactSpeed * 0.0014);
        this.riderSquash = -Math.min(0.28, impactSpeed * 0.0006);

        if (impactSpeed > 180) {
          this.shakeTrauma = Math.min(1, this.shakeTrauma + impactSpeed * 0.001);
          bikeAudio.playSuspensionThud(impactSpeed / 420);

          // Spawn landing dust burst
          for (let i = 0; i < 14; i++) {
            this.spawnParticle(
              this.x + (Math.random() - 0.5) * 36,
              this.y,
              (Math.random() - 0.5) * 160 + this.vx * 0.25,
              -Math.random() * 110 - 20,
              5 + Math.random() * 6,
              0.45 + Math.random() * 0.35,
              '#D6B498',
              'dust'
            );
          }

          // Bonus if landing cleanly into a rear-wheel manual!
          if (angleDeg >= 32 && angleDeg <= 86) {
            const bonus = 400 * this.comboMultiplier;
            this.currentWheelieScore += bonus;
            this.addCallout('WHEELIE LANDING!', bonus, '#10B981');
            bikeAudio.playTrickChime(this.comboMultiplier);
          }
        }
      }
    }

    // Update suspension spring-damper
    const targetRearComp = this.inWheelie ? 0.34 : 0.2;
    const springForce = (targetRearComp - this.rearComp) * 68 * this.bike.suspensionStiffness;
    this.rearCompVel = (this.rearCompVel + springForce * dt) * Math.pow(0.08, dt);
    this.rearComp = Math.max(0.02, Math.min(0.95, this.rearComp + this.rearCompVel * dt));

    const targetFrontComp = this.angle > 0.08 || this.isAirborne ? 0.02 : 0.22;
    this.frontComp += (targetFrontComp - this.frontComp) * Math.min(1, dt * 14);
    this.riderSquash += (0 - this.riderSquash) * Math.min(1, dt * 9);

    // 9. Rotational Wheelie Physics around the Rear Axle!
    const riderBalanceShift = this.riderLean * 0.09;
    const balanceAngleRad =
      ((this.bike.balanceSweetSpotMin + this.bike.balanceSweetSpotMax) * 0.5 * Math.PI) / 180 +
      riderBalanceShift;

    let netTorque = 0;

    if (this.angle > 0.005 || this.isAirborne) {
      const deltaFromBalance = this.angle - balanceAngleRad;
      if (deltaFromBalance < 0) {
        // When clutch is pulled in, engine braking is eliminated so bike coasts much more smoothly near balance point!
        const engineBrakeFactor = this.clutchPulled ? 0.58 : 1.0;
        const proximityToSweetSpot = Math.max(
          0.18,
          Math.min(1, Math.abs(deltaFromBalance) / 0.85)
        );
        netTorque -=
          Math.sin(Math.max(0.08, balanceAngleRad - this.angle)) *
          4.4 *
          proximityToSweetSpot *
          engineBrakeFactor;
      } else {
        netTorque += Math.sin(deltaFromBalance * 1.35) * 4.1;
      }
    }

    // Throttle wheelie torque (only when clutch is engaged!)
    if (effectiveInput.throttle && !this.clutchPulled && !this.isAirborne) {
      const angleLiftCurve = this.angle < balanceAngleRad ? 1.15 : 0.72;
      const stuntCenterOfMassBoost = this.activeTrick === 'SEAT_STAND' ? 1.12 : 1.0;
      const revLimiterTorqueFactor = revLimiterCut ? 0.45 : 1.0;
      netTorque +=
        5.35 *
        this.bike.torqueMultiplier *
        gearRatioFactor *
        angleLiftCurve *
        stuntCenterOfMassBoost *
        revLimiterTorqueFactor;
    }

    // Rider lean rotational impulse
    netTorque += -this.riderLean * 1.45;

    // Rear Brake Feathering (S / Down): The essential anti-loop-out control!
    if (effectiveInput.brake) {
      const brakePitchAuthority = this.isAirborne ? 3.8 : 7.8;
      netTorque -= brakePitchAuthority * this.bike.brakeAuthority;
    }

    // Canyon Wind Gust hazard pushes nose upward
    if (inWind) {
      netTorque += 1.65;
    }

    // Whoops pitch perturbation
    if (currentHazard?.type === 'WHOOPS' && !this.isAirborne) {
      netTorque += Math.sin(this.x * 0.055) * 1.1;
    }

    // Rotational damping
    const inSweetSpotNow =
      angleDeg >= this.bike.balanceSweetSpotMin && angleDeg <= this.bike.balanceSweetSpotMax;
    const angularDamping = inSweetSpotNow ? 3.6 : 2.3;
    netTorque -= this.angularVel * angularDamping;

    this.angularVel += (netTorque / this.bike.rotationalInertia) * dt;
    this.angle += this.angularVel * dt;

    // 10. Ground collision for Front Wheel & Tail Scrape / Loop-Out Check
    const minGroundAngle = Math.max(0, terrainSlope * 0.65);
    if (!this.isAirborne && this.angle <= minGroundAngle) {
      if (this.angularVel < -1.8) {
        this.frontComp = Math.min(0.95, Math.abs(this.angularVel) * 0.25);
        this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.18);
        bikeAudio.playSuspensionThud(0.45);
      }
      this.angle = minGroundAngle;
      this.angularVel = 0;
    }

    const updatedAngleDeg = (this.angle * 180) / Math.PI;

    // Titanium Tail Fender Scrape Zone (82° to Loop-Out angle)
    this.isScraping =
      !this.isAirborne &&
      updatedAngleDeg >= this.bike.scrapeAngleMin &&
      updatedAngleDeg < this.bike.loopOutAngle;

    if (this.isScraping) {
      this.angularVel = Math.min(this.angularVel, 0.35);
      this.angle -= 0.18 * dt;
      this.activeTrick = 'FENDER_SCRAPE';
      this.shakeTrauma = Math.max(this.shakeTrauma, 0.24);

      if (this.scrapeTimer === 0) {
        this.scrapeCount++;
        this.comboMultiplier = Math.min(12, this.comboMultiplier + 1);
        this.addCallout('12 O’CLOCK TAIL SCRAPE!', 500 * this.comboMultiplier, '#F59E0B');
        bikeAudio.playTrickChime(this.comboMultiplier);
      }
      this.scrapeTimer += dt;

      const fenderTipX = this.x - Math.cos(this.angle + 0.42) * 54;
      const fenderTipY = this.y - 16 + Math.sin(this.angle - 1.15) * 18;
      for (let i = 0; i < 4; i++) {
        this.spawnParticle(
          fenderTipX,
          Math.min(this.y - 2, fenderTipY),
          -this.vx * (0.25 + Math.random() * 0.45),
          -Math.random() * 210 - 30,
          2.2 + Math.random() * 2.5,
          0.22 + Math.random() * 0.25,
          Math.random() > 0.35 ? '#FBBF24' : '#FFFFFF',
          'spark'
        );
      }
    } else {
      if (this.activeTrick === 'FENDER_SCRAPE') {
        this.activeTrick = 'NONE';
      }
      this.scrapeTimer = 0;
    }

    // Check Loop-Out Crash!
    if (updatedAngleDeg >= this.bike.loopOutAngle) {
      if (this.gameState === 'TITLE_MENU' || this.gameState === 'GARAGE_MENU') {
        this.angle = (this.bike.scrapeAngleMin * Math.PI) / 180;
        this.angularVel = -0.8;
      } else {
        this.triggerCrash(`LOOPED OUT AT ${Math.round(updatedAngleDeg)}° — FEATHER REAR BRAKE (S)!`);
        return;
      }
    }

    // 11. Wheelie Distance, Sweet-Spot Combo & Scoring
    const isWheelieNow = updatedAngleDeg >= 22;
    this.inSweetSpot =
      updatedAngleDeg >= this.bike.balanceSweetSpotMin &&
      updatedAngleDeg <= this.bike.balanceSweetSpotMax;

    if (isWheelieNow) {
      if (!this.inWheelie) {
        this.inWheelie = true;
        this.wheelieStartX = this.x;
        this.currentWheelieScore = 0;
        this.comboMultiplier = 1;
      }

      this.wheelieDistanceM = Math.max(0, Math.floor((this.x - this.wheelieStartX) / PX_PER_METER));
      if (this.wheelieDistanceM > this.bestWheelieDistanceM && this.gameState === 'PLAYING') {
        this.bestWheelieDistanceM = this.wheelieDistanceM;
      }

      const angleFactor = updatedAngleDeg / 65;
      const sweetSpotBonus = this.inSweetSpot ? 2.4 : 1.0;
      const scrapeBonus = this.isScraping ? 4.2 : 1.0;
      const trickBonus =
        this.activeTrick !== 'NONE' && this.activeTrick !== 'CLUTCH_POP' ? 1.85 : 1.0;

      const pointsPerSec =
        85 * angleFactor * sweetSpotBonus * scrapeBonus * trickBonus * this.comboMultiplier;
      this.currentWheelieScore += pointsPerSec * dt;

      const distanceTier = 1 + Math.floor(this.wheelieDistanceM / 35);
      if (distanceTier > this.comboMultiplier) {
        this.comboMultiplier = Math.min(12, distanceTier);
        this.addCallout(`${this.comboMultiplier}X BALANCE STREAK`, 250 * this.comboMultiplier, '#10B981');
        bikeAudio.playTrickChime(this.comboMultiplier);
      }
    } else if (this.inWheelie && !this.isAirborne) {
      const banked = Math.round(this.currentWheelieScore);
      if (banked > 50) {
        this.score += banked;
        if (this.wheelieDistanceM >= 15) {
          this.addCallout(
            `BANKED ${this.wheelieDistanceM}M WHEELIE!`,
            banked,
            '#38BDF8'
          );
        }
      }
      this.inWheelie = false;
      this.currentWheelieScore = 0;
      this.wheelieDistanceM = 0;
      this.comboMultiplier = 1;
      this.activeTrick = 'NONE';
    }

    const totalLiveScore = Math.round(this.score + this.currentWheelieScore);
    if (totalLiveScore > this.bestScore && this.gameState === 'PLAYING') {
      this.bestScore = totalLiveScore;
    }

    // 12. Emit Dirt Roost & Exhaust Smoke Particles
    if (effectiveInput.throttle && !this.clutchPulled && !this.isAirborne && Math.random() < 0.75) {
      const dirtColor = inMud ? '#3B1D11' : this.course.groundSurface;
      this.spawnParticle(
        this.x - 16,
        this.y - 4,
        -this.vx * (0.3 + Math.random() * 0.4),
        -Math.random() * 145 - 35,
        3.5 + Math.random() * 4.5,
        0.38 + Math.random() * 0.25,
        dirtColor,
        'dirt'
      );
    }

    if (Math.random() < (this.bike.strokeType === '2-STROKE' ? 0.55 : 0.25)) {
      const cosA = Math.cos(this.angle);
      const sinA = Math.sin(this.angle);
      const exX = this.x - cosA * 38 - sinA * 28;
      const exY = this.y - 24 + sinA * 38 - cosA * 28;
      this.spawnParticle(
        exX,
        exY,
        this.vx * 0.35 - cosA * 95,
        -25 + (Math.random() - 0.5) * 35,
        4 + Math.random() * 5,
        0.45 + Math.random() * 0.3,
        this.bike.strokeType === '2-STROKE'
          ? 'rgba(203, 213, 225, 0.42)'
          : 'rgba(148, 163, 184, 0.26)',
        'smoke'
      );
    }

    this.updateParticles(dt);

    // 13. Smooth Camera Tracking
    const targetCamX = this.x + 250 + Math.min(140, this.vx * 0.24);
    const targetCamY = this.y - 125 - (this.inWheelie ? 22 : 0);
    const targetZoom = this.isScraping ? 1.06 : this.inSweetSpot ? 1.03 : 0.98;

    this.camX += (targetCamX - this.camX) * Math.min(1, dt * 8);
    this.camY += (targetCamY - this.camY) * Math.min(1, dt * 6);
    this.camZoom += (targetZoom - this.camZoom) * Math.min(1, dt * 4);

    // Update synthesized engine audio
    bikeAudio.updateEngine(
      this.rpm,
      this.maxRpm,
      this.clutchPulled ? 1 : throttleVal,
      this.bike.strokeType === '2-STROKE',
      this.isScraping,
      this.gameState === 'PLAYING'
    );
  }

  private triggerWheelieStunt(trick: TrickType) {
    this.activeTrick = trick;
    this.trickTimer = 1.35;
    this.tricksLanded++;
    this.comboMultiplier = Math.min(12, this.comboMultiplier + 1);

    const labels: Record<TrickType, string> = {
      NONE: '',
      CLUTCH_POP: 'CLUTCH POP',
      ONE_HANDER: 'NO-HANDER SALUTE!',
      SEAT_STAND: 'HIGH-CHAIR SEAT STAND!',
      NAC_NAC: 'WHIP NAC-NAC!',
      FENDER_SCRAPE: '12 O’CLOCK SCRAPE!',
    };

    const bonus = 350 * this.comboMultiplier;
    this.currentWheelieScore += bonus;
    this.addCallout(labels[trick], bonus, '#FF5500');
    bikeAudio.playTrickChime(this.comboMultiplier);
  }

  public triggerCrash(reason: string) {
    this.isCrashed = true;
    this.crashReason = reason;
    this.crashTimer = 0;

    const finalScore = Math.round(this.score + this.currentWheelieScore * 0.5);
    this.score = finalScore;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
    }
    try {
      localStorage.setItem('twelve_oclock_best_score', String(this.bestScore));
      localStorage.setItem('twelve_oclock_best_dist', String(this.bestWheelieDistanceM));
    } catch {
      // Ignore storage errors
    }

    this.hitstopTimer = 0.065;
    this.screenFlash = 0.75;
    this.screenFlashColor = '#EF4444';
    this.shakeTrauma = 1.0;

    this.ragdollX = this.x - 20;
    this.ragdollY = this.y - 68;
    this.ragdollVx = this.vx * 0.75;
    this.ragdollVy = -220;
    this.ragdollAngle = -this.angle;

    for (let i = 0; i < 32; i++) {
      const isSpark = i % 2 === 0;
      this.spawnParticle(
        this.x - 20 + (Math.random() - 0.5) * 40,
        this.y - 10,
        this.vx * (0.2 + Math.random() * 0.6) + (Math.random() - 0.5) * 220,
        -Math.random() * 280 - 40,
        isSpark ? 3 : 6,
        0.5 + Math.random() * 0.4,
        isSpark ? '#F59E0B' : '#D6B498',
        isSpark ? 'spark' : 'dust'
      );
    }

    bikeAudio.playCrash();
    bikeAudio.updateEngine(0, this.maxRpm, 0, true, false, false);
  }

  private stepCrashed(dt: number) {
    this.crashTimer += dt;
    this.vx *= Math.pow(0.18, dt);
    this.x += this.vx * dt;
    this.y = this.getTerrainHeight(this.x);
    this.angle += 2.2 * dt;

    this.ragdollVy += 820 * dt;
    this.ragdollX += this.ragdollVx * dt;
    this.ragdollY += this.ragdollVy * dt;
    this.ragdollAngle += 6.5 * dt;

    const ragGround = this.getTerrainHeight(this.ragdollX) - 14;
    if (this.ragdollY >= ragGround) {
      this.ragdollY = ragGround;
      this.ragdollVy = -Math.abs(this.ragdollVy) * 0.42;
      this.ragdollVx *= 0.68;
    }

    this.camX += (this.x + 120 - this.camX) * Math.min(1, dt * 5);
    this.updateParticles(dt);
  }

  private updateParticles(dt: number) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.kind === 'dirt' || p.kind === 'spark') {
        p.vy += 680 * dt;
        const groundY = this.getTerrainHeight(p.x);
        if (p.y >= groundY) {
          p.y = groundY;
          p.vy = -Math.abs(p.vy) * 0.35;
          p.vx *= 0.7;
        }
      } else if (p.kind === 'smoke' || p.kind === 'dust') {
        p.vy -= 28 * dt;
        p.size += 8 * dt;
      }
    }
  }

  private computeShowcaseAIInput(): InputState {
    const angleDeg = (this.angle * 180) / Math.PI;
    const targetAngle = 75 + Math.sin(performance.now() * 0.0016) * 8;
    const predictedAngle = angleDeg + ((this.angularVel * 180) / Math.PI) * 0.22;

    const throttle = predictedAngle < targetAngle || this.vx < 260;
    const brake = predictedAngle > targetAngle + 4.5 || angleDeg > 84;
    const leanBack = angleDeg > 40 && angleDeg < 74;
    const leanForward = angleDeg > 80;
    const popTrick =
      angleDeg > 64 &&
      angleDeg < 79 &&
      this.trickTimer <= 0 &&
      Math.random() < 0.012;

    return {
      throttle,
      brake,
      leanBack,
      leanForward,
      clutchHeld: false,
      justReleasedClutch: false,
      justPressedShiftUp: false,
      justPressedShiftDown: false,
      stuntHeld: false,
      justPressedStunt:
        popTrick || (angleDeg < 12 && this.clutchCooldown <= 0 && Math.random() < 0.04),
      justPressedTrick1: false,
      justPressedTrick2: false,
      justPressedTrick3: false,
    };
  }

  public getTelemetry(): TelemetrySnapshot {
    const angleDeg = Math.max(0, Math.round((this.angle * 180) / Math.PI));
    const currentHaz = this.getHazardAt(this.x);

    let upcoming: TelemetrySnapshot['upcomingHazard'] = null;
    for (let i = 0; i < this.hazards.length; i++) {
      const h = this.hazards[i];
      if (h.startX > this.x) {
        const distM = Math.round((h.startX - this.x) / PX_PER_METER);
        if (distM <= 95) {
          upcoming = {
            type: h.type,
            label: h.label,
            distanceM: distM,
          };
        }
        break;
      }
    }

    return {
      score: Math.round(this.score + this.currentWheelieScore),
      bestScore: Math.round(this.bestScore),
      comboMultiplier: this.comboMultiplier,
      currentWheelieScore: Math.round(this.currentWheelieScore),
      wheelieDistanceM: this.wheelieDistanceM,
      bestWheelieDistanceM: this.bestWheelieDistanceM,
      totalDistanceM: Math.floor(this.x / PX_PER_METER),
      speedKmh: Math.round((this.vx / PX_PER_METER) * 3.6),
      rpm: Math.round(this.rpm),
      maxRpm: this.maxRpm,
      gear: this.gear,
      maxGear: this.maxGear,
      transmissionMode: this.transmissionMode,
      clutchPulled: this.clutchPulled,
      clutchCharge: this.clutchCharge,
      wheelieAngleDeg: angleDeg,
      angularVelocityDeg: Math.round((this.angularVel * 180) / Math.PI),
      inWheelie: this.inWheelie,
      inSweetSpot: this.inSweetSpot,
      isScraping: this.isScraping,
      activeTrick: this.activeTrick,
      rearBrakeHeat: this.rearBrakeHeat,
      activeHazard: currentHaz ? currentHaz.type : 'NONE',
      upcomingHazard: upcoming,
      callouts: this.callouts,
      crashReason: this.crashReason,
      scrapeCount: this.scrapeCount,
      tricksLanded: this.tricksLanded,
    };
  }
}
