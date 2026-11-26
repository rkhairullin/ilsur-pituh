import { afterEach, expect, test, vi } from "vitest";

class Canvas {
  width = 1200;
  height = 540;
  context = {
    clearRect: vi.fn(),
    save: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    fillStyle: "",
    fillRect: vi.fn(),
    restore: vi.fn(),
  };

  getContext() {
    return this.context as unknown as CanvasRenderingContext2D;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

test("starts and repeats the Canvas frame loop", async () => {
  const canvas = new Canvas();
  const callbacks: FrameRequestCallback[] = [];
  const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    callbacks.push(callback);
    return callbacks.length;
  });
  vi.stubGlobal("document", {
    querySelector: () => canvas,
  });
  vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);

  await import("../../client/games/ilsur-platformer/main.js");
  expect(requestAnimationFrame).toHaveBeenCalledOnce();
  callbacks.shift()?.(0);
  expect(canvas.context.fillRect).toHaveBeenCalledTimes(15);
  expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
});

test("reports a missing Canvas element", async () => {
  vi.stubGlobal("document", { querySelector: () => null });
  await expect(
    import("../../client/games/ilsur-platformer/main.js"),
  ).rejects.toThrow("Не удалось подготовить Canvas третьей игры");
});

test("reports an unavailable 2D context", async () => {
  const canvas = { getContext: () => null };
  vi.stubGlobal("document", { querySelector: () => canvas });
  await expect(
    import("../../client/games/ilsur-platformer/main.js"),
  ).rejects.toThrow("Не удалось подготовить Canvas третьей игры");
});
