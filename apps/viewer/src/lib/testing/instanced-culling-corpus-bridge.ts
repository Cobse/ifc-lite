/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { Renderer } from '@ifc-lite/renderer';
import { useViewerStore } from '../../store/index.js';

export interface CorpusCullingOptions {
  enabled?: boolean;
  minProjectedDiameter?: number;
}

interface CorpusInstancedStats {
  templateCount: number;
  occurrenceCount: number;
  templateTriangleCount: number;
  expandedTriangleCount: number;
  sourceInstanceBytes: number;
  cpuBoundingSphereBytes: number;
  estimatedCullingGpuBytes: number;
  allocatedCullingGpuBytes: number;
}

interface CorpusInstancedTemplate {
  instanceCount: number;
  indexCount: number;
  indirectBuffer?: GPUBuffer;
}

interface CorpusSceneDiagnostics {
  getInstancedStats(): CorpusInstancedStats;
  getInstancedTemplates(): readonly CorpusInstancedTemplate[];
}

export interface InstancedCullingCorpusBridge {
  setCulling(options: CorpusCullingOptions): void;
  getInstancedStats(): CorpusInstancedStats;
  getModelBounds(): ReturnType<Renderer['getModelBounds']>;
  getLoadState(): {
    loading: boolean;
    geometryStreamingActive: boolean;
    progress: { phase: string; percent: number } | null;
    error: string | null;
    meshCount: number;
  };
  getCullingCounts(): Promise<{
    visibleOccurrences: number;
    totalOccurrences: number;
    visibleTriangles: number;
    totalTriangles: number;
  } | null>;
  setCamera(
    position: { x: number; y: number; z: number },
    target: { x: number; y: number; z: number },
    projection: 'perspective' | 'orthographic',
    up?: { x: number; y: number; z: number },
  ): void;
  requestFrameAndWait(): Promise<number>;
}

declare global {
  // Set by the Playwright corpus runner before the viewer application boots.
  var __IFC_LITE_INSTANCED_CULLING_CORPUS__: boolean | undefined;
  var __ifc_lite_instanced_culling_bridge__: InstancedCullingCorpusBridge | undefined;
}

let activeOptions: CorpusCullingOptions | undefined;
let activeRenderer: Renderer | undefined;

function isCorpusCullingRun(): boolean {
  if (globalThis.__IFC_LITE_INSTANCED_CULLING_CORPUS__ === true) return true;
  return typeof location !== 'undefined'
    && new URLSearchParams(location.search).get('ifcLiteInstancedCullingCorpus') === '1';
}

/** Read the corpus-only override consumed by the normal viewer render loop. */
export function getCorpusCullingOptions(): CorpusCullingOptions | undefined {
  if (!isCorpusCullingRun()) return undefined;
  return activeOptions;
}

/** Install a browser bridge only when the corpus runner explicitly requested it. */
export function installInstancedCullingCorpusBridge(renderer: Renderer): void {
  if (!isCorpusCullingRun()) return;
  activeRenderer = renderer;
  activeOptions = { enabled: false, minProjectedDiameter: 0 };
  // This bridge is deliberately corpus-only. Keep diagnostics off the measured
  // public SceneContents surface while still using the concrete Scene methods.
  const scene = renderer.getScene() as unknown as CorpusSceneDiagnostics;
  globalThis.__ifc_lite_instanced_culling_bridge__ = {
    setCulling(options) {
      activeOptions = {
        enabled: options.enabled === true,
        minProjectedDiameter: Math.max(0, options.minProjectedDiameter ?? 0),
      };
      renderer.requestRender();
    },
    getInstancedStats() {
      return scene.getInstancedStats();
    },
    getModelBounds() {
      return renderer.getModelBounds();
    },
    getLoadState() {
      const state = useViewerStore.getState();
      return {
        loading: state.loading,
        geometryStreamingActive: state.geometryStreamingActive,
        progress: state.progress
          ? { phase: state.progress.phase, percent: state.progress.percent }
          : null,
        error: state.error,
        meshCount: state.geometryResult?.meshes.length ?? 0,
      };
    },
    async getCullingCounts() {
      const device = renderer.getGPUDevice();
      const templates = scene.getInstancedTemplates();
      if (!device || templates.length === 0 || templates.some((template) => !template.indirectBuffer)) {
        return null;
      }
      const readback = device.createBuffer({
        label: 'IFNS corpus count readback',
        size: templates.length * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });
      let mapped = false;
      try {
        const encoder = device.createCommandEncoder();
        for (let index = 0; index < templates.length; index++) {
          encoder.copyBufferToBuffer(templates[index].indirectBuffer!, 4, readback, index * 4, 4);
        }
        device.queue.submit([encoder.finish()]);
        await readback.mapAsync(GPUMapMode.READ);
        mapped = true;
        const counts = new Uint32Array(readback.getMappedRange());
        let visibleOccurrences = 0;
        let visibleTriangles = 0;
        for (let index = 0; index < counts.length; index++) {
          visibleOccurrences += counts[index];
          visibleTriangles += counts[index] * templates[index].indexCount / 3;
        }
        return {
          visibleOccurrences,
          totalOccurrences: templates.reduce((sum, template) => sum + template.instanceCount, 0),
          visibleTriangles,
          totalTriangles: templates.reduce(
            (sum, template) => sum + template.instanceCount * template.indexCount / 3,
            0,
          ),
        };
      } finally {
        if (mapped) readback.unmap();
        readback.destroy();
      }
    },
    setCamera(position, target, projection, up) {
      const camera = renderer.getCamera();
      camera.setProjectionMode(projection);
      camera.setPosition(position.x, position.y, position.z);
      camera.setTarget(target.x, target.y, target.z);
      if (up) camera.setUp(up.x, up.y, up.z);
      renderer.requestRender();
    },
    async requestFrameAndWait() {
      const started = performance.now();
      renderer.requestRender();
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      await renderer.getGPUDevice()?.queue.onSubmittedWorkDone();
      return performance.now() - started;
    },
  };
}

/** Remove the bridge without disturbing another renderer installed later. */
export function clearInstancedCullingCorpusBridge(renderer: Renderer): void {
  if (activeRenderer !== renderer) return;
  activeRenderer = undefined;
  activeOptions = undefined;
  globalThis.__ifc_lite_instanced_culling_bridge__ = undefined;
}
