import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import { createLeaderboard } from "../../server/leaderboard.js";

test("limits the ranking, returns a personal place outside the top, and isolates games", () => {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec(
      "CREATE TABLE players (id INTEGER PRIMARY KEY, nickname TEXT)",
    );
    const insert = database.prepare("INSERT INTO players VALUES (?, ?)");
    const board = createLeaderboard(database);
    for (let player = 1; player <= 22; player++) {
      insert.run(player, `Player ${player}`);
      board.start("arcade", String(player), player, "session");
      board.finish(
        "arcade",
        String(player),
        player,
        "session",
        (23 - player) * 10,
        1,
      );
    }
    board.start("other", "22", 22, "session");
    board.finish("other", "22", 22, "session", 50, 2);
    expect(board.ranking("arcade", 5).top.map(({ place }) => place)).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(board.ranking("arcade", 20, 22)).toMatchObject({
      personal: { place: 22, score: 10 },
    });
    expect(board.ranking("arcade", 20, 22).top).toHaveLength(20);
    expect(board.ranking("other", 5, 22)).toMatchObject({
      top: [{ place: 1, score: 50 }],
    });
    board.start("arcade", "later", 22, "session");
    expect(board.latest("arcade", 22)).toEqual({ score: 10, caught: 1 });
    board.finish("arcade", "later", 22, "session", 0, 0);
    expect(board.latest("arcade", 22)).toEqual({ score: 0, caught: 0 });
    expect(board.latest("empty", 22)).toBeUndefined();
    expect(board.ranking("arcade", 20, 22).personal?.score).toBe(10);
    expect(board.totals("other", 22)).toEqual({
      games: 1,
      score: 50,
      caught: 2,
    });
    expect(board.ranking("empty", 20)).toEqual({
      top: [],
      personal: undefined,
    });
  } finally {
    database.close();
  }
});
