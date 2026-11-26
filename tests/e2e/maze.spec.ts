import { expect, test, type Page } from "@playwright/test";
import { index, levelInfo } from "../../client/games/packman/maze.js";

async function openMaze(page: Page) {
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.request.post("/login", {
    form: { nickname: "Игрок лабиринта", password: "browser-test-password" },
  });
  await page.goto("/packman/");
}

test("protects the prototype with the shared login", async ({ page }) => {
  await page.goto("/packman/");
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fpackman%2F$/);
  await openMaze(page);
  await expect(
    page.getByRole("heading", { name: "Ильсур-Пакман-Членоед" }),
  ).toBeVisible();
  await expect(page.locator("#level")).toHaveText("1");
  await expect(page.locator("#circle")).toHaveText("1");
  await expect(page.locator(".stats")).not.toContainText(/Погоня|Передышка/);
  await expect(page.locator("#field [data-tile^='enemy-']")).toHaveCount(1);
  await expect(
    page.locator("#field .tile").nth(index(levelInfo(1)!.golden)),
  ).toHaveAttribute("data-tile", "golden");
});

test("starts the game when crypto.randomUUID is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(Crypto.prototype, "randomUUID", {
      configurable: true,
      value: undefined,
    });
  });
  await openMaze(page);
  await expect(
    page.getByRole("heading", { name: "Ильсур-Пакман-Членоед" }),
  ).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await page.clock.runFor(280);
  await expect(page.locator("#caught")).toHaveText("1");
});

test("preloads the next Packman music track before the current one ends", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.Audio = class extends Audio {
      constructor(src?: string) {
        super(src);
        const effect = src?.match(/\/(miss|rooster_crowing)-[^/]+\.mp3$/)?.[1];
        this.dataset.kind = effect ? "effect" : "music";
        if (!effect) {
          this.id = "packman-music";
          document.body.append(this);
        }
      }

      override load() {
        if (this.dataset.kind === "music") {
          this.id = "packman-preload";
          this.dataset.packmanPreload = "true";
        }
      }

      override async play() {
        this.dataset.playing = "true";
      }

      override pause() {
        this.dataset.playing = "false";
      }
    };
  });
  await openMaze(page);
  await page.keyboard.press("ArrowRight");

  const music = page.locator("#packman-music");
  const preload = page.locator('audio[data-packman-preload="true"]');
  await expect(music).toHaveAttribute("data-playing", "true");
  await expect(preload).toHaveCount(1);
  await expect(preload).toHaveJSProperty("preload", "auto");
  const nextTrack = await preload.getAttribute("src");

  await music.dispatchEvent("ended");
  await expect(music).toHaveAttribute("src", nextTrack!);
  await expect(music).toHaveAttribute("data-playing", "true");
  await expect(preload).toHaveCount(2);
});

test("plays the golden catch sound when the golden item is collected", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const played: string[] = [];
    Object.defineProperty(window, "__playedAudio", { value: played });
    HTMLMediaElement.prototype.play = function () {
      played.push(this.src);
      return Promise.resolve();
    };
  });
  await openMaze(page);
  await page.keyboard.press("ArrowDown");
  await page.clock.runFor(560);
  await page.keyboard.press("ArrowRight");
  await page.clock.runFor(1680);
  await page.keyboard.press("ArrowDown");
  await page.clock.runFor(1680);
  await expect(
    page.locator("#field .tile").nth(index(levelInfo(1)!.golden)),
  ).toHaveAttribute("data-tile", "player");
  await expect(page.locator("#lives")).toHaveText("6");
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as Window & { __playedAudio: string[] }
        ).__playedAudio.some((src) => src.includes("rooster_crowing")),
      ),
    )
    .toBe(true);
});

test("keeps the compact sound toggle muted across restarts and page reloads @visual", async ({
  page,
}) => {
  await openMaze(page);
  const sound = page.getByRole("button", { name: "Выключить звук" });
  const restart = page.getByRole("button", { name: "Начать заново" });
  await expect(sound).toHaveAttribute("aria-pressed", "true");
  const initialLayout = await page.evaluate(() => {
    const actions = document
      .querySelector(".header-actions")!
      .getBoundingClientRect();
    const restartButton = document
      .querySelector("#restart")!
      .getBoundingClientRect();
    const soundButton = document
      .querySelector("#sound")!
      .getBoundingClientRect();
    return {
      rowHeight: actions.height,
      restartHeight: restartButton.height,
      soundHeight: soundButton.height,
      soundWidth: soundButton.width,
    };
  });
  expect(initialLayout.rowHeight).toBe(initialLayout.restartHeight);
  expect(initialLayout.soundHeight).toBeLessThanOrEqual(
    initialLayout.restartHeight,
  );
  expect(initialLayout.soundWidth).toBe(24);
  await expect(page.locator("header .header-actions")).toHaveScreenshot(
    "packman-header-actions.png",
  );
  await sound.click();
  const muted = page.getByRole("button", { name: "Включить звук" });
  await expect(muted).toHaveAttribute("aria-pressed", "false");
  await expect(muted).toHaveAttribute("data-muted", "true");
  await restart.click();
  await expect(muted).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Включить звук" }),
  ).toHaveAttribute("aria-pressed", "false");
  expect(
    await page.evaluate(() => sessionStorage.getItem("packman-sound")),
  ).toBe("off");
});

test("supports keyboard play, buffered turn, focus and restart", async ({
  page,
}) => {
  await openMaze(page);
  const field = page.locator("#field");
  await page.getByRole("button", { name: "Начать заново" }).click();
  await expect(field).toBeFocused();
  const firstEnemyStart = await field
    .locator("[data-tile^='enemy-']")
    .evaluate((enemy) =>
      Array.from(enemy.parentElement!.children).indexOf(enemy),
    );
  await page.clock.runFor(1200);
  await expect(field.locator(".tile").nth(12)).toHaveAttribute(
    "data-tile",
    "player",
  );
  await expect(page.locator("#caught")).toHaveText("0");
  await expect(field.locator(".tile").nth(firstEnemyStart)).not.toHaveAttribute(
    "data-tile",
    /^enemy-/,
  );
  await page.keyboard.press("ArrowRight");
  await page.clock.runFor(280);
  await expect(page.locator("#caught")).toHaveText("1");
  await page.keyboard.press("s");
  await page.clock.runFor(840);
  await expect(field.locator(".tile").nth(26)).toHaveAttribute(
    "data-tile",
    "player",
  );
  await expect(field.locator("[data-tile='player']")).toHaveAttribute(
    "data-direction",
    "down",
  );
  await page.keyboard.press("a");
  await page.clock.runFor(560);
  await expect(field.locator("[data-tile='player']")).toHaveAttribute(
    "data-direction",
    "left",
  );
  const leftFacingPlayer = await field
    .locator("[data-tile='player']")
    .evaluate((tile) => {
      const matrix = new DOMMatrixReadOnly(
        getComputedStyle(tile, "::after").transform,
      );
      return [matrix.a, matrix.b, matrix.c, matrix.d];
    });
  expect(leftFacingPlayer[0]).toBe(-1);
  expect(leftFacingPlayer[1]).toBe(0);
  expect(leftFacingPlayer[2]).toBe(0);
  expect(leftFacingPlayer[3]).toBe(1);
  await page.keyboard.press("w");
  await page.clock.runFor(840);
  await expect(field.locator("[data-tile='player']")).toHaveAttribute(
    "data-direction",
    "up",
  );
  await page.getByRole("button", { name: "Начать заново" }).click();
  await expect(page.locator("#caught")).toHaveText("0");
  await expect(page.locator("#lives")).toHaveText("5");
});

test("shows the Gay over summary and saves progress after the last life", async ({
  page,
}) => {
  await openMaze(page);
  await page.keyboard.press("ArrowRight");
  await page.clock.runFor(280);
  await expect(page.locator("#caught")).toHaveText("1");
  await page.evaluate(() => {
    window.setInterval(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { code: "ArrowRight", bubbles: true }),
      );
    }, 280);
  });
  for (let elapsed = 0; elapsed < 120_000; elapsed += 1_000)
    await page.clock.runFor(1_000);
  await expect(page.getByRole("heading", { name: "Gay over" })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator("#final-caught")).toHaveText(/\d+/);
  await expect(page.locator("#final-circle")).toHaveText(/\d+/);
  await expect(page.locator("#final-round")).toHaveText(/\d+/);
  await expect(page.locator("#result-status")).toHaveText("Результат сохранён");
  await expect(page.locator("#retry-result")).toBeHidden();
  await expect(page.locator("#lost")).toHaveScreenshot(
    "packman-gameover-desktop.png",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#lost")).toHaveScreenshot(
    "packman-gameover-mobile.png",
  );
  await page.getByRole("button", { name: "Сыграть ещё" }).click();
  await expect(page.locator("#lost")).toBeHidden();
  await expect(page.locator("#caught")).toHaveText("0");
  await expect(page.locator("#lives")).toHaveText("5");
  await expect(page.locator("#level")).toHaveText("1");
  await expect(page.locator("#circle")).toHaveText("1");
});

test("only shows a prominent result retry after saving fails @visual", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/api/games/ilsur-pacman/rounds/*", async (route) => {
    requests += 1;
    await route.fulfill({ status: requests <= 2 ? 503 : 204 });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await openMaze(page);
  const retry = page.getByRole("button", {
    name: "Повторить сохранение результата",
  });
  await expect(retry).toBeHidden();

  await page.keyboard.press("ArrowRight");
  await page.clock.runFor(280);
  await page.evaluate(() => {
    window.setInterval(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { code: "ArrowRight", bubbles: true }),
      );
    }, 280);
  });
  for (let elapsed = 0; elapsed < 120_000; elapsed += 1_000)
    await page.clock.runFor(1_000);

  await expect(page.locator("#result-status")).toHaveText(
    "Результат не подтверждён. Повтори сохранение.",
  );
  await expect(retry).toBeVisible();
  await expect(retry).toHaveCSS("min-height", "52px");
  await expect(retry).toHaveCSS("background-color", "rgb(255, 228, 123)");
  await expect(page.locator("#lost")).toHaveScreenshot(
    "packman-save-retry-mobile.png",
  );

  await retry.click();
  await expect(page.locator("#result-status")).toHaveText("Результат сохранён");
  await expect(retry).toBeHidden();
  expect(requests).toBe(4);
});

test("renders a readable desktop map @visual", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openMaze(page);
  const field = page.locator("#field");
  await expect(field).toBeInViewport({ ratio: 1 });
  await expect(field.locator(".tile")).toHaveCount(165);
  const headerRows = page.locator("header > *");
  await expect(headerRows).toHaveCount(3);
  const headerRowTops = await headerRows.evaluateAll((rows) =>
    rows.map((row) => row.getBoundingClientRect().top),
  );
  expect(headerRowTops[1]).toBeGreaterThan(headerRowTops[0]!);
  expect(headerRowTops[2]).toBeGreaterThan(headerRowTops[1]!);
  const fieldBox = (await field.boundingBox())!;
  expect(fieldBox.width / fieldBox.height).toBeCloseTo(11 / 15);
  await expect(page.locator(".controls")).toBeHidden();
  const player = field.locator("[data-tile='player']");
  await expect(player).toHaveAttribute("data-direction", "right");
  const playerSprite = await player.evaluate(
    (tile) => getComputedStyle(tile, "::after").backgroundImage,
  );
  expect(playerSprite).toContain("data:image/webp;base64,");
  const enemy = field.locator("[data-tile^='enemy-']");
  await expect(enemy).toHaveAttribute("data-direction", "left");
  const enemySprite = await enemy.evaluate(
    (tile) => getComputedStyle(tile, "::after").backgroundImage,
  );
  expect(enemySprite).toContain("enemy-rooster-red-");
  expect(enemySprite).toContain(".webp");
  const leftFacingEnemy = await enemy.evaluate((tile) => {
    const matrix = new DOMMatrixReadOnly(
      getComputedStyle(tile, "::after").transform,
    );
    return [matrix.a, matrix.b, matrix.c, matrix.d];
  });
  expect(leftFacingEnemy).toEqual([-1, 0, 0, 1]);
  await expect(page).toHaveScreenshot("prototype-desktop.png", {
    animations: "disabled",
  });
});

test.describe("touch layout", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test("moves on a touch direction tap", async ({ page }) => {
    await openMaze(page);
    await page.getByRole("button", { name: "Вниз" }).tap();
    await page.clock.runFor(280);
    await expect(page.locator("#field [data-tile='player']")).toHaveAttribute(
      "data-direction",
      "down",
    );
    await expect(page.locator("#field .tile").nth(23)).toHaveAttribute(
      "data-tile",
      "player",
    );
  });

  test("fits a portrait phone with touch controls below the board @visual", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await openMaze(page);
    const field = page.locator("#field");
    await expect(field).toBeInViewport({ ratio: 1 });
    const fieldBox = (await field.boundingBox())!;
    expect(fieldBox.width / fieldBox.height).toBeCloseTo(11 / 15);
    const controlsBox = (await page.locator(".controls").boundingBox())!;
    expect(
      Math.abs(
        controlsBox.x +
          controlsBox.width / 2 -
          (fieldBox.x + fieldBox.width / 2),
      ),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(fieldBox.x + fieldBox.width / 2 - 375 / 2),
    ).toBeLessThanOrEqual(1);
    const [boardRow, controlsRow] = await page
      .locator(".play")
      .evaluate((play) =>
        getComputedStyle(play).gridTemplateRows.split(" ").map(parseFloat),
      );
    expect(boardRow! / (boardRow! + controlsRow!)).toBeCloseTo(0.7);
    expect(fieldBox.height).toBeLessThanOrEqual(boardRow! + 1);
    const buttons = Object.fromEntries(
      await Promise.all(
        ["Вверх", "Влево", "Вниз", "Вправо"].map(async (name) => {
          const button = page.getByRole("button", { name });
          await expect(button).toBeInViewport({ ratio: 1 });
          const box = (await button.boundingBox())!;
          expect(box.y).toBeGreaterThanOrEqual(fieldBox.y + fieldBox.height);
          expect(box.width).toBe(72);
          expect(box.height).toBe(72);
          return [name, box] as const;
        }),
      ),
    );
    expect(buttons["Вверх"]!.x - buttons["Влево"]!.x - 72).toBe(16);
    expect(buttons["Вправо"]!.x - buttons["Вверх"]!.x - 72).toBe(16);
    expect(buttons["Вниз"]!.y - buttons["Вверх"]!.y - 72).toBe(8);
    const rotatedBanana = async (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((tile) => {
          const matrix = new DOMMatrixReadOnly(
            getComputedStyle(tile, "::after").transform,
          );
          return [matrix.a, matrix.b, matrix.c, matrix.d];
        });
    const regularRotation = await rotatedBanana("#field [data-tile='item']");
    const regularBoxSize = await page
      .locator("#field [data-tile='item']")
      .first()
      .evaluate((tile) => {
        const style = getComputedStyle(tile, "::after");
        const box = tile.getBoundingClientRect();
        return [
          parseFloat(style.width) / box.width,
          parseFloat(style.height) / box.height,
        ];
      });
    expect(regularBoxSize[0]).toBeCloseTo(1);
    expect(regularBoxSize[1]).toBeCloseTo(1);
    expect(Math.hypot(regularRotation[0]!, regularRotation[1]!)).toBeCloseTo(
      0.5,
    );
    const regularSprite = await page
      .locator("#field [data-tile='item']")
      .first()
      .evaluate((tile) => getComputedStyle(tile, "::after").backgroundImage);
    expect(regularSprite).toContain("data:image/webp;base64,");
    expect(regularRotation[0]).toBeCloseTo(-Math.SQRT1_2 * 0.5);
    expect(regularRotation[1]).toBeCloseTo(-Math.SQRT1_2 * 0.5);
    expect(regularRotation[2]).toBeCloseTo(Math.SQRT1_2 * 0.5);
    expect(regularRotation[3]).toBeCloseTo(-Math.SQRT1_2 * 0.5);
    const goldenRotation = await rotatedBanana("#field [data-tile='golden']");
    const goldenSprite = await page
      .locator("#field [data-tile='golden']")
      .evaluate((tile) => getComputedStyle(tile, "::after").backgroundImage);
    const goldenSize = await page
      .locator("#field [data-tile='golden']")
      .evaluate((tile) => {
        const style = getComputedStyle(tile, "::after");
        const box = tile.getBoundingClientRect();
        return [
          parseFloat(style.width) / box.width,
          parseFloat(style.height) / box.height,
        ];
      });
    expect(goldenSize[0]).toBeCloseTo(0.94);
    expect(goldenSize[1]).toBeCloseTo(0.94);
    expect(goldenSprite).toContain("data:image/webp;base64,");
    expect(goldenRotation[0]).toBeCloseTo(-1);
    expect(goldenRotation[1]).toBeCloseTo(0);
    expect(goldenRotation[2]).toBeCloseTo(0);
    expect(goldenRotation[3]).toBeCloseTo(-1);
    const fourthEnemyArt = await field.evaluate((board) => {
      const tile = document.createElement("span");
      tile.className = "tile";
      tile.dataset.tile = "enemy-ambusher";
      tile.dataset.enemyKind = "ambusher";
      board.append(tile);
      const background = getComputedStyle(tile, "::after").backgroundImage;
      tile.remove();
      return background;
    });
    expect(fourthEnemyArt).toContain("enemy-rooster-blue-");
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBe(667);
    expect(
      await field
        .locator(".tile[data-tile='wall']")
        .first()
        .evaluate((tile) => getComputedStyle(tile).backgroundColor),
    ).toBe("rgb(69, 100, 137)");
    expect(
      await field.evaluate((element) => getComputedStyle(element).borderWidth),
    ).toBe("2px");
    await expect(page).toHaveScreenshot("prototype-portrait.png", {
      animations: "disabled",
    });

    await page.getByRole("button", { name: "Вправо" }).tap();
    await page.clock.runFor(280);
    await expect(page.locator("#caught")).toHaveText("1");
    await expect(page.locator("[data-tile='player']")).toHaveAttribute(
      "data-direction",
      "right",
    );
    await page.setViewportSize({ width: 844, height: 285 });
    await expect(page.locator(".rotate-notice")).toHaveText(
      "Поверните телефон вертикально, чтобы играть",
    );
    await expect(page.locator(".rotate-notice")).toBeVisible();
    await expect(field).toBeHidden();
    await page.clock.runFor(1000);
    await expect(page.locator("#caught")).toHaveText("1");
    await expect(page.locator("#lives")).toHaveText("5");
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(field).toBeVisible();
    await page.getByRole("button", { name: "Начать заново" }).click();
    await page.getByRole("button", { name: "Вправо" }).tap();
    await page.clock.runFor(280);
    await expect(page.locator("#caught")).toHaveText("1");
  });

  test("keeps the score on one line and leaves tunnel cells empty", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await openMaze(page);
    const stats = page.locator(".stats");
    await expect(
      page.locator("#field .tile").nth(index(levelInfo(1)!.golden)),
    ).toHaveAttribute("data-tile", "golden");
    await expect(stats).toHaveCSS("white-space", "nowrap");
    const initialHeight = (await stats.boundingBox())!.height;
    const portal = page.locator("#field [data-tile='portal']").first();
    await expect(page.locator("#field [data-tile='portal']")).toHaveCount(2);
    expect(
      await portal.evaluate(
        (tile) => getComputedStyle(tile, "::after").borderTopWidth,
      ),
    ).toBe("0px");
    for (const offset of [77, 87, 5, 159])
      await expect(
        page.locator("#field .tile").nth(offset),
      ).not.toHaveAttribute("data-tile", "item");
    await page.getByRole("button", { name: "Вправо" }).tap();
    await page.clock.runFor(280);
    await expect(page.locator("#caught")).toHaveText("1");
    expect((await stats.boundingBox())!.height).toBe(initialHeight);
  });

  test("handles simultaneous touch input and cancellation by pointer id", async ({
    page,
  }) => {
    await openMaze(page);
    const field = page.locator("#field");
    await page.evaluate(() => {
      const controls =
        document.querySelectorAll<HTMLButtonElement>("[data-direction]");
      // Synthetic pointers have no platform capture. A real tap is exercised separately.
      controls.forEach((button) => {
        button.setPointerCapture = () => {};
      });
      const right = document.querySelector('[data-direction="right"]')!;
      const down = document.querySelector('[data-direction="down"]')!;
      right.dispatchEvent(
        new PointerEvent("pointerdown", { pointerId: 1, pointerType: "touch" }),
      );
      down.dispatchEvent(
        new PointerEvent("pointerdown", { pointerId: 2, pointerType: "touch" }),
      );
      right.dispatchEvent(
        new PointerEvent("pointercancel", {
          pointerId: 1,
          pointerType: "touch",
        }),
      );
    });
    await page.clock.runFor(280);
    await expect(field.locator(".tile").nth(23)).toHaveAttribute(
      "data-tile",
      "player",
    );
    await page.getByRole("button", { name: "Начать заново" }).tap();
    await page.locator('button[data-direction="right"]').evaluate((button) => {
      for (const type of ["pointerdown", "pointercancel"]) {
        button.dispatchEvent(
          new PointerEvent(type, { pointerId: 3, pointerType: "touch" }),
        );
      }
    });
    await page.clock.runFor(280);
    await expect(field.locator(".tile").nth(12)).toHaveAttribute(
      "data-tile",
      "player",
    );
  });
});
