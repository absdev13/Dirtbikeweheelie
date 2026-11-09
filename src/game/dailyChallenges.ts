import { BIKES, BikeConfig, COURSES, CourseConfig } from './types';

export type DailyObjectiveKind =
  | 'WHEELIE_DIST_ON_COURSE'
  | 'SCRAPE_COUNT_ON_CATEGORY'
  | 'TRICKS_IN_RUN'
  | 'SWERVE_DIST_ON_ENV'
  | 'HIGH_GEAR_WHEELIE'
  | 'SCORE_ON_COURSE';

export type RewardCosmeticId =
  | 'DEFAULT'
  | 'CYAN_SPARKS'
  | 'GOLD_TRIM'
  | 'PLASMA_FLAME';

export interface DailyChallengeItem {
  id: string;
  slotIndex: number; // 0, 1, 2
  kind: DailyObjectiveKind;
  title: string;
  subtitle: string;
  target: number;
  progress: number;
  unit: string;
  completed: boolean;
  rewardXp: number;
  // Optional required course, environment, or bike category
  requiredCourseId?: CourseConfig['id'];
  requiredEnvironment?: 'STREET' | 'DIRT';
  requiredBikeCategory?: 'SUPERMOTO' | 'DIRTBIKE';
}

export interface DailyRewardTier {
  tier: 1 | 2 | 3;
  requiredCount: number;
  label: string;
  xpBonus: number;
  cosmeticId: RewardCosmeticId;
  cosmeticName: string;
  unlocked: boolean;
}

export interface DailyChallengeState {
  dateKey: string; // YYYY-MM-DD
  seedOffset: number; // 0 for official daily, >0 if user rolls bonus daily set
  streakDays: number;
  completedTotalAllTime: number;
  activeCosmetic: RewardCosmeticId;
  challenges: DailyChallengeItem[];
  rewardTiers: DailyRewardTier[];
}

const STORAGE_KEY = 'twelve_oclock_daily_challenges_v1';

// Deterministic string hash (FNV-1a)
function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Deterministic PRNG (Mulberry32)
function createSeededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getTodayDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTimeUntilNextDailyReset(): string {
  const now = new Date();
  const tomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0
  );
  const diffMs = Math.max(0, tomorrow.getTime() - now.getTime());
  const totalSec = Math.floor(diffMs / 1000);
  const hrs = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const mins = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const secs = String(totalSec % 60).padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}

export function generateDailyChallengesForDate(
  dateKey: string,
  seedOffset: number = 0
): DailyChallengeItem[] {
  const seed = hashString(`${dateKey}#${seedOffset}`);
  const rand = createSeededRandom(seed);

  // Slot 1: Map-specific Wheelie Distance Challenge (e.g., "Pop a 100m wheelie on the desert map")
  const courseIdx = Math.floor(rand() * COURSES.length);
  const targetCourse = COURSES[courseIdx];
  const distOptions = [80, 100, 120, 150];
  const targetDist = distOptions[Math.floor(rand() * distOptions.length)];
  const mapNoun =
    targetCourse.environmentType === 'DIRT' ? 'desert/dirt map' : 'street map';

  const challenge1: DailyChallengeItem = {
    id: `${dateKey}_${seedOffset}_slot0`,
    slotIndex: 0,
    kind: 'WHEELIE_DIST_ON_COURSE',
    title: `Pop a ${targetDist}m wheelie on ${targetCourse.name}`,
    subtitle: `Hold a continuous ${targetDist}m wheelie on the ${targetCourse.name} (${mapNoun}).`,
    target: targetDist,
    progress: 0,
    unit: 'M',
    completed: false,
    rewardXp: 2500,
    requiredCourseId: targetCourse.id,
  };

  // Slot 2: Bike-Category Scrape or Swerve Carve Challenge
  const useScrape = rand() > 0.35;
  let challenge2: DailyChallengeItem;

  if (useScrape) {
    const reqCat: 'SUPERMOTO' | 'DIRTBIKE' =
      rand() > 0.45 ? 'SUPERMOTO' : 'DIRTBIKE';
    const scrapeTarget = 3 + Math.floor(rand() * 4); // 3..6 scrapes
    challenge2 = {
      id: `${dateKey}_${seedOffset}_slot1`,
      slotIndex: 1,
      kind: 'SCRAPE_COUNT_ON_CATEGORY',
      title: `Scrape 12 O’Clock ${scrapeTarget}× on a ${
        reqCat === 'SUPERMOTO' ? 'Supermoto' : 'Dirtbike'
      }`,
      subtitle: `Hit ${scrapeTarget} titanium tail-scrapes in a single run riding any ${reqCat}.`,
      target: scrapeTarget,
      progress: 0,
      unit: 'SCRAPES',
      completed: false,
      rewardXp: 3000,
      requiredBikeCategory: reqCat,
    };
  } else {
    const reqEnv: 'STREET' | 'DIRT' = rand() > 0.4 ? 'STREET' : 'DIRT';
    const swerveTarget = [20, 30, 40][Math.floor(rand() * 3)];
    challenge2 = {
      id: `${dateKey}_${seedOffset}_slot1`,
      slotIndex: 1,
      kind: 'SWERVE_DIST_ON_ENV',
      title: `Carve ${swerveTarget}m of 3D Swerve Wheelies on ${
        reqEnv === 'STREET' ? 'Street Maps' : 'Dirt Trails'
      }`,
      subtitle: `Use Z/X or Carve controls while in a wheelie on any ${reqEnv} course.`,
      target: swerveTarget,
      progress: 0,
      unit: 'M',
      completed: false,
      rewardXp: 3000,
      requiredEnvironment: reqEnv,
    };
  }

  // Slot 3: Stunt Tricks or High-Score Run Challenge
  const useTricks = rand() > 0.45;
  let challenge3: DailyChallengeItem;

  if (useTricks) {
    const trickTarget = 4 + Math.floor(rand() * 5); // 4..8 tricks
    challenge3 = {
      id: `${dateKey}_${seedOffset}_slot2`,
      slotIndex: 2,
      kind: 'TRICKS_IN_RUN',
      title: `Land ${trickTarget} Stunt Tricks in a single run`,
      subtitle: `Combine No-Handers, Seat Stands, Nac-Nacs, or Bar-Hops during one run.`,
      target: trickTarget,
      progress: 0,
      unit: 'TRICKS',
      completed: false,
      rewardXp: 3500,
    };
  } else {
    const scoreCourse = COURSES[(courseIdx + 3) % COURSES.length];
    const scoreTarget = [12000, 16000, 20000][Math.floor(rand() * 3)];
    challenge3 = {
      id: `${dateKey}_${seedOffset}_slot2`,
      slotIndex: 2,
      kind: 'SCORE_ON_COURSE',
      title: `Score ${scoreTarget.toLocaleString()} PTS on ${scoreCourse.name}`,
      subtitle: `Chain sweet-spot combos, coasters, and gear shifts on ${scoreCourse.name}.`,
      target: scoreTarget,
      progress: 0,
      unit: 'PTS',
      completed: false,
      rewardXp: 3500,
      requiredCourseId: scoreCourse.id,
    };
  }

  return [challenge1, challenge2, challenge3];
}

export function buildRewardTiers(completedCount: number): DailyRewardTier[] {
  return [
    {
      tier: 1,
      requiredCount: 1,
      label: 'TIER 1 · BRONZE CRATE',
      xpBonus: 2500,
      cosmeticId: 'CYAN_SPARKS',
      cosmeticName: 'CYBER CYAN 12 O’CLOCK SPARKS',
      unlocked: completedCount >= 1,
    },
    {
      tier: 2,
      requiredCount: 2,
      label: 'TIER 2 · SILVER CRATE',
      xpBonus: 5000,
      cosmeticId: 'GOLD_TRIM',
      cosmeticName: '24K GOLD FACTORY SUB-CAGE',
      unlocked: completedCount >= 2,
    },
    {
      tier: 3,
      requiredCount: 3,
      label: 'TIER 3 · DAILY SWEEP TROPHY',
      xpBonus: 10000,
      cosmeticId: 'PLASMA_FLAME',
      cosmeticName: 'VIOLET PLASMA EXHAUST FLAME',
      unlocked: completedCount >= 3,
    },
  ];
}

export function loadDailyChallengeState(): DailyChallengeState {
  const today = getTodayDateKey();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DailyChallengeState;
      if (parsed && parsed.dateKey === today && Array.isArray(parsed.challenges)) {
        const completedCount = parsed.challenges.filter((c) => c.completed).length;
        parsed.rewardTiers = buildRewardTiers(completedCount);
        return parsed;
      }

      // New calendar day! Preserve streak if yesterday had at least 1 completion
      const prevCompleted = parsed?.challenges?.some((c) => c.completed) ?? false;
      const nextStreak = prevCompleted ? (parsed.streakDays || 1) + 1 : 1;
      const freshChallenges = generateDailyChallengesForDate(today, 0);
      const freshState: DailyChallengeState = {
        dateKey: today,
        seedOffset: 0,
        streakDays: nextStreak,
        completedTotalAllTime: parsed?.completedTotalAllTime || 0,
        activeCosmetic: parsed?.activeCosmetic || 'DEFAULT',
        challenges: freshChallenges,
        rewardTiers: buildRewardTiers(0),
      };
      saveDailyChallengeState(freshState);
      return freshState;
    }
  } catch {
    // Fallback to fresh state
  }

  const initial: DailyChallengeState = {
    dateKey: today,
    seedOffset: 0,
    streakDays: 1,
    completedTotalAllTime: 0,
    activeCosmetic: 'DEFAULT',
    challenges: generateDailyChallengesForDate(today, 0),
    rewardTiers: buildRewardTiers(0),
  };
  saveDailyChallengeState(initial);
  return initial;
}

export function saveDailyChallengeState(state: DailyChallengeState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

export function findMatchingEquipForChallenge(
  challenge: DailyChallengeItem,
  currentBike: BikeConfig,
  currentCourse: CourseConfig
): { bike: BikeConfig; course: CourseConfig } {
  let nextBike = currentBike;
  let nextCourse = currentCourse;

  if (challenge.requiredCourseId) {
    const found = COURSES.find((c) => c.id === challenge.requiredCourseId);
    if (found) nextCourse = found;
  } else if (
    challenge.requiredEnvironment &&
    currentCourse.environmentType !== challenge.requiredEnvironment
  ) {
    const found = COURSES.find(
      (c) => c.environmentType === challenge.requiredEnvironment
    );
    if (found) nextCourse = found;
  }

  if (
    challenge.requiredBikeCategory &&
    currentBike.category !== challenge.requiredBikeCategory
  ) {
    const found = BIKES.find((b) => b.category === challenge.requiredBikeCategory);
    if (found) nextBike = found;
  }

  return { bike: nextBike, course: nextCourse };
}
