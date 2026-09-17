import trayMark from "../../../assets/brand/pulso-tray.png";

const HEIGHT = 36;
const GAP = 3;
const PAD = 1;
const BASELINE = 0.5;

const FONT_SIZE = 21;
const FONT = `600 ${FONT_SIZE}px "Geist Variable", system-ui, sans-serif`;

export function badgeLabel(count: number): string | null {
  if (count <= 0) return null;
  if (count > 99) return "99+";
  return String(count);
}

export async function renderBadge(count: number): Promise<number[] | null> {
  const label = badgeLabel(count);
  if (!label) return null;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return null;

  const [mark] = await Promise.all([loadMark(), loadFont()]);
  if (!mark) return null;

  context.font = FONT;
  const width =
    HEIGHT + GAP + Math.ceil(context.measureText(label).width) + PAD;

  canvas.width = width;
  canvas.height = HEIGHT;

  context.font = FONT;
  context.fillStyle = "#000000";
  context.textBaseline = "middle";
  context.drawImage(mark, 0, 0, HEIGHT, HEIGHT);
  context.fillText(label, HEIGHT + GAP, HEIGHT * BASELINE);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), "image/png");
  });
  if (!blob) return null;

  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}

function loadMark(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => resolve(null));
    image.src = trayMark;
  });
}

function loadFont(): Promise<unknown> {
  const fonts = document.fonts;
  if (!fonts) return Promise.resolve(null);

  return fonts.load(FONT).catch(() => null);
}
