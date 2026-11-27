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
  stepGame,
} from "../../client/games/ilsur-platformer/game.js";
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
  state.player.x = WORLD_WIDTH;
  stepGame(state, { ...neutral, right: true }, 0.05);
  expect(state.player.x).toBe(WORLD_WIDTH - state.player.width);
  expect(state.cameraX).toBe(WORLD_WIDTH - 960);

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
