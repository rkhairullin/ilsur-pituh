import catchEffect from "./assets/sounds/catch.mp3?url";
import missEffect from "./assets/sounds/miss.mp3?url";
import goldenEffect from "./assets/sounds/rooster_crowing.mp3?url";
import { BackgroundMusic } from "../../shared/music/player.js";
import { musicTracks } from "../../shared/music/playlist.js";
import { GameInput, laneForKey, type Lane } from "./input.js";
import { Round, goldenBonus, missLimit } from "./round.js";
import { drawScene } from "./scene.js";
import { GameSound, type Reaction } from "./sound.js";

const game = document.querySelector<HTMLElement>(".game")!;
const hud = document.querySelector<HTMLElement>(".hud")!;
const arena = document.querySelector<HTMLElement>(".arena")!;
const canvas = document.querySelector("canvas")!;
const ctx = canvas.getContext("2d");
const pause = document.querySelector<HTMLButtonElement>("#pause")!;
const resume = document.querySelector<HTMLButtonElement>("#resume")!;
const paused = document.querySelector<HTMLElement>("#paused")!;
const rotate = document.querySelector<HTMLElement>("#rotate")!;
const controls = document.querySelectorAll<HTMLButtonElement>("[data-lane]");
const portraitPhone = matchMedia(
  "(orientation: portrait) and (any-pointer: coarse), (orientation: portrait) and (max-width: 600px)",
);
const compactLandscape = matchMedia(
  "(orientation: landscape) and (max-height: 500px)",
);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const input = new GameInput();
input.pause();
const round = new Round();
const lost = document.querySelector<HTMLElement>("#lost")!;
const mobileBrowser = /Android|iPhone|iPod/i.test(navigator.userAgent);
const iphone = /iPhone|iPod/i.test(navigator.userAgent);
const fullscreenHint = document.querySelector<HTMLElement>("#fullscreen-hint")!;
fullscreenHint.hidden =
  !iphone ||
  document.fullscreenEnabled ||
  matchMedia("(display-mode: standalone), (display-mode: fullscreen)")
    .matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const restart = document.querySelector<HTMLButtonElement>("#restart")!;
const resultStatus = document.querySelector<HTMLElement>("#result-status")!;
const retryResult = document.querySelector<HTMLButtonElement>("#retry-result")!;
const caught = document.querySelector<HTMLElement>("#caught")!;
const misses = document.querySelector<HTMLElement>("#misses")!;
const score = document.querySelector<HTMLElement>("#score")!;
const streak = document.querySelector<HTMLElement>("#streak")!;
const multiplier = document.querySelector<HTMLElement>("#multiplier")!;
const finalCaught = document.querySelector<HTMLElement>("#final-caught")!;
const finalScore = document.querySelector<HTMLElement>("#final-score")!;
const hero = document.querySelector<HTMLImageElement>("#hero-sprite")!;
const bananaSprite =
  document.querySelector<HTMLImageElement>("#banana-sprite")!;
const goldenSprite =
  document.querySelector<HTMLImageElement>("#golden-sprite")!;
const decoySprite = document.querySelector<HTMLImageElement>("#decoy-sprite")!;
const cannonSprite =
  document.querySelector<HTMLImageElement>("#cannon-sprite")!;
const reaction = document.querySelector<HTMLElement>("#reaction")!;
const audioControls = document.querySelector<HTMLElement>("#audio-controls")!;
const sound = new GameSound(
  document.querySelector<HTMLButtonElement>("#sound")!,
  document.querySelector<HTMLButtonElement>("#music")!,
  new BackgroundMusic(musicTracks),
  { catch: catchEffect, golden: goldenEffect, miss: missEffect },
);
const catchPhrases = [
  "Отсосал",
  "Взял в рот",
  "Ммммм",
  "Вкусненько",
  "Я минетчик",
  "Йа пИтух",
  "Хуй мне в рот",
  "Хочу ещё",
  "Ещё хуёв!",
  "На бис!",
  "Вот это подача!",
] as const;
const reactionText = {
  miss: "Лох! Пидр!",
  defeat: "Gay over",
};
let lastReaction: Reaction | undefined;
const swallowDuration = 160;
let swallow:
  { lane: Lane; from: number; started: number; golden: boolean } | undefined;
let reactionUntil = 0;
let previousTime = 0;
let framePending = false;

function roundKey() {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function sendRound(key: string, body: object) {
  try {
    const response = await fetch(
      `/api/games/ilsur-lovit-chleny/rounds/${key}`,
      {
        method: "POST",
        keepalive: true,
        signal: AbortSignal.timeout(8000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    return response.ok;
  } catch {
    return false;
  }
}

let currentRound: { key: string; started: Promise<boolean> };
let pendingResult: { score: number; caught: number };

async function saveResult() {
  restart.setAttribute("aria-disabled", "true");
  retryResult.hidden = true;
  resultStatus.textContent = "Сохраняем результат…";
  const { key, started } = currentRound;
  const registered = (await started) || (await sendRound(key, {}));
  const saved = registered && (await sendRound(key, pendingResult));
  resultStatus.textContent = saved
    ? "Результат сохранён"
    : "Результат не подтверждён. Повтори сохранение.";
  retryResult.hidden = saved;
  restart.setAttribute("aria-disabled", "false");
}

function updateText(element: HTMLElement, value: string) {
  if (element.textContent !== value) element.textContent = value;
}

function render() {
  const lane = input.lane;
  const position = lane ?? "center";
  if (game.dataset.position !== position) {
    game.dataset.position = position;
    for (const button of controls) {
      button.setAttribute("aria-pressed", String(button.dataset.lane === lane));
    }
  }
  const swallowProgress = swallow
    ? (previousTime - swallow.started) / swallowDuration
    : 1;
  const swallowing =
    swallow &&
    swallowProgress < 1 &&
    !reducedMotion.matches &&
    (lane === undefined || lane === swallow.lane)
      ? swallow
      : undefined;
  if (ctx) {
    const unit = Math.max(
      1,
      Math.round(
        Math.min(canvas.clientWidth / 20, canvas.clientHeight / 9) *
          devicePixelRatio,
      ),
    );
    if (canvas.width !== unit * 20) {
      canvas.width = unit * 20;
      canvas.height = unit * 9;
    }
    const scale = unit / 60;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawScene(
      ctx,
      swallowing?.lane ?? lane,
      round.state === "lost" ? [] : round.bananas,
      hero,
      bananaSprite,
      decoySprite,
      goldenSprite,
      cannonSprite,
      lastReaction,
      compactLandscape.matches,
      swallowing && {
        from: swallowing.from,
        progress: swallowProgress,
        golden: swallowing.golden,
      },
    );
  }

  game.dataset.state = round.state;
  updateText(caught, String(round.caught));
  updateText(score, String(round.score));
  updateText(finalScore, String(round.score));
  updateText(finalCaught, String(round.caught));
  updateText(streak, String(round.streak));
  updateText(multiplier, `×${round.multiplier}`);
  updateText(misses, `${round.missed} / ${missLimit}`);

  const needsRotation = portraitPhone.matches;
  rotate.hidden = !needsRotation;
  audioControls.hidden = needsRotation;
  pause.hidden = round.state !== "playing";
  paused.hidden = needsRotation || round.state !== "paused";
  lost.hidden = needsRotation || round.state !== "lost";
  hud.inert = arena.inert = needsRotation || round.state !== "playing";
}

function update() {
  if (round.state !== "playing") return;
  const now = performance.now();
  const previousMisses = round.missed;
  round.advance(now - previousTime);
  previousTime = now;
  if (lastReaction && now >= reactionUntil) clearReaction();
  if (gameHasEnded()) {
    pendingResult = { score: round.score, caught: round.caught };
    void saveResult();
    sound.stopMusic();
    react("defeat", reactionText.defeat);
    input.pause();
    render();
    restart.focus();
  } else if (round.missed > previousMisses) {
    react("miss", reactionText.miss);
  }
}

function gameHasEnded() {
  return round.state === "lost";
}

function scheduleFrame() {
  if (framePending || round.state !== "playing") return;
  framePending = true;
  requestAnimationFrame(() => {
    framePending = false;
    update();
    render();
    scheduleFrame();
  });
}

function activateOnFirstInteraction() {
  const controller = new AbortController();
  const activate = () => {
    controller.abort();
    if (round.state === "playing") {
      sound.activate();
      sound.startMusic();
    }
    if (
      mobileBrowser &&
      document.fullscreenEnabled &&
      !document.fullscreenElement
    ) {
      void document.documentElement.requestFullscreen().catch(() => {
        // The round can still run if the browser declines fullscreen.
      });
    }
  };
  const options = { capture: true, signal: controller.signal };
  addEventListener("click", activate, options);
  addEventListener("keydown", activate, options);
}

function begin() {
  if (round.state === "ready") activateOnFirstInteraction();
  const key = roundKey();
  currentRound = { key, started: sendRound(key, {}) };
  round.start();
  swallow = undefined;
  clearReaction();
  continuePlay();
}

function continuePlay(restoreFocus = false) {
  sound.startMusic();
  sound.activate();
  input.resume(false);
  previousTime = performance.now();
  render();
  if (restoreFocus) pause.focus();
  scheduleFrame();
}

function press(source: string, lane: Lane) {
  update();
  if (input.press(source, lane)) {
    const progress = round.catchBanana(lane);
    if (progress === "decoy") {
      swallow = undefined;
      react("miss", reactionText.miss);
    } else if (progress) {
      swallow = {
        lane,
        from: progress.progress,
        started: previousTime,
        golden: progress.golden,
      };
      if (progress.golden) react("catch", `Бонус +${goldenBonus}`, "golden");
      else
        react(
          "catch",
          catchPhrases[
            crypto.getRandomValues(new Uint32Array(1))[0]! % catchPhrases.length
          ]!,
        );
    } else if (swallow?.lane !== lane) {
      swallow = undefined;
    }
  }
  render();
}

function clearReaction() {
  lastReaction = undefined;
  delete reaction.dataset.reaction;
  reaction.textContent = "";
}

function react(
  kind: Reaction,
  text: string,
  effect: Parameters<GameSound["play"]>[0] = kind,
) {
  lastReaction = kind;
  reactionUntil = previousTime + 750;
  reaction.dataset.reaction = kind;
  reaction.textContent = text;
  sound.play(effect);
}

function stop() {
  sound.stopMusic();
  swallow = undefined;
  round.pause();
  input.pause();
  render();
  if (!paused.hidden) resume.focus();
}

function togglePause() {
  if (round.state === "paused") {
    if (document.hidden || portraitPhone.matches) return;
    round.resume();
    continuePlay(true);
  } else {
    update();
    stop();
  }
}

function rotateScreen() {
  if (portraitPhone.matches) stop();
  else if (round.state === "ready" && !document.hidden) begin();
  else {
    render();
    if (!paused.hidden) resume.focus();
    if (!lost.hidden) restart.focus();
  }
}

addEventListener("keydown", (event) => {
  if (event.code === "Escape") {
    event.preventDefault();
    if (!event.repeat) togglePause();
    return;
  }
  const lane = laneForKey(event.code);
  if (!lane || event.ctrlKey || event.altKey || event.metaKey) return;
  event.preventDefault();
  if (!event.repeat) {
    press(event.code, lane);
  }
});

addEventListener("keyup", (event) => {
  update();
  input.release(event.code);
  render();
});

for (const button of controls) {
  button.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    button.setPointerCapture(event.pointerId);
    press(String(event.pointerId), button.dataset.lane as Lane);
  });

  for (const type of [
    "pointerup",
    "pointercancel",
    "lostpointercapture",
  ] as const) {
    button.addEventListener(type, (event) => {
      update();
      input.release(String(event.pointerId));
      render();
    });
  }

  button.addEventListener("keydown", (event) => {
    if (event.code !== "Space" && event.code !== "Enter") return;
    event.preventDefault();
    if (!event.repeat) press(event.code, button.dataset.lane as Lane);
  });
}

restart.addEventListener("click", () => {
  if (
    round.state === "lost" &&
    restart.getAttribute("aria-disabled") !== "true"
  )
    begin();
});
retryResult.addEventListener("click", () => void saveResult());
pause.addEventListener("click", togglePause);
resume.addEventListener("click", togglePause);
addEventListener("blur", stop);
portraitPhone.addEventListener("change", rotateScreen);
compactLandscape.addEventListener("change", render);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
  else if (round.state === "ready") rotateScreen();
});
hero.addEventListener("load", render);
bananaSprite.addEventListener("load", render);
decoySprite.addEventListener("load", render);
goldenSprite.addEventListener("load", render);
cannonSprite.addEventListener("load", render);
new ResizeObserver(render).observe(canvas);
rotateScreen();
