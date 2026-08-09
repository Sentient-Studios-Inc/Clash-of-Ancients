import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import type { FrameConfig } from './useFrameAnimation';
import { transparentSrcAsync, type ContentBounds } from './transparentImage';
import { placeFrame } from './frameLayout';

export type ExportFormat = 'gif' | 'sheet';
export type ExportSlot = 'cyclops' | 'medusa';

export interface ExportOptions {
  frames: FrameConfig[];
  width: number;
  height: number;
  facing: 'left' | 'right';
  slot: ExportSlot;
  format: ExportFormat;
  /** Pixel-density multiplier for crisp output. Default 2. */
  pixelRatio?: number;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
}

const DEFAULT_PIXEL_RATIO = 2;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load sprite image'));
    img.src = src;
  });
}

interface ResolvedFrame {
  img: HTMLImageElement;
  bounds: ContentBounds;
  naturalW: number;
  naturalH: number;
  config: FrameConfig;
}

async function resolveFrames(
  frames: FrameConfig[],
): Promise<ResolvedFrame[]> {
  const resolved: ResolvedFrame[] = [];
  for (const config of frames) {
    if (!config.src) continue;
    const { url, bounds } = await transparentSrcAsync(config.src);
    const img = await loadImage(url);
    resolved.push({
      img,
      bounds,
      naturalW: bounds.width || img.naturalWidth,
      naturalH: bounds.height || img.naturalHeight,
      config,
    });
  }
  return resolved;
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  resolved: ResolvedFrame,
  canvasW: number,
  canvasH: number,
  facing: 'left' | 'right',
  pixelRatio: number,
  offsetX: number = 0,
  offsetY: number = 0,
) {
  const { config, bounds, naturalW, naturalH, img } = resolved;
  if (naturalW <= 0 || naturalH <= 0) return;

  const placement = placeFrame(
    config,
    canvasW,
    canvasH,
    facing,
    { w: naturalW, h: naturalH },
    bounds,
  );

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(pixelRatio, pixelRatio);

  if (placement.img.transform) {
    const cx = placement.img.left + placement.img.width / 2;
    const cy = 0;
    ctx.translate(cx, cy);
    ctx.scale(-1, 1);
    ctx.translate(-cx, -cy);
  }

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    img,
    placement.img.left,
    (canvasH - placement.img.height - placement.img.bottom),
    placement.img.width,
    placement.img.height,
  );

  ctx.restore();
}

export async function exportSprite(opts: ExportOptions): Promise<ExportResult> {
  const pixelRatio = opts.pixelRatio ?? DEFAULT_PIXEL_RATIO;
  const resolved = await resolveFrames(opts.frames);

  if (resolved.length === 0) {
    throw new Error('No frames with images found to export.');
  }

  const sideLabel = opts.slot === 'cyclops' ? 'left' : 'right';

  if (opts.format === 'sheet') {
    return exportSpriteSheet(resolved, opts, pixelRatio, sideLabel);
  }
  return exportGif(resolved, opts, pixelRatio, sideLabel);
}

async function exportSpriteSheet(
  resolved: ResolvedFrame[],
  opts: ExportOptions,
  pixelRatio: number,
  sideLabel: string,
): Promise<ExportResult> {
  const cols = Math.min(8, resolved.length);
  const rows = Math.ceil(resolved.length / cols);
  const cellW = opts.width * pixelRatio;
  const cellH = opts.height * pixelRatio;

  const canvas = document.createElement('canvas');
  canvas.width = cols * cellW;
  canvas.height = rows * cellH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported in this browser.');

  ctx.imageSmoothingEnabled = false;

  resolved.forEach((r, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    drawFrame(ctx, r, opts.width, opts.height, opts.facing, pixelRatio, col * cellW, row * cellH);
  });

  const blob = await canvasToBlob(canvas, 'image/png');
  if (!blob) throw new Error('Failed to generate sprite sheet image.');
  return { blob, filename: `${sideLabel}-sprite-sheet.png` };
}

async function exportGif(
  resolved: ResolvedFrame[],
  opts: ExportOptions,
  pixelRatio: number,
  sideLabel: string,
): Promise<ExportResult> {
  const canvasW = opts.width * pixelRatio;
  const canvasH = opts.height * pixelRatio;

  const encoder = GIFEncoder();
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas not supported in this browser.');

  ctx.imageSmoothingEnabled = false;

  for (let i = 0; i < resolved.length; i++) {
    ctx.clearRect(0, 0, canvasW, canvasH);
    drawFrame(ctx, resolved[i], opts.width, opts.height, opts.facing, pixelRatio);

    const imageData = ctx.getImageData(0, 0, canvasW, canvasH);
    const { data, width, height } = imageData;

    const palette = quantize(data, 256, { format: 'rgba4444' });
    const index = applyPalette(data, palette, 'rgba4444');

    const delay = Math.max(20, Math.round((resolved[i].config.duration ?? 160) / 10));

    encoder.writeFrame(index, width, height, {
      palette,
      delay,
      transparent: true,
      transparentIndex: 0,
      dispose: 2,
    });
  }

  encoder.finish();
  const bytes = encoder.bytes();
  const blob = new Blob([bytes], { type: 'image/gif' });
  return { blob, filename: `${sideLabel}-sprite-idle.gif` };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type);
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
