/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import assert from 'node:assert';
import { describe, it } from 'node:test';
import { InstancedGpuCuller } from './instanced-gpu-culling.js';
import type { InstancedTemplateGPU } from './scene.js';

const USAGE = {
  COPY_DST: 1 << 0,
  INDIRECT: 1 << 1,
  STORAGE: 1 << 2,
  UNIFORM: 1 << 3,
  VERTEX: 1 << 4,
};

(globalThis as unknown as { GPUBufferUsage: typeof USAGE }).GPUBufferUsage = USAGE;

interface FakeBufferState {
  data: ArrayBuffer;
  destroyed: boolean;
}

function fakeBuffer(size: number, usage = 0): GPUBuffer {
  const state: FakeBufferState = { data: new ArrayBuffer(size), destroyed: false };
  return {
    size,
    usage,
    getMappedRange: () => state.data,
    unmap: () => undefined,
    destroy: () => { state.destroyed = true; },
  } as unknown as GPUBuffer;
}

function fakeTemplate(instanceCount: number): InstancedTemplateGPU {
  return {
    vertexBuffer: fakeBuffer(28),
    indexBuffer: fakeBuffer(12),
    indexCount: 3,
    instanceBuffer: fakeBuffer(instanceCount * 88, USAGE.VERTEX | USAGE.STORAGE),
    boundingSpheres: new Float32Array(instanceCount * 4),
    instanceCount,
  };
}

interface FakeDeviceHarness {
  device: GPUDevice;
  descriptors: GPUBufferDescriptor[];
}

function fakeDevice(
  maxStorageBufferBindingSize = 1 << 24,
  maxComputeWorkgroupsPerDimension = 65_535,
): FakeDeviceHarness {
  const descriptors: GPUBufferDescriptor[] = [];
  const pipeline = {
    getBindGroupLayout: () => ({} as GPUBindGroupLayout),
  } as GPUComputePipeline;
  const device = {
    limits: {
      maxStorageBufferBindingSize,
      maxComputeWorkgroupsPerDimension,
    },
    queue: { writeBuffer: () => undefined },
    createShaderModule: () => ({}),
    createComputePipelineAsync: async () => pipeline,
    createBuffer: (descriptor: GPUBufferDescriptor) => {
      descriptors.push(descriptor);
      return fakeBuffer(descriptor.size, descriptor.usage);
    },
    createBindGroup: () => ({}),
  } as unknown as GPUDevice;
  return { device, descriptors };
}

describe('InstancedGpuCuller orchestration', () => {
  it('allocates compaction resources lazily and keeps translated spheres writable', async () => {
    const { device, descriptors } = fakeDevice();
    const culler = await InstancedGpuCuller.create(
      device, 'bgra8unorm', 'depth24plus-stencil8', 4,
    );
    const template = fakeTemplate(65);
    assert.strictEqual(descriptors.length, 1, 'creation allocates only the shared uniform buffer');

    const clears: Array<[GPUBuffer, number | undefined, number | undefined]> = [];
    const dispatches: number[] = [];
    const pass = {
      setPipeline: () => undefined,
      setBindGroup: () => undefined,
      dispatchWorkgroups: (count: number) => { dispatches.push(count); },
      end: () => undefined,
    } as unknown as GPUComputePassEncoder;
    const encoder = {
      clearBuffer: (buffer: GPUBuffer, offset?: number, size?: number) => {
        clears.push([buffer, offset, size]);
      },
      beginComputePass: () => pass,
    } as unknown as GPUCommandEncoder;

    assert.strictEqual(
      culler.encode(encoder, [template], new Float32Array(16), 1200, 800, 0.75, false),
      true,
    );

    assert.strictEqual(descriptors.length, 4, 'first encode adds compact, sphere, and indirect buffers');
    assert.ok(template.boundingSphereBuffer, 'sphere buffer was attached to the template');
    assert.ok(
      (template.boundingSphereBuffer!.usage & USAGE.COPY_DST) !== 0,
      'sphere buffer supports sparse translation updates',
    );
    assert.deepStrictEqual(dispatches, [2], '65 occurrences cross the 64-thread boundary');
    assert.deepStrictEqual(clears.map(([, offset, size]) => [offset, size]), [[4, 4]]);

    assert.strictEqual(
      culler.encode(encoder, [template], new Float32Array(16), 1200, 800, 0.75, false),
      true,
    );
    assert.strictEqual(descriptors.length, 4, 'later frames reuse template resources');
  });

  it('selects direct draws after a template resource allocation failure', async () => {
    const { device } = fakeDevice();
    const culler = await InstancedGpuCuller.create(
      device, 'bgra8unorm', 'depth24plus-stencil8', 1,
    );
    const mutableDevice = device as unknown as {
      createBuffer: (descriptor: GPUBufferDescriptor) => GPUBuffer;
    };
    const createBuffer = mutableDevice.createBuffer.bind(device);
    let allocations = 0;
    mutableDevice.createBuffer = (descriptor) => {
      allocations++;
      if (allocations === 2) throw new Error('simulated allocation failure');
      return createBuffer(descriptor);
    };
    const encoder = {
      clearBuffer: () => { throw new Error('fallback must not encode buffer clears'); },
      beginComputePass: () => { throw new Error('fallback must not begin a compute pass'); },
    } as unknown as GPUCommandEncoder;
    const warnings: unknown[][] = [];
    const warn = console.warn;
    console.warn = (...values: unknown[]) => { warnings.push(values); };
    try {
      const template = fakeTemplate(1);
      assert.strictEqual(
        culler.encode(encoder, [template], new Float32Array(16), 1200, 800, 0.75, false),
        false,
      );
      assert.strictEqual(culler.canEncode([template]), false, 'failed templates stay on direct draws');
      assert.strictEqual(warnings.length, 1, 'fallback reports the allocation failure');
    } finally {
      console.warn = warn;
    }
  });

  it('rejects templates beyond storage and dispatch limits for direct fallback', async () => {
    const { device } = fakeDevice(64);
    const culler = await InstancedGpuCuller.create(
      device, 'bgra8unorm', 'depth24plus-stencil8', 1,
    );
    assert.strictEqual(culler.canEncode([fakeTemplate(1)]), false, '88-byte instance binding exceeds limit');

    const withinLimits = fakeTemplate(1);
    const limits = (device as unknown as { limits: { maxStorageBufferBindingSize: number } }).limits;
    limits.maxStorageBufferBindingSize = 1 << 24;
    assert.strictEqual(culler.canEncode([withinLimits]), true);

    const dispatchLimited = fakeDevice(1 << 24, 1);
    const dispatchCuller = await InstancedGpuCuller.create(
      dispatchLimited.device, 'bgra8unorm', 'depth24plus-stencil8', 1,
    );
    const tooMany = fakeTemplate(65);
    assert.strictEqual(dispatchCuller.canEncode([tooMany]), false, 'dispatch count exceeds device dimension');
  });
});
