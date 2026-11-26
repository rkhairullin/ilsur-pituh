import { afterEach, expect, test, vi } from "vitest";
import * as engine from "../../client/games/packman/maze.js";

class Element extends EventTarget {
  children: Element[] = [];
  dataset: Record<string, string> = {};
  textContent = "";
  hidden = false;
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
  vi.doUnmock("../../client/games/packman/maze.js");
  vi.resetModules();
});

test("renders play, pointer input and a fresh round", async () => {
  vi.useFakeTimers();
  const field = new Element();
  const score = new Element();
  const lives = new Element();
  const level = new Element();
  const circle = new Element();
  const status = new Element();
  const lost = new Element();
  lost.hidden = true;
  const retry = new Button();
  const restart = new Button();
  const right = new Button();
  const screen = { innerWidth: 375, innerHeight: 667, setTimeout };
  right.dataset.direction = "right";
  const down = new Button();
  down.dataset.direction = "down";
  const elements = new Map([
    ["#field", field],
    ["#caught", score],
    ["#lives", lives],
    ["#level", level],
    ["#circle", circle],
    ["#status", status],
    ["#lost", lost],
    ["#final-caught", new Element()],
    ["#final-circle", new Element()],
    ["#final-round", new Element()],
    ["#result-status", new Element()],
    ["#retry-result", retry],
    ["#restart", restart],
    ["#play-again", new Button()],
  ]);
  const document = Object.assign(new EventTarget(), {
    querySelector: (selector: string) => elements.get(selector),
    querySelectorAll: () => [right, down],
    createElement: () => new Element(),
  });
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", screen);
  const coarseTouch = { matches: true };
  const portraitTouch = { matches: true };
  vi.stubGlobal("matchMedia", (query: string) =>
    query.includes("orientation: portrait") ? portraitTouch : coarseTouch,
  );
  vi.stubGlobal("HTMLButtonElement", Button);
  vi.stubGlobal("HTMLAnchorElement", Anchor);
  const cryptoMock: {
    randomUUID: (() => string) | undefined;
    getRandomValues: (bytes: Uint8Array) => Uint8Array;
  } = {
    randomUUID: vi.fn(() => "round-id"),
    getRandomValues: vi.fn((bytes: Uint8Array) => {
      bytes.set(Array.from({ length: bytes.length }, (_, index) => index));
      return bytes;
    }),
  };
  const fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("crypto", cryptoMock);
  vi.stubGlobal("fetch", fetchMock);
  await import("../../client/games/packman/main.js");

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
  expect(
    field.children.filter(({ dataset }) => dataset.tile?.startsWith("enemy-")),
  ).toHaveLength(1);
  expect(
    field.children.find(({ dataset }) => dataset.tile === "player")?.dataset
      .direction,
  ).toBe("right");
  const firstEnemy = field.children.find(({ dataset }) =>
    dataset.tile?.startsWith("enemy-"),
  );
  expect(firstEnemy?.dataset.direction).toBe("left");
  expect(firstEnemy?.dataset.enemyKind).toBe("pursuer");
  key("ShiftLeft");
  key("ArrowRight", restart);
  key("ArrowRight", new Anchor());
  vi.advanceTimersByTime(280);
  expect(player()).toBe(engine.index({ x: 1, y: 1 }));
  expect(score.textContent).toBe("0");

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
  expect(
    field.children.find(({ dataset }) => dataset.tile === "player")?.dataset
      .direction,
  ).toBe("right");
  key("KeyS");
  vi.advanceTimersByTime(840);
  expect(player()).toBe(engine.index({ x: 4, y: 2 }));

  cryptoMock.randomUUID = undefined;
  dispatch(restart, "click");
  expect(cryptoMock.getRandomValues).toHaveBeenCalledOnce();
  expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(
    "/api/games/ilsur-pacman/rounds/00010203-0405-4607-8809-0a0b0c0d0e0f",
  );
  cryptoMock.randomUUID = () => "round-id";
  expect(field.focus).toHaveBeenCalled();
  expect(score.textContent).toBe("0");
  expect(player()).toBe(engine.index({ x: 1, y: 1 }));

  portraitTouch.matches = false;
  screen.innerWidth = 844;
  screen.innerHeight = 285;
  dispatch(right, "click", { detail: 0 });
  vi.advanceTimersByTime(1000);
  expect(player()).toBe(engine.index({ x: 1, y: 1 }));
  portraitTouch.matches = true;
  screen.innerWidth = 375;
  screen.innerHeight = 667;
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
  expect(lost.hidden).toBe(true);
  vi.advanceTimersByTime(560);
  expect(player()).toBe(engine.index({ x: 1, y: 1 }));
  expect(
    field.children.find(({ dataset }) => dataset.tile === "player")?.dataset
      .direction,
  ).toBe("right");
});

test("restart after defeat starts a fresh game loop", async () => {
  vi.useFakeTimers();
  const lostMaze = engine.createMaze();
  lostMaze.status = "lost";
  lostMaze.phase = "rest";
  const status = new Element();
  const lost = new Element();
  lost.hidden = true;
  const finalCaught = new Element();
  const finalCircle = new Element();
  const finalRound = new Element();
  const retryResult = new Button();
  const field = new Element();
  const restart = new Button();
  const playAgain = new Button();
  lostMaze.caught = 17;
  lostMaze.circle = 4;
  lostMaze.level = 6;
  const elements = new Map([
    ["#field", field],
    ["#caught", new Element()],
    ["#lives", new Element()],
    ["#level", new Element()],
    ["#circle", new Element()],
    ["#lost", lost],
    ["#final-caught", finalCaught],
    ["#final-circle", finalCircle],
    ["#final-round", finalRound],
    ["#result-status", status],
    ["#retry-result", retryResult],
    ["#restart", restart],
    ["#play-again", playAgain],
  ]);
  const freshMaze = engine.createMaze();
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
  vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "round-id") });
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({ ok: true })
    .mockResolvedValueOnce({ ok: false })
    .mockResolvedValueOnce({ ok: true })
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ ok: true })
    .mockResolvedValueOnce({ ok: true });
  vi.stubGlobal("fetch", fetch);
  const createMaze = vi
    .fn()
    .mockReturnValueOnce(lostMaze)
    .mockReturnValue(freshMaze);
  vi.doMock("../../client/games/packman/maze.js", async () => ({
    ...(await vi.importActual<typeof engine>(
      "../../client/games/packman/maze.js",
    )),
    createMaze,
  }));
  await import("../../client/games/packman/main.js");
  expect(lost.hidden).toBe(false);
  expect(finalCaught.textContent).toBe("17");
  expect(finalCircle.textContent).toBe("4");
  expect(finalRound.textContent).toBe("6");
  vi.advanceTimersByTime(280);
  expect(vi.getTimerCount()).toBe(0);
  dispatch(playAgain, "click");
  expect(lost.hidden).toBe(true);
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
  expect(lost.hidden).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
  await vi.waitFor(() => {
    expect(status.textContent).toBe(
      "Результат не подтверждён. Повтори сохранение.",
    );
    expect(retryResult.hidden).toBe(false);
  });
  const resultRequest = JSON.parse(fetch.mock.calls[3]![1]!.body as string);
  expect(resultRequest).toEqual({ caught: 1, circle: 1, round: 1 });
  dispatch(retryResult, "click");
  await vi.waitFor(() => expect(status.textContent).toBe("Результат сохранён"));
});

test("renders four distinct enemy heads on the final map", async () => {
  vi.useFakeTimers();
  const field = new Element();
  const maze = engine.createMaze();
  maze.level = 7;
  maze.enemies = [
    {
      position: { x: 7, y: 5 },
      direction: "left",
      kind: "pursuer",
    },
    {
      position: { x: 9, y: 5 },
      direction: "down",
      kind: "interceptor",
    },
    {
      position: { x: 7, y: 9 },
      direction: "up",
      kind: "patroller",
    },
    {
      position: { x: 9, y: 9 },
      direction: "right",
      kind: "ambusher",
    },
  ];
  const elements = new Map([
    ["#field", field],
    ["#caught", new Element()],
    ["#lives", new Element()],
    ["#level", new Element()],
    ["#circle", new Element()],
    ["#phase", new Element()],
    ["#status", new Element()],
    ["#lost", new Element()],
    ["#final-caught", new Element()],
    ["#final-circle", new Element()],
    ["#final-round", new Element()],
    ["#result-status", new Element()],
    ["#retry-result", new Button()],
    ["#restart", new Button()],
    ["#play-again", new Button()],
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
  vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "round-id") });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  vi.doMock("../../client/games/packman/maze.js", async () => ({
    ...(await vi.importActual<typeof engine>(
      "../../client/games/packman/maze.js",
    )),
    createMaze: () => maze,
  }));
  await import("../../client/games/packman/main.js");

  const enemies = field.children.filter(({ dataset }) =>
    dataset.tile?.startsWith("enemy-"),
  );
  expect(enemies).toHaveLength(4);
  expect(enemies.map(({ dataset }) => dataset.enemyKind).sort()).toEqual([
    "ambusher",
    "interceptor",
    "patroller",
    "pursuer",
  ]);
  expect(enemies.map(({ dataset }) => dataset.direction)).toEqual([
    "left",
    "down",
    "up",
    "right",
  ]);
});
