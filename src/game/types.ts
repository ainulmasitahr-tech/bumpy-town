export type GamePhase = 'menu' | 'playing' | 'arrested' | 'upgrade' | 'paused' | 'gameover';

export type CarStyleId = 'taxi' | 'buggy' | 'van';

export type PotholeSeverity = 'low' | 'medium' | 'high';

export interface CarStyleInfo {
  id: CarStyleId;
  name: string;
  tagline: string;
  defaultColorId: string;
}

export const CAR_STYLES: CarStyleInfo[] = [
  {
    id: 'taxi',
    name: 'City Cab',
    tagline: 'Bouncy rooftop taxi',
    defaultColorId: 'sunshine',
  },
  {
    id: 'buggy',
    name: 'Turbo Buggy',
    tagline: 'Zippy spoiler racer',
    defaultColorId: 'coral',
  },
  {
    id: 'van',
    name: 'Surf Van',
    tagline: 'Cozy beach camper',
    defaultColorId: 'mint',
  },
];

export interface CarColorOption {
  id: string;
  name: string;
  css: string;
  hex: number;
  accentHex: number;
}

export const CAR_COLORS: CarColorOption[] = [
  {
    id: 'sunshine',
    name: 'Sunshine',
    css: '#FFE600',
    hex: 0xffe600,
    accentHex: 0x1e293b,
  },
  {
    id: 'coral',
    name: 'Hot Berry',
    css: '#FF2E63',
    hex: 0xff2e63,
    accentHex: 0xfff8e7,
  },
  {
    id: 'sky',
    name: 'Electric Sky',
    css: '#00D4FF',
    hex: 0x00d4ff,
    accentHex: 0xffffff,
  },
  {
    id: 'mint',
    name: 'Neon Mint',
    css: '#00E676',
    hex: 0x00e676,
    accentHex: 0xffe600,
  },
  {
    id: 'grape',
    name: 'Vivid Grape',
    css: '#9D4EDD',
    hex: 0x9d4edd,
    accentHex: 0xfef08a,
  },
  {
    id: 'tangerine',
    name: 'Tangerine',
    css: '#FF6D00',
    hex: 0xff6d00,
    accentHex: 0xffffff,
  },
  {
    id: 'bubblegum',
    name: 'Bubblegum',
    css: '#FF2E93',
    hex: 0xff2e93,
    accentHex: 0xfffbeb,
  },
  {
    id: 'emerald',
    name: 'Lime Pop',
    css: '#38B000',
    hex: 0x38b000,
    accentHex: 0xffe600,
  },
];

export const POTHOLE_SEVERITY_INFO: Record<
  PotholeSeverity,
  {
    label: string;
    points: number;
    honkReward: number;
    ringHex: number;
    colorCss: string;
  }
> = {
  low: {
    label: 'Low',
    points: 1,
    honkReward: 0,
    ringHex: 0xffe600,
    colorCss: '#FFE600',
  },
  medium: {
    label: 'Medium',
    points: 3,
    honkReward: 0,
    ringHex: 0xff6d00,
    colorCss: '#FF6D00',
  },
  high: {
    label: 'High',
    points: 5,
    honkReward: 1,
    ringHex: 0xff2e93,
    colorCss: '#FF2E93',
  },
};

export type UpgradeId =
  | 'wide_tires'
  | 'bouncy_springs'
  | 'super_honk'
  | 'star_boost'
  | 'gold_rush';

export interface UpgradeDef {
  id: UpgradeId;
  title: string;
  description: string;
  color: string;
  badgeText: string;
}

export const UPGRADE_CATALOG: UpgradeDef[] = [
  {
    id: 'wide_tires',
    title: 'Big Monster Tires',
    description: 'Wider tires make hitting potholes much easier!',
    color: '#FF6D00',
    badgeText: '+28% Hit Width',
  },
  {
    id: 'bouncy_springs',
    title: 'Magnet Springs',
    description: 'Smooth shocks plus a gentle pull toward nearby potholes.',
    color: '#9D4EDD',
    badgeText: 'Pothole Magnet',
  },
  {
    id: 'super_honk',
    title: 'Friendly Mega Horn',
    description: 'Adds +2 Honk Charges now and pauses crossers longer!',
    color: '#00D4FF',
    badgeText: '+2 Honks & Longer Pause',
  },
  {
    id: 'star_boost',
    title: 'Double Star Bonus',
    description: 'Every 3rd pothole in a streak awards +2 bonus points!',
    color: '#FFE600',
    badgeText: 'Combo +2 Pts',
  },
  {
    id: 'gold_rush',
    title: 'Rare Pothole Magnet',
    description: 'Makes Medium & High severity potholes appear more often!',
    color: '#00E676',
    badgeText: 'More High Potholes',
  },
];

export interface LeaderboardEntry {
  name: string;
  score: number;
  blockLevel: number;
  potholesHit: number;
  carColorCss: string;
  carStyle: CarStyleId;
  updatedAt: number;
}

export interface GameHUDState {
  phase: GamePhase;
  playerName: string;
  carColorCss: string;
  score: number;
  bestScore: number;
  potholesHit: number;
  blockLevel: number;
  blockProgress: number;
  blockTarget: number;
  hearts: number;
  maxHearts: number;
  streak: number;
  honkCharges: number;
  honkCooldownRatio: number;
  speedKmh: number;
  timeRemainingSec: number;
  isBoosting: boolean;
  isBraking: boolean;
  activeUpgrades: UpgradeId[];
  statusBanner: string | null;
  pedestrianAheadHint: boolean;
  trafficLightAhead: {
    state: 'red' | 'yellow' | 'green';
    waitProgress: number;
  } | null;
  gameOverReason: 'hearts' | 'time';
}

export interface FloatingScorePopup {
  id: number;
  text: string;
  tone: 'low' | 'medium' | 'high' | 'warning' | 'honk' | 'police';
  xPercent: number;
  yPercent: number;
}
