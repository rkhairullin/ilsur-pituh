import { afterEach, expect, test, vi } from "vitest";
import { GAME_ACTIONS } from "../../client/games/ilsur-platformer/input.js";

class Element extends EventTarget {
  dataset: Record<string, string | undefined> = {};
  attributes = new Map<string, string>();
  hidden = false;
  textContent = "";

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
}

class Canvas extends Element {
  width = 960;
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

class Button extends Element {
  setPointerCapture = vi.fn();

  constructor(action: string) {
    super();
    this.dataset.action = action;
    this.setAttribute("aria-pressed", "false");
  }
}

function fire(target: EventTarget, type: string, fields: object = {}) {
  const event = Object.assign(new Event(type, { cancelable: true }), fields);
  target.dispatchEvent(event);
  return event;
}

async function mount(
  options: {
    canvas?: Canvas | null;
    output?: Element | null;
    prototype?: Element | null;
    buttons?: Button[];
  } = {},
) {
  const canvas = options.canvas === undefined ? new Canvas() : options.canvas;
  const output = options.output === undefined ? new Element() : options.output;
  const prototype =
    options.prototype === undefined ? new Element() : options.prototype;
  const elements = new Map<string, Element>([
    ["#level-name", new Element()],
    ["#level-time", new Element()],
    ["#lives", new Element()],
    ["#checkpoint-name", new Element()],
    ["#pause", new Button("pause")],
    ["#campaign-overlay", new Element()],
    ["#overlay-title", new Element()],
    ["#overlay-message", new Element()],
    ["#resume", new Button("resume")],
    ["#restart", new Button("restart")],
    ["#catalog", new Element()],
  ] as const);
  const buttons =
    options.buttons ?? GAME_ACTIONS.map((action) => new Button(action));
  const document = Object.assign(new EventTarget(), {
    hidden: false,
    querySelector: (selector: string) =>
      selector === "#scene"
        ? canvas
        : selector === "#game-state"
          ? output
          : selector === ".prototype"
            ? prototype
            : (elements.get(selector) ?? null),
    querySelectorAll: () => buttons,
  });
  const window = new EventTarget();
  const frames: FrameRequestCallback[] = [];
  const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", window);
  vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
  await import("../../client/games/ilsur-platformer/main.js");
  return {
    canvas: canvas as Canvas,
    output: output as Element,
    prototype: prototype as Element,
    elements,
    buttons,
    document,
    window,
    frames,
    requestAnimationFrame,
    advance: (time: number) => frames.shift()?.(time),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

test("runs the frame loop and maps keyboard movement to game state", async () => {
  const harness = await mount({
    buttons: [...GAME_ACTIONS, "unknown"].map((action) => new Button(action)),
  });
  expect(harness.requestAnimationFrame).toHaveBeenCalledOnce();
  harness.advance(0);
  expect(harness.output.dataset.playerX).toBe("80");
  expect(harness.output.dataset.level).toBe("1");
  expect(harness.output.dataset.lives).toBe("3");
  expect(harness.elements.get("#level-time")?.textContent).toBe("01:30");
  expect(harness.canvas?.context.fillRect).toHaveBeenCalled();
  expect(harness.requestAnimationFrame).toHaveBeenCalledTimes(2);
  fire(harness.elements.get("#resume")!, "click");
  expect(harness.output.dataset.status).toBe("playing");
  expect(
    fire(harness.window, "keydown", { code: "Escape", repeat: true })
      .defaultPrevented,
  ).toBe(false);

  const modified = fire(harness.window, "keydown", {
    code: "ArrowRight",
    ctrlKey: true,
  });
  expect(modified.defaultPrevented).toBe(false);
  expect(
    fire(harness.window, "keydown", { code: "Escape" }).defaultPrevented,
  ).toBe(true);
  expect(harness.output.dataset.status).toBe("paused");
  expect(
    fire(harness.window, "keyup", { code: "Escape" }).defaultPrevented,
  ).toBe(false);
  fire(harness.window, "keydown", { code: "Escape" });
  expect(harness.output.dataset.status).toBe("playing");
  harness.advance(0);

  expect(
    fire(harness.window, "keydown", { code: "ArrowRight" }).defaultPrevented,
  ).toBe(true);
  expect(harness.buttons[1]?.getAttribute("aria-pressed")).toBe("true");
  harness.advance(100);
  const movedX = Number(harness.output.dataset.playerX);
  expect(movedX).toBeGreaterThan(80);
  harness.advance(90);
  expect(Number(harness.output.dataset.playerX)).toBe(movedX);
  expect(
    fire(harness.window, "keyup", { code: "ArrowRight" }).defaultPrevented,
  ).toBe(true);
  expect(harness.buttons[1]?.getAttribute("aria-pressed")).toBe("false");
  harness.advance(1000);
  expect(harness.requestAnimationFrame).toHaveBeenCalledTimes(6);
});

test("pauses the timer with Escape or the pause control and resumes explicitly", async () => {
  const harness = await mount();
  harness.advance(0);
  harness.advance(1000);
  expect(harness.output.dataset.time).toBe("89");

  fire(harness.window, "keydown", { code: "Escape" });
  expect(harness.output.dataset.status).toBe("paused");
  expect(harness.elements.get("#overlay-title")?.textContent).toBe(
    "Антракт, звезда! ✨",
  );
  expect(harness.elements.get("#catalog")?.hidden).toBe(false);
  harness.advance(5000);
  expect(harness.output.dataset.time).toBe("89");

  fire(harness.elements.get("#resume")!, "click");
  expect(harness.output.dataset.status).toBe("playing");
  harness.advance(5000);
  harness.advance(6000);
  expect(harness.output.dataset.time).toBe("88");

  fire(harness.elements.get("#pause")!, "click");
  expect(harness.output.dataset.status).toBe("paused");
});

test("shows game over after three timed lives and restarts a fresh campaign", async () => {
  const harness = await mount();
  harness.advance(0);
  harness.advance(90_000);
  expect(harness.output.dataset.lives).toBe("2");
  harness.advance(180_000);
  expect(harness.output.dataset.lives).toBe("1");
  harness.advance(270_000);

  expect(harness.output.dataset.status).toBe("game-over");
  expect(harness.elements.get("#overlay-title")?.textContent).toBe(
    "Драма на весь подиум!",
  );
  expect(harness.elements.get("#restart")?.hidden).toBe(false);
  expect(harness.elements.get("#restart")?.textContent).toBe("Ещё попытка!");
  expect(harness.elements.get("#catalog")?.hidden).toBe(false);
  fire(harness.window, "keydown", { code: "Escape" });
  expect(harness.output.dataset.status).toBe("game-over");
  fire(harness.elements.get("#restart")!, "click");
  expect(harness.output.dataset.status).toBe("playing");
  expect(harness.output.dataset.lives).toBe("3");
});

test("restarts a completed campaign as a harder encore", async () => {
  const harness = await mount();
  let now = 0;
  harness.advance(now);
  fire(harness.window, "keydown", { code: "ArrowRight" });

  for (let frame = 1; frame <= 1_100; frame += 1) {
    now += 50;
    harness.advance(now);
    if (harness.output.dataset.status === "complete") break;
  }

  expect(harness.output.dataset.status).toBe("complete");
  expect(harness.elements.get("#restart")?.textContent).toBe(
    "На бис: сложнее!",
  );
  fire(harness.elements.get("#restart")!, "click");

  expect(harness.output.dataset.status).toBe("playing");
  expect(harness.output.dataset.encore).toBe("1");
  expect(harness.output.dataset.time).toBe("70");
});

test("handles pointer controls, cancellation, blur, and hidden documents", async () => {
  const harness = await mount();
  const contextMenu = fire(harness.prototype, "contextmenu");
  expect(contextMenu.defaultPrevented).toBe(true);
  const left = harness.buttons[0]!;
  const right = harness.buttons[1]!;
  expect(
    fire(left, "pointerdown", { button: 2, pointerId: 1 }).defaultPrevented,
  ).toBe(false);
  expect(left.getAttribute("aria-pressed")).toBe("false");

  fire(left, "pointerdown", { button: 0, pointerId: 1 });
  expect(left.setPointerCapture).toHaveBeenCalledWith(1);
  expect(left.getAttribute("aria-pressed")).toBe("true");
  fire(harness.window, "keydown", { code: "ArrowLeft" });
  fire(left, "pointercancel", { pointerId: 1 });
  expect(left.getAttribute("aria-pressed")).toBe("true");
  fire(harness.window, "keyup", { code: "ArrowLeft" });
  expect(left.getAttribute("aria-pressed")).toBe("false");

  fire(right, "pointerdown", { button: 0, pointerId: 2 });
  fire(right, "pointerup", { pointerId: 2 });
  expect(right.getAttribute("aria-pressed")).toBe("false");
  fire(right, "pointerdown", { button: 0, pointerId: 3 });
  fire(right, "lostpointercapture", { pointerId: 3 });
  expect(right.getAttribute("aria-pressed")).toBe("false");

  fire(left, "pointerdown", { button: 0, pointerId: 4 });
  fire(harness.window, "blur");
  expect(left.getAttribute("aria-pressed")).toBe("false");
  fire(right, "pointerdown", { button: 0, pointerId: 5 });
  fire(harness.document, "visibilitychange");
  expect(right.getAttribute("aria-pressed")).toBe("true");
  harness.document.hidden = true;
  fire(harness.document, "visibilitychange");
  expect(right.getAttribute("aria-pressed")).toBe("false");
  expect(harness.output.dataset.status).toBe("paused");
});

test("reports when the Canvas, drawing context, or game status is missing", async () => {
  await expect(mount({ canvas: null })).rejects.toThrow(
    "Не удалось подготовить Canvas третьей игры",
  );
  await expect(mount({ output: null })).rejects.toThrow(
    "Не удалось подготовить Canvas третьей игры",
  );
  await expect(mount({ prototype: null })).rejects.toThrow(
    "Не удалось подготовить Canvas третьей игры",
  );

  const canvas = new Canvas();
  canvas.getContext = () => null as unknown as CanvasRenderingContext2D;
  await expect(mount({ canvas })).rejects.toThrow(
    "Не удалось подготовить Canvas третьей игры",
  );
});
