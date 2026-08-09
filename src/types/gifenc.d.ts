declare module 'gifenc' {
  export interface GIFEncoderInstance {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: number[];
        delay?: number;
        transparent?: boolean;
        transparentIndex?: number;
        dispose?: number;
        repeat?: number;
        first?: boolean;
      },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    reset(): void;
    buffer(): ArrayBuffer;
  }

  export function GIFEncoder(): GIFEncoderInstance;

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    opts?: { format?: 'rgb565' | 'rgba4444' | 'rgb444'; oneBitAlpha?: boolean | number; clearAlpha?: boolean },
  ): number[];

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[],
    format?: 'rgb565' | 'rgba4444' | 'rgb444',
  ): Uint8Array;
}
