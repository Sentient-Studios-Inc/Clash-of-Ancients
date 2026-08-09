import type { ContentBounds } from './transparentImage';
import type { FrameConfig } from './useFrameAnimation';

export interface ImgPlacement {
  /** CSS left of the <img> element (unmirrored space). */
  left: number;
  width: number;
  height: number;
  /** CSS bottom of the <img> element. */
  bottom: number;
  /** CSS transform string (mirror only). */
  transform?: string;
}

export interface ContentRect {
  /** Display-space x of the content mass's left edge (after mirror). */
  left: number;
  /** Display-space x of the content mass's right edge (after mirror). */
  right: number;
  /** Display-space y (from top) of the content mass's top edge. */
  top: number;
  /** Display-space y (from top) of the content mass's bottom edge (ground). */
  bottom: number;
}

export interface FramePlacement {
  img: ImgPlacement;
  /** Content mass rectangle in display space, accounting for mirror. */
  content: ContentRect;
}

/**
 * Shared layout math for a single frame. Pins the content mass (not the
 * image frame) to the ground + chosen anchor edge. Used by both FrameSprite
 * (render) and FrameEditor (guide overlays) so they never drift apart.
 *
 * Coordinate system: x grows right, y grows down (display space). CSS `bottom`
 * is converted internally. `dy > 0` lifts the content above the ground line.
 */
export function placeFrame(
  frame: Pick<FrameConfig, 'dx' | 'dy' | 'scale' | 'anchorEdge'>,
  width: number,
  height: number,
  facing: 'left' | 'right',
  imgNatural: { w: number; h: number },
  bounds: ContentBounds,
): FramePlacement {
  const dx = frame.dx ?? 0;
  const dy = frame.dy ?? 0;
  const userScale = frame.scale ?? 1;
  const anchorEdge = frame.anchorEdge ?? 'center';
  const mirror = facing === 'right';

  const fitScale = Math.min(width / imgNatural.w, height / imgNatural.h) * userScale;
  const renderedW = imgNatural.w * fitScale;
  const renderedH = imgNatural.h * fitScale;
  const contentLeft = bounds.contentLeft;
  const contentRight = bounds.contentRight + 1;
  const contentCenter = (contentLeft + contentRight) / 2;
  const emptyBelowPx = (imgNatural.h - bounds.contentBottom - 1) * fitScale;
  const contentH = (bounds.contentBottom + 1) * fitScale;

  // Horizontal: position so the CONTENT MASS lands on the anchor edge.
  // For a mirrored (right-facing) sprite, source contentLeft becomes the
  // display rear (right side) and source contentRight the front.
  let leftPx: number;
  if (anchorEdge === 'left') {
    leftPx = mirror
      ? dx - renderedW + contentRight * fitScale
      : dx - contentLeft * fitScale;
  } else if (anchorEdge === 'right') {
    leftPx = mirror
      ? width + dx - renderedW + contentLeft * fitScale
      : width + dx - contentRight * fitScale;
  } else {
    leftPx = mirror
      ? width / 2 + dx - renderedW + contentCenter * fitScale
      : width / 2 + dx - contentCenter * fitScale;
  }

  // Vertical: pin content bottom to the ground line, then lift by dy.
  const bottomCss = dy - emptyBelowPx;

  const imgCenterX = leftPx + renderedW / 2;
  const contentLeftDisp = mirror
    ? imgCenterX + (renderedW / 2 - contentRight * fitScale)
    : leftPx + contentLeft * fitScale;
  const contentRightDisp = mirror
    ? imgCenterX + (renderedW / 2 - contentLeft * fitScale)
    : leftPx + contentRight * fitScale;
  const contentBottomY = height - dy;
  const contentTopY = contentBottomY - contentH;

  return {
    img: {
      left: leftPx,
      width: renderedW,
      height: renderedH,
      bottom: bottomCss,
      transform: mirror ? 'scaleX(-1)' : undefined,
    },
    content: {
      left: contentLeftDisp,
      right: contentRightDisp,
      top: contentTopY,
      bottom: contentBottomY,
    },
  };
}
