import { expect, test } from "@playwright/test";

const path = "/packman/instructions";

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
  { width: 390, height: 844 },
]) {
  test(`@visual Packman instructions at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.request.post("/login", {
      form: { nickname: "Игрок лабиринта", password: "browser-test-password" },
    });
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Ильсур-Пакман-Членоед",
    );
    await expect(page.locator(".cast dt")).toHaveText([
      "Ильсур",
      "Красный преследователь",
      "Фиолетовый перехватчик",
      "Бирюзовый патрульный",
      "Синий засадник",
    ]);
    await expect(page.locator("main img")).toHaveCount(7);
    for (const image of await page.locator("main img").all()) {
      await expect(image).not.toHaveJSProperty("naturalWidth", 0);
    }
    await expect(page.locator(".items dt").nth(1)).toContainText("Дилдо");
    await expect(
      page.getByText("Каждые 3 дилдо пополняют запас жизней."),
    ).toBeVisible();
    await expect(
      page.getByText("стрелки или WASD", { exact: false }),
    ).toBeAttached();
    await expect(
      page.getByRole("link", { name: "Начать пИтушить" }),
    ).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(viewport.width);
    await expect(page).toHaveScreenshot(
      `packman-instructions-${viewport.width}x${viewport.height}.png`,
    );
    await page.evaluate(() => {
      const main = document.querySelector("main")!;
      main.scrollTop = main.scrollHeight;
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await expect(
      page.getByRole("link", { name: "Начать пИтушить" }),
    ).toBeInViewport({
      ratio: 1,
    });
    await expect(page).toHaveScreenshot(
      `packman-instructions-bottom-${viewport.width}x${viewport.height}.png`,
    );
    await page.getByRole("link", { name: "Начать пИтушить" }).click();
    await expect(page).toHaveURL(/\/packman\/$/);
    await expect(page.locator("#field .tile")).toHaveCount(165);
  });
}

test("Packman instructions can return to the catalog", async ({ page }) => {
  await page.request.post("/login", {
    form: { nickname: "Игрок лабиринта", password: "browser-test-password" },
  });
  await page.goto(path);
  await page.getByRole("link", { name: "В каталог" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".game-card")).toHaveCount(2);
});

test("Packman instructions match portrait play and game rules", async ({
  page,
}) => {
  await page.request.post("/login", {
    form: { nickname: "Игрок лабиринта", password: "browser-test-password" },
  });
  await page.goto(path);

  const castBox = await page.locator(".rules > section").nth(0).boundingBox();
  const controlsBox = await page
    .locator(".rules > section")
    .nth(1)
    .boundingBox();
  expect(castBox!.width).toBeGreaterThan(controlsBox!.width);
  await expect(page.locator(".rules > section h2")).toHaveText([
    "Кто тут на танцполе",
    "Как двигаться",
    "Что собирать",
    "Карты, жизни и скорость",
  ]);
  const copy = (await page.locator(".rules").innerText()).replace(/\s+/g, " ");
  expect(copy).toContain("держи экран вертикально");
  expect(copy).toContain("Ильсур и Синий засадник");
  expect(copy).toContain(
    "единственный из преследователей умеет проскальзывать сквозь туннели",
  );
  expect(copy).toContain("Успей поймать за 20 шагов игрока.");
  expect(copy).toContain("обычным членом (+1 очко)");
  expect(copy).toContain("даёт 20 очков");
  expect(copy).toContain("отступают на 18 игровых тиков");
  expect(copy).toContain("Каждые 3 дилдо пополняют запас жизней.");
  expect(copy).toContain("круг даёт 500 бонусных очков");

  const rotations = await page.locator(".items img").evaluateAll((images) =>
    images.map((image) => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(image).transform);
      return [matrix.a, matrix.b, matrix.c, matrix.d];
    }),
  );
  expect(rotations[0]![0]).toBeCloseTo(-Math.SQRT1_2);
  expect(rotations[0]![1]).toBeCloseTo(-Math.SQRT1_2);
  expect(rotations[0]![2]).toBeCloseTo(Math.SQRT1_2);
  expect(rotations[0]![3]).toBeCloseTo(-Math.SQRT1_2);
  expect(rotations[1]).toEqual([-1, 0, 0, -1]);
});
