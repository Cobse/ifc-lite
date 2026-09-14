/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { INSTANCE_STRIDE_BYTES } from './instanced-render.js';
import type { InstancedTemplateGPU } from './scene.js';

const INSTANCE_WORDS = INSTANCE_STRIDE_BYTES / 4;
const WORKGROUP_SIZE = 64;
const UNIFORM_BYTES = 176;

/** Exported from this internal module for real-WebGPU contract tests. */
export const instancedCullingShader = /* wgsl */ `
struct CullUniforms {
  planes: array<vec4f, 6>,
  viewProj: mat4x4f,
  params: vec4f,
};

struct IndirectArgs {
  indexCount: u32,
  instanceCount: atomic<u32>,
  firstIndex: u32,
  baseVertex: i32,
  firstInstance: u32,
};

@group(0) @binding(0) var<uniform> uniforms: CullUniforms;
@group(0) @binding(1) var<storage, read> sourceInstances: array<u32>;
@group(0) @binding(2) var<storage, read> spheres: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> visibleInstances: array<u32>;
@group(0) @binding(4) var<storage, read_write> indirect: IndirectArgs;

@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) invocation: vec3u) {
  let instanceIndex = invocation.x;
  if (instanceIndex >= arrayLength(&spheres)) { return; }

  let sourceWord = instanceIndex * ${INSTANCE_WORDS}u;
  let flags = sourceInstances[sourceWord + 21u];
  if ((flags & 2u) != 0u) { return; }

  let sphere = spheres[instanceIndex];
  for (var planeIndex = 0u; planeIndex < 6u; planeIndex++) {
    let plane = uniforms.planes[planeIndex];
    if (dot(plane.xyz, sphere.xyz) + plane.w < -sphere.w - 0.5) { return; }
  }

  let thresholdPx = uniforms.params.z;
  if (thresholdPx > 0.0) {
    let clip = uniforms.viewProj * vec4f(sphere.xyz, 1.0);
    let rowXLength = length(vec3f(
      uniforms.viewProj[0][0], uniforms.viewProj[1][0], uniforms.viewProj[2][0]
    ));
    let rowYLength = length(vec3f(
      uniforms.viewProj[0][1], uniforms.viewProj[1][1], uniforms.viewProj[2][1]
    ));
    let orthographic = uniforms.params.w > 0.5;
    if (orthographic) {
      let diameterPx = sphere.w * max(
        rowXLength * uniforms.params.x,
        rowYLength * uniforms.params.y,
      );
      if (diameterPx < thresholdPx) { return; }
    } else {
      // Bound the full projected rational interval, including the off-axis
      // numerator term. Looking only at nearest depth understates spheres away
      // from the optical axis. A sphere crossing the W=0 plane is retained.
      let rowWLength = length(vec3f(
        uniforms.viewProj[0][3], uniforms.viewProj[1][3], uniforms.viewProj[2][3]
      ));
      let clipWRadius = sphere.w * rowWLength;
      if (clip.w > clipWRadius) {
        let denominator = clip.w * clip.w - clipWRadius * clipWRadius;
        // Do not clamp a small positive denominator upward: that would shrink
        // the bound. Retaining extremely near spheres is the conservative path.
        if (denominator > 0.0001) {
          let radiusX = sphere.w * rowXLength;
          let radiusY = sphere.w * rowYLength;
          let diameterX = uniforms.params.x
            * (radiusX * clip.w + abs(clip.x) * clipWRadius) / denominator;
          let diameterY = uniforms.params.y
            * (radiusY * clip.w + abs(clip.y) * clipWRadius) / denominator;
          if (max(diameterX, diameterY) < thresholdPx) { return; }
        }
      }
    }
  }

  let visibleIndex = atomicAdd(&indirect.instanceCount, 1u);
  let destinationWord = visibleIndex * ${INSTANCE_WORDS}u;
  for (var word = 0u; word < ${INSTANCE_WORDS}u; word++) {
    visibleInstances[destinationWord + word] = sourceInstances[sourceWord + word];
  }
}
`;

/** Extract normalized WebGPU clip planes from a column-major view-projection matrix. */
export function extractWebGpuFrustumPlanes(viewProj: Float32Array): Float32Array {
  const rows = [0, 1, 2, 3].map((row) => [
    viewProj[row], viewProj[4 + row], viewProj[8 + row], viewProj[12 + row],
  ]);
  const combinations: ReadonlyArray<readonly [number, number, number]> = [
    [3, 0, 1], [3, 0, -1], [3, 1, 1], [3, 1, -1], [2, 2, 0], [3, 2, -1],
  ];
  const planes = new Float32Array(24);
  for (let i = 0; i < combinations.length; i++) {
    const [base, other, sign] = combinations[i];
    const raw = sign === 0
      ? rows[base]
      : rows[base].map((value, component) => value + sign * rows[other][component]);
    const length = Math.hypot(raw[0], raw[1], raw[2]);
    const inverseLength = length > 0 ? 1 / length : 0;
    for (let component = 0; component < 4; component++) {
      planes[i * 4 + component] = raw[component] * inverseLength;
    }
  }
  return planes;
}

/**
 * Vertical projection scale in pixels, invariant under camera rotation.
 * The second row of projection*view has spatial length `projection[1][1]`
 * for an orthonormal view matrix; multiplying by viewport height converts a
 * world-space sphere radius directly to its approximate pixel diameter.
 */
export function projectedDiameterScale(viewProj: Float32Array, viewportHeight: number): number {
  return Math.hypot(viewProj[1], viewProj[5], viewProj[9]) * viewportHeight;
}

/** Standard-WebGPU instance culling plus a reusable indirect render bundle. */
export class InstancedGpuCuller {
  private readonly uniformBuffer: GPUBuffer;
  private readonly bindGroups = new WeakMap<InstancedTemplateGPU, GPUBindGroup>();
  private readonly failedTemplates = new WeakSet<InstancedTemplateGPU>();
  private bundleTemplates: readonly InstancedTemplateGPU[] = [];
  private opaqueBundle: GPURenderBundle | null = null;

  private constructor(
    private readonly device: GPUDevice,
    private readonly colorFormat: GPUTextureFormat,
    private readonly depthFormat: GPUTextureFormat,
    private readonly sampleCount: number,
    private readonly pipeline: GPUComputePipeline,
  ) {
    this.uniformBuffer = device.createBuffer({
      label: 'IFNS culling uniforms',
      size: UNIFORM_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  /** Compile eagerly so shader validation failures cleanly select the direct fallback. */
  static async create(
    device: GPUDevice,
    colorFormat: GPUTextureFormat,
    depthFormat: GPUTextureFormat,
    sampleCount: number,
  ): Promise<InstancedGpuCuller> {
    const pipeline = await device.createComputePipelineAsync({
      label: 'IFNS instance culling',
      layout: 'auto',
      compute: {
        module: device.createShaderModule({ code: instancedCullingShader }),
        entryPoint: 'main',
      },
    });
    return new InstancedGpuCuller(device, colorFormat, depthFormat, sampleCount, pipeline);
  }

  /** Keep templates outside this device's compute limits on the direct draw path. */
  canEncode(templates: readonly InstancedTemplateGPU[]): boolean {
    const maxStorageSize = this.device.limits.maxStorageBufferBindingSize;
    const maxWorkgroups = this.device.limits.maxComputeWorkgroupsPerDimension;
    return templates.every((template) =>
      !this.failedTemplates.has(template)
      && template.instanceBuffer.size <= maxStorageSize
      && template.boundingSpheres.byteLength <= maxStorageSize
      && 20 <= maxStorageSize
      && Math.ceil(template.instanceCount / WORKGROUP_SIZE) <= maxWorkgroups
    );
  }

  encode(
    encoder: GPUCommandEncoder,
    templates: readonly InstancedTemplateGPU[],
    viewProj: Float32Array,
    viewportWidth: number,
    viewportHeight: number,
    minProjectedDiameter: number,
    orthographic: boolean,
  ): boolean {
    const uniforms = new Float32Array(UNIFORM_BYTES / 4);
    uniforms.set(extractWebGpuFrustumPlanes(viewProj), 0);
    uniforms.set(viewProj, 24);
    uniforms[40] = viewportWidth;
    uniforms[41] = viewportHeight;
    uniforms[42] = Math.max(0, minProjectedDiameter);
    uniforms[43] = orthographic ? 1 : 0;
    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniforms);

    try {
      for (const template of templates) this.ensureResources(template);
    } catch (error) {
      console.warn('[ifc-lite] GPU instance culling allocation failed; using direct draws', error);
      return false;
    }
    for (const template of templates) {
      encoder.clearBuffer(template.indirectBuffer!, 4, 4);
    }
    const pass = encoder.beginComputePass({ label: 'IFNS instance culling' });
    pass.setPipeline(this.pipeline);
    for (const template of templates) {
      pass.setBindGroup(0, this.getBindGroup(template));
      pass.dispatchWorkgroups(Math.ceil(template.instanceCount / WORKGROUP_SIZE));
    }
    pass.end();
    return true;
  }

  executeOpaque(
    pass: GPURenderPassEncoder,
    templates: readonly InstancedTemplateGPU[],
    renderPipeline: GPURenderPipeline,
    frameBindGroup: GPUBindGroup,
    environmentBindGroup: GPUBindGroup,
  ): void {
    if (!this.matchesBundleTemplates(templates)) {
      this.opaqueBundle = this.createOpaqueBundle(
        templates, renderPipeline, frameBindGroup, environmentBindGroup,
      );
      this.bundleTemplates = [...templates];
    }
    if (this.opaqueBundle) pass.executeBundles([this.opaqueBundle]);
  }

  destroy(): void {
    this.uniformBuffer.destroy();
    this.opaqueBundle = null;
    this.bundleTemplates = [];
  }

  private getBindGroup(template: InstancedTemplateGPU): GPUBindGroup {
    const cached = this.bindGroups.get(template);
    if (cached) return cached;
    const bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: template.instanceBuffer } },
        { binding: 2, resource: { buffer: template.boundingSphereBuffer! } },
        { binding: 3, resource: { buffer: template.culledInstanceBuffer! } },
        { binding: 4, resource: { buffer: template.indirectBuffer! } },
      ],
    });
    this.bindGroups.set(template, bindGroup);
    return bindGroup;
  }

  private ensureResources(template: InstancedTemplateGPU): void {
    if (
      template.culledInstanceBuffer
      && template.boundingSphereBuffer
      && template.indirectBuffer
    ) return;
    template.culledInstanceBuffer?.destroy();
    template.boundingSphereBuffer?.destroy();
    template.indirectBuffer?.destroy();
    let compacted: GPUBuffer | null = null;
    let spheres: GPUBuffer | null = null;
    let indirect: GPUBuffer | null = null;
    try {
      compacted = this.device.createBuffer({
        label: 'IFNS compacted instances',
        size: template.instanceBuffer.size,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
      });
      spheres = this.device.createBuffer({
        label: 'IFNS instance bounding spheres',
        size: template.boundingSpheres.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      });
      new Float32Array(spheres.getMappedRange()).set(template.boundingSpheres);
      spheres.unmap();
      indirect = this.device.createBuffer({
        label: 'IFNS indirect draw arguments',
        size: 20,
        usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE
          | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      });
      new Uint32Array(indirect.getMappedRange()).set([
        template.indexCount, 0, 0, 0, 0,
      ]);
      indirect.unmap();
    } catch (error) {
      compacted?.destroy();
      spheres?.destroy();
      indirect?.destroy();
      this.failedTemplates.add(template);
      throw error;
    }
    template.culledInstanceBuffer = compacted;
    template.boundingSphereBuffer = spheres;
    template.indirectBuffer = indirect;
  }

  private matchesBundleTemplates(templates: readonly InstancedTemplateGPU[]): boolean {
    return templates.length === this.bundleTemplates.length
      && templates.every((template, index) => template === this.bundleTemplates[index]);
  }

  private createOpaqueBundle(
    templates: readonly InstancedTemplateGPU[],
    pipeline: GPURenderPipeline,
    frameBindGroup: GPUBindGroup,
    environmentBindGroup: GPUBindGroup,
  ): GPURenderBundle {
    const bundle = this.device.createRenderBundleEncoder({
      label: 'IFNS opaque indirect bundle',
      colorFormats: [this.colorFormat, 'rgba8unorm'],
      depthStencilFormat: this.depthFormat,
      sampleCount: this.sampleCount,
    });
    bundle.setPipeline(pipeline);
    bundle.setBindGroup(0, frameBindGroup);
    bundle.setBindGroup(1, environmentBindGroup);
    for (const template of templates) {
      bundle.setVertexBuffer(0, template.vertexBuffer);
      bundle.setVertexBuffer(1, template.culledInstanceBuffer!);
      bundle.setIndexBuffer(template.indexBuffer, 'uint32');
      bundle.drawIndexedIndirect(template.indirectBuffer!, 0);
    }
    return bundle.finish();
  }
}
