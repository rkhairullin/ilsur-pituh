import { expect, test } from "@playwright/test";

test("prevents accidental double-tap zoom across project pages", async ({
  page,
}) => {
  await page.goto("/login");
  await page.request.post("/login", {
    form: {
      nickname: "Игрок жестов",
      password: "browser-test-password",
    },
  });

  for (const path of [
    "/",
    "/ilsur-platformer/",
    "/packman/",
    "/packman/instructions",
    "/ilsur-lovit-chleny/",
    "/ilsur-lovit-chleny/instructions",
  ]) {
    await page.goto(path);
    await expect
      .poll(() =>
        page.evaluate(
          () => getComputedStyle(document.documentElement).touchAction,
        ),
      )
      .toBe("pan-x pan-y");
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      "content",
      /maximum-scale=1/,
    );
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      "content",
      /user-scalable=no/,
    );
  }
});

test("suppresses text selection and touch callouts on the game surface", async ({
  page,
}) => {
  await page.request.post("/login", {
    form: {
      nickname: "Игрок без меню копирования",
      password: "browser-test-password",
    },
  });
  await page.goto("/ilsur-platformer/");

  for (const selector of [".prototype", "#scene", "[data-action='jump']"]) {
    await expect(page.locator(selector)).toHaveCSS("user-select", "none");
  }

  const contextMenuWasPrevented = await page
    .locator(".prototype")
    .evaluate((surface) => {
      const event = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
      });
      surface.dispatchEvent(event);
      return event.defaultPrevented;
    });
  expect(contextMenuWasPrevented).toBe(true);
});
