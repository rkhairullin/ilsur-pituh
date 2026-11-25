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

const field = document.querySelector<HTMLElement>("#field")!;
const score = document.querySelector<HTMLElement>("#score")!;
const lives = document.querySelector<HTMLElement>("#lives")!;
const level = document.querySelector<HTMLElement>("#level")!;
const circle = document.querySelector<HTMLElement>("#circle")!;
const status = document.querySelector<HTMLElement>("#status")!;
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
  score.textContent = String(maze.score);
  lives.textContent = String(maze.lives);
  level.textContent = String(maze.level);
  circle.textContent = String(maze.circle);
  const message = maze.notice ?? (maze.status === "lost" ? "Gay over" : "");
  if (status.textContent !== message) status.textContent = message;
}

document.querySelector("#restart")!.addEventListener("click", () => {
  maze = createMaze();
  render();
  field.focus();
  startFrames();
});

document.addEventListener("keydown", (event) => {
  const direction = keys[event.code];
  if (
    !direction ||
    event.target instanceof HTMLButtonElement ||
    event.target instanceof HTMLAnchorElement
  )
    return;
  event.preventDefault();
  turnOnScreen(direction, -1);
});

document
  .querySelectorAll<HTMLButtonElement>("[data-direction]")
  .forEach((button) => {
    const direction = button.dataset.direction as Direction;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      turnOnScreen(direction, event.pointerId);
    });
    button.addEventListener("pointercancel", (event) =>
      cancelTurn(maze, event.pointerId),
    );
    button.addEventListener("click", (event) => {
      if (event.detail === 0) turnOnScreen(direction, -1);
    });
  });

render();
function frame() {
  frameTimer = null;
  if (maze.status !== "playing") return;
  if (coarseTouch.matches && window.innerWidth > window.innerHeight) {
    scheduleFrame(250);
    return;
  }
  advance(maze);
  render();
  if (maze.status === "playing") scheduleFrame(stepMsForCircle(maze.circle));
}
startFrames();
