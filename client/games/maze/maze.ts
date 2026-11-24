export const width = 11;
export const height = 15;
export const tunnelRow = 7;
export const verticalTunnelColumn = 5;
export const directions = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
} as const;
export type Direction = keyof typeof directions;
export type Position = { x: number; y: number };
export type EnemyKind = "pursuer" | "interceptor" | "patroller";
export type Actor = { position: Position; direction: Direction };
export type Enemy = Actor & { kind: EnemyKind };
export type Level = {
  layout: readonly string[];
  name: string;
  enemyCount: number;
  golden: Position;
};

const levels: readonly Level[] = [
  {
    name: "Разминка",
    enemyCount: 1,
    golden: { x: 7, y: 9 },
    layout: [
      "#####T#####",
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
      "#####T#####",
    ],
  },
  {
    name: "Перехват",
    enemyCount: 2,
    golden: { x: 9, y: 11 },
    layout: [
      "#####T#####",
      "#P.....#..#",
      "#.###..#..#",
      "#.........#",
      "#..##.#.#.#",
      "#.....#...#",
      "#.##..#.#.#",
      "...#.#.....",
      "#.#...#.#.#",
      "#.....#...#",
      "#.#.#...#.#",
      "#...#.#...#",
      "#.#...#.#.#",
      "#.........#",
      "#####T#####",
    ],
  },
  {
    name: "В обход",
    enemyCount: 3,
    golden: { x: 4, y: 7 },
    layout: [
      "#####T#####",
      "#P....#...#",
      "#.##..#.#.#",
      "#.........#",
      "#.###.#.#.#",
      "#.....#...#",
      "#.#.#.#.#.#",
      "...#.#.....",
      "#.#...#.#.#",
      "#...#.....#",
      "#.#...#.#.#",
      "#...#.#...#",
      "#.#...#.#.#",
      "#.........#",
      "#####T#####",
    ],
  },
  {
    name: "Под давлением",
    enemyCount: 3,
    golden: { x: 7, y: 9 },
    layout: [
      "#####T#####",
      "#P....#...#",
      "#.##..#.#.#",
      "#.........#",
      "#.#.#.#.#.#",
      "#.....#...#",
      "#.#.#...#.#",
      "...#.#.....",
      "#.#...#.#.#",
      "#...#.....#",
      "#.#.#.#.#.#",
      "#...#.....#",
      "#.#...#.#.#",
      "#.........#",
      "#####T#####",
    ],
  },
  {
    name: "Перекрёстки",
    enemyCount: 3,
    golden: { x: 9, y: 11 },
    layout: [
      "#####T#####",
      "#P....#...#",
      "#.#.#.#.#.#",
      "#.........#",
      "#.#.#.#.#.#",
      "#...#.....#",
      "#.#...#.#.#",
      "...#.#.....",
      "#.#.#.#.#.#",
      "#.........#",
      "#.#.#.#.#.#",
      "#...#.....#",
      "#.#.#.#.#.#",
      "#.........#",
      "#####T#####",
    ],
  },
  {
    name: "Смена ритма",
    enemyCount: 3,
    golden: { x: 4, y: 7 },
    layout: [
      "#####T#####",
      "#P....#...#",
      "#.#.#.#.#.#",
      "#.........#",
      "#.###.#.#.#",
      "#.....#...#",
      "#.#.#...#.#",
      "...#.#.....",
      "#.#...#.#.#",
      "#...#.....#",
      "#.#.#.#.#.#",
      "#...#.....#",
      "#.#...#.#.#",
      "#.........#",
      "#####T#####",
    ],
  },
  {
    name: "Финал",
    enemyCount: 4,
    golden: { x: 9, y: 11 },
    layout: [
      "#####T#####",
      "#P....#...#",
      "#.##..#.#.#",
      "#.........#",
      "#.#.#.#.#.#",
      "#.....#...#",
      "#.#.#...#.#",
      "...#.#.....",
      "#.#...#.#.#",
      "#...#.....#",
      "#.#.#.#.#.#",
      "#...#.....#",
      "#.#...#.#.#",
      "#.........#",
      "#####T#####",
    ],
  },
];

export const levelsCount = levels.length;
export const circleBonus = 500;
export const fruitScore = 1;
export const goldenScore = 20;
export const goldenTicks = 18;
export const goldenWindowMoves = 20;
export const restTicks = 10;
export const baseStepMs = 280;
export const stepReductionPerCircleMs = 20;
// 200 ms per tile is the initial human-playable speed ceiling to validate on phones.
export const minimumStepMs = 200;
export const respawnGraceTicks = 3;

type Maze = {
  player: Actor;
  enemies: Enemy[];
  pending: { direction: Direction; source: number } | null;
  items: Set<number>;
  golden: number | null;
  score: number;
  lives: number;
  status: "playing" | "lost";
  notice: "Карта пройдена!" | "Круг пройден!" | null;
  phase: "chase" | "rest";
  paused: boolean;
  tick: number;
  level: number;
  circle: number;
  goldenTicksLeft: number;
  goldenMovesTaken: number;
  graceTicksLeft: number;
};

const enemySpawns: readonly Enemy[] = [
  { position: { x: 9, y: 7 }, direction: "left", kind: "pursuer" },
  { position: { x: 9, y: 5 }, direction: "down", kind: "patroller" },
  { position: { x: 7, y: 9 }, direction: "left", kind: "interceptor" },
  { position: { x: 7, y: 5 }, direction: "down", kind: "interceptor" },
];
const opposites: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export const cell = (position: Position, level = 1) =>
  levels[level - 1]?.layout[position.y]?.[position.x];
export const index = ({ x, y }: Position) => y * width + x;
export const levelInfo = (level: number) => levels[level - 1];
export const enemyCountForLevel = (level: number) =>
  levels[level - 1]?.enemyCount ?? 0;
export const stepMsForCircle = (circle: number) =>
  Math.max(
    minimumStepMs,
    baseStepMs - (Math.max(1, circle) - 1) * stepReductionPerCircleMs,
  );

function isTunnelPassage({ x, y }: Position) {
  return (
    (y === tunnelRow && (x === 0 || x === width - 1)) ||
    (x === verticalTunnelColumn && (y === 0 || y === height - 1))
  );
}

function itemsForLevel(level: number) {
  const items = new Set<number>();
  levels[level - 1]?.layout.forEach((row, y) => {
    [...row].forEach((tile, x) => {
      const position = { x, y };
      if (tile === "." && !isTunnelPassage(position))
        items.add(index(position));
    });
  });
  return items;
}

function actorsForLevel(level: number): Enemy[] {
  return enemySpawns.slice(0, enemyCountForLevel(level)).map((enemy) => ({
    ...enemy,
    position: { ...enemy.position },
  }));
}

export function createMaze(): Maze {
  return {
    player: { position: { x: 1, y: 1 }, direction: "up" },
    enemies: actorsForLevel(1),
    pending: null,
    items: itemsForLevel(1),
    golden: index(levels[0]!.golden),
    score: 0,
    lives: 5,
    status: "playing",
    notice: null,
    phase: "chase",
    paused: false,
    tick: 0,
    level: 1,
    circle: 1,
    goldenTicksLeft: 0,
    goldenMovesTaken: 0,
    graceTicksLeft: 0,
  };
}

export function destination(
  position: Position,
  direction: Direction,
  level = 1,
  playerCanUseTunnels = true,
) {
  const [dx, dy] = directions[direction];
  const next = { x: position.x + dx, y: position.y + dy };
  if (
    playerCanUseTunnels &&
    position.y === tunnelRow &&
    direction === "left" &&
    position.x === 0
  )
    next.x = width - 1;
  else if (
    playerCanUseTunnels &&
    position.y === tunnelRow &&
    direction === "right" &&
    position.x === width - 1
  )
    next.x = 0;
  else if (
    playerCanUseTunnels &&
    position.x === verticalTunnelColumn &&
    direction === "up" &&
    position.y === 0
  )
    next.y = height - 1;
  else if (
    playerCanUseTunnels &&
    position.x === verticalTunnelColumn &&
    direction === "down" &&
    position.y === height - 1
  )
    next.y = 0;
  if (
    !playerCanUseTunnels &&
    ((next.y === tunnelRow && (next.x === 0 || next.x === width - 1)) ||
      (next.x === verticalTunnelColumn &&
        (next.y === 0 || next.y === height - 1)))
  )
    return null;
  const tile = cell(next, level);
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

function reverse(direction: Direction): Direction {
  return opposites[direction];
}

function moveEnemy(enemy: Enemy, maze: Maze): Enemy {
  const candidates = (Object.keys(directions) as Direction[])
    .filter((direction) => direction !== reverse(enemy.direction))
    .map((direction) => ({
      direction,
      position: destination(enemy.position, direction, maze.level, false),
    }))
    .filter((move) => move.position !== null);
  const options =
    candidates.length > 0
      ? candidates
      : [
          {
            direction: reverse(enemy.direction),
            position: destination(
              enemy.position,
              reverse(enemy.direction),
              maze.level,
              false,
            ),
          },
        ].filter((move) => move.position !== null);
  if (options.length === 0) return enemy;
  const playerAhead = destination(
    maze.player.position,
    maze.player.direction,
    maze.level,
  );
  const interceptorTarget = playerAhead
    ? (destination(playerAhead, maze.player.direction, maze.level) ??
      playerAhead)
    : maze.player.position;
  const target =
    enemy.kind === "interceptor" ? interceptorTarget : maze.player.position;
  const distance = ({ position }: (typeof options)[number]) =>
    Math.abs(position!.x - target.x) + Math.abs(position!.y - target.y);
  const chosen =
    maze.phase === "rest" || maze.goldenTicksLeft > 0
      ? options.reduce((best, next) =>
          distance(next) > distance(best) ? next : best,
        )
      : enemy.kind === "patroller"
        ? options[0]!
        : options.reduce((best, next) =>
            distance(next) < distance(best) ? next : best,
          );
  return { ...enemy, position: chosen.position!, direction: chosen.direction };
}

function setupLevel(maze: Maze, level: number) {
  maze.level = level;
  maze.items = itemsForLevel(level);
  maze.enemies = actorsForLevel(level);
  maze.golden = index(levels[level - 1]!.golden);
  maze.tick = 0;
  maze.phase = "chase";
  maze.goldenMovesTaken = 0;
  maze.goldenTicksLeft = 0;
  maze.graceTicksLeft = respawnGraceTicks;
  maze.pending = null;
  maze.player = { position: { x: 1, y: 1 }, direction: "up" };
}

function loseLife(maze: Maze) {
  maze.lives -= 1;
  if (maze.lives === 0) {
    maze.status = "lost";
    return;
  }
  maze.player = { position: { x: 1, y: 1 }, direction: "up" };
  maze.enemies = actorsForLevel(maze.level);
  maze.pending = null;
  maze.tick = 0;
  maze.phase = "chase";
  maze.goldenTicksLeft = 0;
  maze.graceTicksLeft = respawnGraceTicks;
}

function collect(maze: Maze) {
  const playerIndex = index(maze.player.position);
  if (maze.golden === playerIndex) {
    maze.items.delete(playerIndex);
    maze.golden = null;
    maze.goldenMovesTaken = 0;
    maze.goldenTicksLeft = goldenTicks;
    maze.score += goldenScore;
  } else if (maze.items.delete(playerIndex)) {
    maze.score += fruitScore;
  }
  if (maze.items.size !== 0) return;
  if (maze.level === levelsCount) {
    maze.notice = "Круг пройден!";
    maze.score += circleBonus;
    maze.circle += 1;
    setupLevel(maze, 1);
  } else {
    maze.notice = "Карта пройдена!";
    setupLevel(maze, maze.level + 1);
  }
}

function expireGoldenIfMissed(maze: Maze) {
  if (maze.golden !== null && maze.goldenMovesTaken > goldenWindowMoves)
    maze.golden = null;
}

export function advance(maze: Maze) {
  if (maze.paused || maze.status !== "playing") return;
  maze.notice = null;
  maze.tick += 1;
  if (maze.tick % (restTicks * 4) === 0) maze.phase = "rest";
  else if (maze.tick % (restTicks * 4) === restTicks) maze.phase = "chase";

  const turn = maze.pending;
  const previousPlayerIndex = index(maze.player.position);
  const turnDestination =
    turn && destination(maze.player.position, turn.direction, maze.level);
  if (turn && turnDestination) {
    maze.player = { position: turnDestination, direction: turn.direction };
    maze.pending = null;
  } else {
    maze.player.position =
      destination(maze.player.position, maze.player.direction, maze.level) ??
      maze.player.position;
  }
  const playerMoved = index(maze.player.position) !== previousPlayerIndex;
  if (playerMoved && maze.golden !== null) maze.goldenMovesTaken += 1;

  if (maze.graceTicksLeft > 0) maze.graceTicksLeft -= 1;
  const playerIndex = index(maze.player.position);
  if (
    maze.graceTicksLeft === 0 &&
    maze.enemies.some((enemy) => playerIndex === index(enemy.position))
  ) {
    loseLife(maze);
    expireGoldenIfMissed(maze);
    return;
  }

  maze.enemies = maze.enemies.map((enemy) => {
    const position = enemy.position;
    const inTunnel =
      position.y === tunnelRow && (position.x <= 2 || position.x >= width - 3);
    return maze.tick % (inTunnel ? 4 : 2) === 0
      ? moveEnemy(enemy, maze)
      : enemy;
  });
  if (
    maze.graceTicksLeft === 0 &&
    maze.enemies.some((enemy) => playerIndex === index(enemy.position))
  ) {
    loseLife(maze);
    expireGoldenIfMissed(maze);
    return;
  }
  if (maze.goldenTicksLeft > 0) maze.goldenTicksLeft -= 1;
  collect(maze);
  expireGoldenIfMissed(maze);
}
