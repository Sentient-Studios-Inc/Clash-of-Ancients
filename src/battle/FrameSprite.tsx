import { useEffect, useState } from 'react';
import type { FrameConfig } from './useFrameAnimation';
import { transparentSrcAsync, transparentSrcSync, type ContentBounds } from './transparentImage';
import { placeFrame } from './frameLayout';

interface FrameSpriteProps {
  frame: FrameConfig | null;
  width: number;
  height: number;
  showDebug?: boolean;
  frameNumber?: number;
  totalFrames?: number;
  /** Which way the sprite faces. 'right' mirrors the image horizontally. */
  facing?: 'left' | 'right';
}

/**
 * Renders a single animation frame with ground-aligned bottom:
 * the lowest opaque pixel of each sprite is pinned to the bottom edge
 * of the container so all creatures stand on the same ground line.
 *
 * Per-frame alignment (`dx`, `dy`, `scale`, `anchorEdge`) is applied on top
 * of the ground fit so individual frames can be nudged without touching the
 * image assets. When `facing === 'right'`, the whole frame is mirrored so
 * coordinates stay consistent regardless of facing.
 */
export function FrameSprite({
  frame,
  width,
  height,
  showDebug = false,
  frameNumber,
  totalFrames,
  facing = 'left',
}: FrameSpriteProps) {
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [bounds, setBounds] = useState<ContentBounds | null>(null);
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!frame?.src) {
      setProcessedUrl(null);
      setBounds(null);
      setImgNatural(null);
      return;
    }
    let cancelled = false;

    const cached = transparentSrcSync(frame.src);
    if (cached) {
      setProcessedUrl(cached.url);
      setBounds(cached.bounds);
      setImgNatural({ w: cached.bounds.width, h: cached.bounds.height });
    }

    void transparentSrcAsync(frame.src).then(({ url, bounds: b }) => {
      if (cancelled) return;
      setProcessedUrl(url);
      setBounds(b);
      setImgNatural({ w: b.width, h: b.height });
    });

    return () => { cancelled = true; };
  }, [frame?.src]);

  if (!frame) return <div style={{ width, height }} />;

  if (frame.src) {
    const mirror = facing === 'right';
    let imgStyle: React.CSSProperties;

    if (imgNatural && imgNatural.w > 0 && imgNatural.h > 0 && bounds) {
      const { img } = placeFrame(frame, width, height, facing, imgNatural, bounds);
      imgStyle = {
        position: 'absolute',
        left: img.left,
        width: img.width,
        height: img.height,
        bottom: img.bottom,
        imageRendering: 'pixelated',
        transform: img.transform,
      };
    } else {
      imgStyle = {
        position: 'absolute',
        maxWidth: width,
        maxHeight: height,
        bottom: 0,
        left: '50%',
        imageRendering: 'pixelated',
        transform: `translateX(-50%)${mirror ? ' scaleX(-1)' : ''}`,
      };
    }

    return (
      <div className="relative" style={{ width, height }}>
        <img
          src={processedUrl ?? frame.src}
          alt={frame.label}
          style={imgStyle}
        />
        {showDebug && (
          <div className="absolute bottom-0 left-0 bg-black/70 px-1.5 py-0.5 text-[10px] font-mono text-cyan-300 z-10">
            {frameNumber}/{totalFrames}
          </div>
        )}
      </div>
    );
  }

  // Placeholder box
  return (
    <div
      className="relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed"
      style={{
        width,
        height,
        borderColor: 'rgba(168, 137, 63, 0.5)',
        background:
          'repeating-linear-gradient(45deg, rgba(90,70,40,0.15) 0 12px, rgba(60,45,25,0.15) 12px 24px)',
      }}
    >
      <div className="text-center">
        <div className="font-display text-sm font-bold text-amber-300/70">{frame.label}</div>
        <div className="mt-1 text-[10px] font-mono text-amber-200/40">{width}×{height}</div>
      </div>
      {showDebug && (
        <div className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 text-[10px] font-mono text-cyan-300">
          {frameNumber}/{totalFrames}
        </div>
      )}
    </div>
  );
}
