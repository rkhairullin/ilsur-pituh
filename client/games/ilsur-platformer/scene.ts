const worldWidth = 1200;
const worldHeight = 540;

export function drawPlaceholderScene(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const scale = Math.min(width / worldWidth, height / worldHeight);
  const offsetX = (width - worldWidth * scale) / 2;
  const offsetY = (height - worldHeight * scale) / 2;

  context.clearRect(0, 0, width, height);
  context.save();
  context.translate(offsetX, offsetY);
  context.scale(scale, scale);

  context.fillStyle = "#251137";
  context.fillRect(0, 0, worldWidth, worldHeight);

  context.fillStyle = "#442052";
  context.fillRect(55, 85, 245, 180);
  context.fillRect(890, 70, 245, 200);
  context.fillStyle = "#682a65";
  context.fillRect(0, 390, worldWidth, 150);

  context.fillStyle = "#dc4c9b";
  context.fillRect(0, 390, worldWidth, 18);
  context.fillStyle = "#62d9dc";
  context.fillRect(300, 315, 190, 24);
  context.fillRect(590, 245, 160, 24);
  context.fillRect(900, 330, 150, 22);
  context.fillStyle = "#f4cb62";
  context.fillRect(95, 325, 132, 22);

  context.fillStyle = "#f4cb62";
  context.fillRect(125, 298, 54, 76);
  context.fillStyle = "#f3ecf6";
  context.fillRect(132, 270, 40, 36);
  context.fillStyle = "#dc4c9b";
  context.fillRect(136, 260, 9, 12);
  context.fillRect(148, 253, 9, 19);
  context.fillRect(160, 260, 9, 12);
  context.fillStyle = "#251137";
  context.fillRect(158, 282, 5, 5);

  context.restore();
}
