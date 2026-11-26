import { readdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/games/*/rounds/*", (route) =>
    route.fulfill({ status: 204 }),
  );
});

const tracks = readdirSync(
  new URL("../../client/shared/music/tracks/", import.meta.url),
)
  .filter((name) => name.endsWith(".mp3"))
  .sort();

test("starts music with the round, follows the playlist, and obeys mute", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
    if (localStorage.getItem("ilsur-arcade-sound") === null)
      localStorage.setItem("ilsur-arcade-sound", "off");
    window.Audio = class extends Audio {
      constructor(src?: string) {
        super(src);
        const effect = src?.match(
          /\/(catch|miss|rooster_crowing)-[^/]+\.mp3$/,
        )?.[1];
        this.id = `${effect ?? "music"}-probe`;
        document.body.append(this);
      }

      override load() {
        this.id = "music-preload-probe";
      }

      override async play() {
        if (this.id === "music-preload-probe") {
          document
            .querySelector("#music-probe")
            ?.setAttribute("id", "previous-music-probe");
          this.id = "music-probe";
        }
        this.dataset.playing = "true";
      }

      override pause() {
        this.dataset.playing = "false";
      }
    };
  });
  await page.request.post("/login", {
    form: { nickname: "Игрок", password: "browser-test-password" },
  });
  await page.clock.install();
  await page.goto("/ilsur-lovit-chleny/");
  const music = page.locator("#music-probe");
  const musicToggle = page.getByRole("button", { name: "Музыка" });
  const sound = page.getByRole("button", { name: "Весь звук" });
  await expect(music).toHaveCount(0);
  await expect(musicToggle).toBeDisabled();
  await sound.click();
  await expect(sound).toHaveAttribute("aria-pressed", "true");
  if (tracks.length === 0) {
    await expect(music).toHaveCount(0);
    return;
  }

  await expect(music).toHaveJSProperty("volume", 0.5);
  for (const track of [...tracks, tracks[0]!]) {
    const src = await music.getAttribute("src");
    expect(src).toBeTruthy();
    if (!src!.startsWith("data:")) {
      expect(decodeURIComponent(src!).normalize()).toContain(
        track.replace(/\.mp3$/, "-").normalize(),
      );
      expect((await page.request.get(src!)).ok()).toBe(true);
    }
    await expect(music).toHaveAttribute("data-playing", "true");
    await music.dispatchEvent("ended");
  }

  await sound.click();
  await expect(music).toHaveAttribute("data-playing", "false");
  const pausedTrack = await music.getAttribute("src");
  await sound.click();
  await expect(music).toHaveAttribute("data-playing", "true");
  await expect(music).toHaveAttribute("src", pausedTrack!);

  await page.keyboard.press("Escape");
  await expect(music).toHaveAttribute("data-playing", "false");
  await sound.click();
  await sound.click();
  await expect(music).toHaveAttribute("data-playing", "false");
  await page.getByRole("button", { name: "Продолжить" }).click();
  await expect(music).toHaveAttribute("data-playing", "true");
  await expect(music).toHaveAttribute("src", pausedTrack!);

  await page.clock.runFor(20_000);
  await expect(page.getByRole("heading", { name: "Gay over" })).toBeVisible();
  await expect(music).toHaveAttribute("data-playing", "false");
  await page.getByRole("button", { name: "Играть снова" }).click();
  await expect(music).toHaveAttribute("data-playing", "true");
  await expect(music).toHaveAttribute("src", pausedTrack!);

  await musicToggle.focus();
  await page.keyboard.press("Space");
  await expect(musicToggle).toHaveAttribute("aria-pressed", "false");
  await expect(music).toHaveAttribute("data-playing", "false");
  await sound.click();
  await expect(musicToggle).toBeDisabled();
  await sound.click();
  await expect(musicToggle).toBeEnabled();
  await expect(musicToggle).toHaveAttribute("aria-pressed", "false");
  await expect(music).toHaveAttribute("data-playing", "false");

  await page.clock.fastForward(1000);
  await page.keyboard.press("q");
  await expect(page.locator("#catch-probe")).toHaveAttribute(
    "data-playing",
    "true",
  );
  await expect(page.locator("#catch-probe")).toHaveJSProperty("volume", 1);
  await page.clock.runFor(5000);
  await expect(page.locator("#miss-probe")).toHaveAttribute(
    "data-playing",
    "true",
  );
  await sound.click();
  await expect(page.locator("#miss-probe")).toHaveAttribute(
    "data-playing",
    "false",
  );
  await sound.click();

  await page.reload();
  await expect(music).toHaveCount(0);
  await expect(musicToggle).toHaveAttribute("aria-pressed", "false");
  await musicToggle.click();
  await expect(music).toHaveAttribute("data-playing", "true");
});

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
]) {
  test(`audio and pause buttons align at ${viewport.width} × ${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.request.post("/login", {
      form: { nickname: "Игрок", password: "browser-test-password" },
    });
    await page.goto("/ilsur-lovit-chleny/");
    const pause = page.getByRole("button", { name: "Пауза" });
    await expect(pause).toBeVisible();
    const group = page.getByRole("group", { name: "Управление игрой" });
    const bounds = await group.getByRole("button").evaluateAll((buttons) =>
      buttons.map((button) => {
        const { x, y, width, height } = button.getBoundingClientRect();
        return { x, y, width, height };
      }),
    );
    expect(bounds).toHaveLength(3);
    for (const [index, box] of bounds.entries()) {
      expect(box.width).toBe(44);
      expect(box.height).toBe(44);
      expect(box.y).toBe(bounds[0]!.y);
      expect(box.x).toBe(bounds[0]!.x + index * 56);
    }
    await pause.click();
    await expect(pause).toBeHidden();
    await expect(group.getByRole("button", { name: "Музыка" })).toBeVisible();
  });
}
