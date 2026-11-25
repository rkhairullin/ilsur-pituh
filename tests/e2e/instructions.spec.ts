import { devices, expect, test } from "@playwright/test";

const path = "/ilsur-lovit-chleny/instructions";

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
  { width: 390, height: 844 },
]) {
  test(`@visual instructions at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.request.post("/login", {
      form: { nickname: "Игрок", password: "browser-test-password" },
    });
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Ильсур — пИтух. Диско-пушки заряжены!",
    );
    await expect(page.locator("kbd")).toHaveText(["Q", "O", "A", "L"]);
    await expect(page.locator("dt")).toHaveText([
      "Член",
      "Дилдо",
      "Банан-приманка",
    ]);
    for (const image of await page.locator("main img").all()) {
      await expect(image).not.toHaveJSProperty("naturalWidth", 0);
    }
    await expect(
      page.getByText("У Ильсура есть право сказать «нет».", { exact: false }),
    ).toBeAttached();

    const start = page.getByRole("link", { name: "Начать пИтушить" });
    await expect(start).toBeInViewport({ ratio: 1 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(viewport.width);
    await expect(page).toHaveScreenshot(
      `instructions-${viewport.width}x${viewport.height}.png`,
    );

    await page.evaluate(() => {
      const instructions = document.querySelector("main")!;
      instructions.scrollTop = instructions.scrollHeight;
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await expect(start).toBeInViewport({ ratio: 1 });
    await start.focus();
    await expect(start).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/ilsur-lovit-chleny\/$/);
    if (viewport.width < viewport.height) {
      await expect(
        page.getByRole("heading", { name: "Поверните телефон" }),
      ).toBeVisible();
      await expect(page.getByRole("main")).toHaveAttribute(
        "data-state",
        "ready",
      );
      await page.setViewportSize({
        width: viewport.height,
        height: viewport.width,
      });
    }
    await expect(page.getByRole("main")).toHaveAttribute(
      "data-state",
      "playing",
    );
    await expect(page.getByRole("button", { name: "Пауза" })).toBeVisible();
  });
}

test("instructions can return to the catalog", async ({ page }) => {
  await page.request.post("/login", {
    form: { nickname: "Игрок", password: "browser-test-password" },
  });
  await page.goto(path);
  await page.getByRole("link", { name: "В каталог" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("touch starts the game after scrolling the instructions on a phone", async ({
  browser,
}) => {
  const phone = devices["iPhone 13"];
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: phone.viewport,
    userAgent: phone.userAgent,
  });
  try {
    const page = await context.newPage();
    await page.request.post("/login", {
      form: { nickname: "Игрок", password: "browser-test-password" },
    });
    await page.goto(path);
    const start = page.getByRole("link", { name: "Начать пИтушить" });
    await expect(start).toBeInViewport({ ratio: 1 });
    const beforeScroll = await start.boundingBox();
    const instructions = page.getByRole("main");
    await instructions.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect
      .poll(() => instructions.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    expect(await start.boundingBox()).toEqual(beforeScroll);
    await start.tap();
    await expect(page).toHaveURL(/\/ilsur-lovit-chleny\/$/);
    await expect(
      page.getByRole("heading", { name: "Поверните телефон" }),
    ).toBeVisible();
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByRole("main")).toHaveAttribute(
      "data-state",
      "playing",
    );
  } finally {
    await context.close();
  }
});
