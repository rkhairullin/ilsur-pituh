import { expect, test } from "vitest";
import {
  advanceLevel,
  createCampaignState,
} from "../../client/games/ilsur-platformer/campaign.js";
import { renderCampaignStatus } from "../../client/games/ilsur-platformer/campaign-ui.js";

class TextElement {
  hidden = false;
  textContent = "";
  dataset: Record<string, string | undefined> = {};
}

function makeElements() {
  return {
    levelName: new TextElement(),
    levelTime: new TextElement(),
    lives: new TextElement(),
    checkpoint: new TextElement(),
    pause: new TextElement(),
    overlay: new TextElement(),
    title: new TextElement(),
    message: new TextElement(),
    resume: new TextElement(),
    restart: new TextElement(),
    catalog: new TextElement(),
  };
}

test("renders the level HUD and hides the overlay while playing", () => {
  const campaign = createCampaignState();
  campaign.checkpointIndex = 1;
  campaign.remainingSeconds = 59.1;
  const elements = makeElements();
  const output = new TextElement();

  renderCampaignStatus(campaign, elements, output);

  expect(elements.levelName.textContent).toBe("Уровень 1");
  expect(elements.levelTime.textContent).toBe("01:00");
  expect(elements.lives.textContent).toBe("3");
  expect(elements.checkpoint.textContent).toBe("Чекпоинт 1");
  expect(elements.pause.hidden).toBe(false);
  expect(elements.overlay.hidden).toBe(true);
  expect(elements.resume.hidden).toBe(true);
  expect(elements.restart.hidden).toBe(true);
  expect(elements.catalog.hidden).toBe(true);
  expect(output.dataset.status).toBe("playing");
  expect(output.dataset.level).toBe("1");
});

test("renders paused status and exposes a resume action", () => {
  const campaign = createCampaignState();
  campaign.status = "paused";
  campaign.remainingSeconds = 0.2;
  const elements = makeElements();

  renderCampaignStatus(campaign, elements, new TextElement());

  expect(elements.levelTime.textContent).toBe("00:01");
  expect(elements.pause.hidden).toBe(true);
  expect(elements.overlay.hidden).toBe(false);
  expect(elements.resume.hidden).toBe(false);
  expect(elements.title.textContent).toBe("Антракт, звезда! ✨");
  expect(elements.message.textContent).toBe(
    "Корона отдыхает, таймер тоже. Переведи дух!",
  );
  expect(elements.restart.hidden).toBe(true);
  expect(elements.catalog.hidden).toBe(false);
  expect(elements.resume.textContent).toBe("Вернуться на подиум");
});

test("renders game-over and completed campaign messages", () => {
  const campaign = createCampaignState();
  const elements = makeElements();
  campaign.status = "game-over";
  renderCampaignStatus(campaign, elements, new TextElement());
  expect(elements.title.textContent).toBe("Драма на весь подиум!");
  expect(elements.message.textContent).toBe(
    "Жизни закончились, зато блёстки держатся. Попробуем ещё?",
  );
  expect(elements.restart.hidden).toBe(false);
  expect(elements.restart.textContent).toBe("Ещё попытка!");
  expect(elements.catalog.hidden).toBe(false);

  campaign.status = "playing";
  campaign.levelIndex = 4;
  advanceLevel(campaign);
  renderCampaignStatus(campaign, elements, new TextElement());
  expect(elements.levelName.textContent).toBe("Арена босса");
  expect(elements.title.textContent).toBe("Браво, королева! 🌈");
  expect(elements.message.textContent).toBe(
    "Финал был ослепителен! На бис — на 20 секунд меньше в каждом уровне.",
  );
  expect(elements.restart.hidden).toBe(false);
  expect(elements.resume.hidden).toBe(true);
  expect(elements.restart.textContent).toBe("На бис: сложнее!");
  expect(elements.catalog.hidden).toBe(false);

  campaign.encoreLevel = 3;
  renderCampaignStatus(campaign, elements, new TextElement());
  expect(elements.restart.hidden).toBe(true);
  expect(elements.message.textContent).toBe(
    "Финал был ослепителен! Ты покорила предел сложности. Корона твоя.",
  );
});
