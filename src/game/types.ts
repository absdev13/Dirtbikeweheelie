export type GameState =
  | 'TITLE_MENU'
  | 'PLAYING'
  | 'PAUSED'
  | 'GARAGE_MENU'
  | 'ROUND_SUMMARY'
  | 'GAME_OVER';

export type DeviceMode = 'AUTO' | 'MOBILE' | 'TABLET' | 'DESKTOP';
export type ResolvedDevice = 'MOBILE' | 'TABLET' | 'DESKTOP';

export type TrickType =
  | 'NONE'
  | 'CLUTCH_POP'
  | 'ONE_HANDER'
  | 'SEAT_STAND'
  | 'NAC_NAC'
  | 'FENDER_SCRAPE';

export type HazardType =
  | 'NONE'
  | 'WHOOPS'
  | 'KICKER_RAMP'
  | 'MUD_PIT'
  | 'WIND_GUST'
  | 'TABLETOP';

export interface BikeConfig {
  id: '250_2stroke' | '450_4stroke' | '125_stunt' | '500_2stroke' | '700_supermoto';
  name: string;
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
  id: 'baja_mesa' | 'moab_canyon' | 'night_motopark' | 'alpine_mx' | 'dune_highway';
  name: string;
  region: string;
  difficulty: 'FLOW' | 'TECHNICAL' | 'PRO STUNT' | 'HILLCLIMB' | 'WIDE OPEN';
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
  wheelieAngleDeg: number; // 0 = flat, 72 = balance point, 86 = scrape, 93 = loop-out
  angularVelocityDeg: number;
  inWheelie: boolean;
  inSweetSpot: boolean;
  isScraping: boolean;
  activeTrick: TrickType;
  rearBrakeHeat: number; // 0..1
  activeHazard: HazardType;
  upcomingHazard: {
    type: HazardType;
    label: string;
    distanceM: number;
  } | null;
  callouts: TrickCallout[];
  crashReason: string | null;
  scrapeCount: number;
  tricksLanded: number;
}

export const BIKES: BikeConfig[] = [
  {
    id: '250_2stroke',
    name: 'KTM-X 250 Six Days',
    displacement: '250cc',
    strokeType: '2-STROKE',
    tagline: 'Snappy 2-stroke powerband with featherweight front end and wide balance window.',
    primaryColor: '#FF5500',
    secondaryColor: '#181A20',
    frameColor: '#FF6B1A',
    rimColor: '#D4AF37',
    torqueMultiplier: 1.04,
    brakeAuthority: 1.08,
    rotationalInertia: 1.0,
    balanceSweetSpotMin: 56,
    balanceSweetSpotMax: 81,
    scrapeAngleMin: 82,
    loopOutAngle: 93,
    maxSpeedKmh: 124,
    suspensionStiffness: 1.0,
  },
  {
    id: '450_4stroke',
    name: 'Apex CRF 450 Rally',
    displacement: '450cc',
    strokeType: '4-STROKE',
    tagline: 'Relentless 4-stroke torque pulls the front wheel up in any gear across deep sand.',
    primaryColor: '#E11D48',
    secondaryColor: '#F8FAFC',
    frameColor: '#CBD5E1',
    rimColor: '#1E293B',
    torqueMultiplier: 1.18,
    brakeAuthority: 1.0,
    rotationalInertia: 1.12,
    balanceSweetSpotMin: 58,
    balanceSweetSpotMax: 80,
    scrapeAngleMin: 81,
    loopOutAngle: 92,
    maxSpeedKmh: 138,
    suspensionStiffness: 1.12,
  },
  {
    id: '125_stunt',
    name: 'YZ-125 Twelve-Spec',
    displacement: '125cc',
    strokeType: '2-STROKE',
    tagline: 'Stunt-geared 58-tooth sprocket and titanium sub-frame skid block for deep 12 o’clock scrapes.',
    primaryColor: '#2563EB',
    secondaryColor: '#0F172A',
    frameColor: '#38BDF8',
    rimColor: '#F59E0B',
    torqueMultiplier: 0.98,
    brakeAuthority: 1.25,
    rotationalInertia: 0.88,
    balanceSweetSpotMin: 54,
    balanceSweetSpotMax: 83,
    scrapeAngleMin: 81,
    loopOutAngle: 95,
    maxSpeedKmh: 110,
    suspensionStiffness: 0.94,
  },
  {
    id: '500_2stroke',
    name: 'KX-500 Desert Outlaw',
    displacement: '500cc',
    strokeType: '2-STROKE',
    tagline: 'Violent open-class two-stroke hit that lofts the front wheel at 100+ km/h with a flick of the clutch.',
    primaryColor: '#16A34A',
    secondaryColor: '#090D16',
    frameColor: '#4ADE80',
    rimColor: '#E2E8F0',
    torqueMultiplier: 1.32,
    brakeAuthority: 1.02,
    rotationalInertia: 1.08,
    balanceSweetSpotMin: 59,
    balanceSweetSpotMax: 80,
    scrapeAngleMin: 81,
    loopOutAngle: 92,
    maxSpeedKmh: 152,
    suspensionStiffness: 1.18,
  },
  {
    id: '700_supermoto',
    name: 'SM-700 Street Stunt',
    displacement: '690cc',
    strokeType: '4-STROKE',
    tagline: 'Dual-caliper stunt handbrake, butter-smooth slipper clutch, and extended titanium tail cage.',
    primaryColor: '#F59E0B',
    secondaryColor: '#111827',
    frameColor: '#FBBF24',
    rimColor: '#38BDF8',
    torqueMultiplier: 1.22,
    brakeAuthority: 1.32,
    rotationalInertia: 1.04,
    balanceSweetSpotMin: 55,
    balanceSweetSpotMax: 82,
    scrapeAngleMin: 82,
    loopOutAngle: 95,
    maxSpeedKmh: 146,
    suspensionStiffness: 1.15,
  },
];

export const COURSES: CourseConfig[] = [
  {
    id: 'baja_mesa',
    name: 'Baja Sunset Mesa',
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
    id: 'night_motopark',
    name: 'Floodlight Stunt Compound',
    region: 'Nevada Pro Lot · Night Session',
    difficulty: 'PRO STUNT',
    description: 'Packed clay and asphalt stunt strip under stadium floodlights built for high-speed 12 o’clock tail scrapes.',
    skyTop: '#06080E',
    skyBottom: '#111827',
    horizonGlow: '#38BDF8',
    mountainFar: '#0F172A',
    mountainNear: '#1E293B',
    groundSurface: '#334155',
    groundSubsoil: '#0F172A',
    accentColor: '#10B981',
    hazardFrequency: 0.75,
  },
  {
    id: 'alpine_mx',
    name: 'Timberline MX National',
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
