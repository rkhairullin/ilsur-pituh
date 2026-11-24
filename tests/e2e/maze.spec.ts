import { expect, test, type Page } from "@playwright/test";
import { index, levelInfo } from "../../client/games/maze/maze.js";

async function openMaze(page: Page) {
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.request.post("/login", {
    form: { nickname: "Игрок лабиринта", password: "browser-test-password" },
  });
  await page.goto("/maze/");
}

test("protects the prototype with the shared login", async ({ page }) => {
  await page.goto("/maze/");
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fmaze%2F$/);
  await openMaze(page);
  await expect(page.getByRole("heading", { name: "Лабиринт" })).toBeVisible();
  await expect(page.locator("#level")).toHaveText("1");
  await expect(page.locator("#circle")).toHaveText("1");
  await expect(page.locator("#phase")).toHaveText("Погоня");
  await expect(page.locator("#field [data-tile^='enemy-']")).toHaveCount(1);
  await expect(
    page.locator("#field .tile").nth(index(levelInfo(1)!.golden)),
  ).toHaveAttribute("data-tile", "golden");
});

test("supports keyboard play, buffered turn, focus and restart", async ({
  page,
}) => {
  await openMaze(page);
  const field = page.locator("#field");
  await page.getByRole("button", { name: "Начать заново" }).click();
  await expect(field).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await page.clock.runFor(280);
  await expect(page.locator("#score")).toHaveText("1");
  await page.keyboard.press("s");
  await page.clock.runFor(840);
  await expect(field.locator(".tile").nth(26)).toHaveAttribute(
    "data-tile",
    "player",
  );
  await page.getByRole("button", { name: "Начать заново" }).click();
  await expect(page.locator("#score")).toHaveText("0");
  await expect(page.locator("#lives")).toHaveText("5");
});

test.describe("touch layout", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test("fits a portrait phone with touch controls below the board", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await openMaze(page);
    const field = page.locator("#field");
    await expect(field).toBeInViewport({ ratio: 1 });
    const fieldBox = (await field.boundingBox())!;
    expect(fieldBox.width / fieldBox.height).toBeCloseTo(11 / 15);
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
          expect(box.width).toBe(60);
          expect(box.height).toBe(60);
          return [name, box] as const;
        }),
      ),
    );
    expect(buttons["Вверх"]!.x - buttons["Влево"]!.x - 60).toBe(16);
    expect(buttons["Вправо"]!.x - buttons["Вверх"]!.x - 60).toBe(16);
    expect(buttons["Вниз"]!.y - buttons["Вверх"]!.y - 60).toBe(28);
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBe(667);

    await page.getByRole("button", { name: "Вправо" }).tap();
    await page.clock.runFor(280);
    await expect(page.locator("#score")).toHaveText("1");
    await page.setViewportSize({ width: 844, height: 285 });
    await expect(page.locator(".rotate-notice")).toHaveText(
      "Поверните телефон вертикально, чтобы играть",
    );
    await expect(page.locator(".rotate-notice")).toBeVisible();
    await expect(field).toBeHidden();
    await page.clock.runFor(1000);
    await expect(page.locator("#score")).toHaveText("1");
    await expect(page.locator("#lives")).toHaveText("5");
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(field).toBeVisible();
    await page.getByRole("button", { name: "Начать заново" }).click();
    await page.getByRole("button", { name: "Вправо" }).tap();
    await page.clock.runFor(280);
    await expect(page.locator("#score")).toHaveText("1");
  });

  test("keeps the score on one line and leaves tunnel cells empty", async ({
    page,
  }) => {
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
    await expect(page.locator("#score")).toHaveText("1");
    expect((await stats.boundingBox())!.height).toBe(initialHeight);
  });

  test("renders the portrait prototype @visual", async ({ page }) => {
    await openMaze(page);
    await expect(page.locator("#field").locator(".tile")).toHaveCount(165);
    await expect(page).toHaveScreenshot("prototype-portrait.png", {
      animations: "disabled",
    });
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
    await page.locator('[data-direction="right"]').evaluate((button) => {
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
