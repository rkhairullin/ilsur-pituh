import { expect, test } from "vitest";
import {
  FIRE_INTERVAL,
  GROUND_Y,
  GRAVITY,
  JUMP_SPEED,
  MAX_JUMP_HEIGHT,
  MOVE_SPEED,
  PLATFORMS,
  PROJECTILE_BOUNCE,
  PROJECTILE_GRAVITY,
  PROJECTILE_LAUNCH_DOWN_SPEED,
  PROJECTILE_MIN_BOUNCE_SPEED,
  WORLD_WIDTH,
  createGameState,
  losePlayerLife,
  pauseGame,
  restartGame,
  resumeGame,
  startHarderEncore,
  stepGame,
} from "../../client/games/ilsur-platformer/game.js";
import { LEVELS } from "../../client/games/ilsur-platformer/campaign.js";
import type { GameControls } from "../../client/games/ilsur-platformer/input.js";

const neutral: GameControls = {
  left: false,
  right: false,
  jump: false,
  crouch: false,
  shoot: false,
};

test("moves in both directions, limits the world edges, and follows the player", () => {
  const state = createGameState();
  stepGame(state, { ...neutral, right: true }, 0.05);
  expect(state.player.x).toBe(93);
  expect(state.player.facing).toBe(1);

  stepGame(state, { ...neutral, left: true }, 0.05);
  expect(state.player.x).toBe(80);
  expect(state.player.facing).toBe(-1);

  state.player.x = 0;
  stepGame(state, { ...neutral, left: true }, 0.05);
  expect(state.player.x).toBe(0);
  state.player.x = WORLD_WIDTH - 120;
  stepGame(state, { ...neutral, right: true }, 0.05);
  expect(state.player.x).toBe(WORLD_WIDTH - 107);
  expect(state.cameraX).toBeGreaterThan(0);

  state.player.x = 80;
  stepGame(state, neutral, -1);
  expect(state.player.x).toBe(80);
  expect(state.cameraX).toBe(0);
});

test("crouches, moves slower, preserves the feet, and stands back up", () => {
  const state = createGameState();
  const feet = state.player.y + state.player.height;
  stepGame(state, { ...neutral, crouch: true, right: true }, 0.05);
  expect(state.player.crouched).toBe(true);
  expect(state.player.x).toBe(87.5);
  expect(state.player.height).toBeLessThan(72);
  expect(state.player.y + state.player.height).toBe(feet);

  stepGame(state, neutral, 0.05);
  expect(state.player.crouched).toBe(false);
  expect(state.player.height).toBe(72);
  expect(state.player.y + state.player.height).toBe(feet);
});

test("jumps once per press, lands on platforms, and ignores jump while crouching", () => {
  const state = createGameState();
  stepGame(state, { ...neutral, jump: true }, 1 / 60);
  expect(state.player.grounded).toBe(false);
  expect(state.player.velocityY).toBeLessThan(0);
  const firstJumpY = state.player.y;
  stepGame(state, { ...neutral, jump: true }, 1 / 60);
  expect(state.player.y).toBeLessThan(firstJumpY);

  for (let index = 0; index < 40; index += 1) stepGame(state, neutral, 0.05);
  expect(state.player.grounded).toBe(true);
  expect(state.player.y + state.player.height).toBe(GROUND_Y);

  stepGame(state, { ...neutral, crouch: true }, 0);
  stepGame(state, { ...neutral, crouch: true, jump: true }, 0.016);
  expect(state.player.grounded).toBe(true);
  expect(state.player.crouched).toBe(true);
  expect(state.player.velocityY).toBe(0);
});

test("allows one extra jump in midair and resets jump count after landing", () => {
  const state = createGameState();
  stepGame(state, { ...neutral, jump: true }, 0.016);
  expect(state.player.jumpsUsed).toBe(1);

  stepGame(state, neutral, 0.016);
  stepGame(state, { ...neutral, jump: true }, 0.016);
  expect(state.player.jumpsUsed).toBe(2);
  const secondJumpVelocity = state.player.velocityY;
  expect(secondJumpVelocity).toBeLessThan(0);

  stepGame(state, neutral, 0.016);
  stepGame(state, { ...neutral, jump: true }, 0.016);
  expect(state.player.jumpsUsed).toBe(2);
  expect(state.player.velocityY).toBeCloseTo(
    secondJumpVelocity + 2 * GRAVITY * 0.016,
  );

  for (let index = 0; index < 40; index += 1) stepGame(state, neutral, 0.05);
  expect(state.player.grounded).toBe(true);
  expect(state.player.jumpsUsed).toBe(0);
});

test("lands on a raised platform and falls past a platform without horizontal overlap", () => {
  const raised = createGameState();
  raised.player.x = 350;
  raised.player.y = 310;
  raised.player.grounded = false;
  raised.player.velocityY = 500;
  stepGame(raised, neutral, 0.05);
  expect(raised.player.grounded).toBe(true);
  expect(raised.player.y + raised.player.height).toBe(400);

  const miss = createGameState();
  miss.player.x = 540;
  miss.player.y = 238;
  miss.player.grounded = false;
  miss.player.velocityY = 500;
  stepGame(miss, neutral, 0.05);
  expect(miss.player.grounded).toBe(false);
  expect(miss.player.y).toBeGreaterThan(238);
});

test("each raised platform is reachable with one ordinary jump", () => {
  const raisedPlatforms = PLATFORMS.slice(1);
  for (let index = 0; index < raisedPlatforms.length; index += 1) {
    const current = raisedPlatforms[index]!;
    const previous = raisedPlatforms[index - 1];
    const rise = previous ? previous.y - current.y : GROUND_Y - current.y;
    expect(rise).toBeLessThan(MAX_JUMP_HEIGHT - 10);

    const platformRise = (previous?.y ?? GROUND_Y) - current.y;
    const landingTime =
      (JUMP_SPEED + Math.sqrt(JUMP_SPEED ** 2 - 2 * GRAVITY * platformRise)) /
      GRAVITY;
    const takeoffRight = previous
      ? previous.x + previous.width
      : createGameState().player.x + createGameState().player.width;
    const horizontalGap = current.x - takeoffRight;
    expect(horizontalGap).toBeLessThanOrEqual(MOVE_SPEED * landingTime);
  }
});

test("fires in the facing direction on a repeat interval and removes offscreen shots", () => {
  const state = createGameState();
  stepGame(state, { ...neutral, shoot: true }, 0);
  expect(state.shotsFired).toBe(1);
  expect(state.projectiles[0]?.velocityX).toBeGreaterThan(0);
  expect(state.projectiles[0]?.velocityY).toBe(PROJECTILE_LAUNCH_DOWN_SPEED);
  stepGame(state, { ...neutral, shoot: true }, FIRE_INTERVAL / 2);
  expect(state.shotsFired).toBe(1);
  for (let index = 0; index < 4; index += 1) {
    stepGame(state, { ...neutral, shoot: true }, FIRE_INTERVAL);
  }
  expect(state.shotsFired).toBe(2);

  state.player.facing = -1;
  state.fireCooldown = 0;
  stepGame(state, { ...neutral, shoot: true }, 0);
  expect(state.projectiles.at(-1)?.velocityX).toBeLessThan(0);

  state.projectiles.push(
    { x: -1, y: 20, velocityX: -1, velocityY: 0 },
    { x: WORLD_WIDTH + 1, y: 20, velocityX: 1, velocityY: 0 },
  );
  stepGame(state, neutral, 0);
  expect(state.projectiles.every((projectile) => projectile.x >= 0)).toBe(true);
  expect(
    state.projectiles.every((projectile) => projectile.x <= WORLD_WIDTH),
  ).toBe(true);
});

test("fireballs curve downward and bounce from the first platform they reach", () => {
  const state = createGameState();
  const incomingVelocity = 2200;
  state.projectiles.push({
    x: 300,
    y: 370,
    velocityX: 200,
    velocityY: incomingVelocity,
  });

  stepGame(state, neutral, 0.05);

  const projectile = state.projectiles[0]!;
  const impactVelocity = incomingVelocity + PROJECTILE_GRAVITY * 0.05;
  expect(projectile.x).toBe(310);
  expect(projectile.velocityX).toBe(200);
  expect(projectile.velocityY).toBeCloseTo(-impactVelocity * PROJECTILE_BOUNCE);
  expect(projectile.y).toBe(PLATFORMS[1]!.y - 4);
  expect(state.projectileBounces).toBe(1);
});

test("keeps a small bounce so fireballs continue along a visible wave", () => {
  const state = createGameState();
  state.projectiles.push({
    x: 300,
    y: GROUND_Y - 10,
    velocityX: 200,
    velocityY: 100,
  });

  stepGame(state, neutral, 0.05);

  expect(state.projectiles[0]?.velocityY).toBe(-PROJECTILE_MIN_BOUNCE_SPEED);
  expect(state.projectileBounces).toBe(1);
});

test("timer expiry respawns at the active checkpoint with fresh time", () => {
  const state = createGameState();
  state.player.x = 900;
  stepGame(state, neutral, 0);
  expect(state.campaign.checkpointIndex).toBe(1);
  state.player.y = 120;
  state.player.height = 42;
  state.player.crouched = true;
  state.projectiles.push({ x: 300, y: 300, velocityX: 1, velocityY: 1 });
  state.fireCooldown = 1;

  stepGame(state, neutral, 91);

  expect(state.campaign.lives).toBe(2);
  expect(state.campaign.remainingSeconds).toBe(90);
  expect(state.campaign.status).toBe("playing");
  expect(state.player.x).toBe(900);
  expect(state.player.y + state.player.height).toBe(GROUND_Y);
  expect(state.player.height).toBe(72);
  expect(state.player.grounded).toBe(true);
  expect(state.projectiles).toEqual([]);
  expect(state.fireCooldown).toBe(0);
});

test("timer expiry with the final life enters game over without advancing physics", () => {
  const state = createGameState();
  state.campaign.lives = 1;
  state.player.x = 400;

  stepGame(state, { ...neutral, right: true }, 91);

  expect(state.campaign.status).toBe("game-over");
  expect(state.campaign.lives).toBe(0);
  expect(state.player.x).toBe(400);
});

test("losing a life respawns at the checkpoint and the last loss ends the game", () => {
  const state = createGameState();
  state.player.x = 900;
  stepGame(state, neutral, 0);
  state.player.x = 1200;
  expect(losePlayerLife(state)).toBe(true);
  expect(state.campaign.lives).toBe(2);
  expect(state.player.x).toBe(900);
  expect(state.campaign.remainingSeconds).toBe(90);

  state.campaign.lives = 1;
  expect(losePlayerLife(state)).toBe(true);
  expect(state.campaign.lives).toBe(0);
  expect(state.campaign.status).toBe("game-over");
  expect(losePlayerLife(state)).toBe(false);
});

test("exits move through all levels and complete the final arena", () => {
  const state = createGameState();
  for (let index = 1; index < LEVELS.length; index += 1) {
    const previousLevel = LEVELS[index - 1]!;
    state.player.x = previousLevel.exitX;
    stepGame(state, neutral, 0);
    expect(state.campaign.levelIndex).toBe(index);
    expect(state.player.x).toBe(80);
    expect(state.campaign.checkpointIndex).toBe(0);
    expect(state.campaign.remainingSeconds).toBe(
      LEVELS[index]!.durationSeconds,
    );
  }

  state.player.x = LEVELS.at(-1)!.exitX;
  stepGame(state, neutral, 0);
  expect(state.campaign.status).toBe("complete");
  expect(state.campaign.levelIndex).toBe(LEVELS.length - 1);
});

test("level two keeps the player on the ground after its transition", () => {
  const state = createGameState();
  state.campaign.levelIndex = 1;
  const level = LEVELS[1]!;
  state.player.y = level.groundY - state.player.height;
  state.player.grounded = true;

  stepGame(state, neutral, 1 / 60);

  expect(level.platforms[0]?.y).toBe(level.groundY);
  expect(state.player.grounded).toBe(true);
  expect(state.player.y + state.player.height).toBe(level.groundY);
});

test("starting an encore raises difficulty only after campaign completion", () => {
  const state = createGameState();
  expect(startHarderEncore(state)).toBe(false);
  state.campaign.levelIndex = LEVELS.length - 1;
  state.campaign.status = "complete";

  expect(startHarderEncore(state)).toBe(true);
  expect(state.campaign.status).toBe("playing");
  expect(state.campaign.levelIndex).toBe(0);
  expect(state.campaign.encoreLevel).toBe(1);
  expect(state.campaign.remainingSeconds).toBe(70);
  expect(state.player.x).toBe(80);
  expect(startHarderEncore(state)).toBe(false);

  const maximumEncore = createGameState(3);
  maximumEncore.campaign.levelIndex = LEVELS.length - 1;
  maximumEncore.campaign.status = "complete";
  expect(startHarderEncore(maximumEncore)).toBe(false);
  expect(maximumEncore.campaign.status).toBe("complete");
});

test("a retry after game over keeps the current encore difficulty", () => {
  const state = createGameState(1);
  state.campaign.status = "game-over";
  state.player.x = 500;

  restartGame(state);

  expect(state.campaign.status).toBe("playing");
  expect(state.campaign.encoreLevel).toBe(1);
  expect(state.campaign.remainingSeconds).toBe(70);
  expect(state.player.x).toBe(80);
});

test("pause stops time and movement; resume and restart restore campaign play", () => {
  const state = createGameState();
  expect(pauseGame(state)).toBe(true);
  stepGame(state, { ...neutral, right: true }, 10);
  expect(state.player.x).toBe(80);
  expect(state.campaign.remainingSeconds).toBe(90);
  expect(resumeGame(state)).toBe(true);
  stepGame(state, { ...neutral, right: true }, 1);
  expect(state.player.x).toBeGreaterThan(80);
  expect(state.campaign.remainingSeconds).toBeLessThan(90);
  state.campaign.lives = 1;
  restartGame(state);
  expect(state.player.x).toBe(80);
  expect(state.campaign.lives).toBe(3);
  expect(state.campaign.status).toBe("playing");
});
