import type { Platform } from "./game.js";

export const INITIAL_LIVES = 3;
export const NORMAL_LEVEL_SECONDS = 90;
export const BOSS_ARENA_SECONDS = 120;
export const ENCORE_TIME_PENALTY_SECONDS = 20;

export interface Checkpoint {
  x: number;
  spawnX: number;
}

export interface LevelDefinition {
  name: string;
  worldWidth: number;
  groundY: number;
  platforms: Platform[];
  checkpoints: Checkpoint[];
  exitX: number;
  durationSeconds: number;
  bossArena: boolean;
}

export interface CampaignState {
  levelIndex: number;
  lives: number;
  encoreLevel: number;
  remainingSeconds: number;
  checkpointIndex: number;
  status: "playing" | "paused" | "game-over" | "complete";
}

const worldWidth = 2600;
const groundY = 480;
const standardPlatforms: Platform[] = [
  { x: 0, y: groundY, width: worldWidth, height: 60 },
  { x: 230, y: 400, width: 220, height: 20 },
  { x: 600, y: 350, width: 210, height: 20 },
  { x: 950, y: 405, width: 220, height: 20 },
  { x: 1280, y: 360, width: 220, height: 20 },
  { x: 1610, y: 405, width: 220, height: 20 },
  { x: 1940, y: 350, width: 220, height: 20 },
];

function createPlatforms(offsets: number[]): Platform[] {
  return standardPlatforms.map((platform, index) => ({
    ...platform,
    y: platform.y + (offsets[index - 1] ?? 0),
  }));
}

function createLevel(
  name: string,
  offsets: number[],
  durationSeconds: number,
  bossArena = false,
): LevelDefinition {
  return {
    name,
    worldWidth,
    groundY,
    platforms: createPlatforms(offsets),
    checkpoints: [
      { x: 0, spawnX: 80 },
      { x: 900, spawnX: 900 },
      { x: 1750, spawnX: 1750 },
    ],
    exitX: worldWidth - 42,
    durationSeconds,
    bossArena,
  };
}

export const LEVELS: LevelDefinition[] = [
  createLevel("Уровень 1", [], NORMAL_LEVEL_SECONDS),
  createLevel(
    "Уровень 2",
    [-25, -25, -35, -20, -30, -40],
    NORMAL_LEVEL_SECONDS,
  ),
  createLevel("Уровень 3", [20, 5, 30, -5, 20, 0], NORMAL_LEVEL_SECONDS),
  createLevel("Уровень 4", [-10, 25, -15, 20, -20, 15], NORMAL_LEVEL_SECONDS),
  createLevel("Арена босса", [], BOSS_ARENA_SECONDS, true),
];

export function levelDurationSeconds(
  level: LevelDefinition,
  encoreLevel: number,
) {
  const minimumSeconds = level.bossArena ? 60 : 30;
  return Math.max(
    minimumSeconds,
    level.durationSeconds - encoreLevel * ENCORE_TIME_PENALTY_SECONDS,
  );
}

export function createCampaignState(encoreLevel = 0): CampaignState {
  return {
    levelIndex: 0,
    lives: INITIAL_LIVES,
    encoreLevel,
    remainingSeconds: levelDurationSeconds(LEVELS[0]!, encoreLevel),
    checkpointIndex: 0,
    status: "playing",
  };
}

export function currentLevel(campaign: CampaignState): LevelDefinition {
  return LEVELS[campaign.levelIndex]!;
}

export function activateCheckpoint(
  campaign: CampaignState,
  playerX: number,
): boolean {
  const checkpoints = currentLevel(campaign).checkpoints;
  let activated = false;
  while (
    campaign.checkpointIndex + 1 < checkpoints.length &&
    playerX >= checkpoints[campaign.checkpointIndex + 1]!.x
  ) {
    campaign.checkpointIndex += 1;
    activated = true;
  }
  return activated;
}

export function loseLife(campaign: CampaignState): boolean {
  if (campaign.status !== "playing" && campaign.status !== "paused") {
    return false;
  }
  campaign.lives = Math.max(0, campaign.lives - 1);
  if (campaign.lives === 0) {
    campaign.status = "game-over";
    return true;
  }
  campaign.status = "playing";
  campaign.remainingSeconds = levelDurationSeconds(
    currentLevel(campaign),
    campaign.encoreLevel,
  );
  return true;
}

export function advanceCampaignTime(
  campaign: CampaignState,
  elapsedSeconds: number,
): "none" | "life-lost" | "game-over" {
  if (
    campaign.status !== "playing" ||
    !Number.isFinite(elapsedSeconds) ||
    elapsedSeconds <= 0
  ) {
    return "none";
  }
  campaign.remainingSeconds = Math.max(
    0,
    campaign.remainingSeconds - elapsedSeconds,
  );
  if (campaign.remainingSeconds > 0) return "none";
  loseLife(campaign);
  return campaign.lives === 0 ? "game-over" : "life-lost";
}

export function advanceLevel(campaign: CampaignState): boolean {
  if (campaign.status !== "playing") return false;
  if (campaign.levelIndex === LEVELS.length - 1) {
    campaign.status = "complete";
    return false;
  }
  campaign.levelIndex += 1;
  campaign.remainingSeconds = levelDurationSeconds(
    currentLevel(campaign),
    campaign.encoreLevel,
  );
  campaign.checkpointIndex = 0;
  return true;
}

export function setPaused(campaign: CampaignState, paused: boolean): boolean {
  if (paused && campaign.status === "playing") {
    campaign.status = "paused";
    return true;
  }
  if (!paused && campaign.status === "paused") {
    campaign.status = "playing";
    return true;
  }
  return false;
}
