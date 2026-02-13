// Physics
export const PHYSICS = {
  GRAVITY: -20,
  TIME_STEP: 1 / 60,
  MAX_SUB_STEPS: 3,
  POOP_MASS: 2,
  BLOCK_MASS: 1,
  MONKEY_MASS: 0.5,
  GROUND_FRICTION: 0.5,
  BLOCK_FRICTION: 0.3,
  RESTITUTION: 0.3,
} as const;

// Game
export const GAME = {
  INITIAL_AMMO: 3,
  POINTS_PER_MONKEY: 100,
  POINTS_PER_BLOCK: 10,
  LAUNCH_POWER_MIN: 15,
  LAUNCH_POWER_MAX: 40,
  LAUNCH_ANGLE_MIN: 10,
  LAUNCH_ANGLE_MAX: 75,
  SLINGSHOT_PULL_MAX: 3,
  LEVEL_COMPLETE_DELAY: 2000,
  SETTLE_TIME: 3000,
} as const;

// Camera - can see slingshot and structures
export const CAMERA = {
  FOV: 55,
  NEAR: 0.1,
  FAR: 500,
  // Pulled back, slightly elevated, angled to see both slingshot and targets
  POSITION: { x: -5, y: 10, z: 18 },
  LOOK_AT: { x: 5, y: 3, z: 0 },
} as const;

// World
export const WORLD = {
  GROUND_SIZE: 100,
  GROUND_COLOR: 0x228B22,
  SKY_COLOR: 0x87CEEB,
  AMBIENT_LIGHT: 0xffffff,
  AMBIENT_INTENSITY: 0.6,
  DIRECTIONAL_LIGHT: 0xffffff,
  DIRECTIONAL_INTENSITY: 0.8,
  SLINGSHOT_POSITION: { x: -8, y: 2, z: 0 },
  STRUCTURE_START_X: 5,
} as const;

// Poop
export const POOP = {
  RADIUS: 0.4,
  COLOR: 0x8B4513,
  SEGMENTS: 16,
} as const;

// Monkey
export const MONKEY = {
  BODY_RADIUS: 0.5,
  HEAD_RADIUS: 0.35,
  COLOR: 0xCD853F,
  FACE_COLOR: 0xDEB887,
} as const;

// Blocks
export const BLOCKS = {
  WOOD: {
    COLOR: 0xDEB887,
    HEALTH: 5,
  },
  STONE: {
    COLOR: 0x808080,
    HEALTH: 10,
  },
  GLASS: {
    COLOR: 0xADD8E6,
    HEALTH: 2,
  },
} as const;

// Level Generation
export const LEVEL_GEN = {
  BASE_DIFFICULTY: 1,
  DIFFICULTY_SCALE: 0.3,
  MIN_BLOCKS: 8,
  MAX_BLOCKS: 25,
  MIN_MONKEYS: 2,
  MAX_MONKEYS: 6,
  STRUCTURE_WIDTH: 12,
  STRUCTURE_HEIGHT: 10,
  BLOCK_SIZE: 1.2,
} as const;

// Colors
export const COLORS = {
  TRAJECTORY: 0xffff00,
  SLINGSHOT: 0x654321,
  SLINGSHOT_BAND: 0x8B0000,
} as const;
