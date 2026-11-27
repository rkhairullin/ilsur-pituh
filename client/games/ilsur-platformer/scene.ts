import { VIEW_HEIGHT, VIEW_WIDTH, type GameState } from "./game.js";
import { currentLevel } from "./campaign.js";

export function drawPlatformerScene(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: GameState,
) {
  const scale = Math.min(width / VIEW_WIDTH, height / VIEW_HEIGHT);
  const offsetX = (width - VIEW_WIDTH * scale) / 2;
  const offsetY = (height - VIEW_HEIGHT * scale) / 2;

  context.clearRect(0, 0, width, height);
  context.save();
  context.translate(offsetX, offsetY);
  context.scale(scale, scale);
  context.fillStyle = "#251137";
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  const level = currentLevel(state.campaign);
  context.save();
  context.translate(-state.cameraX, 0);

  context.fillStyle = "#442052";
  for (const x of [120, 560, 980, 1460, 1880, 2320]) {
    context.fillRect(x, 92, 190, 76);
  }

  for (const platform of level.platforms) {
    context.fillStyle = platform.y === 480 ? "#682a65" : "#62d9dc";
    context.fillRect(platform.x, platform.y, platform.width, platform.height);
    context.fillStyle = platform.y === 480 ? "#dc4c9b" : "#f4cb62";
    context.fillRect(platform.x, platform.y, platform.width, 8);
  }

  for (const [index, checkpoint] of level.checkpoints.entries()) {
    if (index === 0) continue;
    context.fillStyle =
      index <= state.campaign.checkpointIndex ? "#f4cb62" : "#8c6698";
    context.fillRect(checkpoint.x, level.groundY - 74, 6, 74);
    context.fillRect(checkpoint.x + 6, level.groundY - 74, 36, 20);
  }
  context.fillStyle = "#62d9dc";
  context.fillRect(level.exitX - 60, level.groundY - 90, 8, 90);
  context.fillRect(level.exitX - 52, level.groundY - 90, 50, 32);

  for (const projectile of state.projectiles) {
    context.fillStyle = "#f4cb62";
    context.fillRect(projectile.x - 7, projectile.y - 4, 14, 8);
  }

  const player = state.player;
  const headHeight = player.crouched ? 24 : 32;
  const bodyTop = player.y + headHeight;
  context.fillStyle = "#f4cb62";
  context.fillRect(
    player.x + 3,
    bodyTop,
    player.width - 6,
    player.height - headHeight,
  );
  context.fillStyle = "#f3ecf6";
  context.fillRect(player.x + 5, player.y, player.width - 10, headHeight);
  context.fillStyle = "#dc4c9b";
  context.fillRect(player.x + 8, player.y - 8, 6, 10);
  context.fillRect(player.x + 18, player.y - 12, 6, 14);
  context.fillRect(player.x + 28, player.y - 8, 6, 10);
  context.fillStyle = "#251137";
  const eyeX = player.facing === 1 ? player.x + 28 : player.x + 10;
  context.fillRect(eyeX, player.y + 12, 5, 5);

  context.restore();
  context.restore();
}
