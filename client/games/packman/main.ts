import {
  advance,
  cancelTurn,
  cell,
  createMaze,
  height,
  index,
  requestTurn,
  stepMsForCircle,
  width,
  type Direction,
} from "./maze.js";
import missEffect from "../ilsur-lovit-chleny/assets/sounds/miss.mp3?url";
import goldenEffect from "../ilsur-lovit-chleny/assets/sounds/rooster_crowing.mp3?url";
import { BackgroundMusic } from "../../shared/music/player.js";
import { musicTracks } from "../../shared/music/playlist.js";
import { PackmanSound, playMazeChange } from "./sound.js";

const field = document.querySelector<HTMLElement>("#field")!;
const caught = document.querySelector<HTMLElement>("#caught")!;
const lives = document.querySelector<HTMLElement>("#lives")!;
const level = document.querySelector<HTMLElement>("#level")!;
const circle = document.querySelector<HTMLElement>("#circle")!;
const lost = document.querySelector<HTMLElement>("#lost")!;
const finalCaught = document.querySelector<HTMLElement>("#final-caught")!;
const finalCircle = document.querySelector<HTMLElement>("#final-circle")!;
const finalRound = document.querySelector<HTMLElement>("#final-round")!;
const resultStatus = document.querySelector<HTMLElement>("#result-status")!;
const retryResult = document.querySelector<HTMLButtonElement>("#retry-result")!;
const restart = document.querySelector<HTMLButtonElement>("#restart")!;
const soundButton = document.querySelector<HTMLButtonElement>("#sound")!;
const playAgain = document.querySelector<HTMLButtonElement>("#play-again")!;
const sound = new PackmanSound(soundButton, new BackgroundMusic(musicTracks), {
  miss: missEffect,
  golden: goldenEffect,
});
const coarseTouch = matchMedia("(any-pointer: coarse)");
const keys: Partial<Record<string, Direction>> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
};
const tiles = Array.from({ length: width * height }, (_, offset) => {
  const tile = document.createElement("span");
  tile.className = "tile";
  tile.setAttribute("aria-hidden", "true");
  field.append(tile);
  return {
    tile,
  };
});

let maze = createMaze();
let frameTimer: number | null = null;
let orientationPaused = false;
let currentRound: { key: string; started: Promise<boolean> };
let pendingResult: { caught: number; circle: number; round: number };

async function sendRound(key: string, body: object) {
  try {
    const response = await fetch(`/api/games/ilsur-pacman/rounds/${key}`, {
      method: "POST",
      keepalive: true,
      signal: AbortSignal.timeout(8000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function startRound() {
  let key: string;
  if (typeof crypto.randomUUID === "function") {
    key = crypto.randomUUID();
  } else {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    key = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  currentRound = { key, started: sendRound(key, {}) };
}

async function saveResult() {
  playAgain.disabled = true;
  retryResult.hidden = true;
  resultStatus.textContent = "Сохраняем результат…";
  const { key, started } = currentRound;
  const registered = (await started) || (await sendRound(key, {}));
  const saved = registered && (await sendRound(key, pendingResult));
  resultStatus.textContent = saved
    ? "Результат сохранён"
    : "Результат не подтверждён. Повтори сохранение.";
  retryResult.hidden = saved;
  playAgain.disabled = false;
}

function startNewGame() {
  maze = createMaze();
  sound.startMusic();
  startRound();
  resultStatus.textContent = "";
  retryResult.hidden = true;
  render();
  field.focus();
  startFrames();
}

function scheduleFrame(delay: number) {
  frameTimer = window.setTimeout(frame, delay);
}

function startFrames() {
  if (frameTimer === null) scheduleFrame(stepMsForCircle(maze.circle));
}

function turnOnScreen(direction: Direction, source: number) {
  requestTurn(maze, direction, source);
}

function render() {
  const player = index(maze.player.position);
  field.dataset.level = String(maze.level);
  tiles.forEach(({ tile }, offset) => {
    const position = { x: offset % width, y: Math.floor(offset / width) };
    const wall = cell(position, maze.level) === "#";
    const portal = cell(position, maze.level) === "T";
    const enemy = maze.enemies.find(
      (actor) => index(actor.position) === offset,
    );
    const appearance = wall
      ? "wall"
      : offset === player
        ? "player"
        : enemy
          ? `enemy-${enemy.kind}`
          : offset === maze.golden
            ? "golden"
            : portal
              ? "portal"
              : maze.items.has(offset)
                ? "item"
                : "empty";
    if (tile.dataset.tile !== appearance) tile.dataset.tile = appearance;
    const direction =
      appearance === "player" ? maze.player.direction : enemy?.direction;
    if (direction) tile.dataset.direction = direction;
    else delete tile.dataset.direction;
    if (enemy) tile.dataset.enemyKind = enemy.kind;
    else delete tile.dataset.enemyKind;
  });
  caught.textContent = String(maze.caught);
  lives.textContent = String(maze.lives);
  level.textContent = String(maze.level);
  circle.textContent = String(maze.circle);
  lost.hidden = maze.status !== "lost";
  if (maze.status === "lost") {
    finalCaught.textContent = String(maze.caught);
    finalCircle.textContent = String(maze.circle);
    finalRound.textContent = String(maze.level);
  }
}

restart.addEventListener("click", startNewGame);
playAgain.addEventListener("click", startNewGame);

retryResult.addEventListener("click", () => void saveResult());

document.addEventListener("keydown", (event) => {
  const direction = keys[event.code];
  if (
    !direction ||
    event.target instanceof HTMLButtonElement ||
    event.target instanceof HTMLAnchorElement
  )
    return;
  event.preventDefault();
  sound.startMusic();
  turnOnScreen(direction, -1);
});

document
  .querySelectorAll<HTMLButtonElement>("[data-direction]")
  .forEach((button) => {
    const direction = button.dataset.direction as Direction;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      sound.startMusic();
      button.setPointerCapture(event.pointerId);
      turnOnScreen(direction, event.pointerId);
    });
    button.addEventListener("pointercancel", (event) =>
      cancelTurn(maze, event.pointerId),
    );
    button.addEventListener("click", (event) => {
      if (event.detail === 0) {
        sound.startMusic();
        turnOnScreen(direction, -1);
      }
    });
  });

render();
startRound();
function frame() {
  frameTimer = null;
  if (maze.status !== "playing") return;
  if (coarseTouch.matches && window.innerWidth > window.innerHeight) {
    if (!orientationPaused) sound.pauseMusic();
    orientationPaused = true;
    scheduleFrame(250);
    return;
  }
  if (orientationPaused) {
    sound.resumeMusic();
    orientationPaused = false;
  }
  const soundStateBeforeAdvance = {
    caught: maze.caught,
    score: maze.score,
    lives: maze.lives,
  };
  advance(maze);
  playMazeChange(sound, soundStateBeforeAdvance, maze);
  render();
  const statusAfterAdvance = maze.status as string;
  if (statusAfterAdvance === "lost") {
    sound.stopMusic();
    pendingResult = {
      caught: maze.caught,
      circle: maze.circle,
      round: maze.level,
    };
    void saveResult();
  }
  if (maze.status === "playing") scheduleFrame(stepMsForCircle(maze.circle));
}
startFrames();
