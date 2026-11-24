import { expect, test, type Page } from "@playwright/test";

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
  await expect(page.locator("#score")).toHaveText("10");
  await page.keyboard.press("s");
  await page.clock.runFor(840);
  await expect(field.locator(".tile").nth(26)).toHaveAttribute(
    "data-tile",
    "player",
  );
  await page.getByRole("button", { name: "Начать заново" }).click();
  await expect(page.locator("#score")).toHaveText("0");
  await expect(page.locator("#lives")).toHaveText("3");
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
    await expect(page.locator("#score")).toHaveText("10");
    await page.setViewportSize({ width: 844, height: 285 });
    await expect(field).toBeInViewport({ ratio: 1 });
    await page.clock.runFor(280);
    await expect(page.locator("#score")).toHaveText("20");
    const rotated = (await field.boundingBox())!;
    const controls = (await page
      .getByRole("group", { name: "Управление движением" })
      .boundingBox())!;
    expect(rotated.width / rotated.height).toBeCloseTo(15 / 11);
    expect(controls.x).toBeGreaterThanOrEqual(rotated.x + rotated.width);
    const [boardColumn, controlsColumn] = await page
      .locator(".play")
      .evaluate((play) =>
        getComputedStyle(play).gridTemplateColumns.split(" ").map(parseFloat),
      );
    expect(boardColumn! / (boardColumn! + controlsColumn!)).toBeCloseTo(0.7);
    await page.getByRole("button", { name: "Вниз" }).tap();
    await page.clock.runFor(280);
    await expect(page.locator("#score")).toHaveText("30");
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
