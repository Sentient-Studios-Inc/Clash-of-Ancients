/**
 * Chroma-key out the near-uniform background of a sprite image using canvas.
 *
 * Two paths:
 *  - If the image already carries a usable alpha channel (any transparency),
 *    we trust it as the mask and only compute content bounds. This prevents
 *    dark sprite pixels from being keyed out when the source was already
 *    transparent but happened to render black in some viewers.
 *  - If the image is fully opaque, we estimate the background color from the
 *    median of edge samples (not just the 4 corners) so a sprite that touches
 *    a corner can't contaminate the estimate, then make pixels close to that
 *    color transparent with a soft feather edge. We also detect the bounding
 *    box of the remaining opaque content for ground alignment.
 *
 * Results are cached per source URL.
 */

export interface ContentBounds {
  /** Y offset from the top of the image to the lowest opaque pixel. */
  contentBottom: number;
  /** X bounds of opaque content. */
  contentLeft: number;
  contentRight: number;
  width: number;
  height: number;
}

interface Processed {
  url: string;
  bounds: ContentBounds;
}

const cache = new Map<string, Processed>();
const pending = new Map<string, Promise<Processed>>();

function stripBackground(
  dataUrl: string,
  threshold: number,
  feather: number,
): Promise<Processed> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve({ url: dataUrl, bounds: fallbackBounds(img) });
          return;
        }
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const px = data.data;
        const w = canvas.width;
        const h = canvas.height;
        const total = w * h;

        // Detect whether the source already has a usable alpha channel. If
        // even ~2% of pixels are not fully opaque, treat the alpha channel as
        // authoritative and skip chroma-keying entirely — keying an already-
        // transparent image would eat dark sprite pixels whose RGB happens to
        // match the background.
        let opaqueCount = 0;
        for (let i = 3; i < px.length; i += 4) {
          if (px[i] >= 250) opaqueCount++;
        }
        const hasAlpha = opaqueCount < total * 0.98;

        if (hasAlpha) {
          const bounds = computeBoundsFromAlpha(px, w, h);
          resolve({ url: canvas.toDataURL('image/png'), bounds });
          return;
        }

        // Fully opaque: estimate bg from the median of edge samples so a
        // sprite touching a corner/edge can't skew the estimate.
        const bg = estimateEdgeBackground(px, w, h);

        const t2 = threshold * threshold;
        const f2 = feather * feather;
        const background = findEdgeConnectedBackground(px, w, h, bg, t2 + f2);
        const rowCounts = new Array(h).fill(0);
        let contentLeft = w;
        let contentRight = -1;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const pixel = y * w + x;
            const i = pixel * 4;
            const dr = px[i] - bg[0];
            const dg = px[i + 1] - bg[1];
            const db = px[i + 2] - bg[2];
            const dist2 = dr * dr + dg * dg + db * db;
            if (background[pixel]) {
              if (dist2 <= t2) {
                px[i + 3] = 0;
              } else if (dist2 < t2 + f2) {
                const t = (dist2 - t2) / f2;
                px[i + 3] = Math.min(px[i + 3], Math.round(t * 255));
              }
            }
            if (px[i + 3] > 16) {
              rowCounts[y]++;
              if (x < contentLeft) contentLeft = x;
              if (x > contentRight) contentRight = x;
            }
          }
        }
        ctx.putImageData(data, 0, 0);
        const bounds = finalizeBounds(w, h, rowCounts, contentLeft, contentRight);
        resolve({ url: canvas.toDataURL('image/png'), bounds });
      } catch {
        resolve({ url: dataUrl, bounds: fallbackBounds(img) });
      }
    };
    img.onerror = () => resolve({ url: dataUrl, bounds: { contentBottom: 0, contentLeft: 0, contentRight: 0, width: 0, height: 0 } });
    img.src = dataUrl;
  });
}

/**
 * Four-way flood fill from the image borders. A pixel joins the fill only if
 * its RGB distance to the estimated background color is within `tol2`, so the
 * fill stops at the sprite outline and cannot reach enclosed background-
 * colored regions (e.g. the inside of a hollow sprite). Returns a boolean
 * mask the same length as `w * h`.
 */
function findEdgeConnectedBackground(
  px: Uint8ClampedArray,
  w: number,
  h: number,
  bg: number[],
  tol2: number,
): Uint8Array {
  const mask = new Uint8Array(w * h);
  const stack: number[] = [];
  const matches = (pixel: number) => {
    const i = pixel * 4;
    const dr = px[i] - bg[0];
    const dg = px[i + 1] - bg[1];
    const db = px[i + 2] - bg[2];
    return dr * dr + dg * dg + db * db <= tol2;
  };
  const push = (x: number, y: number) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const pixel = y * w + x;
    if (mask[pixel]) return;
    if (!matches(pixel)) return;
    mask[pixel] = 1;
    stack.push(pixel);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const pixel = stack.pop()!;
    const x = pixel % w;
    const y = (pixel / w) | 0;
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }
  return mask;
}

function estimateEdgeBackground(px: Uint8ClampedArray, w: number, h: number): number[] {
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const step = Math.max(1, Math.floor(Math.min(w, h) / 64));
  const push = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    rs.push(px[i]);
    gs.push(px[i + 1]);
    bs.push(px[i + 2]);
  };
  for (let x = 0; x < w; x += step) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y += step) {
    push(0, y);
    push(w - 1, y);
  }
  rs.sort((a, b) => a - b);
  gs.sort((a, b) => a - b);
  bs.sort((a, b) => a - b);
  const mid = (a: number[]) => (a.length === 0 ? 0 : a[Math.floor(a.length / 2)]);
  return [mid(rs), mid(gs), mid(bs)];
}

function computeBoundsFromAlpha(px: Uint8ClampedArray, w: number, h: number): ContentBounds {
  const rowCounts = new Array(h).fill(0);
  let contentLeft = w;
  let contentRight = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (px[i + 3] > 16) {
        rowCounts[y]++;
        if (x < contentLeft) contentLeft = x;
        if (x > contentRight) contentRight = x;
      }
    }
  }
  return finalizeBounds(w, h, rowCounts, contentLeft, contentRight);
}

function finalizeBounds(
  w: number,
  h: number,
  rowCounts: number[],
  contentLeft: number,
  contentRight: number,
): ContentBounds {
  // A row counts as "content" only if it has a meaningful amount of opaque
  // pixels — this ignores sparse border noise (1-6 stray pixels per row)
  // that would otherwise drag the content bottom down to the image edge.
  const rowThreshold = Math.max(8, Math.floor(w * 0.01));
  let contentBottom = -1;
  for (let y = h - 1; y >= 0; y--) {
    if (rowCounts[y] >= rowThreshold) {
      contentBottom = y;
      break;
    }
  }
  if (contentBottom < 0) {
    return { contentBottom: h, contentLeft: 0, contentRight: w - 1, width: w, height: h };
  }
  return { contentBottom, contentLeft, contentRight, width: w, height: h };
}

function fallbackBounds(img: HTMLImageElement): ContentBounds {
  return {
    contentBottom: img.naturalHeight || 0,
    contentLeft: 0,
    contentRight: (img.naturalWidth || 1) - 1,
    width: img.naturalWidth || 0,
    height: img.naturalHeight || 0,
  };
}

/**
 * Resolves to the processed (transparent) version of `src` plus the content
 * bounds. Cached per URL.
 */
export async function transparentSrcAsync(src: string): Promise<Processed> {
  if (!src) return { url: src, bounds: { contentBottom: 0, contentLeft: 0, contentRight: 0, width: 0, height: 0 } };
  const cached = cache.get(src);
  if (cached) return cached;
  if (!pending.has(src)) {
    const p = stripBackground(src, 38, 18).then((result) => {
      cache.set(src, result);
      pending.delete(src);
      return result;
    });
    pending.set(src, p);
  }
  return pending.get(src)!;
}

/** Synchronous cached lookup; returns null if not yet processed. */
export function transparentSrcSync(src: string): Processed | null {
  return cache.get(src) ?? null;
}

export function clearTransparentCache(): void {
  cache.clear();
  pending.clear();
}
