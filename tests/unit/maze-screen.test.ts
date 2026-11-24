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
  vi.resetModules();
});

test("renders play, pointer input and a fresh round", async () => {
  vi.useFakeTimers();
  const field = new Element();
  const score = new Element();
  const lives = new Element();
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
    ["#status", status],
    ["#restart", restart],
  ]);
  const document = Object.assign(new EventTarget(), {
    querySelector: (selector: string) => elements.get(selector),
    querySelectorAll: () => [right, down],
    createElement: () => new Element(),
  });
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", { setInterval });
  const landscape = { matches: false };
  vi.stubGlobal("matchMedia", () => landscape);
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
  expect(lives.textContent).toBe("3");
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
  expect(score.textContent).toBe("10");
  key("KeyS");
  vi.advanceTimersByTime(840);
  expect(player()).toBe(engine.index({ x: 4, y: 2 }));

  dispatch(restart, "click");
  expect(field.focus).toHaveBeenCalled();
  expect(score.textContent).toBe("0");
  expect(player()).toBe(engine.index({ x: 1, y: 1 }));

  landscape.matches = true;
  dispatch(down, "pointerdown", { pointerId: 2 });
  vi.advanceTimersByTime(280);
  expect(player()).toBe(engine.index({ x: 2, y: 1 }));
  landscape.matches = false;
  const finalTile = engine.createMaze();
  finalTile.items = new Set([engine.index({ x: 2, y: 1 })]);
  const create = vi.spyOn(engine, "createMaze").mockReturnValueOnce(finalTile);
  dispatch(restart, "click");
  create.mockRestore();
  key("ArrowRight");
  vi.advanceTimersByTime(280);
  expect(status.textContent).toBe("Карта пройдена!");
  vi.advanceTimersByTime(560);
  expect(player()).toBe(engine.index({ x: 2, y: 1 }));
});
