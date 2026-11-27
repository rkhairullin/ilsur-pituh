import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { createApp } from "../../server/app.js";
import { readLoginConfig } from "../../server/config.js";

const options = {
  password: "ПаРоль",
  databasePath: ":memory:",
  secureCookie: false,
};
const apps: ReturnType<typeof createApp>[] = [];
function makeApp(overrides = {}) {
  const app = createApp({ ...options, ...overrides });
  apps.push(app);
  return app;
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  vi.restoreAllMocks();
});

function enter(
  app: ReturnType<typeof createApp>,
  nickname: string,
  password = options.password,
  cookie = "",
) {
  return app.inject({
    method: "POST",
    url: "/login",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie },
    payload: new URLSearchParams({ nickname, password }).toString(),
  });
}

test("gates the game, alternate paths and private API", async () => {
  const app = makeApp();
  for (const url of ["/", "/index.html"]) {
    expect((await app.inject(url)).headers.location).toBe("/login");
  }
  expect((await app.inject("/ilsur-lovit-chleny/")).headers.location).toBe(
    "/login?returnTo=%2Filsur-lovit-chleny%2F",
  );
  expect((await app.inject("/%69ndex.html")).headers.location).toBe("/login");
  expect((await app.inject("/api/session")).statusCode).toBe(401);
  expect((await app.inject("/%61pi/session")).statusCode).toBe(401);
  expect((await app.inject("/api/missing")).statusCode).toBe(401);
  expect((await app.inject("/api/health")).statusCode).toBe(200);
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/login",
        headers: { "sec-fetch-site": "cross-site" },
      })
    ).statusCode,
  ).toBe(403);
});

test("validates input and rate-limits incorrect passwords with recovery", async () => {
  let now = 1000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  const app = makeApp();
  expect((await app.inject({ method: "POST", url: "/login" })).statusCode).toBe(
    400,
  );
  expect(
    (await app.inject({ method: "POST", url: "/login", payload: {} }))
      .statusCode,
  ).toBe(400);
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/login",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        payload: "unrelated=value",
      })
    ).statusCode,
  ).toBe(400);
  for (const [name, password] of [
    [" ", "a"],
    ["x".repeat(33), "a"],
    ["a\u0000b", "a"],
    ["a", ""],
    ["a", "x".repeat(129)],
  ] as const) {
    expect((await enter(app, name, password)).statusCode).toBe(400);
  }
  for (let attempt = 0; attempt < 10; attempt++) {
    const result = await enter(app, "Ринат", "пароль");
    expect(result.statusCode).toBe(401);
    expect(result.body).toContain("Неверный пароль, натурал чертов");
  }
  const blocked = await enter(app, "Ринат");
  expect(blocked.statusCode).toBe(429);
  expect(blocked.headers["retry-after"]).toBe("60");
  expect((await app.inject({ method: "POST", url: "/login" })).statusCode).toBe(
    429,
  );
  now += 60_000;
  expect((await enter(app, "Ринат")).statusCode).toBe(303);
});

test("reuses persisted nicknames, escapes markup, rotates and revokes sessions", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ilsur-login-"));
  try {
    const databasePath = join(dir, "db", "game.sqlite");
    const app = makeApp({ databasePath, secureCookie: true });
    const nickname = "<B>Ё & \"' $&</B>";
    const first = await enter(app, `  ${nickname}  `);
    expect(first.statusCode).toBe(303);
    expect(first.headers["set-cookie"]).toContain(
      "HttpOnly; SameSite=Strict; Secure; Max-Age=604800",
    );
    const cookie = String(first.headers["set-cookie"]).split(";")[0]!;
    const headers = { cookie };
    const profile = (await app.inject({ url: "/api/session", headers })).json();
    expect(profile).toEqual({ id: expect.any(Number), nickname });
    const game = await app.inject({ url: "/", headers });
    expect(game.statusCode).toBe(200);
    expect(game.headers["cache-control"]).toBe("no-store");
    expect(game.body).toContain("Ильсур - пИтух");
    expect(game.body).toContain(
      "&lt;B&gt;Ё &amp; &quot;&#39; $&amp;&lt;/B&gt;",
    );
    expect(game.body).toContain('href="/ilsur-lovit-chleny/instructions"');
    expect(game.body).toContain("Пока нет результатов");
    const gamePage = await app.inject({ url: "/ilsur-lovit-chleny/", headers });
    expect(gamePage.statusCode).toBe(200);
    expect(gamePage.headers["cache-control"]).toBe("no-store");
    expect(gamePage.body).toContain("&#60;B&#62;Ё &#38; &#34;&#39;");
    expect(gamePage.body).toContain('href="/"');
    expect(
      (await app.inject({ url: "/login", headers })).headers.location,
    ).toBe("/");
    expect(
      (
        await app.inject({
          url: "/login?returnTo=%2Filsur-lovit-chleny%2F",
          headers,
        })
      ).headers.location,
    ).toBe("/ilsur-lovit-chleny/");
    expect(
      (await app.inject({ url: "/api/missing", headers })).statusCode,
    ).toBe(404);
    await app.close();
    apps.pop();

    const reopened = makeApp({ databasePath });
    expect(
      (await reopened.inject({ url: "/api/session", headers })).json(),
    ).toEqual(profile);
    const second = await enter(
      reopened,
      nickname.toLowerCase().normalize("NFD"),
      options.password,
      cookie,
    );
    const newCookie = String(second.headers["set-cookie"]).split(";")[0]!;
    expect(newCookie).not.toBe(cookie);
    expect(
      (await reopened.inject({ url: "/api/session", headers })).statusCode,
    ).toBe(401);
    const newHeaders = { cookie: newCookie };
    expect(
      (
        await reopened.inject({ url: "/api/session", headers: newHeaders })
      ).json(),
    ).toEqual(profile);
    const logout = await reopened.inject({
      method: "POST",
      url: "/logout",
      headers: newHeaders,
    });
    expect(logout.headers.location).toBe("/login");
    expect(logout.headers["set-cookie"]).toContain("Max-Age=0");
    expect(
      (await reopened.inject({ url: "/api/session", headers: newHeaders }))
        .statusCode,
    ).toBe(401);
    await reopened.close();
    apps.pop();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("expires a session after seven days", async () => {
  const now = vi.spyOn(Date, "now").mockReturnValue(1000);
  const app = makeApp();
  const result = await enter(app, "Игрок");
  const cookie = String(result.headers["set-cookie"]).split(";")[0]!;
  now.mockReturnValue(1000 + 604800 * 1000);
  expect(
    (await app.inject({ url: "/api/session", headers: { cookie } })).statusCode,
  ).toBe(401);
});

test("a protected game visit returns to the game after login and rejects open redirects", async () => {
  const app = makeApp();
  const login = await app.inject("/login?returnTo=%2Filsur-lovit-chleny%2F");
  expect(login.statusCode).toBe(200);
  expect(login.body).toContain('name="returnTo" value="/ilsur-lovit-chleny/"');
  const result = await app.inject({
    method: "POST",
    url: "/login",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    payload: new URLSearchParams({
      nickname: "Пилот",
      password: options.password,
      returnTo: "/ilsur-lovit-chleny/",
    }).toString(),
  });
  expect(result.statusCode).toBe(303);
  expect(result.headers.location).toBe("/ilsur-lovit-chleny/");
  const invalid = await app.inject(
    "/login?returnTo=https%3A%2F%2Fevil.example",
  );
  expect(invalid.body).toContain('name="returnTo" value="/"');
  const rejected = await app.inject({
    method: "POST",
    url: "/login",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    payload: new URLSearchParams({
      nickname: "Пилот",
      password: "wrong",
      returnTo: "https://evil.example",
    }).toString(),
  });
  expect(rejected.body).toContain('name="returnTo" value="/"');
});

test("requires a configured password", () => {
  expect(() => readLoginConfig({})).toThrow("GAME_PASSWORD");
  expect(() => readLoginConfig({ GAME_PASSWORD: "x".repeat(129) })).toThrow(
    "GAME_PASSWORD",
  );
  expect(readLoginConfig({ GAME_PASSWORD: "x" })).toEqual({
    password: "x",
    databasePath: "./data/game.sqlite",
    secureCookie: false,
  });
  expect(
    readLoginConfig({
      GAME_PASSWORD: "x",
      DATABASE_PATH: "custom",
      NODE_ENV: "production",
    }),
  ).toEqual({ password: "x", databasePath: "custom", secureCookie: true });
});

test("saves a round once, preserves the best result, and persists personal totals", async () => {
  const directory = mkdtempSync(join(tmpdir(), "arcade-results-"));
  const databasePath = join(directory, "game.sqlite");
  const app = makeApp({ databasePath });
  const ranking = "/ilsur-lovit-chleny/rating";
  const path = (id: number) =>
    `/api/games/ilsur-lovit-chleny/rounds/00000000-0000-0000-0000-${String(id).padStart(12, "0")}`;
  const login = async (nickname: string) =>
    String((await enter(app, nickname)).headers["set-cookie"]).split(";")[0]!;
  try {
    const alice = await login("<Alice>");
    const otherSession = await login("<ALICE>");
    const bob = await login("Bob");
    const post = (url: string, cookie: string, payload?: object) =>
      app.inject({ method: "POST", url, headers: { cookie }, payload });
    expect((await app.inject(ranking)).headers.location).toBe("/login");
    expect(
      (await app.inject({ url: ranking, headers: { cookie: alice } })).body,
    ).toContain("У тебя пока нет результата");
    expect((await post(path(1), "", {})).statusCode).toBe(401);
    expect((await post(path(1), alice)).statusCode).toBe(400);
    expect((await post(path(1), alice, [])).statusCode).toBe(400);
    expect((await post(path(1) + "invalid", alice, {})).statusCode).toBe(400);
    expect(
      (await post(path(1), alice, { score: 40, caught: 2 })).statusCode,
    ).toBe(409);
    expect((await post(path(1), alice, {})).statusCode).toBe(204);
    expect((await post(path(1), bob, {})).statusCode).toBe(409);
    expect(
      (await post(path(1), otherSession, { score: 40, caught: 2 })).statusCode,
    ).toBe(409);
    for (const payload of [
      { score: "40", caught: 2 },
      { score: 40, caught: "2" },
      { score: 0.5, caught: 0 },
      { score: 40, caught: 0.5 },
      { score: 11, caught: 1 },
      { score: 0, caught: -1 },
      { score: 0, caught: 1_000_001 },
      { score: 10, caught: 2 },
      { score: 60, caught: 1 },
    ])
      expect((await post(path(1), alice, payload)).statusCode).toBe(400);
    const result = { score: 40, caught: 2 };
    const retries = await Promise.all([
      post(path(1), alice, result),
      post(path(1), alice, result),
    ]);
    expect(retries.map((response) => response.statusCode)).toEqual([204, 204]);
    expect(
      (await post(path(1), alice, { score: 40, caught: 4 })).statusCode,
    ).toBe(409);
    for (const [key, cookie, score, caught] of [
      [2, alice, 10, 1],
      [3, bob, 40, 3],
      [4, alice, 40, 3],
    ] as const) {
      expect((await post(path(key), cookie, {})).statusCode).toBe(204);
      expect(
        (await post(path(key), cookie, { score, caught })).statusCode,
      ).toBe(204);
    }
    const catalog = await app.inject({ url: "/", headers: { cookie: alice } });
    expect(catalog.body).toContain(
      "<li>Bob · Очков: 40 · Членов напихано: 3</li><li>&lt;Alice&gt; · Очков: 40 · Членов напихано: 3</li>",
    );
    const restarted = makeApp({ databasePath });
    const page = await restarted.inject({
      url: ranking,
      headers: { cookie: otherSession },
    });
    expect(page.headers["cache-control"]).toBe("no-store");
    expect(page.body).toContain(
      "<h2>Твоё место</h2><p>Место: 2 · Очков: 40 · Членов напихано: 3</p>",
    );
    expect(page.body).toMatch(
      /Сыграно партий:<\/dt><dd>3<\/dd>\s*<dt>Очков:<\/dt><dd>90<\/dd>\s*<dt>Членов напихано:<\/dt><dd>6/,
    );
  } finally {
    await Promise.all(apps.splice(0).map((running) => running.close()));
    rmSync(directory, { recursive: true, force: true });
  }
});

test("saves Packman progress separately and refreshes both catalog rankings", async () => {
  const app = makeApp();
  const alice = String(
    (await enter(app, "Пакманист")).headers["set-cookie"],
  ).split(";")[0]!;
  const bob = String(
    (await enter(app, "Другой игрок")).headers["set-cookie"],
  ).split(";")[0]!;
  const url = (id: string) =>
    `/api/games/ilsur-pacman/rounds/00000000-0000-0000-0000-${id}`;
  const post = (path: string, cookie: string, payload?: object) =>
    app.inject({ method: "POST", url: path, headers: { cookie }, payload });
  try {
    expect(
      (await app.inject({ url: "/packman/rating", headers: { cookie: alice } }))
        .body,
    ).toContain("У тебя пока нет результата");
    expect((await post(url("000000000001"), alice, {})).statusCode).toBe(204);
    for (const payload of [
      { caught: 2, circle: 0, round: 1 },
      { caught: 2, circle: 1, round: 8 },
      { caught: 2, circle: 1, round: 1.5 },
      { caught: -1, circle: 1, round: 1 },
      { caught: 1, circle: "2", round: 1 },
    ])
      expect((await post(url("000000000001"), alice, payload)).statusCode).toBe(
        400,
      );
    const result = { caught: 120, circle: 3, round: 6 };
    expect((await post(url("000000000001"), alice, result)).statusCode).toBe(
      204,
    );
    expect((await post(url("000000000001"), alice, result)).statusCode).toBe(
      204,
    );
    expect(
      (await post(url("000000000001"), alice, { ...result, round: 5 }))
        .statusCode,
    ).toBe(409);
    expect((await post(url("000000000002"), bob, {})).statusCode).toBe(204);
    expect(
      (
        await post(url("000000000002"), bob, {
          caught: 120,
          circle: 3,
          round: 4,
        })
      ).statusCode,
    ).toBe(204);
    expect((await post(url("000000000003"), alice, {})).statusCode).toBe(204);
    expect(
      (
        await post(
          "/api/games/ilsur-lovit-chleny/rounds/00000000-0000-0000-0000-000000000003",
          alice,
          {},
        )
      ).statusCode,
    ).toBe(204);
    expect(
      (
        await post(
          "/api/games/ilsur-lovit-chleny/rounds/00000000-0000-0000-0000-000000000003",
          alice,
          { score: 40, caught: 2 },
        )
      ).statusCode,
    ).toBe(204);

    const catalog = await app.inject({ url: "/", headers: { cookie: alice } });
    expect(catalog.body).toContain(
      "Пакманист · Членов напихано: 120 · Круг: 3 · Раунд: 6",
    );
    expect(catalog.body).toContain(
      "Пакманист · Очков: 40 · Членов напихано: 2",
    );
    expect(catalog.body).toContain('href="/packman/rating"');

    const rating = await app.inject({
      url: "/packman/rating",
      headers: { cookie: alice },
    });
    expect(rating.body).toContain(
      "Место: 1 · Членов напихано: 120 · Круг: 3 · Раунд: 6",
    );
    expect(rating.body).toContain(
      "Последняя игра · Членов напихано: 120 · Круг: 3 · Раунд: 6",
    );
    expect(rating.body).toContain("Сыграно партий:</dt><dd>1</dd>");
    expect(rating.body).not.toContain("Очков:");
    expect(rating.body).not.toContain("40");
    expect((await post(url("000000000004"), alice, {})).statusCode).toBe(204);
    expect(
      (
        await post(url("000000000004"), alice, {
          caught: 1_000_001,
          circle: 9_000,
          round: 7,
        })
      ).statusCode,
    ).toBe(204);
  } finally {
    await Promise.all(apps.splice(0).map((running) => running.close()));
  }
});

test("requires login for instructions and returns to them after login", async () => {
  const app = makeApp();
  const url = "/ilsur-lovit-chleny/instructions";
  const guest = await app.inject(url);
  expect(guest.headers.location).toBe(
    `/login?returnTo=${encodeURIComponent(url)}`,
  );
  expect(guest.headers["cache-control"]).toBe("no-store");
  expect(
    (await app.inject("/games/ilsur-lovit-chleny/instructions.html"))
      .statusCode,
  ).toBe(404);

  const login = await app.inject({
    method: "POST",
    url: "/login",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    payload: new URLSearchParams({
      nickname: "Игрок",
      password: options.password,
      returnTo: url,
    }).toString(),
  });
  expect(login.statusCode).toBe(303);
  expect(login.headers.location).toBe(url);
  const cookie = String(login.headers["set-cookie"]).split(";")[0]!;
  const instructions = await app.inject({ url, headers: { cookie } });
  expect(instructions.statusCode).toBe(200);
  expect(instructions.headers["cache-control"]).toBe("no-store");
  expect(instructions.body).toContain('href="/ilsur-lovit-chleny/"');
  expect(instructions.body).toContain("У Ильсура есть право сказать «нет».");
});

test("opens Packman and its instructions after shared login", async () => {
  const app = makeApp();
  expect((await app.inject("/packman/")).headers.location).toBe(
    "/login?returnTo=%2Fpackman%2F",
  );
  const instructionPath = "/packman/instructions";
  expect((await app.inject(instructionPath)).headers.location).toBe(
    `/login?returnTo=${encodeURIComponent(instructionPath)}`,
  );
  expect((await app.inject("/games/packman/index.html")).statusCode).toBe(404);
  expect((await app.inject("/maze/")).statusCode).toBe(404);
  const login = await app.inject({
    method: "POST",
    url: "/login",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    payload: new URLSearchParams({
      nickname: "Игрок",
      password: options.password,
      returnTo: instructionPath,
    }).toString(),
  });
  expect(login.headers.location).toBe(instructionPath);
  const cookie = login.cookies[0]!;
  const maze = await app.inject({
    url: "/packman/",
    headers: { cookie: `${cookie.name}=${cookie.value}` },
  });
  expect(maze.statusCode).toBe(200);
  expect(maze.body).toContain("<h1>Ильсур-Пакман-Членоед</h1>");
  const instructions = await app.inject({
    url: instructionPath,
    headers: { cookie: `${cookie.name}=${cookie.value}` },
  });
  expect(instructions.statusCode).toBe(200);
  expect(instructions.body).toContain('href="/packman/">Начать пИтушить</a>');
  expect(instructions.body).toContain("Дилдо");
  const directLogin = await app.inject({
    method: "POST",
    url: "/login",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    payload: new URLSearchParams({
      nickname: "Игрок",
      password: options.password,
      returnTo: "/packman/",
    }).toString(),
  });
  expect(directLogin.headers.location).toBe("/packman/");
});

test("opens the third game by private direct link after shared login", async () => {
  const app = makeApp();
  const path = "/ilsur-platformer/";
  const guest = await app.inject(path);
  expect(guest.statusCode).toBe(302);
  expect(guest.headers.location).toBe(
    `/login?returnTo=${encodeURIComponent(path)}`,
  );
  expect(guest.headers["cache-control"]).toBe("no-store");

  const login = await app.inject({
    method: "POST",
    url: "/login",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    payload: new URLSearchParams({
      nickname: "Игрок платформера",
      password: options.password,
      returnTo: path,
    }).toString(),
  });
  expect(login.statusCode).toBe(303);
  expect(login.headers.location).toBe(path);
  const cookie = login.cookies[0]!;
  const game = await app.inject({
    url: path,
    headers: { cookie: `${cookie.name}=${cookie.value}` },
  });
  expect(game.statusCode).toBe(200);
  expect(game.headers["cache-control"]).toBe("no-store");
  expect(game.body).toContain("<canvas");
  expect(game.body).toContain("Временная сцена платформера с Ильсуром");

  const catalog = await app.inject({
    url: "/",
    headers: { cookie: `${cookie.name}=${cookie.value}` },
  });
  expect(catalog.statusCode).toBe(200);
  expect(catalog.body).not.toContain("ilsur-platformer");
  expect(catalog.body).not.toContain("Большое приключение Ильсура");

  expect(
    (await app.inject("/games/ilsur-platformer/index.html")).statusCode,
  ).toBe(404);
});
