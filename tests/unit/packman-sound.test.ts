import { afterEach, expect, test, vi } from "vitest";
import {
  PackmanSound,
  playMazeChange,
} from "../../client/games/packman/sound.js";

class SoundButton extends EventTarget {
  dataset: Record<string, string> = {};
  title = "";
  attributes = new Map<string, string>();

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
}

class AudioSample {
  static created: Array<{ src: string; sample: AudioSample }> = [];
  currentTime = 0;
  preload = "";
  play = vi.fn<() => Promise<void>>(() => Promise.resolve());
  pause = vi.fn();

  constructor(src: string) {
    AudioSample.created.push({ src, sample: this });
  }
}

function setup(value: string | null = null) {
  AudioSample.created = [];
  const button = new SoundButton();
  const start = vi.fn();
  const pause = vi.fn();
  const storage = {
    getItem: vi.fn(() => value),
    setItem: vi.fn(),
  };
  vi.stubGlobal("sessionStorage", storage);
  vi.stubGlobal("Audio", AudioSample);
  const sound = new PackmanSound(
    button as unknown as HTMLButtonElement,
    { start, pause } as never,
    { miss: "/miss.mp3", golden: "/golden.mp3" },
  );
  const toggle = () => button.dispatchEvent(new Event("click"));
  return { button, sound, start, pause, storage, toggle };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("defaults to on, starts music with gameplay and stops it at game over", () => {
  const { button, sound, start, pause, storage } = setup();
  expect(storage.getItem).toHaveBeenCalledWith("packman-sound");
  expect(button.attributes.get("aria-pressed")).toBe("true");
  expect(button.attributes.get("aria-label")).toBe("Выключить звук");
  expect(button.dataset.muted).toBe("false");
  sound.startMusic();
  sound.pauseMusic();
  sound.resumeMusic();
  expect(start).toHaveBeenCalledTimes(2);
  expect(pause).toHaveBeenCalledOnce();
  sound.stopMusic();
  expect(pause).toHaveBeenCalledTimes(2);
});

test("mutes effects and music until toggled on again, retaining the choice", () => {
  const { button, sound, start, pause, storage, toggle } = setup();
  sound.startMusic();
  sound.play("miss");
  const sample = AudioSample.created[0]!.sample;
  toggle();
  expect(storage.setItem).toHaveBeenLastCalledWith("packman-sound", "off");
  expect(button.attributes.get("aria-pressed")).toBe("false");
  expect(button.attributes.get("aria-label")).toBe("Включить звук");
  expect(button.dataset.muted).toBe("true");
  expect(pause).toHaveBeenCalledOnce();
  expect(sample.pause).toHaveBeenCalledOnce();
  sound.play("miss");
  expect(start).toHaveBeenCalledOnce();
  toggle();
  expect(storage.setItem).toHaveBeenLastCalledWith("packman-sound", "on");
  expect(start).toHaveBeenCalledTimes(2);
});

test("restores mute for the current tab and skips effect playback", () => {
  const { button, sound, start, toggle } = setup("off");
  expect(button.attributes.get("aria-pressed")).toBe("false");
  sound.startMusic();
  sound.play("golden");
  expect(start).not.toHaveBeenCalled();
  toggle();
  expect(start).toHaveBeenCalledOnce();
});

test("does not start music from the toggle before gameplay starts", () => {
  const { start, toggle } = setup();
  toggle();
  toggle();
  expect(start).not.toHaveBeenCalled();
});

test("does not resume music while the game is paused for orientation", () => {
  const { sound, start, toggle } = setup();
  sound.startMusic();
  sound.pauseMusic();
  toggle();
  toggle();
  expect(start).toHaveBeenCalledOnce();
  sound.resumeMusic();
  expect(start).toHaveBeenCalledTimes(2);
});

test("plays each effect from the shared asset and restarts a reused sample", () => {
  const { sound } = setup();
  expect(AudioSample.created.map(({ src }) => src)).toEqual([
    "/miss.mp3",
    "/golden.mp3",
  ]);
  expect(AudioSample.created.map(({ sample }) => sample.preload)).toEqual([
    "auto",
    "auto",
  ]);
  sound.play("miss");
  sound.play("miss");
  sound.play("golden");
  expect(AudioSample.created.map(({ src }) => src)).toEqual([
    "/miss.mp3",
    "/golden.mp3",
  ]);
  expect(AudioSample.created[0]!.sample.currentTime).toBe(0);
  expect(AudioSample.created[0]!.sample.play).toHaveBeenCalledTimes(2);
  expect(AudioSample.created[1]!.sample.play).toHaveBeenCalledOnce();
});

test("keeps gameplay working when storage is unavailable or audio is rejected", async () => {
  const { sound } = setup();
  vi.mocked(sessionStorage.getItem).mockImplementation(() => {
    throw new Error("blocked");
  });
  const blockedButton = new SoundButton();
  const fresh = new PackmanSound(
    blockedButton as unknown as HTMLButtonElement,
    { start: vi.fn(), pause: vi.fn() } as never,
    { miss: "/miss.mp3", golden: "/golden.mp3" },
  );
  vi.mocked(sessionStorage.setItem).mockImplementation(() => {
    throw new Error("blocked");
  });
  expect(() => fresh.startMusic()).not.toThrow();
  fresh.play("miss");
  const sample = AudioSample.created.at(-2)!.sample;
  sample.play.mockRejectedValueOnce(new Error("blocked"));
  fresh.play("miss");
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  expect(() => blockedButton.dispatchEvent(new Event("click"))).not.toThrow();
  expect(() => sound.startMusic()).not.toThrow();
});

test("maps collisions, golden collection and ordinary collection to the right cues", () => {
  const play = vi.fn();
  const sound = { play } as unknown as PackmanSound;
  playMazeChange(
    sound,
    { caught: 1, score: 1, lives: 5 },
    { caught: 1, score: 1, lives: 4 },
  );
  expect(play).toHaveBeenLastCalledWith("miss");
  playMazeChange(
    sound,
    { caught: 1, score: 1, lives: 5 },
    { caught: 2, score: 21, lives: 5 },
  );
  expect(play).toHaveBeenLastCalledWith("golden");
  play.mockClear();
  playMazeChange(
    sound,
    { caught: 1, score: 1, lives: 5 },
    { caught: 2, score: 2, lives: 5 },
  );
  playMazeChange(
    sound,
    { caught: 1, score: 1, lives: 5 },
    { caught: 1, score: 1, lives: 5 },
  );
  expect(play).not.toHaveBeenCalled();
});
