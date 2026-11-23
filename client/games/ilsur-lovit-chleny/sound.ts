import type { BackgroundMusic } from "../../shared/music/player.js";

export type Reaction = "catch" | "miss" | "defeat";

type SoundEffect = Reaction | "golden";

const preference = "ilsur-arcade-sound";
const musicPreference = "ilsur-arcade-music";
const notes: Record<SoundEffect, readonly number[]> = {
  catch: [587, 880],
  golden: [784, 988, 1175, 1568],
  miss: [277, 196],
  defeat: [330, 262, 175],
};

export class GameSound {
  private enabled = true;
  private output: { context: AudioContext; volume: GainNode } | undefined;

  private readonly samples = new Map<SoundEffect, HTMLAudioElement>();
  private musicActive = false;
  private musicEnabled = true;

  constructor(
    private readonly button: HTMLButtonElement,
    private readonly musicButton: HTMLButtonElement,
    private readonly music?: BackgroundMusic,
    private readonly effects: Partial<Record<SoundEffect, string>> = {},
  ) {
    try {
      this.enabled = localStorage.getItem(preference) !== "off";
      this.musicEnabled = localStorage.getItem(musicPreference) !== "off";
    } catch {
      // Play remains available when storage is blocked.
    }
    for (const effect of ["miss", "golden"] as const) {
      const file = effects[effect];
      if (!file) continue;
      const sample = new Audio(file);
      sample.preload = "auto";
      this.samples.set(effect, sample);
    }
    this.render();
    button.addEventListener("click", () => {
      this.enabled = !this.enabled;
      this.render();
      this.savePreference(preference, this.enabled);
      this.activate();
      if (!this.enabled) {
        for (const sample of this.samples.values()) sample.pause();
      }
      this.syncMusic();
    });
    musicButton.addEventListener("click", () => {
      if (!this.enabled) return;
      this.musicEnabled = !this.musicEnabled;
      this.render();
      this.savePreference(musicPreference, this.musicEnabled);
      this.syncMusic();
    });
  }

  private savePreference(key: string, enabled: boolean) {
    try {
      localStorage.setItem(key, enabled ? "on" : "off");
    } catch {
      // Keep the selection for the current page.
    }
  }

  private syncMusic() {
    if (this.enabled && this.musicEnabled && this.musicActive)
      this.music?.start();
    else if (!this.enabled || !this.musicEnabled) this.music?.pause();
  }

  startMusic() {
    this.musicActive = true;
    if (this.enabled && this.musicEnabled) this.music?.start();
  }

  stopMusic() {
    this.musicActive = false;
    this.music?.pause();
  }

  activate() {
    if (!this.enabled) return;
    try {
      if (!this.output) {
        const context = new AudioContext();
        const volume = context.createGain();
        volume.connect(context.destination);
        this.output = { context, volume };
      }
      void this.output.context.resume().catch(() => {});
    } catch {
      // Audio is optional when the browser cannot open an audio output.
    }
  }

  play(reaction: SoundEffect) {
    if (!this.enabled) return;
    const file = this.effects[reaction];
    const cached = this.samples.get(reaction);
    if (file && (reaction === "catch" || (cached && cached.readyState >= 3))) {
      const sample = cached ?? new Audio(file);
      this.samples.set(reaction, sample);
      sample.currentTime = 0;
      void sample.play().catch(() => {
        // The round continues if the browser blocks an effect.
      });
      return;
    }
    if (!this.output || this.output.context.state !== "running") return;
    const { context, volume } = this.output;
    const firstBeat = context.currentTime;

    for (const [index, frequency] of notes[reaction].entries()) {
      const start = firstBeat + index * 0.09;
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.frequency.value = frequency;
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(0.09, start + 0.012);
      envelope.gain.linearRampToValueAtTime(0, start + 0.11);
      oscillator.connect(envelope).connect(volume);
      oscillator.start(start);
      oscillator.stop(start + 0.11);
    }
  }

  private render() {
    this.button.setAttribute("aria-pressed", String(this.enabled));
    this.musicButton.disabled = !this.enabled;
    this.musicButton.setAttribute(
      "aria-pressed",
      String(this.enabled && this.musicEnabled),
    );
    if (this.output) this.output.volume.gain.value = this.enabled ? 1 : 0;
  }
}
