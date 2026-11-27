import { expect, test } from "@playwright/test";

test("direct private link requires login and opens a Canvas prototype", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/ilsur-platformer/");
  await expect(page).toHaveURL(/\/login\?returnTo=%2Filsur-platformer%2F$/);

  await page
    .getByLabel("Имя свое скажи, если ты мущщщщина")
    .fill("Игрок третьей игры");
  await page
    .getByLabel("Пароль (знают все четкие пацаны)")
    .fill("browser-test-password");
  await page.getByRole("button", { name: "В пИтушарню" }).click();

  await expect(page).toHaveURL(/\/ilsur-platformer\/$/);
  await expect(
    page.getByRole("heading", { name: "Большое приключение Ильсура" }),
  ).toBeVisible();
  await expect(page.locator("#scene")).toBeVisible();
  await expect(page.locator("#scene")).toHaveAttribute("width", "1200");
  await expect(page.locator("#scene")).toHaveAttribute("height", "540");

  await page.goto("/");
  await expect(page.locator(".game-card")).toHaveCount(2);
  await expect(page.locator("main")).not.toContainText("Большое приключение");
});

test("mobile portrait asks the player to rotate the phone", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.request.post("/login", {
      form: {
        nickname: "Игрок вертикального экрана",
        password: "browser-test-password",
      },
    });
    await page.goto("/ilsur-platformer/");
    await expect(page.getByRole("status")).toHaveText(
      "Поверните телефон горизонтально",
    );
  } finally {
    await context.close();
  }
});

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
  { width: 390, height: 844 },
]) {
  test(`@visual third game placeholder ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.request.post("/login", {
      form: {
        nickname: `Игрок ${viewport.width}`,
        password: "browser-test-password",
      },
    });
    await page.goto("/ilsur-platformer/");
    await expect(page.locator("#scene")).toBeVisible();
    await expect(page).toHaveScreenshot(
      `third-game-${viewport.width}x${viewport.height}.png`,
    );
  });
}
