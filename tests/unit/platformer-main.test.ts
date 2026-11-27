import { afterEach, expect, test, vi } from "vitest";
import { GAME_ACTIONS } from "../../client/games/ilsur-platformer/input.js";

class Element extends EventTarget {
  dataset: Record<string, string | undefined> = {};
  attributes = new Map<string, string>();

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
            : null,
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
  expect(harness.canvas?.context.fillRect).toHaveBeenCalled();
  expect(harness.requestAnimationFrame).toHaveBeenCalledTimes(2);

  const modified = fire(harness.window, "keydown", {
    code: "ArrowRight",
    ctrlKey: true,
  });
  expect(modified.defaultPrevented).toBe(false);
  expect(
    fire(harness.window, "keydown", { code: "Escape" }).defaultPrevented,
  ).toBe(false);
  expect(
    fire(harness.window, "keyup", { code: "Escape" }).defaultPrevented,
  ).toBe(false);

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
  expect(harness.requestAnimationFrame).toHaveBeenCalledTimes(5);
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
