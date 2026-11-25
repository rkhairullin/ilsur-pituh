import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import { createLeaderboard } from "../../server/leaderboard.js";

test("limits the ranking, returns a personal place outside the top, and isolates games", () => {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec(
      "CREATE TABLE players (id INTEGER PRIMARY KEY, nickname TEXT)",
    );
    const insert = database.prepare(
      "INSERT INTO players VALUES (?, ?) ON CONFLICT DO NOTHING",
    );
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
    expect(board.latest("arcade", 22)).toEqual({
      score: 10,
      caught: 1,
      circle: 1,
      round: 1,
    });
    board.finish("arcade", "later", 22, "session", 0, 0);
    expect(board.latest("arcade", 22)).toEqual({
      score: 0,
      caught: 0,
      circle: 1,
      round: 1,
    });
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

test("ranks Packman by catches, then circle, then round, and keeps the best run per player", () => {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec(
      "CREATE TABLE players (id INTEGER PRIMARY KEY, nickname TEXT)",
    );
    const insert = database.prepare(
      "INSERT INTO players VALUES (?, ?) ON CONFLICT DO NOTHING",
    );
    const board = createLeaderboard(database);
    const save = (
      player: number,
      key: string,
      caught: number,
      circle: number,
      round: number,
    ) => {
      insert.run(player, `Player ${player}`);
      board.start("ilsur-pacman", key, player, "session");
      expect(
        board.finish(
          "ilsur-pacman",
          key,
          player,
          "session",
          null,
          caught,
          circle,
          round,
        ),
      ).toBe(true);
    };
    save(1, "first", 30, 1, 7);
    save(2, "second", 30, 2, 1);
    save(3, "third", 31, 1, 1);
    save(1, "best", 30, 2, 2);
    const ranking = board.ranking("ilsur-pacman", 5, 2);
    expect(
      ranking.top.map(({ playerId, place, circle, round }) => ({
        playerId,
        place,
        circle,
        round,
      })),
    ).toEqual([
      { playerId: 3, place: 1, circle: 1, round: 1 },
      { playerId: 1, place: 2, circle: 2, round: 2 },
      { playerId: 2, place: 3, circle: 2, round: 1 },
    ]);
    expect(ranking.personal).toMatchObject({
      place: 3,
      caught: 30,
      circle: 2,
      round: 1,
    });
    expect(board.latest("ilsur-pacman", 1)).toMatchObject({
      caught: 30,
      circle: 2,
      round: 2,
      score: null,
    });
  } finally {
    database.close();
  }
});

test("adds progress columns when opening an existing leaderboard database", () => {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY, nickname TEXT);
      CREATE TABLE game_rounds (
        id INTEGER PRIMARY KEY, game TEXT NOT NULL, round_key TEXT NOT NULL,
        player_id INTEGER NOT NULL REFERENCES players(id), session_hash TEXT NOT NULL,
        score INTEGER, caught INTEGER, finished_at INTEGER,
        UNIQUE (game, round_key)
      );`);
    const board = createLeaderboard(database);
    database.prepare("INSERT INTO players VALUES (1, 'Legacy')").run();
    board.start("ilsur-pacman", "new", 1, "session");
    expect(
      board.finish("ilsur-pacman", "new", 1, "session", null, 2, 1, 3),
    ).toBe(true);
    expect(board.ranking("ilsur-pacman", 5).top[0]).toMatchObject({
      circle: 1,
      round: 3,
    });
  } finally {
    database.close();
  }
});
