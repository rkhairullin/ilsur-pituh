import type { BackgroundMusic } from "../../shared/music/player.js";

export type PackmanEffect = "miss" | "golden";
export type MazeSoundState = { caught: number; score: number; lives: number };

export class PackmanSound {
  private enabled = true;
  private active = false;
  private paused = false;
  private readonly samples = new Map<PackmanEffect, HTMLAudioElement>();

  constructor(
    private readonly button: HTMLButtonElement,
    private readonly music: BackgroundMusic,
    private readonly effects: Record<PackmanEffect, string>,
  ) {
    try {
      this.enabled = sessionStorage.getItem("packman-sound") !== "off";
    } catch {
      // The page keeps the default preference when session storage is blocked.
    }
    for (const effect of ["miss", "golden"] as const) {
      const sample = new Audio(effects[effect]);
      sample.preload = "auto";
      this.samples.set(effect, sample);
    }
    this.render();
    button.addEventListener("click", () => {
      this.enabled = !this.enabled;
      this.render();
      try {
        sessionStorage.setItem("packman-sound", this.enabled ? "on" : "off");
      } catch {
        // The choice still applies for the rest of this page session.
      }
      if (this.enabled) this.syncMusic();
      else {
        this.music.pause();
        this.samples.forEach((sample) => sample.pause());
      }
    });
  }

  startMusic() {
    this.active = true;
    this.syncMusic();
  }

  stopMusic() {
    this.active = false;
    this.paused = false;
    this.music.pause();
  }

  pauseMusic() {
    this.paused = true;
    this.music.pause();
  }

  resumeMusic() {
    this.paused = false;
    this.syncMusic();
  }

  play(effect: PackmanEffect) {
    if (!this.enabled) return;
    const sample = this.samples.get(effect)!;
    sample.currentTime = 0;
    void sample.play().catch(() => {
      // The game continues if browser audio playback is unavailable.
    });
  }

  private syncMusic() {
    if (this.active && this.enabled && !this.paused) this.music.start();
  }

  private render() {
    this.button.setAttribute("aria-pressed", String(this.enabled));
    this.button.setAttribute(
      "aria-label",
      this.enabled ? "Выключить звук" : "Включить звук",
    );
    this.button.title = this.enabled ? "Выключить звук" : "Включить звук";
    this.button.dataset.muted = String(!this.enabled);
  }
}

export function playMazeChange(
  sound: PackmanSound,
  before: MazeSoundState,
  after: MazeSoundState,
) {
  if (after.lives < before.lives) sound.play("miss");
  else if (after.caught > before.caught && after.score - before.score > 1)
    sound.play("golden");
}
