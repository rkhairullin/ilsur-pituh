import type { DatabaseSync } from "node:sqlite";

export type RecordEntry = {
  place: number;
  nickname: string;
  score: number;
  caught: number;
  finishedAt: number;
};

export function createLeaderboard(database: DatabaseSync) {
  database.exec(`
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS game_rounds (
      id INTEGER PRIMARY KEY,
      game TEXT NOT NULL,
      round_key TEXT NOT NULL,
      player_id INTEGER NOT NULL REFERENCES players(id),
      session_hash TEXT NOT NULL,
      score INTEGER,
      caught INTEGER,
      finished_at INTEGER,
      UNIQUE (game, round_key)
    );
    CREATE INDEX IF NOT EXISTS game_rounds_rank
      ON game_rounds (game, player_id, score DESC, caught DESC, finished_at, id)
      WHERE finished_at IS NOT NULL;
  `);
  const start = database.prepare(`
    INSERT INTO game_rounds (game, round_key, player_id, session_hash)
    VALUES (?, ?, ?, ?) ON CONFLICT (game, round_key) DO NOTHING
  `);
  const owner = database.prepare(`
    SELECT 1 FROM game_rounds
    WHERE game = ? AND round_key = ? AND player_id = ? AND session_hash = ?
  `);
  const finish = database.prepare(`
    UPDATE game_rounds SET score = ?, caught = ?, finished_at = ?
    WHERE game = ? AND round_key = ? AND player_id = ? AND session_hash = ?
      AND finished_at IS NULL
  `);
  const submitted = database.prepare(`
    SELECT score, caught FROM game_rounds
    WHERE game = ? AND round_key = ? AND player_id = ? AND session_hash = ?
  `);
  const rankings = database.prepare(`
    WITH personal AS (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY player_id ORDER BY score DESC, caught DESC, finished_at, id
      ) AS result_number
      FROM game_rounds WHERE game = ? AND finished_at IS NOT NULL
    ), ranked AS (
      SELECT ROW_NUMBER() OVER (ORDER BY score DESC, caught DESC, finished_at, personal.id) AS place,
        players.nickname, player_id AS playerId, score, caught, finished_at AS finishedAt
      FROM personal JOIN players ON players.id = personal.player_id
      WHERE result_number = 1
    )
    SELECT * FROM ranked WHERE place <= ? OR playerId = ? ORDER BY place
  `);
  const latest = database.prepare(`
    SELECT score, caught FROM game_rounds
    WHERE game = ? AND player_id = ? AND finished_at IS NOT NULL
    ORDER BY finished_at DESC, id DESC LIMIT 1
  `);
  const totals = database.prepare(`
    SELECT COUNT(*) AS games, COALESCE(SUM(score), 0) AS score,
      COALESCE(SUM(caught), 0) AS caught
    FROM game_rounds WHERE game = ? AND player_id = ? AND finished_at IS NOT NULL
  `);

  return {
    start(game: string, key: string, player: number, session: string) {
      start.run(game, key, player, session);
      return Boolean(owner.get(game, key, player, session));
    },
    finish(
      game: string,
      key: string,
      player: number,
      session: string,
      score: number,
      caught: number,
    ) {
      finish.run(score, caught, Date.now(), game, key, player, session);
      const saved = submitted.get(game, key, player, session);
      return saved?.score === score && saved?.caught === caught;
    },
    ranking(game: string, limit: number, player = 0) {
      const rows = rankings.all(game, limit, player) as Array<
        RecordEntry & { playerId: number }
      >;
      return {
        top: rows.slice(0, limit),
        personal: rows.find((row) => row.playerId === player),
      };
    },
    latest(game: string, player: number) {
      return latest.get(game, player) as
        Pick<RecordEntry, "score" | "caught"> | undefined;
    },
    totals(game: string, player: number) {
      return totals.get(game, player) as {
        games: number;
        score: number;
        caught: number;
      };
    },
  };
}
