import { afterEach, expect, test, vi } from "vitest";
import { GameSound } from "../../client/games/ilsur-lovit-chleny/sound.js";

import { BackgroundMusic } from "../../client/shared/music/player.js";

function setup(
  stored: string | null = null,
  music?: BackgroundMusic,
  effects?: ConstructorParameters<typeof GameSound>[3],
  storedMusic: string | null = null,
) {
  const button = Object.assign(new EventTarget(), { setAttribute: vi.fn() });
  const musicButton = Object.assign(new EventTarget(), {
    setAttribute: vi.fn(),
    disabled: false,
  });
  const storage = {
    getItem: vi.fn((key: string) =>
      key === "ilsur-arcade-music" ? storedMusic : stored,
    ),
    setItem: vi.fn(),
  };
  const gain = {
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  };
  const oscillator = {
    frequency: { value: 0 },
    connect: vi.fn(() => gain),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const audio = {
    state: "running",
    destination: {},
    currentTime: 3,
    createGain: vi.fn(() => gain),
    createOscillator: vi.fn(() => oscillator),
    resume: vi.fn(async () => {}),
  };
  const context = vi.fn(function () {
    return audio;
  });
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("AudioContext", context);
  const sound = new GameSound(
    button as unknown as HTMLButtonElement,
    musicButton as unknown as HTMLButtonElement,
    music,
    effects,
  );
  const toggle = () => button.dispatchEvent(new Event("click"));
  const toggleMusic = () => musicButton.dispatchEvent(new Event("click"));
  return {
    button,
    musicButton,
    sound,
    storage,
    gain,
    oscillator,
    audio,
    context,
    toggle,
    toggleMusic,
  };
}

afterEach(() => vi.unstubAllGlobals());

test("opens sound only after activation, respects suspension and plays distinct cues", () => {
  const { sound, context, audio, oscillator } = setup();
  sound.play("catch");
  expect(context).not.toHaveBeenCalled();
  sound.activate();
  audio.state = "suspended";
  sound.play("miss");
  expect(audio.createOscillator).not.toHaveBeenCalled();
  audio.state = "running";
  for (const [cue, count, lastNote] of [
    ["catch", 2, 880],
    ["golden", 4, 1568],
    ["miss", 2, 196],
    ["defeat", 3, 175],
  ] as const) {
    oscillator.start.mockClear();
    sound.play(cue);
    expect(oscillator.start).toHaveBeenCalledTimes(count);
    expect(oscillator.frequency.value).toBe(lastNote);
  }
  sound.activate();
  expect(context).toHaveBeenCalledTimes(1);
  expect(audio.resume).toHaveBeenCalledTimes(2);
});

test("reads and writes mute, immediately silences active cues, and reuses audio", () => {
  const { button, sound, context, storage, gain, audio, toggle } = setup("off");
  expect(button.setAttribute).toHaveBeenLastCalledWith("aria-pressed", "false");
  sound.activate();
  expect(context).not.toHaveBeenCalled();
  toggle();
  expect(storage.setItem).toHaveBeenLastCalledWith("ilsur-arcade-sound", "on");
  sound.play("catch");
  const count = audio.createOscillator.mock.calls.length;
  toggle();
  expect(gain.gain.value).toBe(0);
  sound.play("miss");
  sound.play("golden");
  expect(audio.createOscillator).toHaveBeenCalledTimes(count);
  expect(storage.setItem).toHaveBeenLastCalledWith("ilsur-arcade-sound", "off");
  toggle();
  expect(gain.gain.value).toBe(1);
  expect(context).toHaveBeenCalledTimes(1);
});

test("blocked storage, unavailable audio and failed resume do not block the game", async () => {
  const { storage, context, audio } = setup();
  const button = Object.assign(new EventTarget(), { setAttribute: vi.fn() });
  storage.getItem.mockImplementation(() => {
    throw Error("blocked");
  });
  storage.setItem.mockImplementation(() => {
    throw Error("blocked");
  });
  context.mockImplementationOnce(() => {
    throw Error("unavailable");
  });
  audio.resume.mockRejectedValueOnce(Error("blocked"));
  const sound = new GameSound(
    button as unknown as HTMLButtonElement,
    button as unknown as HTMLButtonElement,
  );
  expect(() => sound.activate()).not.toThrow();
  expect(() => sound.activate()).not.toThrow();
  await Promise.resolve();
  expect(() => button.dispatchEvent(new Event("click"))).not.toThrow();
  expect(button.setAttribute).toHaveBeenLastCalledWith("aria-pressed", "false");
});

test("the sound button controls music only after a round has started", () => {
  const music = new BackgroundMusic([]);
  const start = vi.spyOn(music, "start");
  const pause = vi.spyOn(music, "pause");
  const { toggle, sound } = setup("off", music);

  toggle();
  expect(start).not.toHaveBeenCalled();
  toggle();
  sound.startMusic();
  expect(start).not.toHaveBeenCalled();
  toggle();
  expect(start).toHaveBeenCalledTimes(1);
  toggle();
  expect(pause).toHaveBeenCalledTimes(2);
  toggle();
  sound.startMusic();
  expect(start).toHaveBeenCalledTimes(3);
});

test("pausing gameplay stops music until gameplay resumes, regardless of sound toggles", () => {
  const music = new BackgroundMusic([]);
  const start = vi.spyOn(music, "start");
  const pause = vi.spyOn(music, "pause");
  const { toggle, sound } = setup(null, music);
  sound.startMusic();
  expect(start).toHaveBeenCalledTimes(1);
  sound.stopMusic();
  expect(pause).toHaveBeenCalledTimes(1);
  toggle();
  toggle();
  expect(start).toHaveBeenCalledTimes(1);
  sound.startMusic();
  expect(start).toHaveBeenCalledTimes(2);
});

test("plays MP3 effects repeatedly and silences them immediately when muted", async () => {
  const catchEffect = {
    currentTime: 2,
    play: vi.fn(async () => {}),
    pause: vi.fn(),
  };
  const missEffect = {
    readyState: 4,
    currentTime: 1,
    play: vi.fn(async () => {}),
    pause: vi.fn(),
  };
  const goldenEffect = {
    readyState: 4,
    currentTime: 1,
    play: vi.fn(async () => {}),
    pause: vi.fn(),
  };
  const audio = vi.fn(function (url: string) {
    return samples[url as keyof typeof samples];
  });
  const samples = {
    "/catch.mp3": catchEffect,
    "/miss.mp3": missEffect,
    "/rooster_crowing.mp3": goldenEffect,
  };
  vi.stubGlobal("Audio", audio);
  const { sound, toggle, oscillator } = setup(null, undefined, {
    catch: "/catch.mp3",
    miss: "/miss.mp3",
    golden: "/rooster_crowing.mp3",
  });
  expect(audio.mock.calls).toEqual([["/miss.mp3"], ["/rooster_crowing.mp3"]]);
  expect(missEffect.play).not.toHaveBeenCalled();
  sound.activate();
  catchEffect.play.mockRejectedValueOnce(new Error("blocked"));
  sound.play("catch");
  await Promise.resolve();
  sound.play("catch");
  sound.play("miss");
  sound.play("golden");
  expect(audio.mock.calls).toEqual([
    ["/miss.mp3"],
    ["/rooster_crowing.mp3"],
    ["/catch.mp3"],
  ]);
  expect(goldenEffect.currentTime).toBe(0);
  expect(goldenEffect.play).toHaveBeenCalledTimes(1);
  expect(catchEffect.currentTime).toBe(0);
  expect(catchEffect.play).toHaveBeenCalledTimes(2);
  expect(missEffect.play).toHaveBeenCalledTimes(1);
  expect(oscillator.start).not.toHaveBeenCalled();
  sound.play("defeat");
  expect(oscillator.start).toHaveBeenCalledTimes(3);
  missEffect.readyState = 1;
  sound.play("miss");
  expect(missEffect.play).toHaveBeenCalledTimes(1);
  expect(oscillator.start).toHaveBeenCalledTimes(5);
  toggle();
  expect(catchEffect.pause).toHaveBeenCalledTimes(1);
  expect(missEffect.pause).toHaveBeenCalledTimes(1);
  expect(goldenEffect.pause).toHaveBeenCalledTimes(1);
  sound.play("golden");
  expect(goldenEffect.play).toHaveBeenCalledTimes(1);
  sound.play("miss");
  expect(missEffect.play).toHaveBeenCalledTimes(1);
});

test("music preference survives master mute while game effects remain available", () => {
  const music = new BackgroundMusic([]);
  const start = vi.spyOn(music, "start");
  const pause = vi.spyOn(music, "pause");
  const { sound, storage, toggle, toggleMusic, musicButton, oscillator } =
    setup(null, music, undefined, "off");
  sound.activate();
  sound.startMusic();
  expect(start).not.toHaveBeenCalled();
  expect(musicButton.setAttribute).toHaveBeenLastCalledWith(
    "aria-pressed",
    "false",
  );
  sound.play("catch");
  expect(oscillator.start).toHaveBeenCalledTimes(2);
  toggleMusic();
  expect(start).toHaveBeenCalledTimes(1);
  toggleMusic();
  expect(pause).toHaveBeenCalledTimes(1);
  expect(storage.setItem).toHaveBeenLastCalledWith("ilsur-arcade-music", "off");
  toggle();
  expect(musicButton.disabled).toBe(true);
  toggleMusic();
  expect(storage.setItem).toHaveBeenLastCalledWith("ilsur-arcade-sound", "off");
  toggle();
  expect(musicButton.disabled).toBe(false);
  expect(start).toHaveBeenCalledTimes(1);
  sound.stopMusic();
  toggleMusic();
  expect(start).toHaveBeenCalledTimes(1);
  sound.startMusic();
  expect(start).toHaveBeenCalledTimes(2);
});
