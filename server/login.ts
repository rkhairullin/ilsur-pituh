import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { games, renderCatalog, renderRating } from "./catalog.js";
import { createLeaderboard } from "./leaderboard.js";

type Player = { id: number; nickname: string };

declare module "fastify" {
  interface FastifyRequest {
    player: Player | null;
  }
}

export type LoginOptions = {
  password: string;
  databasePath: string;
  secureCookie: boolean;
};

const sessionDuration = 7 * 24 * 60 * 60;
const attemptWindow = 60_000;
const digest = (value: string) => createHash("sha256").update(value).digest();

const gamePath = "/ilsur-lovit-chleny/";
const instructionsPath = `${gamePath}instructions`;

const mazePath = "/maze/";

function safeReturnTo(value: unknown) {
  return value === gamePath || value === instructionsPath || value === mazePath
    ? value
    : "/";
}

function loginPage(
  reply: FastifyReply,
  status = 200,
  message = "",
  returnTo = "/",
) {
  return reply.status(status).type("text/html; charset=utf-8")
    .send(`<!doctype html>
<html lang="ru">
<head>
<link rel="icon" href="/icons/icon-192.png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="manifest" href="/icons/manifest.webmanifest">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ильсур - пИтух</title>
<link rel="stylesheet" href="/login/login.css">
</head>
<body>
<main class="login">
<h1>Ильсур - пИтух</h1>
<div class="login-stage">
<picture class="login-portrait">
<source media="(max-width: 900px)" srcset="/login/login-character-mobile.webp">
<img class="login-character" src="/login/login-character.webp" width="1194" height="1317" alt="Ильсур в образе петуха">
</picture>
<div class="login-panel">
${message ? `<p role="alert">${message}</p>` : ""}
<form method="post" action="/login">
<input type="hidden" name="returnTo" value="${returnTo}">
<label>Имя свое скажи, если ты мущщщщина <input name="nickname" autocomplete="username" required maxlength="32"></label>
<label>Пароль (знают все четкие пацаны) <input name="password" type="password" autocomplete="current-password" required maxlength="128"></label>
<button>Начать петушить</button>
</form>
</div>
</div>
</main>
</body>
</html>`);
}

export function registerLogin(app: FastifyInstance, options: LoginOptions) {
  mkdirSync(dirname(options.databasePath), { recursive: true });
  const database = new DatabaseSync(options.databasePath);
  app.addHook("onClose", async () => database.close());
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY,
      nickname TEXT NOT NULL,
      nickname_key TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
  `);
  const leaderboard = createLeaderboard(database);
  const savePlayer = database.prepare(`
    INSERT INTO players (nickname, nickname_key) VALUES (?, ?)
    ON CONFLICT(nickname_key) DO NOTHING
  `);
  const findPlayer = database.prepare(
    "SELECT id FROM players WHERE nickname_key = ?",
  );
  const saveSession = database.prepare("INSERT INTO sessions VALUES (?, ?, ?)");
  const findSession = database.prepare(`
    SELECT players.id, players.nickname FROM sessions
    JOIN players ON players.id = sessions.player_id
    WHERE token_hash = ? AND expires_at > ?
  `);
  const deleteSession = database.prepare(
    "DELETE FROM sessions WHERE token_hash = ?",
  );
  const deleteExpired = database.prepare(
    "DELETE FROM sessions WHERE expires_at <= ?",
  );
  const expectedPassword = digest(options.password);
  const cookie = "game_session=";
  const cookieFlags = `; Path=/; HttpOnly; SameSite=Strict${options.secureCookie ? "; Secure" : ""}`;
  const failures = new Map<string, number>();
  let resetAt = 0;

  function sessionHash(request: FastifyRequest) {
    const token = request.headers.cookie?.match(
      /(?:^|;\s*)game_session=([a-f0-9]{64})(?:;|$)/,
    )?.[1];
    return token ? digest(token).toString("hex") : "";
  }

  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string", bodyLimit: 2048 },
    (_request, body, done) => {
      done(null, new URLSearchParams(String(body)));
    },
  );

  app.decorateRequest("player", null);
  app.addHook("onRequest", async (request, reply) => {
    if (request.routeOptions.url === "/api/health") return;
    const path = request.url.replace(/\?.*$/, "");
    const api =
      path.startsWith("/api/") || request.routeOptions.url?.startsWith("/api/");
    if (
      path === "/login" ||
      path === "/logout" ||
      path === "/" ||
      path === "/index.html" ||
      path === gamePath ||
      path === instructionsPath ||
      api
    ) {
      reply.header("Cache-Control", "no-store");
    }
    if (
      (path === "/login" || path === "/logout") &&
      request.method === "POST" &&
      request.headers["sec-fetch-site"] === "cross-site"
    ) {
      return reply.code(403).send();
    }
    if (api) {
      const player = findSession.get(sessionHash(request), Date.now()) as
        Player | undefined;
      if (!player) return reply.code(401).send({ error: "Требуется вход" });
      request.player = player;
    }
  });

  async function catalog(request: FastifyRequest, reply: FastifyReply) {
    const player = findSession.get(sessionHash(request), Date.now()) as
      { nickname: string } | undefined;
    if (!player) return reply.redirect("/login");
    return reply
      .type("text/html; charset=utf-8")
      .send(
        renderCatalog(player.nickname, (id) => leaderboard.ranking(id, 5).top),
      );
  }

  async function game(request: FastifyRequest, reply: FastifyReply) {
    const player = findSession.get(sessionHash(request), Date.now()) as
      { nickname: string } | undefined;
    if (!player)
      return reply.redirect(`/login?returnTo=${encodeURIComponent(gamePath)}`);
    const template = await readFile(
      new URL("../client/games/ilsur-lovit-chleny/index.html", import.meta.url),
      "utf8",
    );
    const nickname = player.nickname.replace(
      /[&<>"']/g,
      (character) => `&#${character.charCodeAt(0)};`,
    );
    return reply
      .type("text/html; charset=utf-8")
      .send(template.replace("<!-- player nickname -->", () => nickname));
  }
  app.get("/", catalog);
  app.get("/index.html", catalog);
  app.get(gamePath, game);
  app.get(mazePath, async (request, reply) => {
    if (!findSession.get(sessionHash(request), Date.now())) {
      return reply.redirect(`/login?returnTo=${encodeURIComponent(mazePath)}`);
    }
    const template = await readFile(
      new URL("../client/games/maze/index.html", import.meta.url),
      "utf8",
    );
    return reply.type("text/html; charset=utf-8").send(template);
  });
  app.get(instructionsPath, async (request, reply) => {
    if (!findSession.get(sessionHash(request), Date.now())) {
      return reply.redirect(
        `/login?returnTo=${encodeURIComponent(instructionsPath)}`,
      );
    }
    const template = await readFile(
      new URL(
        "../client/games/ilsur-lovit-chleny/instructions.html",
        import.meta.url,
      ),
      "utf8",
    );
    return reply.type("text/html; charset=utf-8").send(template);
  });
  for (const entry of games) {
    app.get(`${entry.href}rating`, async (request, reply) => {
      reply.header("Cache-Control", "no-store");
      const player = findSession.get(sessionHash(request), Date.now()) as
        { id: number } | undefined;
      if (!player) return reply.redirect("/login");
      const ranking = leaderboard.ranking(entry.id, 20, player.id);
      return reply
        .type("text/html; charset=utf-8")
        .send(
          renderRating(
            entry,
            ranking.top,
            ranking.personal,
            leaderboard.totals(entry.id, player.id),
            leaderboard.latest(entry.id, player.id),
          ),
        );
    });

    app.post<{
      Params: { key: string };
      Body: { score?: unknown; caught?: unknown };
    }>(
      `/api/games/${entry.id}/rounds/:key`,
      { bodyLimit: 1024 },
      async (request, reply) => {
        const session = sessionHash(request);
        const player = request.player!;
        const { key } = request.params;
        if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(key)) {
          return reply
            .code(400)
            .send({ error: "Неверный идентификатор партии" });
        }
        const body = request.body;
        if (!body || typeof body !== "object" || Array.isArray(body)) {
          return reply.code(400).send({ error: "Неверные данные партии" });
        }
        if (Object.keys(body).length === 0) {
          return leaderboard.start(entry.id, key, player.id, session)
            ? reply.code(204).send()
            : reply.code(409).send({ error: "Партия недоступна" });
        }
        const { score, caught } = body;
        if (
          typeof score !== "number" ||
          typeof caught !== "number" ||
          !Number.isSafeInteger(score) ||
          !Number.isSafeInteger(caught) ||
          score % 10 !== 0 ||
          caught < 0 ||
          caught > 1_000_000 ||
          score < caught * 10 ||
          score > caught * 50
        ) {
          return reply.code(400).send({ error: "Неверный результат партии" });
        }
        return leaderboard.finish(
          entry.id,
          key,
          player.id,
          session,
          score,
          caught,
        )
          ? reply.code(204).send()
          : reply
              .code(409)
              .send({ error: "Партия недоступна или результат уже записан" });
      },
    );
  }
  app.get("/login", async (request, reply) => {
    const query = request.query as { returnTo?: string };
    const returnTo = safeReturnTo(query.returnTo);
    return findSession.get(sessionHash(request), Date.now())
      ? reply.redirect(returnTo)
      : loginPage(reply, 200, "", returnTo);
  });
  app.post("/login", async (request, reply) => {
    const now = Date.now();
    if (now >= resetAt) {
      failures.clear();
      resetAt = now + attemptWindow;
    }
    const failed = failures.get(request.ip) ?? 0;
    if (failed >= 10) {
      reply.header("Retry-After", String(Math.ceil((resetAt - now) / 1000)));
      const form = request.body;
      const returnTo = safeReturnTo(
        form instanceof URLSearchParams ? form.get("returnTo") : undefined,
      );
      return loginPage(
        reply,
        429,
        "Слишком много попыток. Попробуйте позже.",
        returnTo,
      );
    }
    const form = request.body;
    const returnTo = safeReturnTo(
      form instanceof URLSearchParams ? form.get("returnTo") : undefined,
    );
    const nickname =
      form instanceof URLSearchParams
        ? (form.get("nickname") ?? "").trim().normalize("NFC")
        : "";
    const password =
      form instanceof URLSearchParams ? (form.get("password") ?? "") : "";
    if (
      !nickname ||
      nickname.length > 32 ||
      /[\p{Cc}\p{Cf}]/u.test(nickname) ||
      !password ||
      password.length > 128
    ) {
      return loginPage(
        reply,
        400,
        "Введите ник длиной до 32 символов и общий пароль.",
        returnTo,
      );
    }
    if (!timingSafeEqual(digest(password), expectedPassword)) {
      failures.set(request.ip, failed + 1);
      return loginPage(reply, 401, "Неверный пароль, натурал чертов", returnTo);
    }
    const key = nickname.toLowerCase().normalize("NFC");
    savePlayer.run(nickname, key);
    const player = findPlayer.get(key) as { id: number };
    const token = randomBytes(32).toString("hex");
    deleteExpired.run(now);
    deleteSession.run(sessionHash(request));
    saveSession.run(
      digest(token).toString("hex"),
      player.id,
      now + sessionDuration * 1000,
    );
    return reply
      .header(
        "Set-Cookie",
        `${cookie}${token}${cookieFlags}; Max-Age=${sessionDuration}`,
      )
      .redirect(returnTo, 303);
  });
  app.get("/api/session", async (request) => request.player);
  app.post("/logout", async (request, reply) => {
    deleteSession.run(sessionHash(request));
    return reply
      .header("Set-Cookie", `${cookie}${cookieFlags}; Max-Age=0`)
      .redirect("/login", 303);
  });
}
