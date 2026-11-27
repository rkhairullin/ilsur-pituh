import { expect, test } from "vitest";
import {
  BOSS_ARENA_SECONDS,
  ENCORE_TIME_PENALTY_SECONDS,
  INITIAL_LIVES,
  LEVELS,
  NORMAL_LEVEL_SECONDS,
  activateCheckpoint,
  advanceCampaignTime,
  advanceLevel,
  createCampaignState,
  currentLevel,
  loseLife,
  levelDurationSeconds,
  setPaused,
} from "../../client/games/ilsur-platformer/campaign.js";

test("defines four timed levels followed by a longer boss arena", () => {
  expect(LEVELS).toHaveLength(5);
  expect(LEVELS.slice(0, 4).every((level) => !level.bossArena)).toBe(true);
  expect(
    LEVELS.slice(0, 4).every(
      (level) => level.durationSeconds === NORMAL_LEVEL_SECONDS,
    ),
  ).toBe(true);
  expect(LEVELS[4]?.bossArena).toBe(true);
  expect(LEVELS[4]?.durationSeconds).toBe(BOSS_ARENA_SECONDS);
  expect(LEVELS.every((level) => level.checkpoints.length >= 2)).toBe(true);
});

test("starts with three lives and advances checkpoints in order", () => {
  const campaign = createCampaignState();
  expect(campaign.lives).toBe(INITIAL_LIVES);
  expect(campaign.levelIndex).toBe(0);
  expect(campaign.remainingSeconds).toBe(NORMAL_LEVEL_SECONDS);
  expect(activateCheckpoint(campaign, -1)).toBe(false);
  expect(activateCheckpoint(campaign, 899)).toBe(false);
  expect(activateCheckpoint(campaign, 900)).toBe(true);
  expect(campaign.checkpointIndex).toBe(1);
  expect(activateCheckpoint(campaign, 1749)).toBe(false);
  expect(activateCheckpoint(campaign, 2600)).toBe(true);
  expect(campaign.checkpointIndex).toBe(2);
  expect(activateCheckpoint(campaign, 2600)).toBe(false);
});

test("encore runs have less time while retries keep the current difficulty", () => {
  const campaign = createCampaignState(1);
  expect(campaign.encoreLevel).toBe(1);
  expect(ENCORE_TIME_PENALTY_SECONDS).toBe(20);
  expect(campaign.remainingSeconds).toBe(NORMAL_LEVEL_SECONDS - 20);
  expect(levelDurationSeconds(LEVELS[4]!, 1)).toBe(BOSS_ARENA_SECONDS - 20);
  expect(levelDurationSeconds(LEVELS[0]!, 4)).toBe(30);
  expect(levelDurationSeconds(LEVELS[4]!, 4)).toBe(60);

  expect(advanceLevel(campaign)).toBe(true);
  expect(campaign.remainingSeconds).toBe(NORMAL_LEVEL_SECONDS - 20);
  campaign.remainingSeconds = 1;
  expect(advanceCampaignTime(campaign, 1)).toBe("life-lost");
  expect(campaign.remainingSeconds).toBe(NORMAL_LEVEL_SECONDS - 20);
  expect(campaign.encoreLevel).toBe(1);
});

test("timer expiry loses a life, restores time, and ends after the last life", () => {
  const campaign = createCampaignState();
  expect(advanceCampaignTime(campaign, 0)).toBe("none");
  expect(advanceCampaignTime(campaign, -5)).toBe("none");
  expect(advanceCampaignTime(campaign, Number.NaN)).toBe("none");
  expect(advanceCampaignTime(campaign, 30)).toBe("none");
  expect(campaign.remainingSeconds).toBe(60);
  campaign.remainingSeconds = 1;
  expect(advanceCampaignTime(campaign, 1)).toBe("life-lost");
  expect(campaign.lives).toBe(2);
  expect(campaign.remainingSeconds).toBe(NORMAL_LEVEL_SECONDS);
  expect(campaign.checkpointIndex).toBe(0);

  campaign.lives = 1;
  campaign.remainingSeconds = 0.25;
  expect(advanceCampaignTime(campaign, 1)).toBe("game-over");
  expect(campaign.lives).toBe(0);
  expect(campaign.status).toBe("game-over");
  expect(advanceCampaignTime(campaign, 5)).toBe("none");
  expect(loseLife(campaign)).toBe(false);
});

test("losing a life from pause resumes play and resets the timer", () => {
  const campaign = createCampaignState();
  campaign.remainingSeconds = 3;
  expect(setPaused(campaign, true)).toBe(true);
  expect(advanceCampaignTime(campaign, 10)).toBe("none");
  expect(campaign.remainingSeconds).toBe(3);
  expect(loseLife(campaign)).toBe(true);
  expect(campaign.lives).toBe(2);
  expect(campaign.status).toBe("playing");
  expect(campaign.remainingSeconds).toBe(NORMAL_LEVEL_SECONDS);
});

test("level exits reset timer and checkpoint, then finish after the boss arena", () => {
  const campaign = createCampaignState();
  expect(advanceLevel(campaign)).toBe(true);
  expect(campaign.levelIndex).toBe(1);
  expect(campaign.remainingSeconds).toBe(NORMAL_LEVEL_SECONDS);
  campaign.checkpointIndex = 2;
  expect(advanceLevel(campaign)).toBe(true);
  expect(campaign.levelIndex).toBe(2);
  expect(campaign.checkpointIndex).toBe(0);
  expect(advanceLevel(campaign)).toBe(true);
  expect(advanceLevel(campaign)).toBe(true);
  expect(currentLevel(campaign).bossArena).toBe(true);
  expect(campaign.remainingSeconds).toBe(BOSS_ARENA_SECONDS);
  expect(advanceLevel(campaign)).toBe(false);
  expect(campaign.status).toBe("complete");
  expect(advanceLevel(campaign)).toBe(false);
  expect(loseLife(campaign)).toBe(false);
});

test("pausing is reversible only while a campaign is active", () => {
  const campaign = createCampaignState();
  expect(setPaused(campaign, false)).toBe(false);
  expect(setPaused(campaign, true)).toBe(true);
  expect(campaign.status).toBe("paused");
  expect(setPaused(campaign, true)).toBe(false);
  expect(setPaused(campaign, false)).toBe(true);
  expect(setPaused(campaign, false)).toBe(false);
  campaign.status = "complete";
  expect(setPaused(campaign, true)).toBe(false);
  expect(setPaused(campaign, false)).toBe(false);
});
