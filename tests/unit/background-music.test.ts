import { afterEach, expect, test, vi } from "vitest";
import { BackgroundMusic } from "../../client/shared/music/player.js";
import { orderMusicTracks } from "../../client/shared/music/playlist.js";

class AudioMock extends EventTarget {
  volume = 1;
  preload = "";
  currentTime = 0;
  play = vi.fn(async () => {});
  pause = vi.fn();
  load = vi.fn();

  constructor(public src: string) {
    super();
  }
}

function setup(tracks: string[]) {
  const audio: AudioMock[] = [];
  const createAudio = vi.fn(function (src: string) {
    const instance = new AudioMock(src);
    audio.push(instance);
    return instance;
  });
  vi.stubGlobal("Audio", createAudio);
  return { audio, createAudio, music: new BackgroundMusic(tracks) };
}

afterEach(() => vi.unstubAllGlobals());

test("preloads the next track and switches immediately through the playlist", () => {
  const tracks = orderMusicTracks({ "02.mp3": "/second", "01.mp3": "/first" });
  const { music, audio, createAudio } = setup([...tracks, "/third"]);
  expect(createAudio).not.toHaveBeenCalled();
  music.start();
  expect(audio[0]!.src).toBe("/first");
  expect(audio[0]!.volume).toBe(0.5);
  expect(audio[0]!.play).toHaveBeenCalledTimes(1);
  expect(audio[1]!.src).toBe("/second");
  expect(audio[1]!.preload).toBe("auto");
  expect(audio[1]!.load).toHaveBeenCalledOnce();
  expect(audio[1]!.play).not.toHaveBeenCalled();

  audio[0]!.dispatchEvent(new Event("ended"));
  expect(audio[0]!.src).toBe("/second");
  expect(audio[0]!.play).toHaveBeenCalledTimes(2);
  expect(audio[2]!.src).toBe("/third");
  expect(audio[2]!.load).toHaveBeenCalledOnce();

  music.pause();
  expect(audio[0]!.pause).toHaveBeenCalledOnce();
  audio[0]!.dispatchEvent(new Event("ended"));
  expect(audio[0]!.src).toBe("/third");
  expect(audio[0]!.play).toHaveBeenCalledTimes(2);
  music.start();
  expect(audio[0]!.play).toHaveBeenCalledTimes(3);
  audio[0]!.dispatchEvent(new Event("ended"));
  expect(audio[0]!.src).toBe("/first");
  expect(audio[0]!.play).toHaveBeenCalledTimes(4);
});

test("an empty playlist is silent and a rejected play can be retried", async () => {
  const empty = setup([]);
  empty.music.pause();
  empty.music.start();
  expect(empty.createAudio).not.toHaveBeenCalled();

  const { music, audio } = setup(["/first"]);
  music.start();
  audio[0]!.play.mockRejectedValueOnce(new Error("Playback blocked"));
  music.pause();
  music.start();
  await Promise.resolve();
  music.start();
  expect(audio[0]!.play).toHaveBeenCalledTimes(3);
  audio[0]!.dispatchEvent(new Event("ended"));
  expect(audio[0]!.currentTime).toBe(0);
  expect(audio[0]!.play).toHaveBeenCalledTimes(4);
  music.pause();
  audio[0]!.currentTime = 1;
  audio[0]!.dispatchEvent(new Event("ended"));
  expect(audio[0]!.currentTime).toBe(0);
  expect(audio[0]!.play).toHaveBeenCalledTimes(4);
  music.start();
  expect(audio[0]!.play).toHaveBeenCalledTimes(5);
});
