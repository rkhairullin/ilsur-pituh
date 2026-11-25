import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
]) {
  test(`first and repeated login, access and logout at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/index.html");
    await expect(page).toHaveURL(/\/login$/);
    const character = page.locator(".login-character");
    const mobile = viewport.width <= 900;
    const characterUrl = new URL(
      mobile
        ? "/login/login-character-mobile.webp"
        : "/login/login-character.webp",
      page.url(),
    ).href;
    await expect(character).toHaveJSProperty("currentSrc", characterUrl);
    await expect(character).toHaveJSProperty(
      "naturalWidth",
      mobile ? 640 : 1194,
    );
    expect((await page.request.get("/api/session")).status()).toBe(401);
    const nickname = `<Лиса> ${test.info().project.name}-${viewport.width}`;
    await page.getByLabel("Имя свое скажи, если ты мущщщщина").fill(nickname);
    await page.getByLabel("Пароль (знают все четкие пацаны)").fill("wrong");
    await page.getByRole("button", { name: "В пИтушарню" }).click();
    await expect(page.getByRole("alert")).toHaveText(
      "Неверный пароль, натурал чертов",
    );
    await page.getByLabel("Имя свое скажи, если ты мущщщщина").fill(nickname);
    await page
      .getByLabel("Пароль (знают все четкие пацаны)")
      .fill("browser-test-password");
    await page.getByLabel("Пароль (знают все четкие пацаны)").press("Enter");
    await expect(page).toHaveURL(/\/$/);
    const player = await (await page.request.get("/api/session")).json();
    expect(player.nickname).toBe(nickname);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Ильсур - пИтух" }),
    ).toBeVisible();
    await expect(page.locator("#player-nickname")).toHaveText(
      `Привет, ${nickname}`,
    );
    await page.getByRole("link", { name: "К игре" }).first().click();
    await page.getByRole("link", { name: "Начать пИтушить" }).click();
    await expect(page).toHaveURL(/\/ilsur-lovit-chleny\/$/);
    const sprite = page.locator("#hero-sprite");
    await expect(sprite).toHaveJSProperty("currentSrc", characterUrl);
    await expect(sprite).toHaveJSProperty("naturalWidth", mobile ? 640 : 1194);
    await page.getByRole("button", { name: "Пауза" }).click();
    await expect(page.locator("#player-nickname")).toHaveText(
      `Игрок: ${nickname}`,
    );
    await page.getByRole("link", { name: "В каталог" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("#player-nickname")).toContainText(nickname);
    expect(await (await page.request.get("/api/session")).json()).toEqual(
      player,
    );
    await page.getByRole("button", { name: "Выйти" }).click();
    await expect(
      page.getByRole("heading", {
        name: "Ильсур - пИтух",
      }),
    ).toBeVisible();
    expect((await page.request.get("/api/session")).status()).toBe(401);
    await page
      .getByLabel("Имя свое скажи, если ты мущщщщина")
      .fill(` ${nickname.toLowerCase()} `);
    await page
      .getByLabel("Пароль (знают все четкие пацаны)")
      .fill("browser-test-password");
    await page.getByRole("button", { name: "В пИтушарню" }).click();
    await expect(
      page.getByRole("heading", {
        name: "Игры, где можно отпетушить Ильсура",
      }),
    ).toBeVisible();
    expect(await (await page.request.get("/api/session")).json()).toEqual(
      player,
    );
  });
}

test("direct game visit without a session asks for login then returns to the game", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/ilsur-lovit-chleny/");
  await expect(page).toHaveURL(/\/login\?returnTo=%2Filsur-lovit-chleny%2F$/);
  await page
    .getByLabel("Имя свое скажи, если ты мущщщщина")
    .fill("Прямой вход");
  await page
    .getByLabel("Пароль (знают все четкие пацаны)")
    .fill("browser-test-password");
  await page.getByRole("button", { name: "В пИтушарню" }).click();
  await expect(page).toHaveURL(/\/ilsur-lovit-chleny\/$/);
  await expect(page.getByRole("button", { name: "Пауза" })).toBeVisible();
  expect(await (await page.request.get("/api/session")).json()).toMatchObject({
    nickname: "Прямой вход",
  });
});

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
  { width: 390, height: 844 },
]) {
  test(`@visual login form ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Ильсур - пИтух" }),
    ).toBeVisible();
    const character = page.getByRole("img", { name: "Ильсур в образе петуха" });
    await expect(character).toHaveJSProperty(
      "naturalWidth",
      viewport.width <= 900 ? 640 : 1194,
    );

    await expect(
      page.getByRole("button", { name: "В пИтушарню" }),
    ).toBeInViewport({
      ratio: 1,
    });
    await expect(page).toHaveScreenshot(
      `login-${viewport.width}x${viewport.height}.png`,
    );
  });
}

test("@visual player and logout on the mobile pause screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.request.post("/login", {
    form: { nickname: "Игрок теста", password: "browser-test-password" },
  });
  await page.goto("/ilsur-lovit-chleny/");
  await page.getByRole("button", { name: "Пауза" }).click();
  await expect(page.getByRole("button", { name: "Выйти" })).toBeInViewport();
  await expect(page.locator("#paused")).toHaveScreenshot("pause-844x390.png");
});
