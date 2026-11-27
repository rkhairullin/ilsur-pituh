import {
  createGameState,
  pauseGame,
  restartGame,
  resumeGame,
  startHarderEncore,
  stepGame,
} from "./game.js";
import { renderCampaignStatus } from "./campaign-ui.js";
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
const levelNameOutput = document.querySelector<HTMLElement>("#level-name");
const levelTimeOutput = document.querySelector<HTMLElement>("#level-time");
const livesOutput = document.querySelector<HTMLElement>("#lives");
const checkpointOutput =
  document.querySelector<HTMLElement>("#checkpoint-name");
const pauseButton = document.querySelector<HTMLButtonElement>("#pause");
const campaignOverlay =
  document.querySelector<HTMLElement>("#campaign-overlay");
const overlayTitle = document.querySelector<HTMLElement>("#overlay-title");
const overlayMessage = document.querySelector<HTMLElement>("#overlay-message");
const resumeButton = document.querySelector<HTMLButtonElement>("#resume");
const restartButton = document.querySelector<HTMLButtonElement>("#restart");
const catalogLink = document.querySelector<HTMLAnchorElement>("#catalog");

if (
  !canvas ||
  !context ||
  !gameStateOutput ||
  !gameSurface ||
  !levelNameOutput ||
  !levelTimeOutput ||
  !livesOutput ||
  !checkpointOutput ||
  !pauseButton ||
  !campaignOverlay ||
  !overlayTitle ||
  !overlayMessage ||
  !resumeButton ||
  !restartButton ||
  !catalogLink
) {
  throw new Error("Не удалось подготовить Canvas третьей игры");
}

const gameCanvas = canvas;
const gameContext = context;
const statusOutput = gameStateOutput;
const interactiveSurface = gameSurface;
const levelLabel = levelNameOutput;
const timeLabel = levelTimeOutput;
const livesLabel = livesOutput;
const checkpointLabel = checkpointOutput;
const pauseControl = pauseButton;
const overlay = campaignOverlay;
const titleLabel = overlayTitle;
const messageLabel = overlayMessage;
const resumeControl = resumeButton;
const restartControl = restartButton;
const catalogControl = catalogLink;
const statusElements = {
  levelName: levelLabel,
  levelTime: timeLabel,
  lives: livesLabel,
  checkpoint: checkpointLabel,
  pause: pauseControl,
  overlay,
  title: titleLabel,
  message: messageLabel,
  resume: resumeControl,
  restart: restartControl,
  catalog: catalogControl,
};
const input = createInputState();
let game = createGameState();
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

function pause() {
  if (!pauseGame(game)) return;
  clearHeldInput();
  previousFrameTime = null;
  updateStatus();
}

function resume() {
  if (!resumeGame(game)) return;
  previousFrameTime = null;
  updateStatus();
}

function togglePause() {
  if (game.campaign.status === "playing") pause();
  else if (game.campaign.status === "paused") resume();
}

pauseControl.addEventListener("click", pause);
resumeControl.addEventListener("pointerup", resume);
resumeControl.addEventListener("click", resume);
restartControl.addEventListener("click", () => {
  if (game.campaign.status === "complete") startHarderEncore(game);
  else restartGame(game);
  clearHeldInput();
  previousFrameTime = null;
  updateStatus();
});

window.addEventListener("keydown", (event) => {
  if (event.code !== "Escape" || event.repeat) return;
  event.preventDefault();
  togglePause();
});

window.addEventListener("blur", () => {
  clearHeldInput();
  pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearHeldInput();
    pause();
  }
});

let previousFrameTime: number | null = null;

function updateStatus() {
  renderCampaignStatus(game.campaign, statusElements, statusOutput);
}

function renderFrame(now: number) {
  const elapsedSeconds =
    previousFrameTime === null
      ? 0
      : Math.max((now - previousFrameTime) / 1000, 0);
  previousFrameTime = now;
  stepGame(game, readControls(input), elapsedSeconds);
  drawPlatformerScene(gameContext, gameCanvas.width, gameCanvas.height, game);
  statusOutput.dataset.playerX = String(Math.round(game.player.x));
  statusOutput.dataset.playerY = String(Math.round(game.player.y));
  statusOutput.dataset.grounded = String(game.player.grounded);
  statusOutput.dataset.jumpsUsed = String(game.player.jumpsUsed);
  statusOutput.dataset.crouched = String(game.player.crouched);
  statusOutput.dataset.shotsFired = String(game.shotsFired);
  statusOutput.dataset.projectileBounces = String(game.projectileBounces);
  statusOutput.dataset.cameraX = String(Math.round(game.cameraX));
  updateStatus();
  syncButtons();
  requestAnimationFrame(renderFrame);
}

requestAnimationFrame(renderFrame);
