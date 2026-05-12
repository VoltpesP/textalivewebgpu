/**
 * Shader Manager
 * Manages WGSL shader compilation and render pipeline creation.
 */

import type { WebGPUDevice } from './WebGPUDevice';

export interface PipelineOptions {
  bufferLayout?: GPUVertexBufferLayout[];
  depthStencil?: GPUDepthStencilState;
  cullMode?: GPUCullMode;
  topology?: GPUPrimitiveTopology;
  /** Set to enable alpha or additive blending on the color target. */
  blend?: GPUBlendState;
  /** Override the full targets array (multiple render targets). Supersedes targetFormat + blend. */
  targets?: GPUColorTargetState[];
}

export class ShaderManager {
  private device: WebGPUDevice;
  private shaders: Map<string, GPUShaderModule> = new Map();
  private pipelines: Map<string, GPURenderPipeline> = new Map();

  constructor(device: WebGPUDevice) {
    this.device = device;
  }

  createShaderModule(name: string, source: string): GPUShaderModule {
    const cached = this.shaders.get(name);
    if (cached) return cached;

    const module = this.device.getDevice().createShaderModule({ code: source, label: name });
    this.shaders.set(name, module);
    return module;
  }

  createPipeline(
    name: string,
    vertexSource: string,
    fragmentSource: string,
    targetFormat: GPUTextureFormat,
    options: PipelineOptions = {}
  ): GPURenderPipeline {
    const cached = this.pipelines.get(name);
    if (cached) return cached;

    const vertexModule = this.createShaderModule(`${name}-vertex`, vertexSource);
    const fragmentModule = this.createShaderModule(`${name}-fragment`, fragmentSource);

    const pipeline = this.device.getDevice().createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: vertexModule,
        entryPoint: 'main',
        buffers: options.bufferLayout ?? [],
      },
      fragment: {
        module: fragmentModule,
        entryPoint: 'main',
        targets: options.targets ?? [{ format: targetFormat, blend: options.blend }],
      },
      primitive: {
        topology: options.topology ?? 'triangle-list',
        cullMode: options.cullMode ?? 'none',
      },
      depthStencil: options.depthStencil,
      label: name,
    });

    this.pipelines.set(name, pipeline);
    return pipeline;
  }

  getPipeline(name: string): GPURenderPipeline | undefined {
    return this.pipelines.get(name);
  }

  reloadShader(name: string, source: string): void {
    this.shaders.delete(name);
    this.createShaderModule(name, source);
  }

  clearCache(): void {
    this.shaders.clear();
    this.pipelines.clear();
  }
}
