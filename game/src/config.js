// Every tuning number, colour and world constant in one place. Solmar is a sun-soaked
// coastal city on a fixed 3200 x 3200 map: a road grid, a beach on the south edge, a park
// and a marina. The renderer scales the 1280 x 720 view to the window, so no rule below
// depends on the screen size.

export const WORLD = { width: 3200, height: 3200 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Roads run at these world coordinates, both ways; road width is the asphalt band. */
export const ROADS = {
  lines: [200, 600, 1000, 1400, 1800, 2200, 2600, 3000],
  width: 72,
  lane: 18,
};

/** South of this y the sand starts; south of the water line is the sea. */
export const BEACH = { sandY: 2960, waterY: 3080 };

/** The view the camera shows, in world units, before the window scales it. */
export const VIEW = { width: 1280, height: 720 };

export const PLAYER = {
  radius: 14,
  walkSpeed: 230,
  sprintSpeed: 330,
  health: 100,
  armor: 100,
  punchDamage: 12,
  pistolDamage: 34,
  pistolRange: 520,
  pistolCooldown: 0.22,
  shotgunDamage: 22,
  shotgunPellets: 6,
  shotgunRange: 380,
  shotgunCooldown: 0.7,
  bulletSpeed: 900,
};

export const CAR = {
  length: 64,
  width: 30,
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 620,
  maxReverse: 180,
  steer: 2.6,
  grip: 3.2,
  drag: 0.55,
};

export const TRAFFIC = { count: 16, parked: 12, cruiseSpeed: 190 };
export const PEDS = { count: 42 };

export const WANTED = {
  decayDelay: 14,
  decayRate: 1,
  maxStars: 5,
  /** Police cars chasing at each wanted level (index = stars). */
  copCars: [0, 1, 2, 3, 4, 5],
  /** Cops on foot at each wanted level. */
  copFoot: [0, 1, 2, 3, 4, 6],
  bustSeconds: 2.2,
};

export const ECONOMY = {
  startCash: 150,
  taxiFare: 90,
  packageReward: 250,
  repairCost: 60,
  armorCost: 150,
  shotgunCost: 400,
  shotgunAmmo: 24,
  wastedLoss: 0.25,
  bustedLoss: 0.35,
};

export const TIME = {
  /** One full in-game day, in real seconds. */
  dayLength: 480,
  /** The clock starts at 09:00. */
  startHour: 9,
};

export const PALETTE = {
  grass: '#7fae5a',
  grassDark: '#74a24f',
  sand: '#e8d29a',
  sea: '#2f7fae',
  seaDeep: '#256b96',
  road: '#3a3f47',
  roadEdge: '#2c3038',
  sidewalk: '#9aa0a8',
  lane: '#e8e4c8',
  buildingRoof: ['#c96f4a', '#b85c5c', '#d9a441', '#5d8aa8', '#8a6fb8', '#6aa87a', '#c98a5a', '#7a7f8c'],
  buildingWall: '#5a5148',
  park: '#5d9b4a',
  tree: '#3f7a33',
  treeDark: '#356b2b',
  player: '#ffd23e',
  playerDark: '#c79a12',
  cop: '#3a6fd8',
  copDark: '#24478f',
  thug: '#b83a3a',
  pedShirt: ['#e8e8e8', '#e07a5f', '#81b29a', '#f2cc8f', '#6d9dc5', '#c77dff', '#f4a261', '#90be6d'],
  hudText: '#ffffff',
  hudShadow: 'rgba(0,0,0,0.65)',
  star: '#ffd23e',
  starEmpty: 'rgba(255,255,255,0.35)',
  marker: '#ffcf3f',
  objective: '#ffe9a8',
  minimapBg: 'rgba(10,14,20,0.82)',
  minimapRoad: '#c8ccd4',
  minimapWater: '#2f7fae',
  minimapBlock: '#4a5568',
  night: 'rgba(8,12,38,0.34)',
  dusk: 'rgba(255,110,40,0.10)',
  dawn: 'rgba(255,170,90,0.08)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'solmar.save.v1';
export const BEST_KEY = 'solmar.best.v1';

/** The city's own names. Nothing here comes from any commercial game. */
export const CITY = {
  name: 'Solmar',
  title: 'SOLMAR',
  subtitle: 'Streets of Solmar',
  garage: "Rosa's Garage",
  hospital: 'Solmar General',
  policeHQ: 'Solmar PD HQ',
  pier: 'Marina Pier',
  mall: 'Palma Mall',
  beachName: 'Playa del Sol',
  parkName: 'Palma Park',
};
