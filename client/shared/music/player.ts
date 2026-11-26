export class BackgroundMusic {
  private audio: HTMLAudioElement | undefined;
  private nextAudio: HTMLAudioElement | undefined;
  private index = 0;
  private paused = false;

  constructor(private readonly tracks: readonly string[]) {}

  start() {
    const track = this.tracks[this.index];
    if (!track) return;
    this.paused = false;
    if (this.audio) {
      this.resume();
      return;
    }

    const audio = this.createAudio(track);
    this.audio = audio;
    this.listenForEnd(audio);
    this.preloadNext();
    this.resume();
  }

  resume() {
    void this.audio?.play().catch(() => {
      // Browser playback restrictions must not interrupt the game.
    });
  }

  pause() {
    this.paused = true;
    this.audio?.pause();
  }

  private createAudio(track: string) {
    const audio = new Audio(track);
    audio.volume = 0.5;
    return audio;
  }

  private preloadNext() {
    if (this.tracks.length < 2) return;
    const nextIndex = (this.index + 1) % this.tracks.length;
    this.nextAudio = this.createAudio(this.tracks[nextIndex]!);
    this.nextAudio.preload = "auto";
    this.nextAudio.load();
  }

  private listenForEnd(audio: HTMLAudioElement) {
    audio.addEventListener(
      "ended",
      () => {
        if (this.tracks.length === 1) {
          audio.currentTime = 0;
          if (!this.paused) this.resume();
          return;
        }

        this.index = (this.index + 1) % this.tracks.length;
        audio.src = this.tracks[this.index]!;
        this.nextAudio = undefined;
        this.listenForEnd(audio);
        this.preloadNext();
        if (!this.paused) this.resume();
      },
      { once: this.tracks.length > 1 },
    );
  }
}
