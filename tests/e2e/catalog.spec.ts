import { expect, test, type Page } from "@playwright/test";

async function openCatalog(page: Page) {
  await page.request.post("/login", {
    form: { nickname: "Игрок каталога", password: "browser-test-password" },
  });
  await page.goto("/");
}

for (const [name, selector] of [
  ["preview image", "Открыть игру Ильсур ловит члены"],
  ["Play button", "К игре"],
] as const) {
  test(`catalog ${name} opens instructions and then the game in the same session`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openCatalog(page);
    await page.getByRole("link", { name: selector }).first().click();
    await expect(page).toHaveURL(/\/ilsur-lovit-chleny\/instructions$/);
    await page.getByRole("link", { name: "Начать пИтушить" }).click();
    await expect(page).toHaveURL(/\/ilsur-lovit-chleny\/$/);
    await expect(page.getByRole("button", { name: "Пауза" })).toBeVisible();
    expect(await (await page.request.get("/api/session")).json()).toMatchObject(
      {
        nickname: "Игрок каталога",
      },
    );
  });
}

test("catalog opens the second game's instructions and then Packman", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openCatalog(page);
  await expect(page.locator(".library-count")).toContainText("02");
  await expect(
    page.getByRole("heading", { name: "Ильсур-Пакман-Членоед" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Открыть игру Ильсур-Пакман-Членоед" })
    .click();
  await expect(page).toHaveURL(/\/packman\/instructions$/);
  await page.getByRole("link", { name: "В каталог" }).click();
  await page
    .locator(".game-card")
    .nth(1)
    .getByRole("link", { name: "К игре" })
    .click();
  await expect(page).toHaveURL(/\/packman\/instructions$/);
  await page.getByRole("link", { name: "Начать пИтушить" }).click();
  await expect(page).toHaveURL(/\/packman\/$/);
  await expect(page.locator("#field .tile")).toHaveCount(165);
});

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
  { width: 390, height: 844 },
]) {
  test(`@visual catalog ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await openCatalog(page);
    await expect(
      page.getByRole("heading", { name: "Ильсур - пИтух" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Игры, где можно отпетушить Ильсура",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", {
        name: "Скриншот игрового экрана во время полёта банана",
      }),
    ).toHaveJSProperty("naturalWidth", 1200);
    await expect(
      page.getByRole("img", { name: "Ильсур и радужные петухи в лабиринте" }),
    ).toHaveJSProperty("naturalWidth", 1200);
    await expect(
      page.locator(".game-card").first().getByText("Пока нет результатов"),
    ).toBeVisible();
    expect(
      await page.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth,
      ]),
    ).toEqual([viewport.width, viewport.width]);
    await page
      .getByRole("heading", { name: "Ильсур-Пакман-Членоед" })
      .scrollIntoViewIfNeeded();
    await expect(page).toHaveScreenshot(
      `catalog-second-game-${viewport.width}x${viewport.height}.png`,
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page).toHaveScreenshot(
      `catalog-${viewport.width}x${viewport.height}.png`,
    );
  });
}
