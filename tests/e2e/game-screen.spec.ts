import { expect, test, type Page } from "@playwright/test";
import { bananaSequence } from "../../client/games/ilsur-lovit-chleny/sequence.js";

async function openGame(page: Page) {
  await page.addInitScript(() => {
    const getRandomValues = window.crypto.getRandomValues.bind(window.crypto);
    window.crypto.getRandomValues = (buffer) => {
      if (buffer instanceof Uint32Array) {
        buffer.fill(0);
        return buffer;
      }
      return getRandomValues(buffer);
    };
  });
  await page.route("**/api/games/*/rounds/*", (route) =>
    route.fulfill({ status: 204 }),
  );
  await page.request.post("/login", {
    form: { nickname: "Игрок теста", password: "browser-test-password" },
  });
  await page.goto("/ilsur-lovit-chleny/");
}

test("keyboard positions, holding, and pause in the production build", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 720 });
  await openGame(page);
  const game = page.getByRole("main");
  for (const [key, lane] of [
    ["q", "upper-left"],
    ["a", "lower-left"],
    ["o", "upper-right"],
    ["l", "lower-right"],
  ] as const) {
    await page.keyboard.down(key);
    await expect(game).toHaveAttribute("data-position", lane);
    await page.keyboard.up(key);
    await expect(game).toHaveAttribute("data-position", "center");
  }
  await page.keyboard.down("q");
  await page.keyboard.down("l");
  await page.keyboard.down("q");
  await expect(game).toHaveAttribute("data-position", "lower-right");
  await page.keyboard.up("l");
  await expect(game).toHaveAttribute("data-position", "upper-left");
  await page.keyboard.press("Escape");
  const resume = page.getByRole("button", { name: "Продолжить" });
  await expect(resume).toBeFocused();
  await expect(game).toHaveAttribute("data-position", "center");
  await page.keyboard.up("q");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Пауза" })).toBeFocused();
  const tab =
    process.platform === "darwin" && test.info().project.name === "webkit"
      ? "Alt+Tab"
      : "Tab";
  for (const name of ["Весь звук", "Музыка", "Слева сверху"]) {
    await page.keyboard.press(tab);
    await expect(page.getByRole("button", { name })).toBeFocused();
  }
  await page.keyboard.down("Space");
  await expect(game).toHaveAttribute("data-position", "upper-left");
  await page.keyboard.up("Space");
  expect(errors).toEqual([]);
});

test("touch release, multiple pointers and cancellation", async ({
  browser,
}) => {
  const page = await browser.newPage({
    hasTouch: true,
    viewport: { width: 844, height: 390 },
  });
  await openGame(page);
  const game = page.getByRole("main");
  const left = page.getByRole("button", { name: "Слева сверху" });
  const right = page.getByRole("button", { name: "Справа снизу" });
  await left.tap();
  await expect(game).toHaveAttribute("data-position", "center");
  // Synthetic pointers make simultaneous and cancelled touches reproducible in both engines.
  await page.evaluate(() => {
    HTMLButtonElement.prototype.setPointerCapture = () => {};
  });
  const pointer = (pointerId: number) => ({
    pointerId,
    pointerType: "touch",
    button: 0,
    bubbles: true,
  });
  await left.dispatchEvent("pointerdown", pointer(1));
  await expect(game).toHaveAttribute("data-position", "upper-left");
  await right.dispatchEvent("pointerdown", pointer(2));
  await expect(game).toHaveAttribute("data-position", "lower-right");
  await right.dispatchEvent("pointercancel", pointer(2));
  await expect(game).toHaveAttribute("data-position", "upper-left");
  await left.dispatchEvent("lostpointercapture", pointer(1));
  await expect(game).toHaveAttribute("data-position", "center");
  await page.close();
});

test("rotation and loss of focus pause and clear input", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openGame(page);
  await expect(
    page.getByRole("heading", { name: "Поверните телефон" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "Поверните телефон" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByRole("main")).toHaveAttribute("data-state", "playing");
  await page.keyboard.down("o");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.getByRole("button", { name: "Продолжить" })).toBeVisible();
  await expect(page.getByRole("main")).toHaveAttribute(
    "data-position",
    "center",
  );
  await page.keyboard.up("o");
});

test("production API health and deterministic clock and random values", async ({
  page,
  request,
}) => {
  expect(await (await request.get("/api/health")).json()).toEqual({
    status: "ok",
  });
  await page.clock.setFixedTime(new Date("2026-01-02T03:04:05.000Z"));
  await page.addInitScript(() => {
    const values = [0.25, 0.75];
    Math.random = () => values.shift() ?? 0.5;
  });
  await openGame(page);
  expect(
    await page.evaluate(() => [
      new Date().toISOString(),
      Math.random(),
      Math.random(),
      Math.random(),
    ]),
  ).toEqual(["2026-01-02T03:04:05.000Z", 0.75, 0.5, 0.5]);
});

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
  { width: 390, height: 844 },
]) {
  test(`layout ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openGame(page);
    const bounds = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.scrollHeight,
    ]);
    expect(bounds).toEqual([viewport.width, viewport.height]);
    if (viewport.width > viewport.height) {
      for (const button of await page.getByRole("button").all()) {
        const box = (await button.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      }
    }
  });
  test(`@visual game ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const background =
      viewport.width > viewport.height
        ? page.waitForResponse((response) =>
            /\/disco-floor-[\w-]+\.webp$/.test(
              new URL(response.url()).pathname,
            ),
          )
        : undefined;
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await openGame(page);
    if (background) {
      expect((await background).ok()).toBe(true);
      await expect(page.locator("#cannon-sprite")).not.toHaveJSProperty(
        "naturalWidth",
        0,
      );
      await expect(page.locator(".arena")).toHaveCSS(
        "background-size",
        "cover",
      );
      await expect(page.locator(".arena")).toHaveCSS(
        "background-position",
        "50% 0%",
      );
    }
    await expect(page.getByRole("main")).toHaveAttribute(
      "data-position",
      "center",
    );
    await expect(page).toHaveScreenshot(
      `game-${viewport.width}x${viewport.height}.png`,
    );
  });
}

test("disco layers share the arena crop and respect reduced motion", async ({
  page,
}) => {
  const loadedAssets = new Set<string>();
  page.on("response", (response) => {
    const asset = new URL(response.url()).pathname.match(
      /disco-(ball|crowd|floor-clean)-[\w-]+\.webp$/,
    );
    if (asset?.[1] && response.ok()) loadedAssets.add(asset[1]);
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openGame(page);

  const arena = page.locator(".arena");
  await expect
    .poll(() => [...loadedAssets].sort())
    .toEqual(["ball", "crowd", "floor-clean"]);
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 844, height: 390 },
    { width: 667, height: 375 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(arena).toBeInViewport();
    await expect(arena).toHaveCSS("background-size", "cover");
    await expect(arena).toHaveCSS("background-position", "50% 0%");
    await expect(arena).toHaveCSS(
      "background-image",
      viewport.width <= 900
        ? /disco-ball-mobile-.*disco-crowd-mobile-.*disco-floor-clean-mobile-/
        : /disco-ball-.*disco-crowd-.*disco-floor-clean-/,
    );
  }

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(arena).toHaveCSS(
    "background-image",
    /^url\("[^"]*\/disco-floor-mobile-[\w-]+\.webp"\)$/,
  );
});

test("low FPS, visibility pause, catching, defeat and restart", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
    let now = 0;
    let callbacks: FrameRequestCallback[] = [];
    let hidden = false;
    Object.defineProperty(document, "hidden", { get: () => hidden });
    document.addEventListener("test-visibility", () => {
      hidden = !hidden;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    performance.now = () => now;
    window.requestAnimationFrame = (callback) => callbacks.push(callback);
    window.addEventListener("test-frame", (event) => {
      now += (event as CustomEvent<number>).detail;
      const pending = callbacks;
      callbacks = [];
      for (const callback of pending) callback(now);
    });
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await openGame(page);
  const game = page.getByRole("main");
  const tick = (ms: number) =>
    page.evaluate(
      (detail) =>
        window.dispatchEvent(new CustomEvent("test-frame", { detail })),
      ms,
    );
  const toggleHidden = () =>
    page.evaluate(() => document.dispatchEvent(new Event("test-visibility")));
  await expect(game).toHaveAttribute("data-state", "playing");
  await tick(900);
  await page.keyboard.down("q");
  await page.keyboard.up("q");
  await expect(page.locator("#caught")).toHaveText("1");
  await expect(page.getByRole("status")).toHaveText("Отсосал");
  await expect(page.locator("#score")).toHaveText("10");
  await expect(page.locator("#streak")).toHaveText("1");
  await toggleHidden();
  await expect(game).toHaveAttribute("data-state", "paused");
  await tick(30000);
  await expect(page.locator("#misses")).toHaveText("0 / 6");
  await toggleHidden();
  await page.getByRole("button", { name: "Продолжить" }).click();
  await tick(20000);
  await expect(game).toHaveAttribute("data-state", "lost");
  await expect(
    page.getByRole("heading", { name: "Gay over", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#misses")).toHaveText("6 / 6");
  await expect(page.locator("#final-score")).toHaveText("10");
  await expect(page.locator("#final-caught")).toHaveText("1");
  await page.keyboard.press("q");
  await expect(page.locator("#final-score")).toHaveText("10");
  await expect(page.getByText("Результат сохранён")).toBeVisible();
  await page.getByRole("button", { name: "Играть снова" }).click();
  await expect(page.locator("#score")).toHaveText("0");
  await expect(page.locator("#streak")).toHaveText("0");
  await expect(page.locator("#multiplier")).toHaveText("×1");
  await expect(game).toHaveAttribute("data-state", "playing");
  await expect(page.locator("#misses")).toHaveText("0 / 6");
  await expect(page.locator("#caught")).toHaveText("0");
  await tick(2939);
  await expect(page.locator("#misses")).toHaveText("0 / 6");
  await tick(1);
  await expect(page.locator("#misses")).toHaveText("1 / 6");
  await expect(page.getByRole("status")).toHaveText("Лох! Пидр!");
});

test("@visual start, banana in flight and defeat", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await openGame(page);
  await expect(page.getByRole("button", { name: "Пауза" })).toBeVisible();
  await page.clock.fastForward(1469);
  await expect.soft(page).toHaveScreenshot("round-flight.png");
  await page.clock.fastForward(1301);
  await expect.soft(page).toHaveScreenshot("round-fall.png");
  await page.clock.fastForward(15000);
  await expect(
    page.getByRole("button", { name: "Играть снова" }),
  ).toBeFocused();
  await expect(page.getByText("Результат сохранён")).toBeVisible();
  await expect.soft(page).toHaveScreenshot("round-lost.png");
});

test("@visual draws overlapping flights and catches either lane independently", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let draw = 0;
    Math.random = () => (draw++ === 18 ? 0.99 : 0);
    const { clearRect, drawImage } = CanvasRenderingContext2D.prototype;
    CanvasRenderingContext2D.prototype.clearRect = function (
      x,
      y,
      width,
      height,
    ) {
      this.canvas.dataset.bananas = "0";
      this.canvas.dataset.bananaDirections = "";
      clearRect.call(this, x, y, width, height);
    };
    CanvasRenderingContext2D.prototype.drawImage = function (
      sprite: CanvasImageSource,
      ...coordinates: number[]
    ) {
      if (
        sprite instanceof HTMLImageElement &&
        sprite.id === "banana-sprite" &&
        Math.max(...coordinates.slice(-2)) >= 59.99
      ) {
        const { c, d } = this.getTransform();
        this.canvas.dataset.bananaDirections += `${Math.sign(c)},${Math.sign(d)};`;
        this.canvas.dataset.bananas = String(
          Number(this.canvas.dataset.bananas) + 1,
        );
      }
      Reflect.apply(drawImage, this, [sprite, ...coordinates]);
    };
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await openGame(page);
  const canvas = page.locator("canvas");
  for (let index = 0; index < 16; index++) {
    await page.clock.fastForward(index === 0 ? 600 : 2800);
    if (index === 11) continue;
    await expect(canvas).toHaveAttribute("data-bananas", "1");
    await page.keyboard.press("q");
  }
  await expect(page.locator("#caught")).toHaveText("15");
  await expect(page.locator("#score")).toHaveText("200");
  await expect(page.locator("#streak")).toHaveText("15");
  await expect(page.locator("#multiplier")).toHaveText("×2");
  await page.clock.fastForward(4000);
  await expect(canvas).toHaveAttribute("data-bananas", "2");
  await expect(canvas).toHaveAttribute(
    "data-banana-directions",
    /^(1,1;-1,-1;|-1,-1;1,1;)$/,
  );
  await expect.soft(page).toHaveScreenshot("round-overlapping-flights.png");
  await page.keyboard.press("l");
  await expect(canvas).toHaveAttribute("data-bananas", "1");
  await page.keyboard.press("q");
  await expect(canvas).toHaveAttribute("data-bananas", "0");
  await expect(page.locator("#caught")).toHaveText("17");
  await expect(page.locator("#misses")).toHaveText("0 / 6");
});

test("sound preference persists and reduced motion removes reaction animation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.clock.install();
  await openGame(page);
  const sound = page.getByRole("button", { name: "Весь звук" });
  await expect(sound).toHaveAttribute("aria-pressed", "true");
  await sound.click();
  await page.reload();
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  await page.clock.fastForward(1000);
  await page.keyboard.press("q");
  const reaction = page.getByRole("status");
  await expect(reaction).toHaveText("Отсосал");
  await expect(reaction).toHaveCSS("animation-name", "none");
  await sound.click();
  await page.reload();
  await expect(sound).toHaveAttribute("aria-pressed", "true");
});

test("missing sprites fall back to readable symbols and the game remains playable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.addInitScript(() => {
    Math.random = () => 0;
    const { fillText } = CanvasRenderingContext2D.prototype;
    CanvasRenderingContext2D.prototype.fillText = function (
      text,
      x,
      y,
      maxWidth,
    ) {
      this.canvas.dataset.fallback = text;
      fillText.call(this, text, x, y, maxWidth);
    };
  });
  await page.route(
    /\/(?:banana-[\w-]+\.png|login-character(?:-mobile)?\.webp|disco-cannon-[\w-]+\.webp)$/,
    (route) => route.abort(),
  );
  await page.clock.install();
  await openGame(page);
  await expect(page.locator("canvas")).toHaveAttribute("data-fallback", "🐓");
  await page.clock.fastForward(1000);
  await expect(page.locator("canvas")).toHaveAttribute("data-fallback", "🍌");
  await page.keyboard.press("q");
  await expect(page.locator("#caught")).toHaveText("1");
});

test("@visual catch and miss on a landscape phone", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await openGame(page);
  await page.clock.fastForward(800);
  await page.keyboard.down("q");
  await expect(page.getByRole("status")).toHaveText("Отсосал");
  await expect.soft(page).toHaveScreenshot("round-catch-landscape.png");
  await page.keyboard.up("q");
  await page.clock.fastForward(5100);
  await expect(page.getByRole("status")).toHaveText("Лох! Пидр!");
  await expect(page).toHaveScreenshot("round-miss-landscape.png");
});

test("a large Retina desktop keeps a wide arena and a high-resolution canvas", async ({
  browser,
}) => {
  const page = await browser.newPage({
    viewport: { width: 2048, height: 1280 },
    deviceScaleFactor: 2,
  });
  try {
    await openGame(page);
    const canvas = page.locator("canvas");
    await expect(canvas).toHaveCSS("object-fit", "contain");
    const dimensions = await canvas.evaluate((element: HTMLCanvasElement) => ({
      cssRatio: element.clientWidth / element.clientHeight,
      pixelRatio: element.width / element.height,
      density: element.width / element.clientWidth,
    }));
    expect(dimensions.cssRatio).toBeCloseTo(20 / 9, 1);
    expect(dimensions.pixelRatio).toBeCloseTo(20 / 9);
    expect(dimensions.density).toBeCloseTo(2, 1);
  } finally {
    await page.close();
  }
});

for (const capture of [false, true]) {
  test(`@decoy ${capture ? "catching costs a miss" : "skipping is safe"}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: capture ? 1280 : 844,
      height: capture ? 720 : 390,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => {
      Math.random = () => 0.125;
    });
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await openGame(page);
    await expect(page.locator("#decoy-sprite")).not.toHaveJSProperty(
      "naturalWidth",
      0,
    );

    let elapsed = 0;
    const sequence = bananaSequence(() => 0.125);
    for (const item of sequence) {
      const time = item.launch + 500;
      await page.clock.fastForward(time - elapsed);
      elapsed = time;
      if (!item.decoy) {
        await page.keyboard.press("q");
        continue;
      }
      await expect(page.locator("#misses")).toHaveText("0 / 6");
      const score = await page.locator("#score").textContent();
      if (capture) {
        await page.keyboard.press("q");
        await expect(page.locator("#misses")).toHaveText("1 / 6");
        await expect(page.locator("#streak")).toHaveText("0");
        await expect(page.getByRole("status")).toHaveAttribute(
          "data-reaction",
          "miss",
        );
      } else {
        await expect.soft(page).toHaveScreenshot("round-decoy-landscape.png");
        await page.clock.fastForward(item.flight);
        await expect(page.locator("#misses")).toHaveText("0 / 6");
      }
      await expect(page.locator("#score")).toHaveText(score!);
      break;
    }
  });
}

for (const capture of [false, true]) {
  test(`@golden ${capture ? "catch awards bonus points" : "skipping is safe"}`, async ({
    page,
  }) => {
    await page.setViewportSize(
      capture ? { width: 1280, height: 720 } : { width: 844, height: 390 },
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => {
      Math.random = () => 0;
      window.Audio = class extends Audio {
        override get readyState() {
          return 4;
        }

        override async play() {
          if (/\/rooster_crowing-[^/]+\.mp3$/.test(this.src))
            document.documentElement.dataset.goldenSound = "played";
        }
      };
    });
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await openGame(page);
    await expect(page.locator("#golden-sprite")).not.toHaveJSProperty(
      "naturalWidth",
      0,
    );
    let elapsed = 0;
    for (const item of bananaSequence(() => 0)) {
      const time = item.deadline - 100;
      await page.clock.fastForward(time - elapsed);
      elapsed = time;
      if (!item.golden) {
        if (!item.decoy) await page.keyboard.press("q");
        continue;
      }
      const score = Number(await page.locator("#score").textContent());
      const streak = Number(await page.locator("#streak").textContent());
      if (capture) {
        await page.keyboard.press("q");
        await expect(page.getByRole("status")).toHaveText("Бонус +20");
      } else {
        await expect.soft(page).toHaveScreenshot("round-golden-landscape.png");
        await page.clock.fastForward(600);
      }
      await expect(page.locator("#misses")).toHaveText("0 / 6");
      await expect(page.locator("#score")).toHaveText(
        String(score + (capture ? 50 : 0)),
      );
      await expect(page.locator("#streak")).toHaveText(
        String(streak + Number(capture)),
      );
      const root = page.locator("html");
      if (capture) {
        await expect(root).toHaveAttribute("data-golden-sound", "played");
      } else {
        await expect(root).not.toHaveAttribute("data-golden-sound", "played");
      }
      break;
    }
  });
}

for (const mode of ["allowed", "declined", "iphone", "installed"] as const) {
  test(`mobile fullscreen at round start: ${mode}`, async ({ browser }) => {
    const iphone = mode === "iphone" || mode === "installed";
    const page = await browser.newPage({
      hasTouch: true,
      viewport: { width: 844, height: 390 },
      userAgent: iphone ? "iPhone" : "Android",
    });
    await page.addInitScript((mode) => {
      Object.defineProperty(navigator, "standalone", {
        value: mode === "installed",
      });
      Object.defineProperty(document, "fullscreenEnabled", {
        value: mode === "allowed" || mode === "declined",
      });
      Element.prototype.requestFullscreen = function (this: HTMLElement) {
        this.dataset.fullscreenRequested = "true";
        return mode === "declined"
          ? Promise.reject(new Error("Fullscreen declined"))
          : Promise.resolve();
      };
    }, mode);
    await openGame(page);
    const hint = page.locator("#fullscreen-hint");
    const root = page.locator("html");
    await expect(root).not.toHaveAttribute("data-fullscreen-requested");
    await expect(page.getByRole("main")).toHaveAttribute(
      "data-state",
      "playing",
    );
    await page.getByRole("button", { name: "Пауза" }).click();
    if (mode === "iphone") await expect(hint).toBeVisible();
    else await expect(hint).toBeHidden();
    if (iphone)
      await expect(root).not.toHaveAttribute("data-fullscreen-requested");
    else
      await expect(root).toHaveAttribute("data-fullscreen-requested", "true");
    await page.close();
  });
}

test("mobile cold start responds while artwork loads and reports frame intervals", async ({
  page,
  browserName,
}, testInfo) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.request.post("/login", {
    form: { nickname: "Проверка загрузки", password: "browser-test-password" },
  });

  if (browserName === "chromium") {
    const session = await page.context().newCDPSession(page);
    await session.send("Network.enable");
    await session.send("Network.setCacheDisabled", { cacheDisabled: true });
    await session.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: 125_000,
      uploadThroughput: 62_500,
    });
  }

  await page.goto("/ilsur-lovit-chleny/", { waitUntil: "domcontentloaded" });
  const game = page.getByRole("main");
  await expect(game).toHaveAttribute("data-state", "playing");
  await page.keyboard.down("q");
  await expect(game).toHaveAttribute("data-position", "upper-left");
  const firstInputMs = await page.evaluate(() => performance.now());
  await page.keyboard.up("q");
  const frames = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        let previous = 0;
        const intervals: number[] = [];
        function record(time: number) {
          if (previous) intervals.push(time - previous);
          previous = time;
          if (intervals.length === 60) resolve(intervals);
          else requestAnimationFrame(record);
        }
        requestAnimationFrame(record);
      }),
  );
  frames.sort((left, right) => left - right);
  await expect(page.locator("#hero-sprite")).toHaveJSProperty(
    "naturalWidth",
    640,
  );
  await testInfo.attach("mobile-performance", {
    contentType: "application/json",
    body: JSON.stringify({
      network:
        browserName === "chromium" ? "1 Mbps, 150 ms latency" : "unthrottled",
      firstInputMs,
      frameIntervalP95Ms: frames[56],
      longestFrameIntervalMs: frames[59],
    }),
  });
});
