const layout = [
  "###########",
  "#P....#.#.#",
  "#.##..#.#.#",
  "#.........#",
  "#.###.#.#.#",
  "#.##....#.#",
  "#.....#.#.#",
  "...#.#.....",
  "#.#...#.#.#",
  "#...#.....#",
  "#.#...#.#.#",
  "#...#...#.#",
  "#.#...#.#.#",
  "#...#.....#",
  "###########",
];

export const width = 11;
export const height = layout.length;
export const tunnelRow = 7;
export const directions = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
} as const;
export type Direction = keyof typeof directions;
type Position = { x: number; y: number };
type Actor = { position: Position; direction: Direction };
type Maze = {
  player: Actor;
  enemy: Actor;
  pending: { direction: Direction; source: number } | null;
  items: Set<number>;
  score: number;
  lives: number;
  status: "playing" | "won" | "lost";
  paused: boolean;
  tick: number;
};

export const cell = ({ x, y }: Position) => layout[y]?.[x];
export const index = ({ x, y }: Position) => y * width + x;

function spawn() {
  return {
    player: { position: { x: 1, y: 1 }, direction: "up" },
    enemy: { position: { x: width - 2, y: tunnelRow }, direction: "right" },
  } as const;
}

export function createMaze(): Maze {
  const items = new Set<number>();
  layout.forEach((row, y) => {
    [...row].forEach((tile, x) => {
      if (tile === ".") items.add(index({ x, y }));
    });
  });
  return {
    ...spawn(),
    items,
    pending: null,
    score: 0,
    lives: 3,
    status: "playing",
    paused: false,
    tick: 0,
  };
}

export function destination({ x, y }: Position, direction: Direction) {
  const [dx, dy] = directions[direction];
  const next = {
    x: y === tunnelRow ? (x + dx + width) % width : x + dx,
    y: y + dy,
  };
  const tile = cell(next);
  return tile && tile !== "#" ? next : null;
}

export function requestTurn(maze: Maze, direction: Direction, source: number) {
  if (!maze.paused && maze.status === "playing") {
    maze.pending = { direction, source };
  }
}

export function cancelTurn(maze: Maze, source: number) {
  if (maze.pending?.source === source) maze.pending = null;
}

function moveEnemy(enemy: Actor) {
  const [dx, dy] = directions[enemy.direction];
  for (const direction of [
    enemy.direction,
    ...Object.keys(directions),
  ] as Direction[]) {
    const [nextX, nextY] = directions[direction];
    if (nextX === -dx && nextY === -dy) continue;
    const position = destination(enemy.position, direction);
    if (position) return { position, direction };
  }
  const reverse = {
    up: "down",
    down: "up",
    left: "right",
    right: "left",
  } as const;
  // Every open tile has a neighbor. At a dead end, it is the tile the enemy came from.
  const direction = reverse[enemy.direction];
  return {
    position: destination(enemy.position, direction)!,
    direction,
  };
}

function loseLife(maze: Maze) {
  maze.lives -= 1;
  if (maze.lives === 0) {
    maze.status = "lost";
    return;
  }
  Object.assign(maze, spawn(), { pending: null, tick: 0 });
}

export function advance(maze: Maze) {
  if (maze.paused || maze.status !== "playing") return;
  maze.tick += 1;
  const turn = maze.pending;
  const turnDestination =
    turn && destination(maze.player.position, turn.direction);
  if (turn && turnDestination) {
    maze.player = { position: turnDestination, direction: turn.direction };
    maze.pending = null;
  } else {
    maze.player.position =
      destination(maze.player.position, maze.player.direction) ??
      maze.player.position;
  }

  const playerIndex = index(maze.player.position);
  if (playerIndex === index(maze.enemy.position)) {
    loseLife(maze);
    return;
  }

  const { x, y } = maze.enemy.position;
  const inTunnel = y === tunnelRow && (x <= 2 || x >= width - 3);
  if (maze.tick % (inTunnel ? 4 : 2) === 0) maze.enemy = moveEnemy(maze.enemy);

  if (playerIndex === index(maze.enemy.position)) {
    loseLife(maze);
    return;
  }

  if (maze.items.delete(playerIndex)) maze.score += 10;
  if (maze.items.size === 0) maze.status = "won";
}
