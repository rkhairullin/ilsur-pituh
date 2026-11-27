import { expect, test, vi } from "vitest";
import { createGameState } from "../../client/games/ilsur-platformer/game.js";
import { drawPlatformerScene } from "../../client/games/ilsur-platformer/scene.js";

function makeContext() {
  return {
    clearRect: vi.fn(),
    save: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    fillStyle: "",
    fillRect: vi.fn(),
    restore: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

test("draws the world, platforms, player, and projectiles in the camera view", () => {
  const context = makeContext();
  const state = createGameState();
  state.cameraX = 140;
  state.projectiles.push({ x: 220, y: 420, velocityX: 560, velocityY: 160 });
  drawPlatformerScene(context, 960, 540, state);

  expect(context.clearRect).toHaveBeenCalledWith(0, 0, 960, 540);
  expect(context.translate).toHaveBeenCalledWith(0, 0);
  expect(context.translate).toHaveBeenCalledWith(-140, 0);
  expect(context.scale).toHaveBeenCalledWith(1, 1);
  expect(context.fillRect).toHaveBeenCalledWith(0, 480, 2600, 60);
  expect(context.fillRect).toHaveBeenCalledWith(213, 416, 14, 8);
  expect(context.restore).toHaveBeenCalledTimes(2);
});

test("centers a scaled viewport and draws the crouched player facing left", () => {
  const context = makeContext();
  const state = createGameState();
  state.player.crouched = true;
  state.player.facing = -1;
  drawPlatformerScene(context, 600, 400, state);

  expect(context.translate).toHaveBeenCalledWith(0, 31.25);
  expect(context.scale).toHaveBeenCalledWith(0.625, 0.625);
  expect(context.fillRect).toHaveBeenCalledWith(90, 420, 5, 5);
  expect(context.restore).toHaveBeenCalledTimes(2);
});
