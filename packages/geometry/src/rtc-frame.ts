/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * One home for "which RTC frame does this model render in" on the TypeScript
 * side (issue #4611).
 *
 * Every WASM mesh path starts from a pre-pass that reports the offset it
 * detected for THIS model, and every one of them can be overridden by a
 * federation-wide offset so a set of models shares one coordinate space. The
 * rule has three parts and all three have to move together:
 *
 *  - a caller-supplied `sharedRtcOffset` wins over the detected offset;
 *  - it also FORCES `needsShift`, because the shared origin is only honoured
 *    if the mesh path is told to subtract something (a model whose own
 *    coordinates are small reports `needsShift: false`, and shipping that
 *    beside a non-zero shared offset renders it a federation-offset away from
 *    the others);
 *  - with no shared offset, absence of a detected offset means the zero
 *    vector, not `undefined`.
 *
 * That rule was written out three times — `applyPrePassMetadata` and
 * `processStreamingBytes` in index.ts and `sendStreamStartIfReady` in
 * geometry-parallel.ts — one per mesh path, so a model loaded through the
 * sync path, the streaming path and the worker pool could have disagreed
 * about its own origin with nothing to catch it.
 */

/** The offset a mesh path must subtract, and whether it must subtract at all. */
export interface RtcFrame {
  x: number;
  y: number;
  z: number;
  needsShift: boolean;
}

/** What a pre-pass reports about the offset it detected for one model. */
export interface DetectedRtc {
  /** `[x, y, z]` in IFC metres; absent when the pre-pass found no anchor. */
  rtcOffset?: ArrayLike<number> | null;
  needsShift?: boolean | null;
}

/**
 * Resolve the frame a mesh path renders in, given what the pre-pass detected
 * and an optional federation override.
 */
export function resolveRtcFrame(
  detected: DetectedRtc,
  sharedRtcOffset?: { x: number; y: number; z: number } | null,
): RtcFrame {
  if (sharedRtcOffset != null) {
    return {
      x: sharedRtcOffset.x,
      y: sharedRtcOffset.y,
      z: sharedRtcOffset.z,
      needsShift: true,
    };
  }
  const detectedOffset = detected.rtcOffset;
  return {
    x: detectedOffset?.[0] ?? 0,
    y: detectedOffset?.[1] ?? 0,
    z: detectedOffset?.[2] ?? 0,
    needsShift: Boolean(detected.needsShift),
  };
}
