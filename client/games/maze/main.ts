import {
  advance,
  cancelTurn,
  cell,
  createMaze,
  height,
  index,
  requestTurn,
  width,
  type Direction,
} from "./maze.js";

const field = document.querySelector<HTMLElement>("#field")!;
const score = document.querySelector<HTMLElement>("#score")!;
const lives = document.querySelector<HTMLElement>("#lives")!;
const status = document.querySelector<HTMLElement>("#status")!;
const landscapeTouch = matchMedia(
  "(any-pointer: coarse) and (orientation: landscape)",
);
const landscapeDirections: Record<Direction, Direction> = {
  up: "left",
  down: "right",
  left: "down",
  right: "up",
};
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
    wall: cell({ x: offset % width, y: Math.floor(offset / width) }) === "#",
  };
});

let maze = createMaze();

function turnOnScreen(direction: Direction, source: number) {
  requestTurn(
    maze,
    landscapeTouch.matches ? landscapeDirections[direction] : direction,
    source,
  );
}

function render() {
  const player = index(maze.player.position);
  const enemy = index(maze.enemy.position);
  tiles.forEach(({ tile, wall }, offset) => {
    const appearance = wall
      ? "wall"
      : offset === player
        ? "player"
        : offset === enemy
          ? "enemy"
          : maze.items.has(offset)
            ? "item"
            : "empty";
    if (tile.dataset.tile !== appearance) tile.dataset.tile = appearance;
  });
  score.textContent = String(maze.score);
  lives.textContent = String(maze.lives);
  const message = {
    playing: "",
    won: "Карта пройдена!",
    lost: "Ильсур подавился",
  }[maze.status];
  if (status.textContent !== message) status.textContent = message;
}

document.querySelector("#restart")!.addEventListener("click", () => {
  maze = createMaze();
  render();
  field.focus();
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
window.setInterval(() => {
  if (maze.status !== "playing") return;
  advance(maze);
  render();
}, 280);
