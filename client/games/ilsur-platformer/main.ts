import { drawPlaceholderScene } from "./scene.js";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
const context = canvas?.getContext("2d");

if (!canvas || !context) {
  throw new Error("Не удалось подготовить Canvas третьей игры");
}

const gameCanvas = canvas;
const gameContext = context;

function renderFrame() {
  drawPlaceholderScene(gameContext, gameCanvas.width, gameCanvas.height);
  requestAnimationFrame(renderFrame);
}

requestAnimationFrame(renderFrame);
