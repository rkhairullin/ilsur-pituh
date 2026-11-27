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
  await expect(page.locator("header")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "В каталог" })).toHaveCount(0);
  await expect(page.locator("#scene")).toBeVisible();
  await expect(page.locator("#scene")).toHaveAttribute("width", "960");
  await expect(page.locator("#scene")).toHaveAttribute("height", "540");
  await expect(page.locator("[data-action]")).toHaveCount(5);

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
    await expect(page.locator("#game-state")).toHaveAttribute(
      "data-grounded",
      "true",
    );
    await expect(page).toHaveScreenshot("third-game-mobile-portrait.png");
    await expect(
      page.getByRole("navigation", { name: "Управление игрой" }),
    ).toBeHidden();
    await expect(page.locator(".scene")).toBeHidden();
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByRole("status")).toBeHidden();
    await expect(page.getByRole("button", { name: "Влево" })).toBeVisible();
    const scene = await page.locator(".scene").boundingBox();
    const controls = await page
      .getByRole("navigation", { name: "Управление игрой" })
      .boundingBox();
    const leftControls = await page
      .locator(".control-cluster--movement")
      .boundingBox();
    const jump = await page
      .getByRole("button", { name: "Прыжок" })
      .boundingBox();
    const left = await page
      .getByRole("button", { name: "Влево" })
      .boundingBox();
    const crouchButton = page.getByRole("button", { name: "Присесть" });
    const crouch = await crouchButton.boundingBox();
    expect(scene).not.toBeNull();
    expect(controls).not.toBeNull();
    expect(leftControls).not.toBeNull();
    expect(left).not.toBeNull();
    expect(crouch).not.toBeNull();
    expect(jump).not.toBeNull();
    expect(scene!.y + scene!.height).toBeLessThanOrEqual(controls!.y);
    expect(crouch!.width).toBe(left!.width);
    await expect(crouchButton).toHaveText("▼");
    await expect(page.getByRole("button", { name: "Стрелять" })).toHaveText(
      "■",
    );
    await expect(page.getByRole("button", { name: "Прыжок" })).toHaveText("✕");
    expect(leftControls!.x).toBeLessThan(100);
    expect(jump!.x + jump!.width).toBeGreaterThan(744);
    await expect(page).toHaveScreenshot("third-game-mobile-landscape.png");
  } finally {
    await context.close();
  }
});

test("mouse and keyboard control movement, crouching, jumping, and shooting", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.request.post("/login", {
    form: {
      nickname: "Игрок клавиатуры",
      password: "browser-test-password",
    },
  });
  await page.goto("/ilsur-platformer/");
  const state = page.locator("#game-state");
  const right = page.getByRole("button", { name: "Вправо" });
  await right.hover();
  await page.mouse.down();
  await expect(right).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(async () => Number(await state.getAttribute("data-player-x")))
    .toBeGreaterThan(80);
  await page.mouse.up();
  await expect(right).toHaveAttribute("aria-pressed", "false");

  await page.keyboard.down("ArrowLeft");
  await expect
    .poll(async () => Number(await state.getAttribute("data-player-x")))
    .toBeLessThan(120);
  await page.keyboard.up("ArrowLeft");

  await page.keyboard.down("ArrowDown");
  await expect(state).toHaveAttribute("data-crouched", "true");
  await page.keyboard.up("ArrowDown");
  await expect(state).toHaveAttribute("data-crouched", "false");

  await page.keyboard.down("x");
  await expect(state).toHaveAttribute("data-shots-fired", "1");
  await page.keyboard.up("x");
  await expect
    .poll(async () =>
      Number(await state.getAttribute("data-projectile-bounces")),
    )
    .toBeGreaterThan(0);

  await page.keyboard.down("Space");
  await expect(state).toHaveAttribute("data-grounded", "false");
  await page.keyboard.up("Space");
  await expect(state).toHaveAttribute("data-grounded", "true");

  await page.keyboard.down("ArrowRight");
  await expect
    .poll(async () => Number(await state.getAttribute("data-camera-x")))
    .toBeGreaterThan(0);
  await page.keyboard.up("ArrowRight");
});

test("allows a second jump in the air but not a third", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.request.post("/login", {
    form: {
      nickname: "Игрок двойного прыжка",
      password: "browser-test-password",
    },
  });
  await page.goto("/ilsur-platformer/");
  const state = page.locator("#game-state");

  await page.keyboard.down("Space");
  await expect(state).toHaveAttribute("data-jumps-used", "1");
  await page.keyboard.up("Space");
  const firstJumpY = Number(await state.getAttribute("data-player-y"));

  await page.waitForTimeout(100);
  await page.keyboard.down("Space");
  await expect(state).toHaveAttribute("data-jumps-used", "2");
  await page.keyboard.up("Space");
  await expect
    .poll(async () => Number(await state.getAttribute("data-player-y")))
    .toBeLessThan(firstJumpY);

  await page.waitForTimeout(50);
  await page.keyboard.down("Space");
  await page.waitForTimeout(50);
  await expect(state).toHaveAttribute("data-jumps-used", "2");
  await page.keyboard.up("Space");
});

test("supports two simultaneous touch actions and releases a cancelled pointer", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.request.post("/login", {
      form: {
        nickname: "Игрок сенсорного управления",
        password: "browser-test-password",
      },
    });
    await page.goto("/ilsur-platformer/");
    await page.evaluate(() => {
      document
        .querySelectorAll<HTMLButtonElement>("[data-action]")
        .forEach((button) => {
          button.setPointerCapture = () => {};
        });
    });
    const left = page.getByRole("button", { name: "Влево" });
    const shoot = page.getByRole("button", { name: "Стрелять" });
    const pointer = (pointerId: number) => ({
      pointerId,
      pointerType: "touch",
      button: 0,
      bubbles: true,
      cancelable: true,
    });
    await left.dispatchEvent("pointerdown", pointer(1));
    await shoot.dispatchEvent("pointerdown", pointer(2));
    await expect(left).toHaveAttribute("aria-pressed", "true");
    await expect(shoot).toHaveAttribute("aria-pressed", "true");
    const state = page.locator("#game-state");
    await expect
      .poll(async () => Number(await state.getAttribute("data-shots-fired")))
      .toBeGreaterThan(0);
    await expect
      .poll(async () => Number(await state.getAttribute("data-player-x")))
      .toBeLessThan(80);

    await left.dispatchEvent("pointercancel", pointer(1));
    await expect(left).toHaveAttribute("aria-pressed", "false");
    await expect(shoot).toHaveAttribute("aria-pressed", "true");
    await shoot.dispatchEvent("pointerup", pointer(2));
    await expect(shoot).toHaveAttribute("aria-pressed", "false");
  } finally {
    await context.close();
  }
});

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
  { width: 390, height: 844 },
]) {
  test(`@visual third game ${viewport.width}x${viewport.height}`, async ({
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
    await expect(page.locator("#game-state")).toHaveAttribute(
      "data-grounded",
      "true",
    );
    await expect(page).toHaveScreenshot(
      `third-game-${viewport.width}x${viewport.height}.png`,
    );
  });
}
