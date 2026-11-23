import { afterEach, expect, test, vi } from "vitest";
import { lanes } from "../../client/games/ilsur-lovit-chleny/input.js";
import { drawScene } from "../../client/games/ilsur-lovit-chleny/scene.js";
import { bananaSequence } from "../../client/games/ilsur-lovit-chleny/sequence.js";

class ElementStub extends EventTarget {
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  hidden = false;
  textContent = "";
  inert = false;
  focus = vi.fn();
  getAttribute(name: string) {
    return this.attributes.get(name);
  }
  setPointerCapture = vi.fn();
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
}

async function mount(
  options: {
    portrait?: boolean;
    hidden?: boolean;
    firstRequestFails?: boolean;
    userAgent?: string;
    fullscreen?: boolean;
    fullscreenActive?: boolean;
    installed?: boolean;
    displayMode?: boolean;
    requestFullscreen?: () => Promise<void>;
    canvas?: boolean;
    random?: () => number;
    phraseIndex?: () => number;
    sprites?: boolean;
  } = {},
) {
  vi.resetModules();
  const fetchRound = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(null, { status: 204 }));
  if (options.firstRequestFails)
    fetchRound.mockRejectedValueOnce(new Error("offline"));
  vi.stubGlobal("fetch", fetchRound);
  const getRandomValues = crypto.getRandomValues.bind(crypto);
  vi.spyOn(crypto, "getRandomValues").mockImplementation((buffer) => {
    if (buffer instanceof Uint32Array) {
      buffer[0] = options.phraseIndex?.() ?? 0;
      return buffer;
    }
    return getRandomValues(buffer);
  });
  vi.stubGlobal(
    "Math",
    Object.create(Math, { random: { value: options.random ?? (() => 0) } }),
  );
  const elements = new Map(
    [
      ".game",
      ".hud",
      ".arena",
      "#pause",
      "#resume",
      "#paused",
      "#rotate",
      "#lost",
      "#fullscreen-hint",
      "#restart",
      "#caught",
      "#misses",
      "#score",
      "#streak",
      "#multiplier",
      "#final-score",
      "#final-caught",
      "#result-status",
      "#retry-result",
      "#hero-sprite",
      "#banana-sprite",
      "#decoy-sprite",
      "#golden-sprite",
      "#cannon-sprite",
      "#reaction",
      "#audio-controls",
      "#sound",
      "#music",
    ].map((selector) => [selector, new ElementStub()]),
  );
  if (options.sprites) {
    for (const selector of [
      "#hero-sprite",
      "#banana-sprite",
      "#decoy-sprite",
      "#golden-sprite",
      "#cannon-sprite",
    ]) {
      Object.assign(elements.get(selector)!, {
        naturalWidth: 150,
        naturalHeight: 100,
      });
    }
  }
  const lane = new ElementStub();
  lane.dataset.lane = "upper-left";
  const drawing = {
    clearRect: vi.fn(),
    setLineDash: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
    rotate: vi.fn(),
  };
  const canvas = {
    clientWidth: 1200,
    clientHeight: 540,
    width: 1200,
    height: 540,
    getContext: () => (options.canvas === false ? null : drawing),
  };
  let resize = () => {};
  vi.stubGlobal("devicePixelRatio", 1);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
    },
  );
  const requestFullscreen = vi.fn(
    options.requestFullscreen ?? (() => Promise.resolve()),
  );
  vi.stubGlobal("navigator", {
    userAgent: options.userAgent ?? "Desktop",
    standalone: options.installed,
  });
  const document = Object.assign(new EventTarget(), {
    hidden: options.hidden ?? false,
    fullscreenEnabled: options.fullscreen ?? false,
    fullscreenElement: options.fullscreenActive ? {} : null,
    documentElement: { requestFullscreen },
    querySelector: (selector: string) =>
      selector === "canvas" ? canvas : elements.get(selector),
    querySelectorAll: () => [lane],
  });
  const media = Object.assign(new EventTarget(), {
    matches: options.portrait ?? false,
  });
  const window = new EventTarget();
  vi.stubGlobal("Audio", class {});
  vi.stubGlobal("document", document);
  vi.stubGlobal("localStorage", {
    getItem: () => "off",
    setItem: vi.fn(),
  });
  const landscape = Object.assign(new EventTarget(), { matches: false });
  const motion = Object.assign(new EventTarget(), { matches: false });
  vi.stubGlobal("matchMedia", (query: string) =>
    query.includes("max-height")
      ? landscape
      : query.includes("reduced-motion")
        ? motion
        : query.includes("display-mode")
          ? { matches: options.displayMode ?? false }
          : media,
  );
  vi.stubGlobal("addEventListener", window.addEventListener.bind(window));
  const frames: FrameRequestCallback[] = [];
  let now = 0;
  vi.stubGlobal("performance", { now: () => now });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    frames.push(callback),
  );
  const el = (selector: string) => elements.get(selector)!;
  const advance = (delta: number) => {
    now += delta;
    frames.shift()?.(now);
  };
  await import("../../client/games/ilsur-lovit-chleny/main.js");
  return {
    elements,
    lane,
    document,
    media,
    landscape,
    motion,
    window,
    drawing,
    canvas,
    resize: () => resize(),
    el,
    advance,
    frames,
    fetchRound,
    requestFullscreen,
  };
}

function fire(target: EventTarget, type: string, fields = {}) {
  const event = Object.assign(new Event(type, { cancelable: true }), fields);
  target.dispatchEvent(event);
  return event;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("keyboard and pointer navigation share the same displayed position", async () => {
  const { elements, lane, window, drawing } = await mount();
  const game = elements.get(".game")!;
  expect(game.dataset.position).toBe("center");
  expect(drawing.fillText).toHaveBeenLastCalledWith("🐓", 600, 270);
  for (const [code, modifiers] of [
    ["KeyX", {}],
    ["KeyQ", { ctrlKey: true }],
    ["KeyQ", { altKey: true }],
    ["KeyQ", { metaKey: true }],
  ] as const) {
    expect(
      fire(window, "keydown", { code, ...modifiers }).defaultPrevented,
    ).toBe(false);
  }
  fire(window, "keydown", { code: "KeyO" });
  expect(game.dataset.position).toBe("upper-right");
  fire(window, "keydown", { code: "KeyQ", repeat: true });
  expect(game.dataset.position).toBe("upper-right");
  fire(lane, "pointerdown", { button: 2, pointerId: 1 });
  expect(lane.setPointerCapture).not.toHaveBeenCalled();
  fire(lane, "pointerdown", { button: 0, pointerId: 1 });
  expect(lane.setPointerCapture).toHaveBeenCalledWith(1);
  expect(lane.attributes.get("aria-pressed")).toBe("true");
  expect(drawing.fillText).toHaveBeenLastCalledWith("🐓", 420, 160);
  fire(lane, "pointerup", { pointerId: 1 });
  expect(game.dataset.position).toBe("upper-right");
  fire(window, "keyup", { code: "KeyO" });
  expect(game.dataset.position).toBe("center");
  expect(fire(lane, "keydown", { code: "KeyQ" }).defaultPrevented).toBe(false);
  for (const code of ["Space", "Enter"]) {
    expect(fire(lane, "keydown", { code }).defaultPrevented).toBe(true);
    expect(game.dataset.position).toBe("upper-left");
    fire(lane, "keydown", { code, repeat: true });
    expect(game.dataset.position).toBe("upper-left");
    fire(window, "keyup", { code });
    expect(game.dataset.position).toBe("center");
  }
});

test("manual pause and automatic pause clear input and restore focus", async () => {
  const { elements, document, window } = await mount();
  const pause = elements.get("#pause")!;
  const resume = elements.get("#resume")!;
  const overlay = elements.get("#paused")!;
  expect(pause.focus).not.toHaveBeenCalled();
  fire(window, "keydown", { code: "Escape", repeat: true });
  expect(overlay.hidden).toBe(true);
  fire(pause, "click");
  expect(overlay.hidden).toBe(false);
  expect(resume.focus).toHaveBeenCalled();
  expect(elements.get(".arena")!.inert).toBe(true);
  fire(resume, "click");
  expect(pause.focus).toHaveBeenCalled();
  fire(document, "visibilitychange");
  expect(overlay.hidden).toBe(true);
  document.hidden = true;
  fire(document, "visibilitychange");
  fire(window, "keydown", { code: "Escape" });
  expect(overlay.hidden).toBe(false);
  document.hidden = false;
  fire(window, "keydown", { code: "Escape" });
  expect(overlay.hidden).toBe(true);
  fire(window, "keydown", { code: "KeyQ" });
  fire(window, "blur");
  expect(overlay.hidden).toBe(false);
  expect(elements.get(".game")!.dataset.position).toBe("center");
});

test("portrait holds the screen paused until the player resumes in landscape", async () => {
  const { elements, media, window } = await mount({
    portrait: true,
    canvas: false,
  });
  const rotate = elements.get("#rotate")!;
  const overlay = elements.get("#paused")!;
  const resume = elements.get("#resume")!;
  expect(rotate.hidden).toBe(false);
  fire(window, "keydown", { code: "Escape" });
  expect(overlay.hidden).toBe(true);
  media.matches = false;
  fire(media, "change");
  expect(rotate.hidden).toBe(true);
  expect(overlay.hidden).toBe(true);
  expect(elements.get(".game")!.dataset.state).toBe("playing");
  media.matches = true;
  fire(media, "change");
  media.matches = false;
  fire(media, "change");
  expect(overlay.hidden).toBe(false);
  expect(resume.focus).toHaveBeenCalledOnce();
  fire(resume, "click");
  expect(overlay.hidden).toBe(true);
  media.matches = true;
  fire(media, "change");
  expect(rotate.hidden).toBe(false);
});

test("the animation loop survives pause and restart with only one pending frame", async () => {
  const { el, advance, frames, drawing, document, media } = await mount({
    hidden: true,
  });
  const game = el(".game");
  expect(game.dataset.state).toBe("ready");
  document.hidden = true;
  expect(frames).toHaveLength(0);
  document.hidden = false;
  fire(document, "visibilitychange");
  fire(document, "visibilitychange");
  expect(frames).toHaveLength(1);
  advance(500);
  expect(drawing.fillText).toHaveBeenLastCalledWith("🍌", 172, 68);
  fire(el("#pause"), "click");
  fire(el("#resume"), "click");
  expect(frames).toHaveLength(1);
  fire(el("#pause"), "click");
  advance(30000);
  expect(frames).toHaveLength(0);
  expect(el("#misses").textContent).toBe("0 / 6");
  fire(el("#resume"), "click");
  advance(2270);
  const dropY = 160 + (506 - 160) * 0.5 ** 2;
  expect(drawing.fillText).toHaveBeenLastCalledWith("🍌", 420, dropY);
  expect(el("#misses").textContent).toBe("0 / 6");
  advance(170);
  expect(drawing.fillText).toHaveBeenLastCalledWith("🍌", 420, 506);
  expect(el("#misses").textContent).toBe("1 / 6");
  advance(15000);
  expect(game.dataset.state).toBe("lost");
  expect(el("#restart").focus).toHaveBeenCalled();
  expect(frames).toHaveLength(0);
  fire(media, "change");
  await vi.waitFor(() =>
    expect(el("#result-status").textContent).toBe("Результат сохранён"),
  );
  fire(el("#restart"), "click");
  expect(game.dataset.state).toBe("playing");
  expect(el("#misses").textContent).toBe("0 / 6");
  expect(el("#caught").textContent).toBe("0");
  expect(frames).toHaveLength(1);
});

test("holding a key, auto-repeat and duplicate keydown cannot catch a second banana", async () => {
  const { el, advance, window, lane } = await mount();
  fire(window, "keydown", { code: "KeyQ" });
  advance(500);
  expect(el("#caught").textContent).toBe("0");
  fire(window, "keyup", { code: "KeyQ" });

  for (let index = 0; index < 16; index++) {
    if (index > 0) advance(2800);
    if (index === 11) continue;
    fire(window, "keydown", { code: "KeyQ" });
    fire(window, "keyup", { code: "KeyQ" });
  }
  advance(4000);
  fire(window, "keydown", { code: "KeyQ" });
  expect(el("#caught").textContent).toBe("16");
  advance(100);
  fire(window, "keydown", { code: "KeyQ", repeat: true });
  expect(el("#caught").textContent).toBe("16");
  fire(window, "keydown", { code: "KeyQ", repeat: false });
  expect(el("#caught").textContent).toBe("16");
  fire(window, "keyup", { code: "KeyQ" });
  fire(lane, "pointerdown", { button: 0, pointerId: 8 });
  fire(lane, "pointerup", { button: 0, pointerId: 8 });
  expect(el("#caught").textContent).toBe("17");
});

test("a new round draws its first lane, even after a restart", async () => {
  let value = 0.99;
  const { el, advance, window } = await mount({ random: () => value });
  advance(500);
  fire(window, "keydown", { code: "KeyQ" });
  expect(el("#caught").textContent).toBe("0");
  fire(window, "keyup", { code: "KeyQ" });
  fire(window, "keydown", { code: "KeyL" });
  expect(el("#caught").textContent).toBe("1");
  advance(20_000);
  value = 0.3;
  await vi.waitFor(() =>
    expect(el("#result-status").textContent).toBe("Результат сохранён"),
  );
  fire(el("#restart"), "click");
  advance(500);
  fire(window, "keydown", { code: "KeyA" });
  expect(el("#caught").textContent).toBe("1");
});

test("loaded sprites render and the hero turns and leans toward the selected lane", async () => {
  const { drawing, el, window, advance } = await mount({ sprites: true });
  fire(el("#hero-sprite"), "load");
  fire(el("#banana-sprite"), "load");
  expect(drawing.drawImage).toHaveBeenCalledWith(
    el("#hero-sprite"),
    -97.5,
    -65,
    195,
    130,
  );
  advance(500);
  expect(drawing.drawImage).toHaveBeenCalledWith(
    el("#banana-sprite"),
    -34,
    expect.any(Number),
    68,
    expect.any(Number),
  );
  fire(window, "keydown", { code: "KeyA" });
  expect(drawing.scale).toHaveBeenCalledWith(-1, 1);
  expect(drawing.rotate).toHaveBeenCalledWith(0.22);
  fire(window, "keydown", { code: "KeyQ" });
  expect(el("#reaction").textContent).toBe("Отсосал");
  advance(751);
  expect(el("#reaction").textContent).toBe("");
});

test("compact landscape increases the banana and hero sizes immediately", async () => {
  const { drawing, el, landscape, advance } = await mount({
    sprites: true,
  });
  advance(500);
  landscape.matches = true;
  fire(landscape, "change");
  expect(drawing.drawImage).toHaveBeenCalledWith(
    el("#hero-sprite"),
    -146.25,
    -97.5,
    292.5,
    195,
  );
  expect(drawing.drawImage).toHaveBeenLastCalledWith(
    el("#banana-sprite"),
    -38,
    expect.any(Number),
    76,
    expect.any(Number),
  );
  landscape.matches = false;
  fire(landscape, "change");
  expect(drawing.drawImage).toHaveBeenCalledWith(
    el("#hero-sprite"),
    -97.5,
    -65,
    195,
    130,
  );
});

test("the same cannon sprite is mirrored and aimed from all four launch points", async () => {
  const { drawing, el } = await mount({ sprites: true });
  for (const mock of [
    drawing.drawImage,
    drawing.translate,
    drawing.rotate,
    drawing.scale,
  ]) {
    mock.mockClear();
  }
  fire(el("#cannon-sprite"), "load");
  const angle = Math.atan2(92, 248);
  expect(drawing.translate.mock.calls.slice(0, 4)).toEqual([
    [172, 68],
    [172, 472],
    [1028, 68],
    [1028, 472],
  ]);
  expect(drawing.rotate.mock.calls).toEqual([
    [angle],
    [-angle],
    [angle],
    [-angle],
  ]);
  expect(drawing.scale.mock.calls).toEqual([
    [1, 1],
    [1, 1],
    [-1, 1],
    [-1, 1],
  ]);
  expect(drawing.drawImage.mock.calls.slice(0, 4)).toEqual(
    Array.from({ length: 4 }, () => [
      el("#cannon-sprite"),
      -108 * 0.85,
      -36,
      108,
      72,
    ]),
  );
});

test.each([false, true])(
  "banana aims along each lane and falls upright (golden: %s)",
  async (golden) => {
    const { drawing, el } = await mount({ sprites: true });
    const ordinarySprite = el("#banana-sprite") as unknown as HTMLImageElement;
    const goldenSprite = el("#golden-sprite") as unknown as HTMLImageElement;
    const sprite = golden ? goldenSprite : ordinarySprite;
    const missing = { naturalWidth: 0 } as HTMLImageElement;
    drawing.rotate.mockClear();
    drawing.translate.mockClear();

    drawScene(
      drawing as unknown as CanvasRenderingContext2D,
      undefined,
      [
        ...lanes.map((lane) => ({
          lane,
          decoy: false,
          golden,
          progress: 0,
          fall: 0,
        })),
        {
          lane: "upper-left",
          decoy: false,
          golden,
          progress: 1,
          fall: 0.5,
        },
      ],
      missing,
      ordinarySprite,
      missing,
      goldenSprite,
      missing,
      undefined,
      false,
    );

    expect(drawing.translate.mock.calls).toEqual([
      [172, 68],
      [172, 472],
      [1028, 68],
      [1028, 472],
    ]);
    const directions = [
      [248, 92],
      [248, -92],
      [-248, 92],
      [-248, -92],
    ];
    expect(drawing.drawImage).toHaveBeenLastCalledWith(
      sprite,
      golden ? 369 : 386,
      expect.any(Number),
      expect.closeTo(golden ? 102 : 68),
      expect.any(Number),
    );
    expect(drawing.rotate.mock.calls).toHaveLength(4);
    drawing.rotate.mock.calls.forEach(([angle], index) => {
      const [dx, dy] = directions[index]!;
      expect(-Math.sin(angle)).toBeCloseTo(dx! / Math.hypot(dx!, dy!));
      expect(Math.cos(angle)).toBeCloseTo(dy! / Math.hypot(dx!, dy!));
    });
  },
);

test.each([
  [false, 195],
  [true, 292.5],
])(
  "the enlarged hero anchors its mouth on all four lanes (compact: %s)",
  async (compact, size) => {
    const { drawing, el } = await mount({ sprites: true });
    const hero = el("#hero-sprite") as unknown as HTMLImageElement;
    const banana = el("#banana-sprite") as unknown as HTMLImageElement;
    const missing = { naturalWidth: 0 } as HTMLImageElement;
    const catchPoints = [
      [420, 160],
      [420, 380],
      [780, 160],
      [780, 380],
    ];

    for (const [index, lane] of lanes.entries()) {
      drawing.translate.mockClear();
      drawing.drawImage.mockClear();
      drawScene(
        drawing as unknown as CanvasRenderingContext2D,
        lane,
        [],
        hero,
        banana,
        missing,
        missing,
        missing,
        undefined,
        compact,
        { from: 0.5, progress: 1, golden: false },
      );

      const [, x, y, width, height] = drawing.drawImage.mock.calls[0]!;
      expect(width).toBeCloseTo(size);
      expect(x + width * 0.72).toBeCloseTo(0);
      expect(y + height * 0.245).toBeCloseTo(0);
      expect(drawing.translate.mock.calls).toEqual([
        catchPoints[index],
        catchPoints[index],
      ]);
    }
  },
);

test("catch pulls the banana to the anchored mouth, even after key release", async () => {
  const { drawing, el, motion, advance, window } = await mount({
    sprites: true,
  });
  const draws = (selector: string) =>
    drawing.drawImage.mock.calls.filter(([sprite]) => sprite === el(selector));
  advance(500);
  fire(window, "keydown", { code: "KeyQ" });
  fire(window, "keyup", { code: "KeyQ" });
  fire(window, "keydown", { code: "KeyQ" });
  fire(window, "keyup", { code: "KeyQ" });
  expect(el("#caught").textContent).toBe("1");
  drawing.arc.mockClear();
  fire(window, "keydown", { code: "KeyQ" });
  expect(drawing.arc.mock.calls).toHaveLength(3);
  expect(
    drawing.arc.mock.calls.every(
      ([x, y, radius]) => radius === 11 && (x !== 420 || y !== 160),
    ),
  ).toBe(true);
  fire(window, "keyup", { code: "KeyQ" });
  const heroDraw = draws("#hero-sprite").at(-1)!;
  [-210 * 0.72, -140 * 0.245, 210, 140].forEach((value, index) => {
    expect(heroDraw[index + 1]).toBeCloseTo(value);
  });
  const flightAngle = Math.atan2(92, 248) - Math.PI / 2;
  expect(drawing.rotate).toHaveBeenLastCalledWith(flightAngle);
  expect(drawing.translate.mock.lastCall?.[0]).toBeCloseTo(172);
  advance(80);
  expect(drawing.rotate).toHaveBeenLastCalledWith(flightAngle);
  expect(drawing.translate.mock.lastCall?.[0]).toBeCloseTo(296);
  drawing.drawImage.mockClear();
  motion.matches = true;
  advance(30);
  expect(draws("#banana-sprite")).toHaveLength(0);
  motion.matches = false;
  advance(50);
  expect(draws("#banana-sprite")).toHaveLength(0);
});

test("a tall high-density viewport uses equal axis scaling and a sharper canvas", async () => {
  const { canvas, drawing, resize } = await mount();
  canvas.clientWidth = 1400;
  canvas.clientHeight = 1000;
  vi.stubGlobal("devicePixelRatio", 2);
  resize();
  expect([canvas.width, canvas.height]).toEqual([2800, 1260]);
  expect(drawing.setTransform).toHaveBeenLastCalledWith(
    140 / 60,
    0,
    0,
    140 / 60,
    0,
    0,
  );
});

test("the decoy draws its own sprite or cross and plays the miss reaction on capture", async () => {
  const { drawing, el, window, advance } = await mount({ sprites: true });
  const sequence = bananaSequence(() => 0);
  let elapsed = 0;
  for (const item of sequence) {
    advance(item.launch - elapsed);
    elapsed = item.launch;
    if (item.decoy) break;
    fire(window, "keydown", { code: "KeyQ" });
    fire(window, "keyup", { code: "KeyQ" });
  }
  expect(drawing.drawImage.mock.lastCall?.[0]).toBe(el("#decoy-sprite"));
  Object.assign(el("#decoy-sprite"), { naturalWidth: 0 });
  fire(el("#decoy-sprite"), "load");
  expect(drawing.fillText.mock.lastCall?.[0]).toBe("✖");
  fire(window, "keydown", { code: "KeyQ" });
  expect(el("#misses").textContent).toBe("1 / 6");
  expect(el("#reaction").dataset.reaction).toBe("miss");
});

test("golden banana has its own sprite, catch animation and bonus message", async () => {
  const { drawing, el, window, advance } = await mount({ sprites: true });
  let now = 0;
  for (const item of bananaSequence(() => 0)) {
    const time = item.deadline - 100;
    advance(time - now);
    now = time;
    if (item.golden) break;
    if (item.decoy) continue;
    fire(window, "keydown", { code: "KeyQ" });
    fire(window, "keyup", { code: "KeyQ" });
  }
  const flightAngle = Math.atan2(92, 248) - Math.PI / 2;
  expect(drawing.rotate).toHaveBeenLastCalledWith(flightAngle);
  const sprite = el("#golden-sprite");
  expect(drawing.drawImage.mock.calls.some(([image]) => image === sprite)).toBe(
    true,
  );
  const { naturalWidth } = sprite as unknown as HTMLImageElement;
  Object.assign(sprite, { naturalWidth: 0 });
  fire(sprite, "load");
  expect(drawing.fillText).toHaveBeenCalledWith(
    "⭐",
    expect.any(Number),
    expect.any(Number),
  );
  Object.assign(sprite, { naturalWidth });
  drawing.drawImage.mockClear();
  fire(window, "keydown", { code: "KeyQ" });
  expect(el("#reaction").textContent).toBe("Бонус +20");
  expect(drawing.rotate).toHaveBeenLastCalledWith(flightAngle);
  const caughtSprite = drawing.drawImage.mock.calls.find(
    ([image]) => image === sprite,
  );
  expect(caughtSprite?.[3]).toBeCloseTo(102);
});

test("a failed result can be retried using the same round key", async () => {
  const { el, advance, fetchRound } = await mount({ firstRequestFails: true });
  fetchRound
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockRejectedValueOnce(new Error("response lost"));
  advance(30000);
  fire(el("#restart"), "click");
  expect(el(".game").dataset.state).toBe("lost");
  await vi.waitFor(() => expect(el("#retry-result").hidden).toBe(false));
  expect(el("#result-status").textContent).toContain("не подтверждён");
  fire(el("#retry-result"), "click");
  await vi.waitFor(() => expect(fetchRound).toHaveBeenCalledTimes(4));
  await vi.waitFor(() => expect(el("#retry-result").hidden).toBe(false));
  fire(el("#retry-result"), "click");
  await vi.waitFor(() =>
    expect(el("#result-status").textContent).toBe("Результат сохранён"),
  );
  expect(el("#retry-result").hidden).toBe(true);
  expect(new Set(fetchRound.mock.calls.map(([url]) => url)).size).toBe(1);
  expect(fetchRound.mock.calls.map(([, options]) => options?.body)).toEqual([
    "{}",
    "{}",
    "{}",
    '{"score":0,"caught":0}',
    "{}",
    '{"score":0,"caught":0}',
  ]);
});

test.each([
  { userAgent: "Android", fullscreen: true, requested: true },
  { userAgent: "Android", fullscreen: true, fullscreenActive: true },
  { userAgent: "Android", fullscreen: true, portrait: true },
  { userAgent: "Desktop", fullscreen: true },
  { userAgent: "iPhone", hint: true },
  { userAgent: "iPhone", fullscreen: true, requested: true },
  { userAgent: "iPhone", installed: true },
  { userAgent: "iPhone", displayMode: true },
])("mobile fullscreen and installation hint: %j", async (options) => {
  const app = await mount(options);
  expect(app.el("#fullscreen-hint").hidden).toBe(!options.hint);
  expect(app.requestFullscreen).not.toHaveBeenCalled();
  fire(app.window, "click");
  expect(app.requestFullscreen).toHaveBeenCalledTimes(
    options.requested ? 1 : 0,
  );
  expect(app.el(".game").dataset.state).toBe(
    options.portrait ? "ready" : "playing",
  );
});

test("a declined fullscreen request still starts the round", async () => {
  const app = await mount({
    userAgent: "Android",
    fullscreen: true,
    requestFullscreen: () => Promise.reject(new Error("Fullscreen declined")),
  });
  fire(app.window, "click");
  await Promise.resolve();
  expect(app.requestFullscreen).toHaveBeenCalledOnce();
  expect(app.el(".game").dataset.state).toBe("playing");
});

test("automatic start registers only one round and preserves a later pause", async () => {
  const { el, fetchRound, window, document } = await mount();
  expect(el(".game").dataset.state).toBe("playing");
  fire(el("#restart"), "click");
  fire(window, "blur");
  fire(window, "click");
  fire(document, "visibilitychange");
  expect(el(".game").dataset.state).toBe("paused");
  expect(fetchRound).toHaveBeenCalledTimes(1);
});

test("ordinary catches can choose different reaction phrases", async () => {
  let phraseIndex = 0;
  const { el, window, advance } = await mount({
    phraseIndex: () => phraseIndex,
  });
  advance(500);
  fire(window, "keydown", { code: "KeyQ" });
  fire(window, "keyup", { code: "KeyQ" });
  expect(el("#reaction").textContent).toBe("Отсосал");
  advance(2800);
  phraseIndex = 10;
  fire(window, "keydown", { code: "KeyQ" });
  expect(el("#reaction").textContent).toBe("Вот это подача!");
  expect(el("#caught").textContent).toBe("2");
});
