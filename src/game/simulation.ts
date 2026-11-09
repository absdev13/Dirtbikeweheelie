import {
  ActiveChallenge,
  BikeConfig,
  CourseConfig,
  GameState,
  HazardType,
  RiderStance,
  TelemetrySnapshot,
  TrickCallout,
  TrickType,
} from './types';
import {
  buildRewardTiers,
  DailyChallengeState,
  generateDailyChallengesForDate,
  getTodayDateKey,
  loadDailyChallengeState,
  RewardCosmeticId,
  saveDailyChallengeState,
} from './dailyChallenges';
import { bikeAudio } from './audio';

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  z: number; // 3D lateral position in meters
  vx: number;
  vy: number;
  vz: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  kind: 'dirt' | 'spark' | 'smoke' | 'dust' | 'flame';
}

export interface SkidMarkSegment {
  active: boolean;
  worldX: number; // meters
  worldY: number; // meters
  worldZ: number; // meters
  isScrapeSpark: boolean;
  intensity: number;
}

export interface HazardSegment {
  id: number;
  type: HazardType;
  label: string;
  startX: number; // world pixels (42px = 1 meter)
  endX: number;
  intensity: number;
}

export interface InputState {
  throttle: boolean; // W or ArrowUp
  brake: boolean; // S or ArrowDown
  leanBack: boolean; // A or ArrowLeft
  leanForward: boolean; // D or ArrowRight
  steerLeft: boolean; // Z or Left Steer
  steerRight: boolean; // X or Right Steer
  clutchHeld: boolean; // C or ShiftLeft or Hold Clutch button
  justReleasedClutch: boolean; // Edge trigger when clutch is dumped
  boostHeld: boolean; // F or Nitro Boost button
  justPressedShiftUp: boolean; // E or Gear + button
  justPressedShiftDown: boolean; // Q or Gear - button
  stuntHeld: boolean; // Space
  justPressedStunt: boolean;
  justPressedStanceCycle: boolean; // G or Foot-on-Seat Stance button
  justPressedTrick1: boolean;
  justPressedTrick2: boolean;
  justPressedTrick3: boolean;
  justPressedTrick4: boolean;
}

export const PX_PER_METER = 42;
export const MAX_SKID_MARKS = 180;

const RIDER_RANKS = [
  'LOT ROOKIE',
  'STREET APPRENTICE',
  'BALANCE JUNKIE',
  'GEAR CHASER',
  'COASTER PRO',
  'SUMO HOOLIGAN',
  'SCRAPE KING',
  '12 O’CLOCK LEGEND',
];

export class WheelieSimulation {
  public bike: BikeConfig;
  public course: CourseConfig;
  public gameState: GameState = 'TITLE_MENU';

  // World & Bike 3D kinematics
  public x: number = 0; // rear wheel contact X in world pixels
  public y: number = 0; // rear wheel contact Y in world pixels
  public lateralZ: number = 0; // 3D lane offset in meters (-4.8m to +4.8m)
  public vx: number = 220; // px/s
  public vy: number = 0; // px/s
  public vz: number = 0; // lateral m/s
  public rollAngle: number = 0; // 3D bank/swerve roll angle in radians
  public isAirborne: boolean = false;

  // Pitch angle in radians (positive = nose up CCW from right-facing horizontal)
  public angle: number = 0;
  public angularVel: number = 0;

  // Suspension & Rider
  public rearComp: number = 0; // 0..1 compression
  public rearCompVel: number = 0;
  public frontComp: number = 0; // 0..1 compression
  public frontCompVel: number = 0;
  public riderLean: number = 0; // -1 (back) to +1 (forward)
  public riderSquash: number = 0; // -0.3 to +0.3

  // Drivetrain, Clutch, Nitro Boost & 6-Speed Gearbox
  public rpm: number = 2800;
  public maxRpm: number = 10500;
  public gear: number = 1;
  public maxGear: number = 6;
  public transmissionMode: 'MANUAL' | 'AUTO' = 'AUTO';
  public clutchPulled: boolean = false;
  public clutchCharge: number = 0; // 0..1 rev-bomb energy built while clutch is held
  public clutchCooldown: number = 0;
  public coasterTimer: number = 0;
  public isCoasting: boolean = false;
  public boostCharge: number = 0.65; // 0..1 stunt nitro charge
  public boostActive: boolean = false;
  public exhaustFlameIntensity: number = 0; // 0..1 backfire / nitro flame pop
  public rearWheelSpinAngle: number = 0;
  public frontWheelSpinAngle: number = 0;
  public rearBrakeHeat: number = 0;

  // Wheelie, Swerve & Scoring
  public score: number = 0;
  public bestScore: number = 0;
  public totalCareerXp: number = 0;
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
  public swerveAccumM: number = 0;
  public swerveBonusCount: number = 0;

  // Live Run Challenge System & Procedural Daily Challenges
  public challengeIndex: number = 0;
  public challengeTargets = [50, 2, 3, 4, 20];
  public dailyState: DailyChallengeState;

  // Stunt Stance (Pre-Wheelie & Mid-Wheelie Foot/Seat Positions) & Flair Tricks
  public riderStance: RiderStance = 'NORMAL';
  public seatPreloadTimer: number = 0;
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

  // Hazards, Particles & 3D Tire Skid Marks
  public hazards: HazardSegment[] = [];
  public particles: Particle[] = [];
  public skidMarks: SkidMarkSegment[] = [];
  private nextSkidIndex: number = 0;
  private lastSkidWorldX: number = -999;
  private nextHazardEndX: number = 900;
  private hazardCounter: number = 1;

  constructor(bike: BikeConfig, course: CourseConfig) {
    this.bike = bike;
    this.course = course;
    this.dailyState = loadDailyChallengeState();

    try {
      const savedScore = localStorage.getItem('twelve_oclock_best_score');
      const savedDist = localStorage.getItem('twelve_oclock_best_dist');
      const savedXp = localStorage.getItem('twelve_oclock_career_xp');
      if (savedScore) this.bestScore = parseInt(savedScore, 10) || 0;
      if (savedDist) this.bestWheelieDistanceM = parseInt(savedDist, 10) || 0;
      if (savedXp) this.totalCareerXp = parseInt(savedXp, 10) || 0;
    } catch {
      // Ignore storage errors
    }

    // Pre-allocate pooled 3D particles
    for (let i = 0; i < 360; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        size: 3,
        life: 0,
        maxLife: 1,
        color: '#FF5500',
        kind: 'dirt',
      });
    }

    // Pre-allocate 3D tire skid / titanium scrape mark ring buffer
    for (let i = 0; i < MAX_SKID_MARKS; i++) {
      this.skidMarks.push({
        active: false,
        worldX: 0,
        worldY: 0,
        worldZ: 0,
        isScrapeSpark: false,
        intensity: 1,
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
    this.lateralZ = 0;
    this.vx = 185;
    this.vy = 0;
    this.vz = 0;
    this.rollAngle = 0;
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
    this.coasterTimer = 0;
    this.isCoasting = false;
    this.boostCharge = 0.65;
    this.boostActive = false;
    this.exhaustFlameIntensity = 0;

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
    this.swerveAccumM = 0;
    this.swerveBonusCount = 0;

    this.riderStance = 'NORMAL';
    this.seatPreloadTimer = 0;
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
    for (let i = 0; i < this.skidMarks.length; i++) {
      this.skidMarks[i].active = false;
    }
    this.lastSkidWorldX = -999;

    this.camX = this.x + 220;
    this.camY = this.y - 120;
    this.camZoom = 1;
  }

  public toggleTransmissionMode() {
    this.transmissionMode = this.transmissionMode === 'AUTO' ? 'MANUAL' : 'AUTO';
  }

  public rerollDailyChallenges() {
    const today = getTodayDateKey();
    const nextOffset = (this.dailyState.seedOffset || 0) + 1;
    const freshChallenges = generateDailyChallengesForDate(today, nextOffset);
    this.dailyState = {
      ...this.dailyState,
      dateKey: today,
      seedOffset: nextOffset,
      challenges: freshChallenges,
      rewardTiers: buildRewardTiers(0),
    };
    saveDailyChallengeState(this.dailyState);
    bikeAudio.playTrickChime(4);
  }

  public setActiveCosmetic(cosmeticId: RewardCosmeticId) {
    this.dailyState = {
      ...this.dailyState,
      activeCosmetic: cosmeticId,
    };
    saveDailyChallengeState(this.dailyState);
    bikeAudio.playTrickChime(3);
  }

  public cycleRiderStance() {
    const order: RiderStance[] = [
      'NORMAL',
      'KNEE_ON_SEAT',
      'FOOT_ON_SEAT',
      'SUBCAGE_LOCK',
      'HIGH_CHAIR',
    ];
    const next = order[(order.indexOf(this.riderStance) + 1) % order.length];
    this.setRiderStance(next);
  }

  public setRiderStance(nextStance: RiderStance) {
    if (this.isCrashed) return;
    const targetStance: RiderStance =
      this.riderStance === nextStance && nextStance !== 'NORMAL'
        ? 'NORMAL'
        : nextStance;
    this.riderStance = targetStance;

    if (targetStance === 'NORMAL') {
      this.addCallout('ATTACK PEGS STANCE', 50, '#94A3B8');
      bikeAudio.playSuspensionThud(0.25);
      return;
    }

    const prepLabels: Record<Exclude<RiderStance, 'NORMAL'>, string> = {
      KNEE_ON_SEAT: 'KNEE ON SEAT SET — HIT THROTTLE TO WHEELIE!',
      FOOT_ON_SEAT: 'BOOTS ON SEAT STAND — HIT THROTTLE TO WHEELIE!',
      SUBCAGE_LOCK: 'FOOT IN 12-BAR CAGE — HIT THROTTLE TO WHEELIE!',
      HIGH_CHAIR: 'HIGH-CHAIR ON TANK — HIT THROTTLE TO WHEELIE!',
    };

    const midWheelieLabels: Record<Exclude<RiderStance, 'NORMAL'>, string> = {
      KNEE_ON_SEAT: 'KNEE-ON-SEAT STANCE!',
      FOOT_ON_SEAT: 'DOUBLE BOOT SEAT STAND!',
      SUBCAGE_LOCK: '12-BAR SUB-CAGE FOOT LOCK!',
      HIGH_CHAIR: 'TANK HIGH-CHAIR SWITCH!',
    };

    // Compress rear suspension from planting foot/knee onto the seat!
    this.rearComp = Math.min(0.9, this.rearComp + 0.36);
    this.riderSquash = -0.22;
    this.seatPreloadTimer = 2.4;
    bikeAudio.playSuspensionThud(0.45);

    if (this.inWheelie) {
      this.tricksLanded++;
      this.comboMultiplier = Math.min(15, this.comboMultiplier + 1);
      const bonus = 420 * this.comboMultiplier;
      this.currentWheelieScore += bonus;
      this.addCallout(midWheelieLabels[targetStance], bonus, '#38BDF8');
      bikeAudio.playTrickChime(this.comboMultiplier);
    } else {
      // Pre-wheelie stance set on flat ground! Give a subtle suspension bounce impulse
      this.angularVel += 0.32;
      this.addCallout(prepLabels[targetStance], 150, '#10B981');
      bikeAudio.playTrickChime(2);
    }
  }

  public shiftGear(delta: number, isManualAction: boolean = true) {
    const nextGear = Math.max(1, Math.min(this.maxGear, this.gear + delta));
    if (nextGear === this.gear) return;

    const up = nextGear > this.gear;
    this.gear = nextGear;
    this.exhaustFlameIntensity = 1.0; // Exhaust backfire pop on gearshift!
    bikeAudio.playGearShift(up);

    if (up) {
      this.rpm = Math.max(2600, this.rpm * 0.72);
      const angleDeg = (this.angle * 180) / Math.PI;
      if (isManualAction && angleDeg >= 42 && !this.isCrashed) {
        const bonus = 250 * this.comboMultiplier;
        this.currentWheelieScore += bonus;
        this.addCallout(`GEAR ${this.gear} WHEELIE SHIFT!`, bonus, '#38BDF8');
      }
    } else {
      this.rpm = Math.min(this.maxRpm, this.rpm * 1.28);
      if (!this.clutchPulled && !this.isAirborne) {
        this.angularVel -= 0.22;
      }
    }
  }

  private ensureHazardsAhead() {
    // Street maps are clean, obstacle-free asphalt with no water slicks, speed bumps, or ramps
    if (this.course.environmentType === 'STREET' || this.course.hazardFrequency <= 0) {
      this.hazards = [];
      return;
    }

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
    if (this.course.environmentType === 'STREET') {
      return 420;
    }

    const base =
      Math.sin(worldX * 0.0011) * 32 +
      Math.sin(worldX * 0.00043 + 1.2) * 58 +
      Math.cos(worldX * 0.0024) * 10;

    const haz = this.getHazardAt(worldX);
    let mod = 0;
    if (haz) {
      const t = (worldX - haz.startX) / (haz.endX - haz.startX);
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

  public recordSkidMark(isScrapeSpark: boolean, intensity: number = 1) {
    const worldX = this.x / PX_PER_METER;
    if (Math.abs(worldX - this.lastSkidWorldX) < 0.38) return;
    this.lastSkidWorldX = worldX;

    const worldY = (420 - this.y) / PX_PER_METER;
    const slot = this.skidMarks[this.nextSkidIndex];
    slot.active = true;
    slot.worldX = worldX;
    slot.worldY = worldY;
    slot.worldZ = this.lateralZ;
    slot.isScrapeSpark = isScrapeSpark;
    slot.intensity = intensity;

    this.nextSkidIndex = (this.nextSkidIndex + 1) % MAX_SKID_MARKS;
  }

  public spawnParticle(
    x: number,
    y: number,
    vx: number,
    vy: number,
    size: number,
    maxLife: number,
    color: string,
    kind: Particle['kind'],
    z: number = this.lateralZ,
    vz: number = (Math.random() - 0.5) * 1.4
  ) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = x;
        p.y = y;
        p.z = z;
        p.vx = vx;
        p.vy = vy;
        p.vz = vz;
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

    if (this.screenFlash > 0) {
      this.screenFlash = Math.max(0, this.screenFlash - dt * 3.8);
    }
    if (this.shakeTrauma > 0) {
      this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 1.9);
    }
    if (this.exhaustFlameIntensity > 0) {
      this.exhaustFlameIntensity = Math.max(0, this.exhaustFlameIntensity - dt * 4.5);
    }
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateParticles(dt * 0.25);
      return;
    }

    const now = performance.now();
    this.callouts = this.callouts.filter((c) => now - c.timestamp < 1900);

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

    // 1b. 3D Lateral Lane Steering & One-Wheel Swerve Carving (Z / X or Steer Buttons)
    let steerDir = 0;
    if (effectiveInput.steerLeft) steerDir -= 1;
    if (effectiveInput.steerRight) steerDir += 1;

    const targetVz = steerDir * 4.6;
    this.vz += (targetVz - this.vz) * Math.min(1, dt * 8);
    const prevZ = this.lateralZ;
    this.lateralZ = Math.max(-4.8, Math.min(4.8, this.lateralZ + this.vz * dt));

    // Dynamic 3D Roll/Lean angle when carving across lanes
    const targetRoll = -this.vz * (this.inWheelie ? 0.095 : 0.065);
    this.rollAngle += (targetRoll - this.rollAngle) * Math.min(1, dt * 10);

    // Award One-Wheel Swerve Carve Bonus!
    if (this.inWheelie && Math.abs(this.lateralZ - prevZ) > 0.001) {
      this.swerveAccumM += Math.abs(this.lateralZ - prevZ);
      const swerveTier = Math.floor(this.swerveAccumM / 7.5);
      if (swerveTier > this.swerveBonusCount) {
        this.swerveBonusCount = swerveTier;
        const bonus = 300 * this.comboMultiplier;
        this.currentWheelieScore += bonus;
        this.addCallout('ONE-WHEEL SWERVE CARVE!', bonus, '#38BDF8');
        bikeAudio.playTrickChime(this.comboMultiplier);
      }
    }

    // 2. Manual Gearshift inputs (E / Gear+ and Q / Gear-)
    if (effectiveInput.justPressedShiftUp) {
      this.shiftGear(1, true);
    } else if (effectiveInput.justPressedShiftDown) {
      this.shiftGear(-1, true);
    }

    // 3. Clutch Lever Physics & Clutch-In Balance Coaster Detection!
    const angleDeg = (this.angle * 180) / Math.PI;
    const gearRatioFactor = 1.52 - (this.gear - 1) * 0.145;

    this.clutchPulled = effectiveInput.clutchHeld;
    if (this.clutchCooldown > 0) {
      this.clutchCooldown = Math.max(0, this.clutchCooldown - dt);
    }

    if (this.clutchPulled) {
      const revRate = effectiveInput.throttle ? 2.8 : 1.5;
      this.clutchCharge = Math.min(1, this.clutchCharge + dt * revRate);
      const revTarget = effectiveInput.throttle ? this.maxRpm : 3400;
      this.rpm += (revTarget - this.rpm) * Math.min(1, dt * 18);

      // Check for Clutch-In Coaster when balanced in sweet spot!
      if (angleDeg >= this.bike.balanceSweetSpotMin - 4 && !this.isAirborne) {
        const prevCoasting = this.isCoasting;
        this.coasterTimer += dt;
        if (this.coasterTimer >= 0.55) {
          this.isCoasting = true;
          this.activeTrick = 'COASTER';
          if (!prevCoasting) {
            const coasterPts = 400 * this.comboMultiplier;
            this.currentWheelieScore += coasterPts;
            this.addCallout('CLUTCH-IN COASTER!', coasterPts, '#38BDF8');
            bikeAudio.playTrickChime(this.comboMultiplier);
          }
        }
      }
    } else if (effectiveInput.justReleasedClutch && this.clutchCharge > 0.15 && !this.isAirborne) {
      // CLUTCH DUMP! Deliver stored flywheel angular momentum into rear tire
      const dumpPower = 0.45 + this.clutchCharge * 0.75;
      const liftImpulse =
        ((2.45 * dumpPower * this.bike.torqueMultiplier * gearRatioFactor) /
          this.bike.rotationalInertia) *
        (angleDeg < 55 ? 1.0 : 0.55);

      this.angularVel += liftImpulse;
      this.vx += 56 * dumpPower;
      this.activeTrick = 'CLUTCH_POP';
      this.trickTimer = 0.65;
      this.exhaustFlameIntensity = 1.0;
      this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.25 * dumpPower);
      this.recordSkidMark(false, 1.0);
      bikeAudio.playClutchPop();

      const pts = Math.round(150 * dumpPower * this.comboMultiplier);
      this.currentWheelieScore += pts;
      this.addCallout(
        this.clutchCharge > 0.75 ? 'REDLINE CLUTCH DUMP!' : 'CLUTCH KICK!',
        pts,
        '#FF5500'
      );

      const isStreet = this.course.environmentType === 'STREET';
      for (let i = 0; i < 8; i++) {
        this.spawnParticle(
          this.x - 18,
          this.y - 4,
          -this.vx * (0.4 + Math.random() * 0.5),
          -Math.random() * (isStreet ? 70 : 190) - 20,
          4 + Math.random() * 4,
          0.45,
          isStreet ? 'rgba(226, 232, 240, 0.42)' : this.course.groundSurface,
          isStreet ? 'smoke' : 'dirt'
        );
      }
      this.clutchCharge = 0;
      this.coasterTimer = 0;
      this.isCoasting = false;
    } else {
      this.clutchCharge = Math.max(0, this.clutchCharge - dt * 3.5);
      this.coasterTimer = 0;
      if (this.isCoasting) {
        this.isCoasting = false;
        if (this.activeTrick === 'COASTER') this.activeTrick = 'NONE';
      }
    }

    // 3b. Stunt Nitro Boost (Hold F or Boost Button)
    if (effectiveInput.boostHeld && this.boostCharge > 0.05 && !this.isCrashed) {
      this.boostActive = true;
      this.boostCharge = Math.max(0, this.boostCharge - dt * 0.38);
      this.exhaustFlameIntensity = 1.0;
      this.shakeTrauma = Math.max(this.shakeTrauma, 0.16);
      this.recordSkidMark(false, 0.85);
    } else {
      this.boostActive = false;
      const rechargeRate = this.isScraping ? 0.28 : this.inSweetSpot ? 0.14 : 0.035;
      this.boostCharge = Math.min(1, this.boostCharge + dt * rechargeRate);
    }

    if (this.seatPreloadTimer > 0) {
      this.seatPreloadTimer = Math.max(0, this.seatPreloadTimer - dt);
    }

    // 4. Stunt Stance System (Put Foot/Knee on Seat BEFORE or DURING Wheelie) & Flair Tricks
    if (effectiveInput.justPressedStanceCycle) {
      this.cycleRiderStance();
    } else if (effectiveInput.justPressedTrick1) {
      this.setRiderStance('KNEE_ON_SEAT');
    } else if (effectiveInput.justPressedTrick2) {
      this.setRiderStance('FOOT_ON_SEAT');
    } else if (effectiveInput.justPressedTrick3) {
      this.setRiderStance('SUBCAGE_LOCK');
    } else if (effectiveInput.justPressedTrick4) {
      this.setRiderStance('HIGH_CHAIR');
    }

    if (effectiveInput.justPressedStunt) {
      if (angleDeg < 34 && this.clutchCooldown <= 0 && !this.isAirborne) {
        this.clutchCooldown = 0.75;
        this.rpm = Math.min(this.maxRpm, this.rpm + 3500);
        const stancePopBoost = this.riderStance !== 'NORMAL' ? 1.24 : 1.0;
        this.angularVel +=
          (2.4 * stancePopBoost * this.bike.torqueMultiplier * gearRatioFactor) /
          this.bike.rotationalInertia;
        this.vx += 46;
        this.activeTrick = 'CLUTCH_POP';
        this.trickTimer = 0.65;
        this.exhaustFlameIntensity = 0.95;
        this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.24);
        this.recordSkidMark(false, 0.9);
        bikeAudio.playClutchPop();
        const popLabel =
          this.riderStance === 'FOOT_ON_SEAT'
            ? 'SEAT-STAND BOUNCE POP!'
            : this.riderStance === 'KNEE_ON_SEAT'
            ? 'KNEE-ON-SEAT POP!'
            : 'CLUTCH POP!';
        this.addCallout(popLabel, 250, '#FF5500');
        this.currentWheelieScore += 250;
      } else if (angleDeg >= 34) {
        const tricks: TrickType[] = ['ONE_HANDER', 'NAC_NAC', 'BAR_HOP', 'SEAT_STAND'];
        const chosen = tricks[this.trickCycleIndex % tricks.length];
        this.trickCycleIndex++;
        this.triggerWheelieStunt(chosen);
      }
    }

    if (this.trickTimer > 0) {
      this.trickTimer -= dt;
      if (
        this.trickTimer <= 0 &&
        this.activeTrick !== 'FENDER_SCRAPE' &&
        this.activeTrick !== 'COASTER'
      ) {
        this.activeTrick = 'NONE';
      }
    }

    // 5. Drivetrain, 6-Speed Gear Ratios & RPM
    const speedKmh = (this.vx / PX_PER_METER) * 3.6;
    const maxSpd = this.bike.maxSpeedKmh * (this.boostActive ? 1.18 : 1.0);
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
    const throttleVal = effectiveInput.throttle || this.boostActive ? 1 : 0;

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
    if (revLimiterCut && Math.random() < 0.35) {
      this.exhaustFlameIntensity = 0.85;
    }

    if (
      (effectiveInput.throttle || this.boostActive) &&
      !this.clutchPulled &&
      !this.isAirborne &&
      !revLimiterCut &&
      speedKmh < maxSpd
    ) {
      const boostMult = this.boostActive ? 1.45 : 1.0;
      forwardAccel += 395 * this.bike.torqueMultiplier * gearRatioFactor * boostMult;
    }

    if (effectiveInput.brake) {
      if (this.rearBrakeHeat < 0.15) {
        bikeAudio.playBrakeTap();
      }
      this.rearBrakeHeat = Math.min(1, this.rearBrakeHeat + dt * 3.4);
      if (!this.isAirborne) {
        forwardAccel -= 310 * this.bike.brakeAuthority;
        if (this.rearBrakeHeat > 0.35) {
          this.recordSkidMark(false, 0.7);
        }
      }
    } else {
      this.rearBrakeHeat = Math.max(0, this.rearBrakeHeat - dt * 2.2);
    }

    const baseDrag = inMud ? (angleDeg > 28 ? 0.35 : 2.15) : 0.22;
    forwardAccel -= this.vx * baseDrag;

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

      if (terrainVelY > 240 && this.vx > 240) {
        this.isAirborne = true;
        this.vy = -Math.sin(Math.max(0.18, terrainSlope)) * this.vx * 0.92 - 95;
      } else {
        const prevY = this.y;
        this.y = terrainY;
        const bumpImpulse = (prevY - this.y) / Math.max(0.008, dt);
        this.rearCompVel += bumpImpulse * 0.0018;
      }
    } else {
      this.vy += 860 * dt;
      this.y += this.vy * dt;

      if (this.y >= terrainY) {
        const impactSpeed = Math.abs(this.vy);
        this.y = terrainY;
        this.vy = 0;
        this.isAirborne = false;
        this.rearComp = Math.min(0.95, 0.25 + impactSpeed * 0.0014);
        this.riderSquash = -Math.min(0.28, impactSpeed * 0.0006);

        if (impactSpeed > 180) {
          this.shakeTrauma = Math.min(1, this.shakeTrauma + impactSpeed * 0.001);
          bikeAudio.playSuspensionThud(impactSpeed / 420);

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

          if (angleDeg >= 32 && angleDeg <= 86) {
            const bonus = 400 * this.comboMultiplier;
            this.currentWheelieScore += bonus;
            this.addCallout('WHEELIE LANDING!', bonus, '#10B981');
            bikeAudio.playTrickChime(this.comboMultiplier);
          }
        }
      }
    }

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
        const engineBrakeFactor = this.clutchPulled ? 0.52 : 1.0;
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

    if ((effectiveInput.throttle || this.boostActive) && !this.clutchPulled && !this.isAirborne) {
      const angleLiftCurve = this.angle < balanceAngleRad ? 1.15 : 0.72;
      const stanceLiftBoost =
        this.riderStance === 'FOOT_ON_SEAT'
          ? 1.28
          : this.riderStance === 'KNEE_ON_SEAT' || this.riderStance === 'SUBCAGE_LOCK'
          ? 1.22
          : this.riderStance === 'HIGH_CHAIR'
          ? 1.18
          : 1.0;
      const preloadBounceBoost =
        !this.inWheelie && this.seatPreloadTimer > 0 ? 1.18 : 1.0;
      const stuntCenterOfMassBoost =
        (this.activeTrick === 'SEAT_STAND' || this.activeTrick === 'BAR_HOP' ? 1.14 : 1.0) *
        stanceLiftBoost *
        preloadBounceBoost;
      const revLimiterTorqueFactor = revLimiterCut ? 0.45 : 1.0;
      const boostLift = this.boostActive ? 1.2 : 1.0;
      netTorque +=
        5.35 *
        this.bike.torqueMultiplier *
        gearRatioFactor *
        angleLiftCurve *
        stuntCenterOfMassBoost *
        revLimiterTorqueFactor *
        boostLift;
    }

    netTorque += -this.riderLean * 1.45;

    if (effectiveInput.brake) {
      const brakePitchAuthority = this.isAirborne ? 3.8 : 7.8;
      netTorque -= brakePitchAuthority * this.bike.brakeAuthority;
    }

    if (inWind) {
      netTorque += 1.65;
    }

    if (currentHazard?.type === 'WHOOPS' && !this.isAirborne) {
      netTorque += Math.sin(this.x * 0.055) * 1.1;
    }

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
      this.recordSkidMark(true, 1.0);

      if (this.scrapeTimer === 0) {
        this.scrapeCount++;
        this.comboMultiplier = Math.min(15, this.comboMultiplier + 1);
        this.addCallout('12 O’CLOCK TAIL SCRAPE!', 500 * this.comboMultiplier, '#F59E0B');
        bikeAudio.playTrickChime(this.comboMultiplier);
      }
      this.scrapeTimer += dt;

      const fenderTipX = this.x - Math.cos(this.angle + 0.42) * 54;
      const fenderTipY = this.y - 16 + Math.sin(this.angle - 1.15) * 18;
      const sparkPrimaryColor =
        this.dailyState.activeCosmetic === 'CYAN_SPARKS'
          ? '#22D3EE'
          : this.dailyState.activeCosmetic === 'PLASMA_FLAME'
          ? '#C084FC'
          : '#FBBF24';
      for (let i = 0; i < 5; i++) {
        this.spawnParticle(
          fenderTipX,
          Math.min(this.y - 2, fenderTipY),
          -this.vx * (0.25 + Math.random() * 0.45),
          -Math.random() * 230 - 30,
          2.2 + Math.random() * 2.5,
          0.24 + Math.random() * 0.26,
          Math.random() > 0.3 ? sparkPrimaryColor : '#38BDF8',
          'spark',
          this.lateralZ + (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 3.2
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

    // 11. Wheelie Distance, Sweet-Spot Combo, Coaster & Challenge Progression
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

        // Reward player for planting Foot or Knee on the Seat BEFORE popping the wheelie!
        if (this.riderStance !== 'NORMAL') {
          this.tricksLanded++;
          this.comboMultiplier = 2;
          const launchLabels: Record<Exclude<RiderStance, 'NORMAL'>, string> = {
            KNEE_ON_SEAT: 'KNEE-ON-SEAT WHEELIE LAUNCH!',
            FOOT_ON_SEAT: 'FOOT-ON-SEAT STAND LAUNCH!',
            SUBCAGE_LOCK: '12-BAR FOOT-LOCK LAUNCH!',
            HIGH_CHAIR: 'HIGH-CHAIR TANK LAUNCH!',
          };
          const launchBonus =
            this.riderStance === 'HIGH_CHAIR'
              ? 850
              : this.riderStance === 'FOOT_ON_SEAT'
              ? 750
              : 650;
          this.currentWheelieScore += launchBonus;
          this.addCallout(launchLabels[this.riderStance], launchBonus, '#10B981');
          bikeAudio.playTrickChime(4);
        }
      }

      this.wheelieDistanceM = Math.max(0, Math.floor((this.x - this.wheelieStartX) / PX_PER_METER));
      if (this.wheelieDistanceM > this.bestWheelieDistanceM && this.gameState === 'PLAYING') {
        this.bestWheelieDistanceM = this.wheelieDistanceM;
      }

      const angleFactor = updatedAngleDeg / 65;
      const sweetSpotBonus = this.inSweetSpot ? 2.4 : 1.0;
      const scrapeBonus = this.isScraping ? 4.2 : 1.0;
      const coasterBonus = this.isCoasting ? 2.2 : 1.0;
      const boostBonus = this.boostActive ? 1.75 : 1.0;
      const stanceBonus =
        this.riderStance === 'HIGH_CHAIR'
          ? 2.1
          : this.riderStance === 'FOOT_ON_SEAT'
          ? 1.95
          : this.riderStance === 'SUBCAGE_LOCK'
          ? 1.8
          : this.riderStance === 'KNEE_ON_SEAT'
          ? 1.65
          : 1.0;
      const trickBonus =
        this.activeTrick !== 'NONE' && this.activeTrick !== 'CLUTCH_POP' ? 1.85 : 1.0;

      const pointsPerSec =
        85 *
        angleFactor *
        sweetSpotBonus *
        scrapeBonus *
        coasterBonus *
        boostBonus *
        stanceBonus *
        trickBonus *
        this.comboMultiplier;
      this.currentWheelieScore += pointsPerSec * dt;

      const distanceTier = 1 + Math.floor(this.wheelieDistanceM / 35);
      if (distanceTier > this.comboMultiplier) {
        this.comboMultiplier = Math.min(15, distanceTier);
        this.addCallout(
          `${this.comboMultiplier}X BALANCE STREAK`,
          250 * this.comboMultiplier,
          '#10B981'
        );
        bikeAudio.playTrickChime(this.comboMultiplier);
      }
    } else if (this.inWheelie && !this.isAirborne) {
      const banked = Math.round(this.currentWheelieScore);
      if (banked > 50) {
        this.score += banked;
        this.totalCareerXp += Math.round(banked * 0.25);
        if (this.wheelieDistanceM >= 15) {
          this.addCallout(`BANKED ${this.wheelieDistanceM}M WHEELIE!`, banked, '#38BDF8');
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

    // Check Live Mission Challenge & Procedural Daily Challenges completion
    if (this.gameState === 'PLAYING') {
      this.checkChallengeCompletion();
      this.checkDailyChallenges(totalLiveScore);
    }

    // 12. Emit Dirt Roost (Dirt Trails only) & Exhaust Smoke Particles
    if (
      this.course.environmentType === 'DIRT' &&
      effectiveInput.throttle &&
      !this.clutchPulled &&
      !this.isAirborne &&
      Math.random() < 0.75
    ) {
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

    bikeAudio.updateEngine(
      this.rpm,
      this.maxRpm,
      this.clutchPulled ? 1 : throttleVal,
      this.bike.strokeType === '2-STROKE',
      this.isScraping,
      this.gameState === 'PLAYING'
    );
  }

  private getActiveChallengeSnapshot(): ActiveChallenge {
    const typeIdx = this.challengeIndex % 5;
    const target = this.challengeTargets[typeIdx];
    if (typeIdx === 0) {
      return {
        title: `HOLD A ${target}M WHEELIE`,
        progress: Math.min(target, this.wheelieDistanceM),
        target,
        unit: 'M',
        rewardPts: 1500,
      };
    } else if (typeIdx === 1) {
      return {
        title: `SCRAPE 12 O’CLOCK ${target} TIMES`,
        progress: Math.min(target, this.scrapeCount),
        target,
        unit: 'SCRAPES',
        rewardPts: 2000,
      };
    } else if (typeIdx === 2) {
      return {
        title: `LAND ${target} STUNT TRICKS`,
        progress: Math.min(target, this.tricksLanded),
        target,
        unit: 'TRICKS',
        rewardPts: 1800,
      };
    } else if (typeIdx === 3) {
      return {
        title: `CHASE UP TO GEAR ${target} IN WHEELIE`,
        progress: this.inWheelie ? Math.min(target, this.gear) : 0,
        target,
        unit: 'GEAR',
        rewardPts: 2200,
      };
    } else {
      return {
        title: `SWERVE CARVE ${target}M ON ONE WHEEL`,
        progress: Math.min(target, Math.floor(this.swerveAccumM)),
        target,
        unit: 'M',
        rewardPts: 2500,
      };
    }
  }

  private checkChallengeCompletion() {
    const ch = this.getActiveChallengeSnapshot();
    if (ch.progress >= ch.target) {
      this.score += ch.rewardPts;
      this.totalCareerXp += 750;
      this.addCallout(`MISSION COMPLETE: +${ch.rewardPts} PTS!`, ch.rewardPts, '#10B981');
      bikeAudio.playTrickChime(8);

      const typeIdx = this.challengeIndex % 5;
      if (typeIdx === 0) this.challengeTargets[0] += 45;
      else if (typeIdx === 1) this.challengeTargets[1] += 2;
      else if (typeIdx === 2) this.challengeTargets[2] += 3;
      else if (typeIdx === 3) this.challengeTargets[3] = Math.min(6, this.challengeTargets[3] + 1);
      else this.challengeTargets[4] += 15;

      this.challengeIndex++;
    }
  }

  private checkDailyChallenges(totalLiveScore: number) {
    let anyChanged = false;
    let newlyCompletedCount = 0;

    for (let i = 0; i < this.dailyState.challenges.length; i++) {
      const ch = this.dailyState.challenges[i];
      if (ch.completed) continue;

      // Check course / environment / bike category filter
      if (ch.requiredCourseId && this.course.id !== ch.requiredCourseId) continue;
      if (
        ch.requiredEnvironment &&
        this.course.environmentType !== ch.requiredEnvironment
      ) {
        continue;
      }
      if (
        ch.requiredBikeCategory &&
        this.bike.category !== ch.requiredBikeCategory
      ) {
        continue;
      }

      let liveVal = ch.progress;
      if (ch.kind === 'WHEELIE_DIST_ON_COURSE') {
        liveVal = Math.max(ch.progress, this.wheelieDistanceM);
      } else if (ch.kind === 'SCRAPE_COUNT_ON_CATEGORY') {
        liveVal = Math.max(ch.progress, this.scrapeCount);
      } else if (ch.kind === 'TRICKS_IN_RUN') {
        liveVal = Math.max(ch.progress, this.tricksLanded);
      } else if (ch.kind === 'SWERVE_DIST_ON_ENV') {
        liveVal = Math.max(ch.progress, Math.floor(this.swerveAccumM));
      } else if (ch.kind === 'SCORE_ON_COURSE') {
        liveVal = Math.max(ch.progress, totalLiveScore);
      } else if (ch.kind === 'HIGH_GEAR_WHEELIE') {
        liveVal = Math.max(ch.progress, this.inWheelie ? this.gear : 0);
      }

      const clamped = Math.min(ch.target, liveVal);
      if (clamped !== ch.progress) {
        ch.progress = clamped;
        anyChanged = true;
      }

      if (ch.progress >= ch.target && !ch.completed) {
        ch.completed = true;
        anyChanged = true;
        newlyCompletedCount++;
        this.dailyState.completedTotalAllTime =
          (this.dailyState.completedTotalAllTime || 0) + 1;
        this.score += ch.rewardXp;
        this.totalCareerXp += ch.rewardXp;
        this.addCallout(
          `DAILY CHALLENGE COMPLETE! +${ch.rewardXp.toLocaleString()} XP`,
          ch.rewardXp,
          '#FBBF24'
        );
        bikeAudio.playTrickChime(12);
      }
    }

    if (anyChanged) {
      const completedCount = this.dailyState.challenges.filter(
        (c) => c.completed
      ).length;
      const prevUnlocked = this.dailyState.rewardTiers.filter(
        (t) => t.unlocked
      ).length;
      this.dailyState.rewardTiers = buildRewardTiers(completedCount);

      if (completedCount > prevUnlocked && newlyCompletedCount > 0) {
        const unlockedTier = this.dailyState.rewardTiers[completedCount - 1];
        if (unlockedTier) {
          this.totalCareerXp += unlockedTier.xpBonus;
          this.dailyState.activeCosmetic = unlockedTier.cosmeticId;
          this.addCallout(
            `REWARD UNLOCKED: ${unlockedTier.cosmeticName}!`,
            unlockedTier.xpBonus,
            '#38BDF8'
          );
        }
      }

      saveDailyChallengeState(this.dailyState);
      try {
        localStorage.setItem('twelve_oclock_career_xp', String(this.totalCareerXp));
      } catch {
        // Ignore storage errors
      }
    }
  }

  private triggerWheelieStunt(trick: TrickType) {
    this.activeTrick = trick;
    this.trickTimer = 1.4;
    this.tricksLanded++;
    this.comboMultiplier = Math.min(15, this.comboMultiplier + 1);

    const labels: Record<TrickType, string> = {
      NONE: '',
      CLUTCH_POP: 'CLUTCH POP',
      ONE_HANDER: 'NO-HANDER SALUTE!',
      SEAT_STAND: 'HIGH-CHAIR SEAT STAND!',
      NAC_NAC: 'WHIP NAC-NAC!',
      BAR_HOP: 'HANDLEBAR FOOT PLANT!',
      COASTER: 'CLUTCH-IN COASTER!',
      FENDER_SCRAPE: '12 O’CLOCK SCRAPE!',
    };

    const bonus = (trick === 'BAR_HOP' ? 450 : 350) * this.comboMultiplier;
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
    this.totalCareerXp += Math.round(finalScore * 0.15);
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
    }
    try {
      localStorage.setItem('twelve_oclock_best_score', String(this.bestScore));
      localStorage.setItem('twelve_oclock_best_dist', String(this.bestWheelieDistanceM));
      localStorage.setItem('twelve_oclock_career_xp', String(this.totalCareerXp));
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
      p.z += p.vz * dt;

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
    const now = performance.now();
    const targetAngle = 76 + Math.sin(now * 0.0016) * 8;
    const predictedAngle = angleDeg + ((this.angularVel * 180) / Math.PI) * 0.22;

    const throttle = predictedAngle < targetAngle || this.vx < 260;
    const brake = predictedAngle > targetAngle + 4.5 || angleDeg > 84;
    const leanBack = angleDeg > 40 && angleDeg < 74;
    const leanForward = angleDeg > 80;
    const swerveWave = Math.sin(now * 0.0011);
    const popTrick =
      angleDeg > 64 &&
      angleDeg < 79 &&
      this.trickTimer <= 0 &&
      Math.random() < 0.015;

    return {
      throttle,
      brake,
      leanBack,
      leanForward,
      steerLeft: swerveWave < -0.35,
      steerRight: swerveWave > 0.35,
      clutchHeld: false,
      justReleasedClutch: false,
      boostHeld: false,
      justPressedShiftUp: false,
      justPressedShiftDown: false,
      stuntHeld: false,
      justPressedStunt:
        popTrick || (angleDeg < 12 && this.clutchCooldown <= 0 && Math.random() < 0.04),
      justPressedStanceCycle: Math.random() < 0.004,
      justPressedTrick1: false,
      justPressedTrick2: false,
      justPressedTrick3: false,
      justPressedTrick4: false,
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

    const riderLevel = 1 + Math.floor(this.totalCareerXp / 2500);
    const rankIdx = Math.min(RIDER_RANKS.length - 1, Math.floor((riderLevel - 1) / 2));

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
      boostCharge: this.boostCharge,
      boostActive: this.boostActive,
      wheelieAngleDeg: angleDeg,
      angularVelocityDeg: Math.round((this.angularVel * 180) / Math.PI),
      lateralOffsetM: Number(this.lateralZ.toFixed(1)),
      rollAngleDeg: Math.round((this.rollAngle * 180) / Math.PI),
      inWheelie: this.inWheelie,
      inSweetSpot: this.inSweetSpot,
      isScraping: this.isScraping,
      isCoasting: this.isCoasting,
      riderStance: this.riderStance,
      activeTrick: this.activeTrick,
      rearBrakeHeat: this.rearBrakeHeat,
      activeHazard: currentHaz ? currentHaz.type : 'NONE',
      upcomingHazard: upcoming,
      activeChallenge: this.getActiveChallengeSnapshot(),
      dailyState: this.dailyState,
      riderLevel,
      riderRankTitle: RIDER_RANKS[rankIdx],
      callouts: this.callouts,
      crashReason: this.crashReason,
      scrapeCount: this.scrapeCount,
      tricksLanded: this.tricksLanded,
    };
  }
}
