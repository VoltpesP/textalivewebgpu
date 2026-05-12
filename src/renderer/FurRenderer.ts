/**
 * FurRenderer — hybrid deferred + forward renderer for shell-based fur.
 *
 * Encodes three GPU passes per frame:
 *   Pass 1  G-Buffer   — skin layer (shell 0) → albedo + normal textures + depth
 *   Pass 2  Lighting   — full-screen triangle reads G-Buffer → lit swap-chain output
 *                        Background pixels are filled with the loaded skybox (or
 *                        a procedural gradient if no skybox has been loaded yet).
 *   Pass 3  Forward    — shells 1..N-1 with per-fragment discard, depth-tested
 *                        against G-Buffer depth so strands sit on top of the skin
 *
 * Geometry is owned by this class: call setGeometry() at any time to swap the
 * rendered mesh without recreating pipelines or bind groups.
 * Skybox can be swapped at any time with setSkybox().
 */

import GBUF_VERT     from '../shaders/gbuffer.vert.wgsl?raw';
import GBUF_FRAG     from '../shaders/gbuffer.frag.wgsl?raw';
import DEFERRED_VERT from '../shaders/deferred_light.vert.wgsl?raw';
import DEFERRED_FRAG from '../shaders/deferred_light.frag.wgsl?raw';
import FUR_VERT      from '../shaders/fur.vert.wgsl?raw';
import FUR_FRAG      from '../shaders/fur.frag.wgsl?raw';

import type { ShaderManager } from '../core/ShaderManager';
import type { InterleavedGeometry } from '../utils/GeometryUtils';
import { GBuffer, ALBEDO_FORMAT, NORMAL_FORMAT } from './GBuffer';
import { createDefaultSkyboxTexture } from '../utils/SkyboxLoader';

export interface FurRendererOptions {
  device           : GPUDevice;
  uniformBuffer    : GPUBuffer;      // per-frame scene uniforms (viewProj, model, …)
  skyUniformBuffer : GPUBuffer;      // per-frame sky uniforms (invViewProj, eyePos, hasSkybox)
  geometry         : InterleavedGeometry;
  shaderManager    : ShaderManager;
  swapFormat       : GPUTextureFormat;
  depthFormat      : GPUTextureFormat;
  numShells        : number;
  width            : number;
  height           : number;
}

export class FurRenderer {
  // Public so DebugOverlay can build its blit bind groups from the current views
  readonly gbuf: GBuffer;

  private device          : GPUDevice;
  private skyUniformBuffer: GPUBuffer;
  private gbufferPL       : GPURenderPipeline;
  private lightingPL      : GPURenderPipeline;
  private furPL           : GPURenderPipeline;
  private gbufferBG       : GPUBindGroup;
  private lightingBG      : GPUBindGroup;
  private furBG           : GPUBindGroup;
  private sampler         : GPUSampler;     // nearest — for G-Buffer reads
  private skyboxSampler   : GPUSampler;     // linear  — for skybox atlas
  private skyboxTex       : GPUTexture;
  private vertexBuffer    : GPUBuffer;
  private indexBuffer     : GPUBuffer;
  private indexCount      : number;
  private numShells       : number;

  constructor(opts: FurRendererOptions) {
    this.device           = opts.device;
    this.numShells        = opts.numShells;
    this.skyUniformBuffer = opts.skyUniformBuffer;

    this.gbuf          = new GBuffer(opts.device, opts.width, opts.height);
    this.sampler       = opts.device.createSampler({ magFilter: 'nearest', minFilter: 'nearest' });
    this.skyboxSampler = opts.device.createSampler({ magFilter: 'linear',  minFilter: 'linear' });
    this.skyboxTex     = createDefaultSkyboxTexture(opts.device);

    // Upload initial geometry
    this.vertexBuffer = this.upload(opts.geometry.vertices, GPUBufferUsage.VERTEX);
    this.indexBuffer  = this.upload(opts.geometry.indices,  GPUBufferUsage.INDEX);
    this.indexCount   = opts.geometry.indices.length;

    // All shaders expect stride=24: [pos:float32x3 | normal:float32x3]
    const vertexLayout: GPUVertexBufferLayout[] = [{
      arrayStride: 24,
      attributes: [
        { shaderLocation: 0, offset:  0, format: 'float32x3' },
        { shaderLocation: 1, offset: 12, format: 'float32x3' },
      ],
    }];
    const depthState: GPUDepthStencilState = {
      format: opts.depthFormat,
      depthWriteEnabled: true,
      depthCompare: 'less',
    };

    const sm = opts.shaderManager;

    this.gbufferPL = sm.createPipeline('gbuffer', GBUF_VERT, GBUF_FRAG, ALBEDO_FORMAT, {
      bufferLayout: vertexLayout,
      depthStencil: depthState,
      cullMode: 'back',
      targets: [{ format: ALBEDO_FORMAT }, { format: NORMAL_FORMAT }],
    });

    this.lightingPL = sm.createPipeline('deferred-light', DEFERRED_VERT, DEFERRED_FRAG, opts.swapFormat);

    this.furPL = sm.createPipeline('fur', FUR_VERT, FUR_FRAG, opts.swapFormat, {
      bufferLayout: vertexLayout,
      depthStencil: depthState,
      cullMode: 'back',
    });

    this.gbufferBG = opts.device.createBindGroup({
      layout: this.gbufferPL.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: opts.uniformBuffer } }],
      label: 'gbuf-bg',
    });
    this.furBG = opts.device.createBindGroup({
      layout: this.furPL.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: opts.uniformBuffer } }],
      label: 'fur-bg',
    });
    this.lightingBG = this.buildLightingBG();
  }

  // ---- Skybox ---------------------------------------------------------------

  /** Hot-swap the skybox texture. The old texture is destroyed. */
  setSkybox(tex: GPUTexture): void {
    this.skyboxTex.destroy();
    this.skyboxTex  = tex;
    this.lightingBG = this.buildLightingBG();
  }

  // ---- Geometry -------------------------------------------------------------

  /** Swap the rendered mesh. Old GPU buffers are destroyed immediately. */
  setGeometry(geo: InterleavedGeometry): void {
    this.vertexBuffer.destroy();
    this.indexBuffer.destroy();
    this.vertexBuffer = this.upload(geo.vertices, GPUBufferUsage.VERTEX);
    this.indexBuffer  = this.upload(geo.indices,  GPUBufferUsage.INDEX);
    this.indexCount   = geo.indices.length;
  }

  private upload(data: ArrayBufferView, usage: GPUBufferUsageFlags): GPUBuffer {
    const size = (data.byteLength + 3) & ~3;
    const buf  = this.device.createBuffer({ size, usage, mappedAtCreation: true });
    new Uint8Array(buf.getMappedRange()).set(
      new Uint8Array(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength),
    );
    buf.unmap();
    return buf;
  }

  // ---- Resize ---------------------------------------------------------------

  /** Call after the canvas is resized. Recreates G-Buffer textures and the lighting bind group. */
  resize(width: number, height: number): void {
    this.gbuf.resize(width, height);
    this.lightingBG = this.buildLightingBG();
  }

  // ---- Frame encode ---------------------------------------------------------

  encode(encoder: GPUCommandEncoder, swapView: GPUTextureView, depthView: GPUTextureView): void {
    // ---- Pass 1: G-Buffer ---------------------------------------------------
    {
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          { view: this.gbuf.albedoView, clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' },
          { view: this.gbuf.normalView, clearValue: { r: 0.5, g: 0.5, b: 1, a: 1 }, loadOp: 'clear', storeOp: 'store' },
        ],
        depthStencilAttachment: { view: depthView, depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store' },
      });
      pass.setPipeline(this.gbufferPL);
      pass.setVertexBuffer(0, this.vertexBuffer);
      pass.setIndexBuffer(this.indexBuffer, 'uint32');
      pass.setBindGroup(0, this.gbufferBG);
      pass.drawIndexed(this.indexCount, 1);
      pass.end();
    }

    // ---- Pass 2: Deferred lighting + skybox background ----------------------
    {
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ view: swapView, clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }],
      });
      pass.setPipeline(this.lightingPL);
      pass.setBindGroup(0, this.lightingBG);
      pass.draw(3);
      pass.end();
    }

    // ---- Pass 3: Forward fur ------------------------------------------------
    {
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ view: swapView, loadOp: 'load', storeOp: 'store' }],
        depthStencilAttachment: { view: depthView, depthLoadOp: 'load', depthStoreOp: 'store' },
      });
      pass.setPipeline(this.furPL);
      pass.setVertexBuffer(0, this.vertexBuffer);
      pass.setIndexBuffer(this.indexBuffer, 'uint32');
      pass.setBindGroup(0, this.furBG);
      pass.drawIndexed(this.indexCount, this.numShells - 1);
      pass.end();
    }
  }

  // ---- Cleanup --------------------------------------------------------------

  destroy(): void {
    this.gbuf.destroy();
    this.skyboxTex.destroy();
    this.vertexBuffer.destroy();
    this.indexBuffer.destroy();
  }

  // ---- Private helpers ------------------------------------------------------

  private buildLightingBG(): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.lightingPL.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.gbuf.albedoView },
        { binding: 1, resource: this.gbuf.normalView },
        { binding: 2, resource: this.sampler },
        { binding: 3, resource: this.skyboxTex.createView() },
        { binding: 4, resource: this.skyboxSampler },
        { binding: 5, resource: { buffer: this.skyUniformBuffer } },
      ],
      label: 'lighting-bg',
    });
  }
}
