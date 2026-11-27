import type { CampaignState } from "./campaign.js";
import { currentLevel, levelDurationSeconds } from "./campaign.js";

export interface CampaignStatusElement {
  hidden: boolean;
  textContent: string | null;
}

export interface CampaignStatusElements {
  levelName: CampaignStatusElement;
  levelTime: CampaignStatusElement;
  lives: CampaignStatusElement;
  checkpoint: CampaignStatusElement;
  pause: CampaignStatusElement;
  overlay: CampaignStatusElement;
  title: CampaignStatusElement;
  message: CampaignStatusElement;
  resume: CampaignStatusElement;
  restart: CampaignStatusElement;
  catalog: CampaignStatusElement;
}

export function renderCampaignStatus(
  campaign: CampaignState,
  elements: CampaignStatusElements,
  output: { dataset: Record<string, string | undefined> },
) {
  const level = currentLevel(campaign);
  const canStartEncore =
    campaign.status === "complete" &&
    levelDurationSeconds(level, campaign.encoreLevel + 1) <
      levelDurationSeconds(level, campaign.encoreLevel);
  const totalSeconds = Math.ceil(campaign.remainingSeconds);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  elements.levelName.textContent = level.name;
  elements.levelTime.textContent = `${minutes}:${seconds}`;
  elements.lives.textContent = String(campaign.lives);
  elements.checkpoint.textContent =
    campaign.checkpointIndex === 0
      ? "Старт"
      : `Чекпоинт ${campaign.checkpointIndex}`;
  elements.pause.hidden = campaign.status !== "playing";
  elements.overlay.hidden = campaign.status === "playing";
  elements.resume.hidden = campaign.status !== "paused";
  elements.restart.hidden = campaign.status !== "game-over" && !canStartEncore;
  elements.catalog.hidden = campaign.status === "playing";
  elements.resume.textContent = "Вернуться на подиум";
  if (campaign.status === "paused") {
    elements.title.textContent = "Антракт, звезда! ✨";
    elements.message.textContent =
      "Корона отдыхает, таймер тоже. Переведи дух!";
  } else if (campaign.status === "game-over") {
    elements.title.textContent = "Драма на весь подиум!";
    elements.message.textContent =
      "Жизни закончились, зато блёстки держатся. Попробуем ещё?";
    elements.restart.textContent = "Ещё попытка!";
  } else if (campaign.status === "complete") {
    elements.title.textContent = "Браво, королева! 🌈";
    if (canStartEncore) {
      elements.message.textContent =
        "Финал был ослепителен! На бис — на 20 секунд меньше в каждом уровне.";
      elements.restart.textContent = "На бис: сложнее!";
    } else {
      elements.message.textContent =
        "Финал был ослепителен! Ты покорила предел сложности. Корона твоя.";
    }
  }
  output.dataset.level = String(campaign.levelIndex + 1);
  output.dataset.levelName = level.name;
  output.dataset.time = String(totalSeconds);
  output.dataset.lives = String(campaign.lives);
  output.dataset.checkpoint = String(campaign.checkpointIndex);
  output.dataset.encore = String(campaign.encoreLevel);
  output.dataset.status = campaign.status;
}
