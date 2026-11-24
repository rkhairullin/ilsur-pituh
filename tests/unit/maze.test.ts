import { describe, expect, it } from "vitest";
import {
  advance,
  cancelTurn,
  createMaze,
  destination,
  directions,
  index,
  requestTurn,
  width,
  tunnelRow,
  type Direction,
} from "../../client/games/maze/maze.js";

describe("maze prototype", () => {
  it("connects every collectible to the starting position", () => {
    const maze = createMaze();
    const queue = [maze.player.position];
    const visited = new Set([index(maze.player.position)]);
    for (const position of queue) {
      for (const direction of Object.keys(directions) as Direction[]) {
        const next = destination(position, direction);
        if (next && !visited.has(index(next))) {
          visited.add(index(next));
          queue.push(next);
        }
      }
    }
    expect([...maze.items].every((item) => visited.has(item))).toBe(true);
  });

  it("blocks walls, moves continuously, buffers a turn and collects a tile once", () => {
    const maze = createMaze();
    advance(maze);
    expect(maze.player.position).toEqual({ x: 1, y: 1 });
    requestTurn(maze, "right", -1);
    advance(maze);
    requestTurn(maze, "down", -1);
    advance(maze);
    expect(maze.player.position).toEqual({ x: 3, y: 1 });
    expect(maze.pending?.direction).toBe("down");
    advance(maze);
    advance(maze);
    expect(maze.player.position).toEqual({ x: 4, y: 2 });
    expect(maze.score).toBe(40);
    requestTurn(maze, "up", -1);
    advance(maze);
    expect(maze.score).toBe(40);
    expect(maze.pending).toBeNull();
  });

  it("pauses the clock and only cancels the matching touch", () => {
    const maze = createMaze();
    requestTurn(maze, "right", 1);
    requestTurn(maze, "down", 2);
    cancelTurn(maze, 1);
    expect(maze.pending?.source).toBe(2);
    cancelTurn(maze, 2);
    expect(maze.pending).toBeNull();
    maze.paused = true;
    requestTurn(maze, "right", 1);
    advance(maze);
    expect(maze.tick).toBe(0);
    expect(maze.pending).toBeNull();
  });

  it.each([
    ["left", 0, width - 1],
    ["right", width - 1, 0],
  ] as const)(
    "preserves both actors' %s direction through the tunnel",
    (direction, from, to) => {
      const maze = createMaze();
      maze.player = { position: { x: from, y: tunnelRow }, direction };
      const enemyMaze = createMaze();
      enemyMaze.enemy = { position: { x: from, y: tunnelRow }, direction };
      enemyMaze.tick = 3;
      advance(maze);
      advance(enemyMaze);
      expect(maze.player).toEqual({
        position: { x: to, y: tunnelRow },
        direction,
      });
      expect(enemyMaze.enemy).toEqual({
        position: { x: to, y: tunnelRow },
        direction,
      });
    },
  );

  it("slows the enemy in the tunnel and restores its pace on exit", () => {
    const maze = createMaze();
    maze.enemy = { position: { x: 2, y: tunnelRow }, direction: "right" };
    advance(maze);
    advance(maze);
    expect(maze.enemy.position).toEqual({ x: 2, y: tunnelRow });
    advance(maze);
    advance(maze);
    expect(maze.enemy.position).toEqual({ x: 2, y: tunnelRow - 1 });
    advance(maze);
    expect(maze.enemy.position).toEqual({ x: 2, y: tunnelRow - 1 });
    advance(maze);
    expect(maze.enemy.position).toEqual({ x: 1, y: tunnelRow - 1 });
  });

  it("detects collisions at both tunnel entrances and preserves progress until the final life", () => {
    const maze = createMaze();
    requestTurn(maze, "right", -1);
    advance(maze);
    for (const [life, direction, from, to] of [
      [2, "left", 0, width - 1],
      [1, "right", width - 1, 0],
      [0, "left", 2, 1],
    ] as const) {
      maze.player = { position: { x: from, y: tunnelRow }, direction };
      maze.enemy.position = { x: to, y: tunnelRow };
      advance(maze);
      expect(maze.lives).toBe(life);
      expect(maze.score).toBe(10);
      expect(maze.items.has(index({ x: 2, y: 1 }))).toBe(false);
      if (life > 0) expect(maze.player.position).toEqual({ x: 1, y: 1 });
    }
    expect(maze.status).toBe("lost");
    requestTurn(maze, "down", -1);
    advance(maze);
    expect(maze.lives).toBe(0);
  });

  it("detects an enemy moving onto the player", () => {
    const maze = createMaze();
    maze.player = { position: { x: 0, y: tunnelRow }, direction: "up" };
    maze.enemy = {
      position: { x: width - 1, y: tunnelRow },
      direction: "right",
    };
    maze.tick = 3;
    advance(maze);
    expect(maze.lives).toBe(2);
  });

  it("finishes immediately after the final collectible", () => {
    const maze = createMaze();
    maze.items = new Set([index({ x: 2, y: 1 })]);
    requestTurn(maze, "right", -1);
    advance(maze);
    expect(maze.status).toBe("won");
    expect(maze.score).toBe(10);
    advance(maze);
    expect(maze.player.position).toEqual({ x: 2, y: 1 });
  });

  it("allows the enemy to reverse at a dead end", () => {
    const maze = createMaze();
    maze.enemy = { position: { x: 7, y: 1 }, direction: "up" };
    maze.tick = 1;
    advance(maze);
    expect(maze.enemy.direction).toBe("down");
  });
});
