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
