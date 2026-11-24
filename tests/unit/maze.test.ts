import { describe, expect, it } from "vitest";
import {
  advance,
  cancelTurn,
  cell,
  circleBonus,
  createMaze,
  destination,
  directions,
  enemyCountForLevel,
  goldenScore,
  goldenTicks,
  goldenWindowMoves,
  height,
  index,
  levelInfo,
  levelsCount,
  minimumStepMs,
  requestTurn,
  respawnGraceTicks,
  restTicks,
  stepMsForCircle,
  tunnelRow,
  width,
  type Direction,
} from "../../client/games/maze/maze.js";

describe("seven-map maze", () => {
  it("has seven connected maps with reachable items, golden fruit and valid spawns", () => {
    for (let level = 1; level <= levelsCount; level += 1) {
      const definition = levelInfo(level)!;
      const queue = [{ x: 1, y: 1 }];
      const visited = new Set([index(queue[0]!)]);
      for (const position of queue) {
        for (const direction of Object.keys(directions) as Direction[]) {
          const next = destination(position, direction, level);
          if (next && !visited.has(index(next))) {
            visited.add(index(next));
            queue.push(next);
          }
        }
      }
      const itemCells = definition.layout.flatMap((row, y) =>
        [...row].flatMap((tile, x) => (tile === "." ? [index({ x, y })] : [])),
      );
      expect(itemCells.every((item) => visited.has(item))).toBe(true);
      expect(visited.has(index(definition.golden))).toBe(true);
      expect(enemyCountForLevel(level)).toBe([1, 2, 3, 3, 3, 3, 4][level - 1]);
      const spawnPoints = [
        { x: 9, y: 7 },
        { x: 9, y: 5 },
        { x: 7, y: 9 },
        { x: 7, y: 5 },
      ];
      expect(
        spawnPoints
          .slice(0, enemyCountForLevel(level))
          .every((position) => cell(position, level) === "."),
      ).toBe(true);
      expect(definition.layout).toHaveLength(height);
    }
    expect(levelInfo(0)).toBeUndefined();
    expect(cell({ x: 1, y: 1 }, levelsCount + 1)).toBeUndefined();
    expect(enemyCountForLevel(0)).toBe(0);
    expect(enemyCountForLevel(levelsCount + 1)).toBe(0);
  });

  it("hides each golden fruit at a farthest point reachable within its 20-move window", () => {
    for (let level = 1; level <= levelsCount; level += 1) {
      const definition = levelInfo(level)!;
      const start = { x: 1, y: 1 };
      const distances = new Map([[index(start), 0]]);
      const queue = [start];
      for (const position of queue) {
        const distance = distances.get(index(position))!;
        for (const direction of Object.keys(directions) as Direction[]) {
          const next = destination(position, direction, level);
          if (next && !distances.has(index(next))) {
            distances.set(index(next), distance + 1);
            queue.push(next);
          }
        }
      }
      const farthest = Math.max(...distances.values());
      expect(distances.get(index(definition.golden))).toBe(farthest);
      expect(farthest).toBeLessThanOrEqual(goldenWindowMoves);
      expect(
        definition.layout[definition.golden.y]?.[definition.golden.x],
      ).toBe(".");
    }
  });

  it("keeps speed fixed within a circle and caps later increases", () => {
    expect(stepMsForCircle(0)).toBe(280);
    expect(stepMsForCircle(1)).toBe(280);
    expect(stepMsForCircle(2)).toBe(260);
    expect(stepMsForCircle(5)).toBe(minimumStepMs);
    expect(stepMsForCircle(10_000)).toBe(minimumStepMs);
  });

  it("blocks walls, buffers turns, collects each item once and cancels matching input", () => {
    const maze = createMaze();
    expect(maze.enemies).toHaveLength(1);
    expect(destination({ x: 1, y: 1 }, "up")).toBeNull();
    advance(maze);
    expect(maze.player.position).toEqual({ x: 1, y: 1 });
    requestTurn(maze, "right", 1);
    requestTurn(maze, "down", 2);
    cancelTurn(maze, 1);
    expect(maze.pending?.source).toBe(2);
    cancelTurn(maze, 2);
    expect(maze.pending).toBeNull();
    requestTurn(maze, "right", -1);
    advance(maze);
    expect(maze.player.position).toEqual({ x: 2, y: 1 });
    expect(maze.score).toBe(1);
    requestTurn(maze, "up", -1);
    advance(maze);
    expect(maze.pending?.direction).toBe("up");
    expect(maze.score).toBe(2);
  });

  it.each([
    ["left", 0, width - 1],
    ["right", width - 1, 0],
  ] as const)(
    "preserves %s movement through the side tunnel",
    (direction, from, to) => {
      const maze = createMaze();
      maze.player = { position: { x: from, y: tunnelRow }, direction };
      maze.graceTicksLeft = 1;
      advance(maze);
      expect(maze.player).toEqual({
        position: { x: to, y: tunnelRow },
        direction,
      });
    },
  );

  it("allows players to wrap vertically while enemies cannot enter edge tunnels", () => {
    expect(destination({ x: 5, y: 0 }, "up")).toEqual({ x: 5, y: 14 });
    expect(destination({ x: 5, y: 14 }, "down")).toEqual({ x: 5, y: 0 });
    expect(destination({ x: 5, y: 1 }, "up", 1, false)).toBeNull();
    expect(destination({ x: 1, y: tunnelRow }, "left", 1, false)).toBeNull();
  });

  it("leaves all tunnel passage cells free of score items on every map", () => {
    const maze = createMaze();
    const passageCells = [
      { x: 0, y: tunnelRow },
      { x: width - 1, y: tunnelRow },
      { x: 5, y: 0 },
      { x: 5, y: height - 1 },
    ];
    for (let level = 1; level <= levelsCount; level += 1) {
      for (const position of passageCells)
        expect(maze.items.has(index(position))).toBe(false);
      maze.items.clear();
      maze.player = { position: { x: 1, y: 1 }, direction: "up" };
      advance(maze);
    }
  });

  it("slows enemy movement in the tunnel and moves pursuers outside it", () => {
    const maze = createMaze();
    maze.enemies = [
      { position: { x: 2, y: tunnelRow }, direction: "right", kind: "pursuer" },
      { position: { x: 7, y: 1 }, direction: "up", kind: "patroller" },
      { position: { x: 7, y: 9 }, direction: "left", kind: "interceptor" },
    ];
    maze.graceTicksLeft = 5;
    advance(maze);
    advance(maze);
    expect(maze.enemies[0]!.position).toEqual({ x: 2, y: tunnelRow });
    const previous = maze.enemies[1]!.position;
    advance(maze);
    advance(maze);
    expect(maze.enemies[0]!.position).not.toEqual({ x: 2, y: tunnelRow });
    expect(maze.enemies[1]!.position).not.toEqual(previous);
  });

  it("only removes a life on same-cell contact with an enemy", () => {
    const maze = createMaze();
    maze.enemies = [
      { position: { x: 3, y: 1 }, direction: "left", kind: "pursuer" },
    ];
    requestTurn(maze, "right", -1);
    advance(maze);
    expect(maze.player.position).toEqual({ x: 2, y: 1 });
    expect(maze.enemies[0]!.position).toEqual({ x: 3, y: 1 });
    expect(maze.lives).toBe(5);
    advance(maze);
    expect(maze.player.position).toEqual({ x: 1, y: 1 });
    expect(maze.lives).toBe(4);
  });

  it("uses visible rest periods to send enemies away from the player", () => {
    const maze = createMaze();
    maze.graceTicksLeft = 100;
    for (let tick = 0; tick < restTicks * 4; tick += 1) advance(maze);
    expect(maze.phase).toBe("rest");
    for (let tick = 0; tick < restTicks; tick += 1) advance(maze);
    expect(maze.phase).toBe("chase");
  });

  it("collects golden fruit for a timed distraction and bonus", () => {
    const maze = createMaze();
    maze.golden = index({ x: 2, y: 1 });
    maze.items = new Set([
      index({ x: 2, y: 1 }),
      index({ x: 3, y: 1 }),
      index({ x: 4, y: 1 }),
    ]);
    requestTurn(maze, "right", -1);
    advance(maze);
    expect(maze.score).toBe(goldenScore);
    expect(maze.golden).toBeNull();
    expect(maze.goldenMovesTaken).toBe(0);
    expect(maze.goldenTicksLeft).toBe(goldenTicks);
    advance(maze);
    expect(maze.goldenTicksLeft).toBe(goldenTicks - 1);
    maze.paused = true;
    const tick = maze.tick;
    advance(maze);
    expect(maze.tick).toBe(tick);
  });

  it("keeps the golden fruit through 20 moves and turns it ordinary after move 21", () => {
    const maze = createMaze();
    maze.enemies = [];
    maze.graceTicksLeft = goldenWindowMoves + 1;
    const golden = maze.golden!;
    expect(maze.items.has(golden)).toBe(true);
    for (let tick = 0; tick < 40; tick += 1) advance(maze);
    expect(maze.golden).toBe(golden);
    expect(maze.goldenMovesTaken).toBe(0);
    for (let move = 0; move < goldenWindowMoves; move += 1) {
      requestTurn(maze, move % 2 === 0 ? "right" : "left", -1);
      advance(maze);
    }
    expect(maze.golden).toBe(golden);
    expect(maze.goldenMovesTaken).toBe(goldenWindowMoves);
    requestTurn(maze, "right", -1);
    advance(maze);
    expect(maze.golden).toBeNull();
    expect(maze.items.has(golden)).toBe(true);
    maze.player = { position: { x: 7, y: 8 }, direction: "down" };
    advance(maze);
    expect(maze.score).toBe(2);
    expect(maze.items.has(golden)).toBe(false);
  });

  it("moves through seven maps and awards the circle bonus only on 7 to 1", () => {
    const maze = createMaze();
    const openingSpeed = stepMsForCircle(maze.circle);
    for (let level = 1; level < levelsCount; level += 1) {
      maze.items = new Set([index({ x: 2, y: 1 })]);
      requestTurn(maze, "right", -1);
      advance(maze);
      expect(maze.level).toBe(level + 1);
      expect(maze.circle).toBe(1);
      expect(stepMsForCircle(maze.circle)).toBe(openingSpeed);
      expect(maze.enemies).toHaveLength(enemyCountForLevel(level + 1));
      expect(maze.items.size).toBeGreaterThan(1);
      expect(maze.golden).toBe(index(levelInfo(level + 1)!.golden));
      expect(maze.goldenMovesTaken).toBe(0);
      expect(maze.graceTicksLeft).toBe(respawnGraceTicks);
    }
    maze.items = new Set([index({ x: 2, y: 1 })]);
    maze.score = 100;
    maze.lives = 2;
    requestTurn(maze, "right", -1);
    advance(maze);
    expect(maze.level).toBe(1);
    expect(maze.circle).toBe(2);
    expect(stepMsForCircle(maze.circle)).toBe(260);
    expect(maze.score).toBe(101 + circleBonus);
    expect(maze.lives).toBe(2);
    expect(maze.enemies).toHaveLength(1);
    expect(maze.items.size).toBeGreaterThan(1);
    expect(maze.golden).toBe(index(levelInfo(1)!.golden));
    expect(maze.goldenMovesTaken).toBe(0);
  });

  it("removes one life on collision, preserves progress, then ends after the last life", () => {
    const maze = createMaze();
    maze.items.delete(index({ x: 2, y: 1 }));
    maze.score = 70;
    maze.enemies[0]!.position = { x: 2, y: 1 };
    requestTurn(maze, "right", -1);
    advance(maze);
    expect(maze.lives).toBe(4);
    expect(maze.score).toBe(70);
    expect(maze.items.has(index({ x: 2, y: 1 }))).toBe(false);
    expect(maze.player.position).toEqual({ x: 1, y: 1 });
    expect(maze.graceTicksLeft).toBe(respawnGraceTicks);
    maze.graceTicksLeft = 0;
    maze.enemies.forEach((enemy) => (enemy.position = { x: 2, y: 1 }));
    maze.player.direction = "right";
    maze.lives = 1;
    advance(maze);
    expect(maze.lives).toBe(0);
    expect(maze.status).toBe("lost");
    const tick = maze.tick;
    requestTurn(maze, "down", -1);
    advance(maze);
    expect(maze.tick).toBe(tick);
  });

  it("catches an enemy that moves onto the player", () => {
    const maze = createMaze();
    maze.player = { position: { x: 2, y: 1 }, direction: "up" };
    maze.enemies = [
      { position: { x: 2, y: 2 }, direction: "up", kind: "pursuer" },
    ];
    maze.graceTicksLeft = 1;
    maze.tick = 1;
    advance(maze);
    expect(maze.lives).toBe(4);
    expect(maze.player.position).toEqual({ x: 1, y: 1 });
  });

  it("supports reversing at a dead end without an available forward path", () => {
    const maze = createMaze();
    maze.enemies = [
      { position: { x: 7, y: 1 }, direction: "up", kind: "pursuer" },
    ];
    maze.graceTicksLeft = 10;
    maze.tick = 1;
    advance(maze);
    expect(maze.enemies[0]!.direction).toBe("down");
  });

  it("keeps an enemy in place when it has no valid adjacent tile", () => {
    const maze = createMaze();
    maze.enemies = [
      { position: { x: 99, y: 99 }, direction: "up", kind: "pursuer" },
    ];
    maze.graceTicksLeft = 10;
    maze.tick = 1;
    advance(maze);
    expect(maze.enemies[0]!.position).toEqual({ x: 99, y: 99 });
  });
});
