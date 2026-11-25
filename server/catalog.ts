import type { RecordEntry } from "./leaderboard.js";

type GameCard = {
  title: string;
  href: string;
  image: string;
  imageAlt: string;
  description: string;
  id: string;
};

export const games: GameCard[] = [
  {
    title: "Ильсур ловит члены",
    href: "/ilsur-lovit-chleny/",
    image: "/catalog/game-preview.webp",
    imageAlt: "Скриншот игрового экрана во время полёта банана",
    description:
      "Диско-пушки палят членами, а у Ильсура опять руки заняты. Помоги ему поймать их ртом, держи темп и докажи, что у Ильсура глубокая глотка",
    id: "ilsur-lovit-chleny",
  },
  {
    title: "Ильсур-Пакман-Членоед",
    href: "/packman/",
    image: "/catalog/packman-preview.webp",
    imageAlt: "Ильсур и радужные петухи в лабиринте",
    description:
      "Ильсур мчит по радужному лабиринту, собирает члены и ускользает от четырёх очень разных поклонников",
    id: "ilsur-pacman",
  },
];

function escapeHtml(value: string) {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (character) => entities[character]!);
}

function renderRecords(records: RecordEntry[], withDate = false) {
  if (!records.length) return "<p>Пока нет результатов</p>";
  return `<ol>${records.map((record) => `<li>${withDate ? (["🥇 ", "🥈 ", "🥉 "][record.place - 1] ?? "") : ""}${escapeHtml(record.nickname)} · Очков: ${record.score} · Членов напихано: ${record.caught}${withDate ? ` · Дата: ${new Date(record.finishedAt).toISOString().slice(0, 10)}` : ""}</li>`).join("")}</ol>`;
}

export function renderRating(
  game: GameCard,
  records: RecordEntry[],
  personal: RecordEntry | undefined,
  totals: { games: number; score: number; caught: number },
  latest?: Pick<RecordEntry, "score" | "caught">,
) {
  return `<!doctype html>
<html lang="ru">
<head>
<link rel="icon" href="/icons/icon-192.png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="manifest" href="/icons/manifest.webmanifest">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Рейтинг · ${game.title}</title>
<link rel="stylesheet" href="/catalog/catalog.css">
</head>
<body>
<main class="catalog rating-page">
<nav><a class="catalog-button" href="/">Каталог игр</a> <a class="catalog-button" href="${game.href}instructions">Играть</a></nav>
<h1>Рейтинг · ${game.title}</h1>
<section><h2>Топ-20</h2>${renderRecords(records, true)}</section>
<section><h2>Твоё место</h2><p>${personal ? `Место: ${personal.place} · Очков: ${personal.score} · Членов напихано: ${personal.caught}` : "У тебя пока нет результата"}</p>${latest ? `<p>Последняя игра · Очков: ${latest.score} · Членов напихано: ${latest.caught}</p>` : ""}</section>
<section><h2>За всё время</h2><dl>
<dt>Сыграно партий:</dt><dd>${totals.games}</dd>
<dt>Очков:</dt><dd>${totals.score}</dd>
<dt>Членов напихано:</dt><dd>${totals.caught}</dd>
</dl></section>
</main>
</body>
</html>`;
}

export function renderCatalog(
  nickname: string,
  top: (game: string) => RecordEntry[],
) {
  const cards = games
    .map(
      (game) => `<article class="game-card">
  <a class="game-card__preview" href="${game.href}instructions" aria-label="Открыть игру ${game.title}">
    <img src="${game.image}" alt="${game.imageAlt}" width="1200" height="675">
    <span class="game-card__play-indicator" aria-hidden="true">▶</span>
  </a>
  <div class="game-card__body">
    <h2>${game.title}</h2>
    <p class="game-card__description">${game.description}</p>
    <div class="game-card__rating"><h3>Топ-5</h3>${renderRecords(top(game.id))}<a href="${game.href}rating">Полный рейтинг</a></div>
    <a class="catalog-button" href="${game.href}instructions">К игре</a>
  </div>
</article>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="ru">
  <head>
<link rel="icon" href="/icons/icon-192.png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="manifest" href="/icons/manifest.webmanifest">
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="color-scheme" content="dark">
    <title>Ильсур - пИтух</title>
    <link rel="stylesheet" href="/catalog/catalog.css">
  </head>
  <body>
    <main class="catalog" aria-label="Игры, где можно отпетушить Ильсура">
      <header class="catalog-header">
        <div class="catalog-brand">
          <p class="catalog-kicker">ВСЕ ВОКРУГ ЗНАЮТ, ЧТО</p>
          <h1>Ильсур - пИтух</h1>
        </div>
        <div class="catalog-account">
          <p id="player-nickname">Привет, <b>${escapeHtml(nickname)}</b></p>
          <div class="catalog-account-actions">
            <form method="get" action="/"><button class="refresh-button" type="submit">Обновить рейтинг</button></form>
            <form method="post" action="/logout"><button class="logout-button" type="submit">Выйти</button></form>
          </div>
        </div>
      </header>
      <section class="catalog-library" aria-labelledby="library-title">
        <div class="section-heading">
          <div>
            <p class="catalog-kicker">ВЫБИРАЙ И ЗАЛЕТАЙ</p>
            <h2 id="library-title">Игры, где можно отпетушить Ильсура</h2>
          </div>
          <p class="library-count">${String(games.length).padStart(2, "0")} <span>ИГРЫ</span></p>
        </div>
        <div class="game-grid">${cards}</div>
      </section>
    </main>
  </body>
</html>`;
}
