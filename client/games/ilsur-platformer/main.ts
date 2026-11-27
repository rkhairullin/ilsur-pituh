import { createGameState, stepGame } from "./game.js";
import {
  clearInput,
  createInputState,
  isGameAction,
  pressPointer,
  readControls,
  releasePointer,
  updateKeyboardInput,
} from "./input.js";
import { drawPlatformerScene } from "./scene.js";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
const context = canvas?.getContext("2d");
const gameStateOutput =
  document.querySelector<HTMLOutputElement>("#game-state");
const gameSurface = document.querySelector<HTMLElement>(".prototype");

if (!canvas || !context || !gameStateOutput || !gameSurface) {
  throw new Error("Не удалось подготовить Canvas третьей игры");
}

const gameCanvas = canvas;
const gameContext = context;
const statusOutput = gameStateOutput;
const interactiveSurface = gameSurface;
const input = createInputState();
const game = createGameState();
const actionButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-action]"),
).flatMap((button) => {
  const action = button.dataset.action;
  return isGameAction(action) ? [{ button, action }] : [];
});

interactiveSurface.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

function syncButtons() {
  const controls = readControls(input);
  for (const { button, action } of actionButtons) {
    button.setAttribute("aria-pressed", String(controls[action]));
  }
}

window.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.altKey || event.metaKey) return;
  if (!updateKeyboardInput(input, event.code, true)) return;
  event.preventDefault();
  syncButtons();
});

window.addEventListener("keyup", (event) => {
  if (!updateKeyboardInput(input, event.code, false)) return;
  event.preventDefault();
  syncButtons();
});

for (const { button, action } of actionButtons) {
  button.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    pressPointer(input, event.pointerId, action);
    syncButtons();
  });

  const release = (event: PointerEvent) => {
    releasePointer(input, event.pointerId);
    syncButtons();
  };
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
}

function clearHeldInput() {
  clearInput(input);
  syncButtons();
}

window.addEventListener("blur", clearHeldInput);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearHeldInput();
});

let previousFrameTime: number | null = null;

function renderFrame(now: number) {
  const deltaSeconds =
    previousFrameTime === null
      ? 0
      : Math.min(Math.max((now - previousFrameTime) / 1000, 0), 1 / 30);
  previousFrameTime = now;
  stepGame(game, readControls(input), deltaSeconds);
  drawPlatformerScene(gameContext, gameCanvas.width, gameCanvas.height, game);
  statusOutput.dataset.playerX = String(Math.round(game.player.x));
  statusOutput.dataset.playerY = String(Math.round(game.player.y));
  statusOutput.dataset.grounded = String(game.player.grounded);
  statusOutput.dataset.jumpsUsed = String(game.player.jumpsUsed);
  statusOutput.dataset.crouched = String(game.player.crouched);
  statusOutput.dataset.shotsFired = String(game.shotsFired);
  statusOutput.dataset.projectileBounces = String(game.projectileBounces);
  statusOutput.dataset.cameraX = String(Math.round(game.cameraX));
  syncButtons();
  requestAnimationFrame(renderFrame);
}

requestAnimationFrame(renderFrame);
