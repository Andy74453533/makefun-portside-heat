// Every number the game agrees on: the size of the world, the feel of
// walking and driving, the wanted ladder, and the colours of Portside.

export const WORLD = {
  SIZE: 3200,
  ROAD_SPACING: 400,
  ROAD_WIDTH: 96,
  BLOCK: 304,
};

export const PLAYER = {
  RADIUS: 13,
  WALK_SPEED: 175,
  SPRINT_SPEED: 265,
  HEALTH: 100,
};

export const CAR = {
  LENGTH: 46,
  WIDTH: 22,
  ACCEL: 420,
  BRAKE: 700,
  REVERSE_ACCEL: 260,
  MAX_SPEED: 560,
  MAX_REVERSE: 180,
  TURN_RATE: 2.6,
  GRIP: 3.2,
};

export const WANTED = {
  MAX: 5,
  DECAY_SECONDS: 14,
  // Police cars on the street for each wanted level.
  POLICE_PER_STAR: [0, 2, 3, 5, 7, 9],
};

export const SAVE_KEY = 'portside-heat-save-v1';

export const COLORS = {
  grass: '#7fae5a',
  grassDry: '#a8b06a',
  sand: '#e8d29a',
  water: '#3f8fb5',
  waterDeep: '#2e6f92',
  asphalt: '#3a3a40',
  asphaltLight: '#45454c',
  sidewalk: '#b9b3a4',
  curb: '#8f887a',
  buildingRoof: ['#c96f4a', '#d99a5b', '#7a8ba0', '#b0563f', '#8fa382', '#a87f5f'],
  buildingWall: '#00000033',
  parkGreen: '#6da34f',
  container: ['#c94f38', '#3f7fb5', '#d9a03f', '#4f9e5f', '#8a5fa8'],
};

export const DISTRICTS = {
  RESIDENTIAL: 'residential',
  DOWNTOWN: 'downtown',
  MARINA: 'marina',
  PORT: 'port',
  PARK: 'park',
};

export const MONEY = {
  MISSION_REWARDS: [100, 250, 300, 450, 600, 1000],
  SMG_PRICE: 800,
  ARMOR_PRICE: 150,
  HEALTH_PRICE: 100,
  REPAIR_PRICE: 50,
  BUSTED_FINE: 200,
  WASTED_FINE: 150,
};
