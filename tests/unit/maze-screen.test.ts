import { afterEach, expect, test, vi } from "vitest";
import * as engine from "../../client/games/maze/maze.js";

class Element extends EventTarget {
  children: Element[] = [];
  dataset: Record<string, string> = {};
  textContent = "";
  focus = vi.fn();
  setAttribute = vi.fn();
  setPointerCapture = vi.fn();

  append(child: Element) {
    this.children.push(child);
  }
}

class Button extends Element {}
class Anchor extends Element {}

function dispatch(target: EventTarget, type: string, props = {}) {
  target.dispatchEvent(
    Object.assign(new Event(type, { cancelable: true }), props),
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.doUnmock("../../client/games/maze/maze.js");
  vi.resetModules();
});

test("renders play, pointer input and a fresh round", async () => {
  vi.useFakeTimers();
  const field = new Element();
  const score = new Element();
  const lives = new Element();
  const level = new Element();
  const circle = new Element();
  const phase = new Element();
  const status = new Element();
  const restart = new Button();
  const right = new Button();
  right.dataset.direction = "right";
  const down = new Button();
  down.dataset.direction = "down";
  const elements = new Map([
    ["#field", field],
    ["#score", score],
    ["#lives", lives],
    ["#level", level],
    ["#circle", circle],
    ["#phase", phase],
    ["#status", status],
    ["#restart", restart],
  ]);
  const document = Object.assign(new EventTarget(), {
    querySelector: (selector: string) => elements.get(selector),
    querySelectorAll: () => [right, down],
    createElement: () => new Element(),
  });
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", { setTimeout });
  const coarseTouch = { matches: true };
  const portraitTouch = { matches: true };
  vi.stubGlobal("matchMedia", (query: string) =>
    query.includes("orientation: portrait") ? portraitTouch : coarseTouch,
  );
  vi.stubGlobal("HTMLButtonElement", Button);
  vi.stubGlobal("HTMLAnchorElement", Anchor);
  await import("../../client/games/maze/main.js");

  const player = () =>
    field.children.findIndex(({ dataset }) => dataset.tile === "player");
  const key = (code: string, target: EventTarget = field) => {
    const event = new Event("keydown", { cancelable: true });
    Object.defineProperties(event, {
      code: { value: code },
      target: { value: target },
    });
    document.dispatchEvent(event);
  };
  expect(field.children).toHaveLength(165);
  expect(field.children[0]?.dataset.tile).toBe("wall");
  expect(
    field.children[engine.index(engine.levelInfo(1)!.golden)]?.dataset.tile,
  ).toBe("golden");
  expect(lives.textContent).toBe("5");
  expect(level.textContent).toBe("1");
  expect(circle.textContent).toBe("1");
  expect(phase.textContent).toBe("Погоня");
  expect(
    field.children.filter(({ dataset }) => dataset.tile?.startsWith("enemy-")),
  ).toHaveLength(1);
  key("ShiftLeft");
  key("ArrowRight", restart);
  key("ArrowRight", new Anchor());
  vi.advanceTimersByTime(280);
  expect(player()).toBe(engine.index({ x: 1, y: 1 }));

  dispatch(right, "pointerdown", { pointerId: 1 });
  dispatch(right, "click", { detail: 1 });
  dispatch(right, "pointercancel", { pointerId: 1 });
  expect(right.setPointerCapture).toHaveBeenCalledWith(1);
  vi.advanceTimersByTime(280);
  expect(player()).toBe(engine.index({ x: 1, y: 1 }));

  dispatch(right, "click", { detail: 0 });
  vi.advanceTimersByTime(279);
  expect(player()).toBe(engine.index({ x: 1, y: 1 }));
  vi.advanceTimersByTime(1);
  expect(player()).toBe(engine.index({ x: 2, y: 1 }));
  expect(score.textContent).toBe("1");
  key("KeyS");
  vi.advanceTimersByTime(840);
  expect(player()).toBe(engine.index({ x: 4, y: 2 }));

  dispatch(restart, "click");
  expect(field.focus).toHaveBeenCalled();
  expect(score.textContent).toBe("0");
  expect(player()).toBe(engine.index({ x: 1, y: 1 }));

  portraitTouch.matches = false;
  vi.advanceTimersByTime(1000);
  expect(player()).toBe(engine.index({ x: 1, y: 1 }));
  portraitTouch.matches = true;
  dispatch(right, "click", { detail: 0 });
  vi.advanceTimersByTime(280);
  expect(player()).toBe(engine.index({ x: 2, y: 1 }));
  const finalTile = engine.createMaze();
  finalTile.items = new Set([engine.index({ x: 2, y: 1 })]);
  const create = vi.spyOn(engine, "createMaze").mockReturnValueOnce(finalTile);
  dispatch(restart, "click");
  create.mockRestore();
  key("ArrowRight");
  vi.advanceTimersByTime(280);
  expect(status.textContent).toBe("Карта пройдена!");
  vi.advanceTimersByTime(560);
  expect(player()).toBe(engine.index({ x: 1, y: 1 }));
});

test("restart after defeat starts a fresh game loop", async () => {
  vi.useFakeTimers();
  const lostMaze = engine.createMaze();
  lostMaze.status = "lost";
  lostMaze.phase = "rest";
  const status = new Element();
  const field = new Element();
  const restart = new Button();
  const freshMaze = engine.createMaze();
  const elements = new Map([
    ["#field", field],
    ["#score", new Element()],
    ["#lives", new Element()],
    ["#level", new Element()],
    ["#circle", new Element()],
    ["#phase", new Element()],
    ["#status", status],
    ["#restart", restart],
  ]);
  const document = Object.assign(new EventTarget(), {
    querySelector: (selector: string) => elements.get(selector),
    querySelectorAll: () => [],
    createElement: () => new Element(),
  });
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", { setTimeout });
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.stubGlobal("HTMLButtonElement", Button);
  vi.stubGlobal("HTMLAnchorElement", Anchor);
  const createMaze = vi
    .fn()
    .mockReturnValueOnce(lostMaze)
    .mockReturnValue(freshMaze);
  vi.doMock("../../client/games/maze/maze.js", async () => ({
    ...(await vi.importActual<typeof engine>(
      "../../client/games/maze/maze.js",
    )),
    createMaze,
  }));
  await import("../../client/games/maze/main.js");
  expect(status.textContent).toBe("Gay over");
  vi.advanceTimersByTime(280);
  expect(vi.getTimerCount()).toBe(0);
  dispatch(restart, "click");
  expect(status.textContent).toBe("");
  const event = new Event("keydown", { cancelable: true });
  Object.defineProperties(event, {
    code: { value: "ArrowRight" },
    target: { value: field },
  });
  document.dispatchEvent(event);
  vi.advanceTimersByTime(280);
  expect(
    field.children.findIndex(({ dataset }) => dataset.tile === "player"),
  ).toBe(engine.index({ x: 2, y: 1 }));
  expect(vi.getTimerCount()).toBe(1);
  freshMaze.lives = 1;
  freshMaze.enemies = [
    { position: { x: 3, y: 1 }, direction: "left", kind: "pursuer" },
  ];
  const losingEvent = new Event("keydown", { cancelable: true });
  Object.defineProperties(losingEvent, {
    code: { value: "ArrowRight" },
    target: { value: field },
  });
  document.dispatchEvent(losingEvent);
  vi.advanceTimersByTime(280);
  expect(status.textContent).toBe("Gay over");
  expect(vi.getTimerCount()).toBe(0);
});
