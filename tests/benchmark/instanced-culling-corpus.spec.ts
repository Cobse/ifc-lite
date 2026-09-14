/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { InstancedCullingCorpusBridge } from '../../apps/viewer/src/lib/testing/instanced-culling-corpus-bridge.js';
import { ViewerBenchmarkPage } from './viewer-benchmark-page.js';

interface ManifestEntry {
  path: string;
  size: number;
  sha256: string;
}

interface PixelComparison {
  width: number;
  height: number;
  changedPixels: number;
  changedRatio: number;
  maxChannelDifference: number;
  meanAbsoluteChannelDifference: number;
}

interface PoseResult {
  name: string;
  directHash: string;
  directRepeatHash: string;
  culledHash: string;
  culledRepeatHash: string;
  pixels: PixelComparison;
  directStability: PixelComparison;
  culledStability: PixelComparison;
  thresholdZeroVisibleOccurrences: number | null;
  lod075VisibleOccurrences: number | null;
  thresholdZeroVisibleTriangles: number | null;
  lod075VisibleTriangles: number | null;
  lod075Pixels: PixelComparison;
  directFrameMs: number[];
  culledFrameMs: number[];
}

const manifest = JSON.parse(
  readFileSync(join(process.cwd(), 'tests/models/manifest.json'), 'utf8'),
) as { files: ManifestEntry[] };
const pathFilter = process.env.CULL_CORPUS_FILTER
  ? new RegExp(process.env.CULL_CORPUS_FILTER, 'i')
  : null;
const requestedLimit = Number.parseInt(process.env.CULL_CORPUS_LIMIT ?? '', 10);
const requestedOffset = Number.parseInt(process.env.CULL_CORPUS_OFFSET ?? '', 10);
const offset = Number.isFinite(requestedOffset) && requestedOffset > 0 ? requestedOffset : 0;
const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
  ? requestedLimit
  : manifest.files.length;
const entries = manifest.files
  .filter((entry) => pathFilter?.test(entry.path) ?? true)
  .slice(offset, offset + limit);
const outputRoot = join(
  process.cwd(),
  process.env.CULL_CORPUS_OUTPUT ?? '.codex-artifacts/instanced-culling-corpus',
);
mkdirSync(outputRoot, { recursive: true });

async function setCulling(page: Page, enabled: boolean, minProjectedDiameter = 0): Promise<void> {
  await page.evaluate(({ nextEnabled, threshold }) => {
    const value = globalThis.__ifc_lite_instanced_culling_bridge__;
    if (!value) throw new Error('instanced culling corpus bridge is unavailable');
    value.setCulling({ enabled: nextEnabled, minProjectedDiameter: threshold });
  }, { nextEnabled: enabled, threshold: minProjectedDiameter });
}

async function requestFrameAndWait(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const value = globalThis.__ifc_lite_instanced_culling_bridge__;
    if (!value) throw new Error('instanced culling corpus bridge is unavailable');
    return value.requestFrameAndWait();
  });
}

async function getStats(
  page: Page,
): Promise<ReturnType<InstancedCullingCorpusBridge['getInstancedStats']>> {
  return page.evaluate(() => {
    const value = globalThis.__ifc_lite_instanced_culling_bridge__;
    if (!value) throw new Error('instanced culling corpus bridge is unavailable');
    return value.getInstancedStats();
  });
}

async function getBounds(
  page: Page,
): Promise<ReturnType<InstancedCullingCorpusBridge['getModelBounds']>> {
  return page.evaluate(() => {
    const value = globalThis.__ifc_lite_instanced_culling_bridge__;
    if (!value) throw new Error('instanced culling corpus bridge is unavailable');
    return value.getModelBounds();
  });
}

async function setCamera(
  page: Page,
  pose: Parameters<InstancedCullingCorpusBridge['setCamera']>,
): Promise<void> {
  await page.evaluate(async (args) => {
    const value = globalThis.__ifc_lite_instanced_culling_bridge__;
    if (!value) throw new Error('instanced culling corpus bridge is unavailable');
    await value.setCamera(...args);
  }, pose);
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function comparePngs(page: Page, direct: Buffer, culled: Buffer): Promise<PixelComparison> {
  return page.evaluate(async ({ directBase64, culledBase64 }) => {
    async function pixels(base64: string): Promise<ImageData> {
      const response = await fetch(`data:image/png;base64,${base64}`);
      const bitmap = await createImageBitmap(await response.blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('2D comparison context unavailable');
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      return context.getImageData(0, 0, canvas.width, canvas.height);
    }
    const [a, b] = await Promise.all([pixels(directBase64), pixels(culledBase64)]);
    if (a.width !== b.width || a.height !== b.height) {
      throw new Error(`screenshot dimensions differ: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
    }
    let changedPixels = 0;
    let maximum = 0;
    let absoluteDifference = 0;
    for (let pixel = 0; pixel < a.width * a.height; pixel++) {
      let changed = false;
      for (let channel = 0; channel < 4; channel++) {
        const index = pixel * 4 + channel;
        const difference = Math.abs(a.data[index] - b.data[index]);
        absoluteDifference += difference;
        maximum = Math.max(maximum, difference);
        changed ||= difference !== 0;
      }
      if (changed) changedPixels++;
    }
    return {
      width: a.width,
      height: a.height,
      changedPixels,
      changedRatio: changedPixels / (a.width * a.height),
      maxChannelDifference: maximum,
      meanAbsoluteChannelDifference: absoluteDifference / a.data.length,
    };
  }, {
    directBase64: direct.toString('base64'),
    culledBase64: culled.toString('base64'),
  });
}

async function sampleFrames(
  page: Page,
  enabled: boolean,
  samples: number,
  minProjectedDiameter = 0,
): Promise<number[]> {
  await setCulling(page, enabled, minProjectedDiameter);
  for (let warmup = 0; warmup < 5; warmup++) {
    await requestFrameAndWait(page);
  }
  const values: number[] = [];
  for (let sample = 0; sample < samples; sample++) {
    values.push(await requestFrameAndWait(page));
  }
  return values;
}

test.describe('IFNS culling full corpus', () => {
  for (const entry of entries) {
    test(entry.path, async ({ page }) => {
      const fixture = join(process.cwd(), 'tests/models', entry.path);
      test.skip(!existsSync(fixture), `${entry.path} missing — run \`pnpm fixtures\``);
      await page.addInitScript(() => {
        globalThis.__IFC_LITE_INSTANCED_CULLING_CORPUS__ = true;
      });
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(String(error)));
      const viewer = new ViewerBenchmarkPage(page);
      await viewer.setup('http://localhost:3000/?ifcLiteInstancedCullingCorpus=1');
      await viewer.loadFile(fixture);
      await page.waitForFunction(
        () => Boolean(globalThis.__ifc_lite_instanced_culling_bridge__),
        undefined,
        { timeout: 30_000 },
      );
      const timeout = entry.size > 200_000_000 ? 720_000
        : entry.size > 50_000_000 ? 420_000
          : 240_000;
      const isStep = /\.ifc$/i.test(entry.path);
      if (isStep) {
        await viewer.waitForCompletion(timeout);
      } else {
        await page.waitForFunction(
          () => {
            const state = globalThis.__ifc_lite_instanced_culling_bridge__?.getLoadState();
            return state !== undefined
              && !state.loading
              && !state.geometryStreamingActive
              && (state.error !== null || state.progress?.percent === 100 || state.meshCount > 0);
          },
          undefined,
          { timeout: Math.min(timeout, 120_000) },
        );
      }
      const loaderMetrics = viewer.getMetrics();
      if (isStep) {
        expect(loaderMetrics.totalMeshes, `missing load-completion metrics for ${entry.path}`).not.toBeNull();
      }
      await requestFrameAndWait(page);
      const stats = await getStats(page);
      if (stats.occurrenceCount > 0) {
        await page.waitForFunction(
          () => globalThis.__ifc_lite_instanced_culling_bridge__?.getModelBounds() !== null,
          undefined,
          { timeout: 30_000 },
        );
      }
      await page.addStyleTag({
        content: 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }',
      });
      await requestFrameAndWait(page);
      const bounds = await getBounds(page);
      const loadState = await page.evaluate(() => {
        const value = globalThis.__ifc_lite_instanced_culling_bridge__;
        if (!value) throw new Error('instanced culling corpus bridge is unavailable');
        return value.getLoadState();
      });
      const consoleLogs = viewer.getConsoleLogs();
      console.log(`[culling-corpus] ${entry.path}: ${stats.templateCount} templates, ${stats.occurrenceCount} occurrences`);
      const result: {
        fixture: ManifestEntry & { actualSize: number };
        adapter: { vendor: string; architecture: string; device: string; description: string } | null;
        loaderMetrics: typeof loaderMetrics;
        loadState: typeof loadState;
        stats: typeof stats;
        bounds: typeof bounds;
        poses: PoseResult[];
        pageErrors: string[];
        geometryWarningCount: number;
      } = {
        fixture: { ...entry, actualSize: statSync(fixture).size },
        adapter: await page.evaluate(async () => {
          const info = (await navigator.gpu?.requestAdapter())?.info;
          return info ? {
            vendor: info.vendor,
            architecture: info.architecture,
            device: info.device,
            description: info.description,
          } : null;
        }),
        loaderMetrics,
        loadState,
        stats,
        bounds,
        poses: [],
        pageErrors,
        geometryWarningCount: consoleLogs.filter((line) => (
          line.includes('Batch of') && line.includes('failed')
          || line.includes('Skipping entity')
          || line.includes('instanced shard upload failed')
        )).length,
      };

      if (stats.occurrenceCount > 0 && bounds) {
        const canvas = page.locator('canvas').first();
        const center = {
          x: (bounds.min.x + bounds.max.x) / 2,
          y: (bounds.min.y + bounds.max.y) / 2,
          z: (bounds.min.z + bounds.max.z) / 2,
        };
        const radius = Math.max(
          Math.hypot(
            bounds.max.x - bounds.min.x,
            bounds.max.y - bounds.min.y,
            bounds.max.z - bounds.min.z,
          ) / 2,
          1,
        );
        const poses = [
          {
            name: 'isometric-perspective',
            position: { x: center.x + radius * 1.8, y: center.y + radius * 1.4, z: center.z + radius * 1.8 },
            projection: 'perspective' as const,
            up: { x: 0, y: 1, z: 0 },
          },
          {
            name: 'top-orthographic',
            position: { x: center.x, y: center.y + radius * 2.5, z: center.z + radius * 0.001 },
            projection: 'orthographic' as const,
            up: { x: 0, y: 0, z: -1 },
          },
        ];
        for (const pose of poses) {
          console.log(`[culling-corpus] ${entry.path}: ${pose.name} camera`);
          await setCamera(page, [pose.position, center, pose.projection, pose.up]);
          console.log(`[culling-corpus] ${entry.path}: ${pose.name} direct samples`);
          const directFrameMs = await sampleFrames(page, false, 10);
          console.log(`[culling-corpus] ${entry.path}: ${pose.name} direct screenshot`);
          const direct = await canvas.screenshot();
          await requestFrameAndWait(page);
          const directRepeat = await canvas.screenshot();
          console.log(`[culling-corpus] ${entry.path}: ${pose.name} culled samples`);
          const culledFrameMs = await sampleFrames(page, true, 10);
          console.log(`[culling-corpus] ${entry.path}: ${pose.name} culled screenshot`);
          const culled = await canvas.screenshot();
          await requestFrameAndWait(page);
          const culledRepeat = await canvas.screenshot();
          const thresholdZeroCounts = await page.evaluate(async () => (
            globalThis.__ifc_lite_instanced_culling_bridge__?.getCullingCounts() ?? null
          ));
          await sampleFrames(page, true, 5, 0.75);
          const lod075 = await canvas.screenshot();
          const lod075Counts = await page.evaluate(async () => (
            globalThis.__ifc_lite_instanced_culling_bridge__?.getCullingCounts() ?? null
          ));
          result.poses.push({
            name: pose.name,
            directHash: sha256(direct),
            directRepeatHash: sha256(directRepeat),
            culledHash: sha256(culled),
            culledRepeatHash: sha256(culledRepeat),
            pixels: await comparePngs(page, direct, culled),
            directStability: await comparePngs(page, direct, directRepeat),
            culledStability: await comparePngs(page, culled, culledRepeat),
            thresholdZeroVisibleOccurrences: thresholdZeroCounts?.visibleOccurrences ?? null,
            lod075VisibleOccurrences: lod075Counts?.visibleOccurrences ?? null,
            thresholdZeroVisibleTriangles: thresholdZeroCounts?.visibleTriangles ?? null,
            lod075VisibleTriangles: lod075Counts?.visibleTriangles ?? null,
            lod075Pixels: await comparePngs(page, culled, lod075),
            directFrameMs,
            culledFrameMs,
          });
          if (sha256(direct) !== sha256(culled)) {
            const safe = entry.path.replace(/[^a-zA-Z0-9]+/g, '_');
            writeFileSync(join(outputRoot, `${safe}-${pose.name}-direct.png`), direct);
            writeFileSync(join(outputRoot, `${safe}-${pose.name}-culled.png`), culled);
          }
        }
        result.stats = await getStats(page);
      }

      const output = join(outputRoot, `${entry.path.replace(/[^a-zA-Z0-9]+/g, '_')}.json`);
      writeFileSync(output, JSON.stringify(result, null, 2));
      expect(pageErrors, `uncaught errors for ${basename(entry.path)}`).toEqual([]);
      for (const pose of result.poses) {
        expect(pose.pixels.changedPixels, `${entry.path} ${pose.name} color parity`).toBe(0);
        if (
          pose.thresholdZeroVisibleOccurrences !== null
          && pose.lod075VisibleOccurrences !== null
        ) {
          expect(
            pose.lod075VisibleOccurrences,
            `${entry.path} ${pose.name} LOD visibility monotonicity`,
          ).toBeLessThanOrEqual(pose.thresholdZeroVisibleOccurrences);
        }
      }
    });
  }
});
