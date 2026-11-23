import { expect, test } from "@playwright/test";

test("a completed round survives a network retry and appears in another browser context", async ({
  page,
  browser,
}) => {
  // Keep the shared catalog visual tests independent of saved records.
  const builtApp = new URL("../../dist/server/app.js", import.meta.url);
  const { createApp } = (await import(
    builtApp.href
  )) as typeof import("../../server/app.js");
  const server = createApp({
    password: "ranking-test",
    databasePath: ":memory:",
    secureCookie: false,
  });
  const baseURL = await server.listen({ host: "127.0.0.1", port: 0 });
  const second = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
  });
  try {
    await page.addInitScript(() => {
      Math.random = () => 0;
    });
    await page.setViewportSize({ width: 844, height: 390 });
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await page.request.post(`${baseURL}/login`, {
      form: { nickname: "Лидер теста", password: "ranking-test" },
    });
    await page.route("**/api/games/*/rounds/*", async (route) => {
      if (route.request().postDataJSON().score === undefined)
        return route.continue();
      const saved = await route.fetch();
      expect(saved.status()).toBe(204);
      await route.abort();
      await page.unroute("**/api/games/*/rounds/*");
    });
    const observer = await second.newPage();
    await observer.request.post("/login", {
      form: { nickname: "лидер теста", password: "ranking-test" },
    });
    await observer.goto("/");
    await expect(observer.getByText("Пока нет результатов")).toBeVisible();

    await page.goto(`${baseURL}/ilsur-lovit-chleny/`);
    await page.clock.fastForward(900);
    await page.keyboard.press("q");
    await expect(page.locator("#caught")).toHaveText("1");
    await page.clock.fastForward(20000);
    await expect(
      page.getByText("Результат не подтверждён. Повтори сохранение."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Повторить сохранение" }).click();
    await expect(page.getByText("Результат сохранён")).toBeVisible();

    await observer.getByRole("button", { name: "Обновить рейтинг" }).click();
    await expect(
      observer.getByText("Лидер теста · Очков: 10 · Членов напихано: 1"),
    ).toBeVisible();
    await observer.getByRole("link", { name: "Полный рейтинг" }).click();
    await expect(
      observer.getByText("🥇 Лидер теста · Очков: 10 · Членов напихано: 1"),
    ).toBeVisible();
    await expect(
      observer.getByText("Место: 1 · Очков: 10 · Членов напихано: 1", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(observer.locator("dd")).toHaveText(["1", "10", "1"]);
    expect(
      await observer.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(390);
    await expect(
      page.getByRole("link", { name: "Рейтинг игры" }),
    ).toHaveAttribute("href", "./rating");
    const back = page.locator("#lost").getByRole("link", { name: "В каталог" });
    await expect(back).toBeInViewport({ ratio: 1 });
    await back.click();
    await expect(
      page.getByRole("button", { name: "Обновить рейтинг" }),
    ).toBeVisible();
  } finally {
    await second.close();
    await server.close();
  }
});

test("@visual empty ranking on desktop and mobile", async ({ page }) => {
  await page.request.post("/login", {
    form: { nickname: "Новый игрок", password: "browser-test-password" },
  });
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/ilsur-lovit-chleny/rating");
    await expect(page.getByText("Пока нет результатов")).toBeVisible();
    await expect(page.getByText("У тебя пока нет результата")).toBeVisible();
    await expect
      .soft(page)
      .toHaveScreenshot(
        `rating-empty-${viewport.width}x${viewport.height}.png`,
      );
  }
});
