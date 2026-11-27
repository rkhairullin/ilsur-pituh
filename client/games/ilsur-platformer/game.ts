import type { GameControls } from "./input.js";
import {
  LEVELS,
  activateCheckpoint,
  advanceCampaignTime,
  advanceLevel,
  createCampaignState,
  currentLevel,
  loseLife,
  levelDurationSeconds,
  setPaused,
  type CampaignState,
} from "./campaign.js";

export const VIEW_WIDTH = 960;
export const VIEW_HEIGHT = 540;
export const WORLD_WIDTH = 2600;
export const GROUND_Y = 480;
export const GRAVITY = 1800;
export const MOVE_SPEED = 260;
export const CROUCH_SPEED = 150;
export const JUMP_SPEED = 640;
export const MAX_JUMP_HEIGHT = (JUMP_SPEED * JUMP_SPEED) / (2 * GRAVITY);
export const FIRE_INTERVAL = 0.24;
export const PROJECTILE_GRAVITY = 1200;
export const PROJECTILE_LAUNCH_DOWN_SPEED = 160;
export const PROJECTILE_BOUNCE = 0.8;
export const PROJECTILE_MIN_BOUNCE_SPEED = 180;

export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
  velocityX: number;
  velocityY: number;
  facing: -1 | 1;
  grounded: boolean;
  crouched: boolean;
  jumpsUsed: number;
}

export interface Projectile {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
}

export interface GameState {
  campaign: CampaignState;
  player: Player;
  cameraX: number;
  projectiles: Projectile[];
  shotsFired: number;
  projectileBounces: number;
  fireCooldown: number;
  jumpHeld: boolean;
}

export const PLATFORMS: Platform[] = [
  { x: 0, y: GROUND_Y, width: WORLD_WIDTH, height: 60 },
  { x: 230, y: 400, width: 220, height: 20 },
  { x: 600, y: 350, width: 210, height: 20 },
  { x: 950, y: 405, width: 220, height: 20 },
  { x: 1280, y: 360, width: 220, height: 20 },
  { x: 1610, y: 405, width: 220, height: 20 },
  { x: 1940, y: 350, width: 220, height: 20 },
];

const PLAYER_WIDTH = 42;
const PLAYER_STANDING_HEIGHT = 72;
const PLAYER_CROUCHING_HEIGHT = 42;
const PROJECTILE_SPEED = 560;
const PROJECTILE_HALF_WIDTH = 7;
const PROJECTILE_HALF_HEIGHT = 4;
const MAX_FRAME_SECONDS = 0.05;

export function createGameState(encoreLevel = 0): GameState {
  const campaign = createCampaignState(encoreLevel);
  const level = currentLevel(campaign);
  return {
    campaign,
    player: {
      x: 80,
      y: level.groundY - PLAYER_STANDING_HEIGHT,
      width: PLAYER_WIDTH,
      height: PLAYER_STANDING_HEIGHT,
      velocityX: 0,
      velocityY: 0,
      facing: 1,
      grounded: true,
      crouched: false,
      jumpsUsed: 0,
    },
    cameraX: 0,
    projectiles: [],
    shotsFired: 0,
    projectileBounces: 0,
    fireCooldown: 0,
    jumpHeld: false,
  };
}

function resetAtCheckpoint(state: GameState) {
  const level = currentLevel(state.campaign);
  const checkpoint = level.checkpoints[state.campaign.checkpointIndex]!;
  state.player.x = checkpoint.spawnX;
  state.player.y = level.groundY - PLAYER_STANDING_HEIGHT;
  state.player.velocityX = 0;
  state.player.velocityY = 0;
  state.player.height = PLAYER_STANDING_HEIGHT;
  state.player.facing = 1;
  state.player.grounded = true;
  state.player.crouched = false;
  state.player.jumpsUsed = 0;
  state.projectiles = [];
  state.fireCooldown = 0;
  state.jumpHeld = false;
  state.cameraX = Math.min(
    Math.max(state.player.x - VIEW_WIDTH * 0.36, 0),
    level.worldWidth - VIEW_WIDTH,
  );
}

export function pauseGame(state: GameState) {
  return setPaused(state.campaign, true);
}

export function resumeGame(state: GameState) {
  return setPaused(state.campaign, false);
}

export function restartGame(state: GameState) {
  const fresh = createGameState(state.campaign.encoreLevel);
  Object.assign(state, fresh);
}

export function startHarderEncore(state: GameState) {
  if (state.campaign.status !== "complete") return false;
  const currentLevelDefinition = currentLevel(state.campaign);
  const currentDuration = levelDurationSeconds(
    currentLevelDefinition,
    state.campaign.encoreLevel,
  );
  const nextDuration = levelDurationSeconds(
    currentLevelDefinition,
    state.campaign.encoreLevel + 1,
  );
  if (nextDuration >= currentDuration) return false;
  const fresh = createGameState(state.campaign.encoreLevel + 1);
  Object.assign(state, fresh);
  return true;
}

export function losePlayerLife(state: GameState) {
  const lost = loseLife(state.campaign);
  if (lost && state.campaign.status === "playing") resetAtCheckpoint(state);
  return lost;
}

export function stepGame(
  state: GameState,
  controls: GameControls,
  deltaSeconds: number,
) {
  if (state.campaign.status !== "playing") return;
  const timerResult = advanceCampaignTime(state.campaign, deltaSeconds);
  if (timerResult === "life-lost") {
    resetAtCheckpoint(state);
    return;
  }
  if (timerResult === "game-over") return;

  const delta = Math.min(Math.max(deltaSeconds, 0), MAX_FRAME_SECONDS);
  const level = currentLevel(state.campaign);
  const player = state.player;
  const direction = Number(controls.right) - Number(controls.left);
  const canCrouch = controls.crouch && player.grounded;
  const nextHeight = canCrouch
    ? PLAYER_CROUCHING_HEIGHT
    : PLAYER_STANDING_HEIGHT;

  if (nextHeight !== player.height) {
    player.y += player.height - nextHeight;
    player.height = nextHeight;
  }
  player.crouched = canCrouch;
  player.velocityX = direction * (player.crouched ? CROUCH_SPEED : MOVE_SPEED);
  if (direction !== 0) player.facing = direction < 0 ? -1 : 1;

  const jumpStarted = controls.jump && !state.jumpHeld;
  if (jumpStarted && player.jumpsUsed < 2 && !player.crouched) {
    player.velocityY = -JUMP_SPEED;
    player.grounded = false;
    player.jumpsUsed += 1;
  }
  state.jumpHeld = controls.jump;

  const previousBottom = player.y + player.height;
  player.x = Math.min(
    Math.max(player.x + player.velocityX * delta, 0),
    level.worldWidth - player.width,
  );
  player.velocityY += GRAVITY * delta;
  player.y += player.velocityY * delta;
  player.grounded = false;

  if (player.velocityY >= 0) {
    for (const platform of level.platforms) {
      const overlapsX =
        player.x < platform.x + platform.width &&
        player.x + player.width > platform.x;
      const crossesTop =
        previousBottom <= platform.y && player.y + player.height >= platform.y;
      if (overlapsX && crossesTop) {
        player.y = platform.y - player.height;
        player.velocityY = 0;
        player.grounded = true;
        player.jumpsUsed = 0;
        break;
      }
    }
  }

  state.fireCooldown = Math.max(0, state.fireCooldown - delta);
  if (controls.shoot && state.fireCooldown === 0) {
    state.projectiles.push({
      x: player.x + (player.facing === 1 ? player.width : 0),
      y: player.y + player.height * 0.45,
      velocityX: player.facing * PROJECTILE_SPEED,
      velocityY: PROJECTILE_LAUNCH_DOWN_SPEED,
    });
    state.shotsFired += 1;
    state.fireCooldown = FIRE_INTERVAL;
  }

  for (const projectile of state.projectiles) {
    const previousBottom = projectile.y + PROJECTILE_HALF_HEIGHT;
    projectile.x += projectile.velocityX * delta;
    projectile.velocityY += PROJECTILE_GRAVITY * delta;
    projectile.y += projectile.velocityY * delta;

    if (projectile.velocityY > 0) {
      let landingPlatform: Platform | undefined;
      for (const platform of level.platforms) {
        const overlapsX =
          projectile.x + PROJECTILE_HALF_WIDTH > platform.x &&
          projectile.x - PROJECTILE_HALF_WIDTH < platform.x + platform.width;
        const crossesTop =
          previousBottom <= platform.y &&
          projectile.y + PROJECTILE_HALF_HEIGHT >= platform.y;
        if (
          overlapsX &&
          crossesTop &&
          (!landingPlatform || platform.y < landingPlatform.y)
        ) {
          landingPlatform = platform;
        }
      }

      if (landingPlatform) {
        projectile.y = landingPlatform.y - PROJECTILE_HALF_HEIGHT;
        projectile.velocityY = -Math.max(
          projectile.velocityY * PROJECTILE_BOUNCE,
          PROJECTILE_MIN_BOUNCE_SPEED,
        );
        state.projectileBounces += 1;
      }
    }
  }
  state.projectiles = state.projectiles.filter(
    (projectile) => projectile.x >= 0 && projectile.x <= level.worldWidth,
  );

  activateCheckpoint(state.campaign, player.x);
  if (player.x >= level.exitX) {
    const movedToNextLevel = advanceLevel(state.campaign);
    if (movedToNextLevel) resetAtCheckpoint(state);
  }
  state.cameraX = Math.min(
    Math.max(player.x - VIEW_WIDTH * 0.36, 0),
    level.worldWidth - VIEW_WIDTH,
  );
}

export { LEVELS };
