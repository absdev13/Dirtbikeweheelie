import type { DailyChallengeState } from './dailyChallenges';

export type GameState =
  | 'TITLE_MENU'
  | 'PLAYING'
  | 'PAUSED'
  | 'GARAGE_MENU'
  | 'ROUND_SUMMARY'
  | 'GAME_OVER';

export type DeviceMode = 'AUTO' | 'MOBILE' | 'TABLET' | 'DESKTOP';
export type ResolvedDevice = 'MOBILE' | 'TABLET' | 'DESKTOP';
export type CameraViewMode = 'CHASE' | 'SIDE_3D' | 'HELMET_POV' | 'LOW_HERO';

export type RiderStance =
  | 'NORMAL'
  | 'KNEE_ON_SEAT'
  | 'FOOT_ON_SEAT'
  | 'HIGH_CHAIR'
  | 'SUBCAGE_LOCK';

export type TrickType =
  | 'NONE'
  | 'CLUTCH_POP'
  | 'ONE_HANDER'
  | 'SEAT_STAND'
  | 'NAC_NAC'
  | 'BAR_HOP'
  | 'COASTER'
  | 'FENDER_SCRAPE';

export type HazardType =
  | 'NONE'
  | 'WHOOPS'
  | 'KICKER_RAMP'
  | 'MUD_PIT'
  | 'WIND_GUST'
  | 'TABLETOP';

export interface BikeConfig {
  id:
    | 'fs450_sumo'
    | 'smcr690_sumo'
    | 'sxv550_sumo'
    | 'drz400_sumo'
    | '250_2stroke'
    | '450_4stroke'
    | '125_stunt'
    | '500_2stroke';
  name: string;
  category: 'SUPERMOTO' | 'DIRTBIKE';
  tireStyle: 'SUPERMOTO_SLICK' | 'DIRT_KNOBBY';
  displacement: string;
  strokeType: '2-STROKE' | '4-STROKE';
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  frameColor: string;
  rimColor: string;
  // Physics tuning
  torqueMultiplier: number;
  brakeAuthority: number;
  rotationalInertia: number;
  balanceSweetSpotMin: number; // degrees
  balanceSweetSpotMax: number; // degrees
  scrapeAngleMin: number; // degrees
  loopOutAngle: number; // degrees
  maxSpeedKmh: number;
  suspensionStiffness: number;
}

export interface CourseConfig {
  id:
    | 'downtown_blvd'
    | 'miami_causeway'
    | 'industrial_lot'
    | 'tokyo_expressway'
    | 'baja_mesa'
    | 'moab_canyon'
    | 'alpine_mx'
    | 'dune_highway';
  name: string;
  environmentType: 'STREET' | 'DIRT';
  region: string;
  difficulty: 'STREET FLOW' | 'PRO STUNT' | 'HIGHWAY' | 'FLOW' | 'TECHNICAL' | 'HILLCLIMB' | 'WIDE OPEN';
  description: string;
  skyTop: string;
  skyBottom: string;
  horizonGlow: string;
  mountainFar: string;
  mountainNear: string;
  groundSurface: string;
  groundSubsoil: string;
  accentColor: string;
  hazardFrequency: number;
}

export interface TrickCallout {
  id: number;
  title: string;
  points: number;
  color: string;
  timestamp: number;
}

export interface ActiveChallenge {
  title: string;
  progress: number;
  target: number;
  unit: string;
  rewardPts: number;
}

export interface TelemetrySnapshot {
  score: number;
  bestScore: number;
  comboMultiplier: number;
  currentWheelieScore: number;
  wheelieDistanceM: number;
  bestWheelieDistanceM: number;
  totalDistanceM: number;
  speedKmh: number;
  rpm: number;
  maxRpm: number;
  gear: number;
  maxGear: number;
  transmissionMode: 'MANUAL' | 'AUTO';
  clutchPulled: boolean;
  clutchCharge: number; // 0..1 stored rev-bomb energy when holding clutch
  boostCharge: number; // 0..1 stunt nitro charge earned in sweet spot & scrapes
  boostActive: boolean;
  wheelieAngleDeg: number; // 0 = flat, 72 = balance point, 86 = scrape, 93 = loop-out
  angularVelocityDeg: number;
  lateralOffsetM: number; // -5m to +5m 3D lane position
  rollAngleDeg: number; // 3D swerve bank angle
  inWheelie: boolean;
  inSweetSpot: boolean;
  isScraping: boolean;
  isCoasting: boolean;
  riderStance: RiderStance;
  activeTrick: TrickType;
  rearBrakeHeat: number; // 0..1
  activeHazard: HazardType;
  upcomingHazard: {
    type: HazardType;
    label: string;
    distanceM: number;
  } | null;
  activeChallenge: ActiveChallenge;
  dailyState: DailyChallengeState;
  riderLevel: number;
  riderRankTitle: string;
  callouts: TrickCallout[];
  crashReason: string | null;
  scrapeCount: number;
  tricksLanded: number;
}

export const BIKES: BikeConfig[] = [
  // ======================== SUPERMOTOS ========================
  {
    id: 'fs450_sumo',
    name: 'Husky FS 450 Sumo',
    category: 'SUPERMOTO',
    tireStyle: 'SUPERMOTO_SLICK',
    displacement: '450cc',
    strokeType: '4-STROKE',
    tagline: '17-inch two-tone split supermoto wheels, radial Brembo rear caliper, and surgical balance control.',
    primaryColor: '#F8FAFC',
    secondaryColor: '#1E3A8A',
    frameColor: '#EAB308',
    rimColor: '#38BDF8',
    torqueMultiplier: 1.2,
    brakeAuthority: 1.34,
    rotationalInertia: 0.96,
    balanceSweetSpotMin: 54,
    balanceSweetSpotMax: 83,
    scrapeAngleMin: 82,
    loopOutAngle: 95,
    maxSpeedKmh: 148,
    suspensionStiffness: 1.2,
  },
  {
    id: 'smcr690_sumo',
    name: 'SMC-R 690 Hooligan',
    category: 'SUPERMOTO',
    tireStyle: 'SUPERMOTO_SLICK',
    displacement: '690cc',
    strokeType: '4-STROKE',
    tagline: 'Big-bore street supermoto with dual-caliper stunt handbrake, slipper clutch, and 5th-gear highway lift.',
    primaryColor: '#FF5500',
    secondaryColor: '#0F172A',
    frameColor: '#FB923C',
    rimColor: '#FF5500',
    torqueMultiplier: 1.28,
    brakeAuthority: 1.32,
    rotationalInertia: 1.04,
    balanceSweetSpotMin: 55,
    balanceSweetSpotMax: 82,
    scrapeAngleMin: 82,
    loopOutAngle: 95,
    maxSpeedKmh: 162,
    suspensionStiffness: 1.18,
  },
  {
    id: 'sxv550_sumo',
    name: 'Aprilia SXV 550 Twin',
    category: 'SUPERMOTO',
    tireStyle: 'SUPERMOTO_SLICK',
    displacement: '550cc',
    strokeType: '4-STROKE',
    tagline: 'Screaming V-Twin supermoto with explosive powerband, slick tires, and titanium sub-frame spark block.',
    primaryColor: '#DC2626',
    secondaryColor: '#090D16',
    frameColor: '#E2E8F0',
    rimColor: '#EF4444',
    torqueMultiplier: 1.3,
    brakeAuthority: 1.26,
    rotationalInertia: 0.94,
    balanceSweetSpotMin: 56,
    balanceSweetSpotMax: 82,
    scrapeAngleMin: 81,
    loopOutAngle: 94,
    maxSpeedKmh: 168,
    suspensionStiffness: 1.22,
  },
  {
    id: 'drz400_sumo',
    name: 'DR-Z 400SM Lot King',
    category: 'SUPERMOTO',
    tireStyle: 'SUPERMOTO_SLICK',
    displacement: '400cc',
    strokeType: '4-STROKE',
    tagline: 'Stunt-lot legend with 54-tooth rear sprocket, ultra-wide balance sweet spot, and 12 o’clock scrape bar.',
    primaryColor: '#FACC15',
    secondaryColor: '#1E293B',
    frameColor: '#94A3B8',
    rimColor: '#F59E0B',
    torqueMultiplier: 1.08,
    brakeAuthority: 1.38,
    rotationalInertia: 0.92,
    balanceSweetSpotMin: 52,
    balanceSweetSpotMax: 84,
    scrapeAngleMin: 81,
    loopOutAngle: 96,
    maxSpeedKmh: 132,
    suspensionStiffness: 1.1,
  },

  // ======================== DIRTBIKES ========================
  {
    id: '250_2stroke',
    name: 'KTM-X 250 Six Days',
    category: 'DIRTBIKE',
    tireStyle: 'DIRT_KNOBBY',
    displacement: '250cc',
    strokeType: '2-STROKE',
    tagline: 'Snappy 2-stroke powerband with featherweight front end and wide off-road balance window.',
    primaryColor: '#FF5500',
    secondaryColor: '#181A20',
    frameColor: '#FF6B1A',
    rimColor: '#D4AF37',
    torqueMultiplier: 1.06,
    brakeAuthority: 1.1,
    rotationalInertia: 1.0,
    balanceSweetSpotMin: 56,
    balanceSweetSpotMax: 81,
    scrapeAngleMin: 82,
    loopOutAngle: 93,
    maxSpeedKmh: 126,
    suspensionStiffness: 1.0,
  },
  {
    id: '450_4stroke',
    name: 'Apex CRF 450 Rally',
    category: 'DIRTBIKE',
    tireStyle: 'DIRT_KNOBBY',
    displacement: '450cc',
    strokeType: '4-STROKE',
    tagline: 'Relentless 4-stroke torque pulls the front wheel up in any gear across deep sand and whoops.',
    primaryColor: '#E11D48',
    secondaryColor: '#F8FAFC',
    frameColor: '#CBD5E1',
    rimColor: '#1E293B',
    torqueMultiplier: 1.18,
    brakeAuthority: 1.04,
    rotationalInertia: 1.1,
    balanceSweetSpotMin: 58,
    balanceSweetSpotMax: 80,
    scrapeAngleMin: 81,
    loopOutAngle: 92,
    maxSpeedKmh: 140,
    suspensionStiffness: 1.12,
  },
  {
    id: '125_stunt',
    name: 'YZ-125 Twelve-Spec',
    category: 'DIRTBIKE',
    tireStyle: 'DIRT_KNOBBY',
    displacement: '125cc',
    strokeType: '2-STROKE',
    tagline: 'Featherweight 2-stroke with 58-tooth stunt sprocket for effortless clutch pops and tail scrapes.',
    primaryColor: '#2563EB',
    secondaryColor: '#0F172A',
    frameColor: '#38BDF8',
    rimColor: '#F59E0B',
    torqueMultiplier: 1.0,
    brakeAuthority: 1.25,
    rotationalInertia: 0.88,
    balanceSweetSpotMin: 54,
    balanceSweetSpotMax: 83,
    scrapeAngleMin: 81,
    loopOutAngle: 95,
    maxSpeedKmh: 112,
    suspensionStiffness: 0.94,
  },
  {
    id: '500_2stroke',
    name: 'KX-500 Desert Outlaw',
    category: 'DIRTBIKE',
    tireStyle: 'DIRT_KNOBBY',
    displacement: '500cc',
    strokeType: '2-STROKE',
    tagline: 'Violent open-class two-stroke hit that lofts the front wheel at 110+ km/h with a flick of the clutch.',
    primaryColor: '#16A34A',
    secondaryColor: '#090D16',
    frameColor: '#4ADE80',
    rimColor: '#E2E8F0',
    torqueMultiplier: 1.34,
    brakeAuthority: 1.05,
    rotationalInertia: 1.08,
    balanceSweetSpotMin: 59,
    balanceSweetSpotMax: 80,
    scrapeAngleMin: 81,
    loopOutAngle: 92,
    maxSpeedKmh: 154,
    suspensionStiffness: 1.18,
  },
];

export const COURSES: CourseConfig[] = [
  // ======================== STREET MAPS ========================
  {
    id: 'downtown_blvd',
    name: 'Downtown City Boulevard',
    environmentType: 'STREET',
    region: 'Metro District · Closed Street',
    difficulty: 'STREET FLOW',
    description: 'Clean, flat multi-lane urban asphalt with painted lane stripes and high-rise skyline views — zero obstacles.',
    skyTop: '#070B19',
    skyBottom: '#1E1B4B',
    horizonGlow: '#F97316',
    mountainFar: '#0F172A',
    mountainNear: '#1E293B',
    groundSurface: '#262C3A',
    groundSubsoil: '#0B0F19',
    accentColor: '#FF5500',
    hazardFrequency: 0,
  },
  {
    id: 'industrial_lot',
    name: 'Dockside Stunt Lot',
    environmentType: 'STREET',
    region: 'Port Warehouse · Concrete Pad',
    difficulty: 'PRO STUNT',
    description: 'High-grip flat concrete stunt lot with endless clean pavement built for 12 o’clock scrapes and slow coasters.',
    skyTop: '#06080E',
    skyBottom: '#111827',
    horizonGlow: '#38BDF8',
    mountainFar: '#0F172A',
    mountainNear: '#1E293B',
    groundSurface: '#334155',
    groundSubsoil: '#0F172A',
    accentColor: '#10B981',
    hazardFrequency: 0,
  },
  {
    id: 'miami_causeway',
    name: 'Sunset Ocean Causeway',
    environmentType: 'STREET',
    region: 'Biscayne Bay · Coastal Highway',
    difficulty: 'HIGHWAY',
    description: 'Wide-open smooth coastal highway tarmac at golden hour for uninterrupted 6th-gear balance runs.',
    skyTop: '#1E1035',
    skyBottom: '#831843',
    horizonGlow: '#FB923C',
    mountainFar: '#1F122B',
    mountainNear: '#31102F',
    groundSurface: '#2E3440',
    groundSubsoil: '#111827',
    accentColor: '#F43F5E',
    hazardFrequency: 0,
  },
  {
    id: 'tokyo_expressway',
    name: 'Wangan Midnight Route',
    environmentType: 'STREET',
    region: 'Bayshore Elevated Highway',
    difficulty: 'HIGHWAY',
    description: 'Smooth elevated midnight expressway under sodium streetlights for pure top-speed gear-chase wheelies.',
    skyTop: '#030712',
    skyBottom: '#0F172A',
    horizonGlow: '#F59E0B',
    mountainFar: '#090D16',
    mountainNear: '#172033',
    groundSurface: '#1E2430',
    groundSubsoil: '#090D16',
    accentColor: '#FBBF24',
    hazardFrequency: 0,
  },

  // ======================== DIRT MAPS ========================
  {
    id: 'baja_mesa',
    name: 'Baja Sunset Mesa',
    environmentType: 'DIRT',
    region: 'Sonoran Desert · 1,240m',
    difficulty: 'FLOW',
    description: 'Smooth golden-hour desert rollers with long sightlines ideal for chaining multi-gear balance runs.',
    skyTop: '#13111C',
    skyBottom: '#6E2E1E',
    horizonGlow: '#F97316',
    mountainFar: '#271924',
    mountainNear: '#3D2220',
    groundSurface: '#B4532A',
    groundSubsoil: '#431D14',
    accentColor: '#FF5500',
    hazardFrequency: 1.0,
  },
  {
    id: 'moab_canyon',
    name: 'Slickrock Canyon Run',
    environmentType: 'DIRT',
    region: 'Utah Redlands · 1,580m',
    difficulty: 'TECHNICAL',
    description: 'High-grip sandstone ledges, canyon updraft gusts, and step-up kickers that test rear-brake control.',
    skyTop: '#0C1829',
    skyBottom: '#334E68',
    horizonGlow: '#F59E0B',
    mountainFar: '#1E293B',
    mountainNear: '#5C2B23',
    groundSurface: '#9A3412',
    groundSubsoil: '#3B140B',
    accentColor: '#F59E0B',
    hazardFrequency: 1.25,
  },
  {
    id: 'alpine_mx',
    name: 'Timberline MX National',
    environmentType: 'DIRT',
    region: 'Colorado Rockies · 2,650m',
    difficulty: 'HILLCLIMB',
    description: 'Loamy mountain motocross track packed with rhythm whoop sections and massive tabletop jumps.',
    skyTop: '#0B172A',
    skyBottom: '#1E3A5F',
    horizonGlow: '#38BDF8',
    mountainFar: '#1E293B',
    mountainNear: '#0F291E',
    groundSurface: '#5C4033',
    groundSubsoil: '#271810',
    accentColor: '#38BDF8',
    hazardFrequency: 1.45,
  },
  {
    id: 'dune_highway',
    name: 'Imperial Sand Dunes',
    environmentType: 'DIRT',
    region: 'Glamis Bowl · Sea Level',
    difficulty: 'WIDE OPEN',
    description: 'Sweeping golden sand bowls where 4th and 5th gear clutch-pop wheelies carry across massive crests.',
    skyTop: '#1A120B',
    skyBottom: '#78350F',
    horizonGlow: '#FBBF24',
    mountainFar: '#451A03',
    mountainNear: '#713F12',
    groundSurface: '#D97706',
    groundSubsoil: '#78350F',
    accentColor: '#FBBF24',
    hazardFrequency: 0.9,
  },
];
