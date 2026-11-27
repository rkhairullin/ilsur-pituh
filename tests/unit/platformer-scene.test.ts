import { expect, test, vi } from "vitest";
import { drawPlaceholderScene } from "../../client/games/ilsur-platformer/scene.js";

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

test("draws the placeholder scene scaled to the canvas", () => {
  const context = makeContext();
  drawPlaceholderScene(context, 1200, 540);
  expect(context.clearRect).toHaveBeenCalledWith(0, 0, 1200, 540);
  expect(context.translate).toHaveBeenCalledWith(0, 0);
  expect(context.scale).toHaveBeenCalledWith(1, 1);
  expect(context.fillRect).toHaveBeenCalledTimes(15);
  expect(context.restore).toHaveBeenCalledOnce();
});

test("keeps the placeholder scene centered when the canvas is smaller", () => {
  const context = makeContext();
  drawPlaceholderScene(context, 600, 270);
  expect(context.translate).toHaveBeenCalledWith(0, 0);
  expect(context.scale).toHaveBeenCalledWith(0.5, 0.5);
});
