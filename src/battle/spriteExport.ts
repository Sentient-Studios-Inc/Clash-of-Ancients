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
  /** Playback speed multiplier to match on-screen timing. Default 1. */
  speed?: number;
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

function computeFrameBounds(
  resolved: ResolvedFrame[],
  opts: ExportOptions,
): { minX: number; minY: number; contentW: number; contentH: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const r of resolved) {
    if (r.naturalW <= 0 || r.naturalH <= 0) continue;
    const placement = placeFrame(
      r.config,
      opts.width,
      opts.height,
      opts.facing,
      { w: r.naturalW, h: r.naturalH },
      r.bounds,
    );
    const left = placement.img.left;
    const right = placement.img.left + placement.img.width;
    const top = opts.height - placement.img.height - placement.img.bottom;
    const bottom = top + placement.img.height;
    minX = Math.min(minX, left);
    maxX = Math.max(maxX, right);
    minY = Math.min(minY, top);
    maxY = Math.max(maxY, bottom);
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, contentW: opts.width, contentH: opts.height };
  }
  return {
    minX: Math.floor(minX),
    minY: Math.floor(minY),
    contentW: Math.ceil(maxX - minX),
    contentH: Math.ceil(maxY - minY),
  };
}

async function exportSpriteSheet(
  resolved: ResolvedFrame[],
  opts: ExportOptions,
  pixelRatio: number,
  sideLabel: string,
): Promise<ExportResult> {
  const bounds = computeFrameBounds(resolved, opts);
  const cols = Math.min(8, resolved.length);
  const rows = Math.ceil(resolved.length / cols);
  const cellW = bounds.contentW * pixelRatio;
  const cellH = bounds.contentH * pixelRatio;

  const canvas = document.createElement('canvas');
  canvas.width = cols * cellW;
  canvas.height = rows * cellH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported in this browser.');

  ctx.imageSmoothingEnabled = false;

  resolved.forEach((r, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    drawFrame(ctx, r, opts.width, opts.height, opts.facing, pixelRatio, col * bounds.contentW - bounds.minX, row * bounds.contentH - bounds.minY);
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
  const bounds = computeFrameBounds(resolved, opts);
  const canvasW = bounds.contentW * pixelRatio;
  const canvasH = bounds.contentH * pixelRatio;

  const encoder = GIFEncoder();
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas not supported in this browser.');

  ctx.imageSmoothingEnabled = false;

  const speed = Math.max(0.1, opts.speed ?? 1);

  for (let i = 0; i < resolved.length; i++) {
    ctx.clearRect(0, 0, canvasW, canvasH);
    drawFrame(ctx, resolved[i], opts.width, opts.height, opts.facing, pixelRatio, -bounds.minX, -bounds.minY);

    const imageData = ctx.getImageData(0, 0, canvasW, canvasH);
    const { data, width, height } = imageData;

    // Reserve palette slot 0 for transparency and force fully transparent
    // pixels to quantize to it, so the GIF's transparentIndex resolves to a
    // true transparent slot instead of a near-black opaque color.
    const palette = quantize(data, 255, { format: 'rgba4444' });
    palette.unshift(0, 0, 0, 0);
    const index = applyPalette(data, palette, 'rgba4444');
    for (let p = 0; p < index.length; p++) {
      if (data[p * 4 + 3] === 0) index[p] = 0;
    }

    const actualDuration = (resolved[i].config.duration ?? 160) / speed;
    const delay = Math.max(20, Math.round(actualDuration));

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
