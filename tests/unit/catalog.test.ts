import { expect, test } from "vitest";
import { games, renderCatalog, renderRating } from "../../server/catalog.js";

test("renders both games in order with an escaped player name", () => {
  const page = renderCatalog(`<Игрок> & \"Рок\" 'n'`, () => []);

  expect(page).toContain("<h1>Ильсур - пИтух</h1>");
  expect(page).toContain('<p class="catalog-kicker">ВСЕ ВОКРУГ ЗНАЮТ, ЧТО</p>');
  expect(page).toContain(
    '<h2 id="library-title">Игры, где можно отпетушить Ильсура</h2>',
  );
  expect(page).toContain(
    "<b>&lt;Игрок&gt; &amp; &quot;Рок&quot; &#39;n&#39;</b>",
  );
  expect(page).toContain('href="/ilsur-lovit-chleny/instructions"');
  expect(page).toContain('href="/packman/instructions"');
  expect(page).toContain('src="/catalog/game-preview.webp"');
  expect(page).toContain('src="/catalog/packman-preview.webp"');
  expect(page.match(/>К игре<\/a>/g)).toHaveLength(2);
  expect(page).toContain('<p class="library-count">02 <span>ИГРЫ</span></p>');
  expect(page.indexOf("Ильсур ловит члены")).toBeLessThan(
    page.indexOf("Ильсур-Пакман-Членоед"),
  );
  expect(page).toContain(
    "Диско-пушки палят членами, а у Ильсура опять руки заняты. Помоги ему поймать их ртом, держи темп и докажи, что у Ильсура глубокая глотка",
  );
  expect(page).toContain(
    '<form method="get" action="/"><button class="refresh-button" type="submit">Обновить рейтинг</button></form>',
  );
  expect(page).toContain("Пока нет результатов");
  expect(page).not.toContain("АРКАДА · 1 ИГРОК");
});

test("awards medals to the first three places and shows the latest game separately", () => {
  const records = [1, 2, 3, 4].map((place) => ({
    place,
    nickname: `Игрок ${place}`,
    score: 50,
    caught: 5,
    circle: 1,
    round: 1,
    finishedAt: 0,
  }));
  const page = renderRating(
    games[0]!,
    records,
    records[0],
    {
      games: 2,
      score: 60,
      caught: 6,
    },
    { score: 10, caught: 1 },
  );

  expect(page).toContain(
    "🥇 Игрок 1 · Очков: 50 · Членов напихано: 5 · Дата: 1970-01-01",
  );
  expect(page).toContain("🥈 Игрок 2");
  expect(page).toContain("🥉 Игрок 3");
  expect(page).toContain("<li>Игрок 4");
  expect(page).toContain("Место: 1 · Очков: 50");
  expect(page).toContain("Последняя игра · Очков: 10");
});

test("renders the Packman leaderboard without points and includes progress and dates", () => {
  const record = {
    place: 1,
    nickname: "Лабиринтный игрок",
    score: null,
    caught: 25,
    circle: 3,
    round: 6,
    finishedAt: Date.UTC(2026, 0, 2),
  };
  const page = renderRating(
    games[1]!,
    [record],
    record,
    { games: 4, score: 0, caught: 80 },
    record,
  );
  expect(page).toContain(
    "🥇 Лабиринтный игрок · Членов напихано: 25 · Круг: 3 · Раунд: 6 · Дата: 2026-01-02",
  );
  expect(page).toContain("Место: 1 · Членов напихано: 25 · Круг: 3 · Раунд: 6");
  expect(page).toContain("За всё время</h2>");
  expect(page).toContain("Сыграно партий:</dt><dd>4");
  expect(page).toContain("Членов напихано:</dt><dd>80");
  expect(page).not.toContain("Очков:");
  expect(page).not.toContain("Очков</dt>");
});
