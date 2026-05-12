/**
 * ComputeManager - creates and dispatches GPUComputePipelines.
 *
 * Compute pipelines are separate from render pipelines:
 *   - No vertex/fragment stages, only a @compute entry point
 *   - Output goes to storage buffers, not the screen
 *   - Dispatched with dispatchWorkgroups(x, y, z) instead of draw()
 */

import type { WebGPUDevice } from './WebGPUDevice';

export class ComputeManager {
  private device: WebGPUDevice;
  private pipelines: Map<string, GPUComputePipeline> = new Map();

  constructor(device: WebGPUDevice) {
    this.device = device;
  }

  /**
   * Compile a WGSL compute shader and create a pipeline.
   * The shader must have exactly one @compute @workgroup_size(...) fn.
   */
  createPipeline(name: string, source: string): GPUComputePipeline {
    const cached = this.pipelines.get(name);
    if (cached) return cached;

    const module = this.device.getDevice().createShaderModule({
      code: source,
      label: `${name}-compute-module`,
    });

    // 'auto' infers the bind group layout from the shader's @group/@binding declarations
    const pipeline = this.device.getDevice().createComputePipeline({
      layout: 'auto',
      compute: { module, entryPoint: 'main' },
      label: name,
    });

    this.pipelines.set(name, pipeline);
    console.log(`[Compute] Pipeline "${name}" compiled`);
    return pipeline;
  }

  /**
   * Record a compute pass into an existing command encoder.
   *
   * workgroupsX = ceil(totalInvocations / workgroupSize)
   * e.g. 10 000 particles with @workgroup_size(64) -> ceil(10000/64) = 157
   */
  dispatch(
    encoder: GPUCommandEncoder,
    pipeline: GPUComputePipeline,
    bindGroup: GPUBindGroup,
    workgroupsX: number,
    workgroupsY: number = 1,
    workgroupsZ: number = 1,
  ): void {
    // A compute pass is like a render pass but has no attachments
    const pass = encoder.beginComputePass({ label: `${pipeline.label}-pass` });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    // Each dispatchWorkgroups call launches workgroupsX * workgroupsY * workgroupsZ workgroups
    pass.dispatchWorkgroups(workgroupsX, workgroupsY, workgroupsZ);
    pass.end();
  }

  clearCache(): void {
    this.pipelines.clear();
  }
}
