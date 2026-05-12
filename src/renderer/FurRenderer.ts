/**
 * FurRenderer — hybrid deferred + forward renderer for shell-based fur.
 *
 * Encodes three GPU passes per frame:
 *   Pass 1  G-Buffer   — skin layer (shell 0) of ALL visible SceneNodes
 *   Pass 2  Lighting   — full-screen triangle; reads G-Buffer, applies lights,
 *                        fills background with skybox or procedural sky
 *   Pass 3  Forward    — shells 1..N-1 of ALL visible SceneNodes, depth-tested
 *
 * Uniform split:
 *   Group 0 (per-frame)  — SceneUniforms: viewProj, time; LightBuffer (fragment)
 *   Group 1 (per-object) — ObjectUniforms: model, numShells, furLength, firstShell
 *
 * Use updateSceneUniforms() each frame before encode().
 * The renderer automatically syncs GPU resources with scene.nodes each frame.
 */

import GBUF_VERT      from '../shaders/gbuffer.vert.wgsl?raw';
import GBUF_FRAG      from '../shaders/gbuffer.frag.wgsl?raw';
import DEFERRED_VERT  from '../shaders/deferred_light.vert.wgsl?raw';
import DEFERRED_FRAG  from '../shaders/deferred_light.frag.wgsl?raw';
import FUR_VERT       from '../shaders/fur.vert.wgsl?raw';
import FUR_FRAG       from '../shaders/fur.frag.wgsl?raw';
import LIGHTS_WGSL    from '../shaders/lights.wgsl?raw';
import FUR_PARAMS_WGSL from '../shaders/fur_params.wgsl?raw';

import type { ShaderManager } from '../core/ShaderManager';
import type { SceneManager }  from '../scene/SceneManager';
import type { SceneNode }     from '../scene/SceneNode';
import type { InterleavedGeometry } from '../utils/GeometryUtils';
import { GBuffer, ALBEDO_FORMAT, NORMAL_FORMAT } from './GBuffer';
import { createDefaultSkyboxTexture } from '../utils/SkyboxLoader';

// SceneUniforms:  viewProj(64B) + time(4B) + implicit pad(12B) = 80 bytes = 20 floats
// ObjectUniforms: model(64B) + numShells(4B) + furLength(4B) + firstShell(4B) + pad(4B) = 80 bytes
const SCENE_UNIFORM_BYTES  = 80;
const OBJECT_UNIFORM_BYTES = 80;

interface GPUNodeData {
  vertexBuffer : GPUBuffer;
  indexBuffer  : GPUBuffer;
  indexCount   : number;
  objectBuffer : GPUBuffer;       // ObjectUniforms
  gbufferObjBG : GPUBindGroup;   // group 1 for G-Buffer pass
  furObjBG     : GPUBindGroup;   // group 1 for fur pass
  geometry     : InterleavedGeometry; // reference for change detection
}

export interface FurRendererOptions {
  device           : GPUDevice;
  scene            : SceneManager;
  skyUniformBuffer : GPUBuffer;
  lightBuffer      : GPUBuffer;
  paramsBuffer     : GPUBuffer;      // FurParams — real-time tweakable fur parameters
  depthView        : GPUTextureView;
  shaderManager    : ShaderManager;
  swapFormat       : GPUTextureFormat;
  depthFormat      : GPUTextureFormat;
  width            : number;
  height           : number;
}

export class FurRenderer {
  readonly gbuf: GBuffer;

  private device          : GPUDevice;
  private scene           : SceneManager;
  private skyUniformBuffer: GPUBuffer;
  private lightBuffer     : GPUBuffer;
  private paramsBuffer    : GPUBuffer;
  private depthView       : GPUTextureView;

  // Pipelines
  private gbufferPL  : GPURenderPipeline;
  private lightingPL : GPURenderPipeline;
  private furPL      : GPURenderPipeline;

  // Per-frame shared resources
  private sceneBuffer     : GPUBuffer;      // SceneUniforms (viewProj + time)
  private gbufferSceneBG  : GPUBindGroup;   // group 0 for G-Buffer pass
  private furSceneBG      : GPUBindGroup;   // group 0 for fur pass (+ lightBuf)
  private lightingBG      : GPUBindGroup;   // group 0 for lighting pass

  // Samplers & skybox
  private sampler       : GPUSampler;
  private skyboxSampler : GPUSampler;
  private skyboxTex     : GPUTexture;

  // Per-node GPU data (kept in sync with scene.nodes each frame)
  private gpuNodes = new Map<SceneNode, GPUNodeData>();

  // Scratch buffer to avoid per-frame allocations
  private readonly sceneData = new Float32Array(SCENE_UNIFORM_BYTES  / 4);
  private readonly objData   = new Float32Array(OBJECT_UNIFORM_BYTES / 4);

  constructor(opts: FurRendererOptions) {
    this.device           = opts.device;
    this.scene            = opts.scene;
    this.skyUniformBuffer = opts.skyUniformBuffer;
    this.lightBuffer      = opts.lightBuffer;
    this.paramsBuffer     = opts.paramsBuffer;
    this.depthView        = opts.depthView;

    this.gbuf          = new GBuffer(opts.device, opts.width, opts.height);
    this.sampler       = opts.device.createSampler({ magFilter: 'nearest', minFilter: 'nearest' });
    this.skyboxSampler = opts.device.createSampler({ magFilter: 'linear',  minFilter: 'linear' });
    this.skyboxTex     = createDefaultSkyboxTexture(opts.device);

    // Scene uniform buffer — written each frame by updateSceneUniforms()
    this.sceneBuffer = opts.device.createBuffer({
      size : SCENE_UNIFORM_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: 'scene-uniforms',
    });

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

    // G-Buffer: vertex needs no params; fragment reads skinColor + bump params
    this.gbufferPL = sm.createPipeline('gbuffer', GBUF_VERT, FUR_PARAMS_WGSL + '\n' + GBUF_FRAG, ALBEDO_FORMAT, {
      bufferLayout: vertexLayout,
      depthStencil: depthState,
      cullMode: 'none',
      targets: [{ format: ALBEDO_FORMAT }, { format: NORMAL_FORMAT }],
    });

    this.lightingPL = sm.createPipeline(
      'deferred-light',
      DEFERRED_VERT,
      LIGHTS_WGSL + '\n' + DEFERRED_FRAG,
      opts.swapFormat,
    );

    // Fur: both stages read params (vertex: gravity/wind, fragment: density/colors)
    this.furPL = sm.createPipeline(
      'fur',
      FUR_PARAMS_WGSL + '\n' + FUR_VERT,
      FUR_PARAMS_WGSL + '\n' + LIGHTS_WGSL + '\n' + FUR_FRAG,
      opts.swapFormat,
      { bufferLayout: vertexLayout, depthStencil: depthState, cullMode: 'none' },
    );

    // Group 0 bind groups (per-frame, no per-object data)
    // G-Buffer group 0: binding 0 = scene (vertex), binding 1 = params (fragment)
    this.gbufferSceneBG = opts.device.createBindGroup({
      layout: this.gbufferPL.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.sceneBuffer } },
        { binding: 1, resource: { buffer: this.paramsBuffer } },
      ],
      label: 'gbuffer-scene-bg',
    });

    // Fur group 0: binding 0 = scene (vertex), binding 1 = lights (fragment), binding 2 = params (both)
    this.furSceneBG = opts.device.createBindGroup({
      layout: this.furPL.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.sceneBuffer } },
        { binding: 1, resource: { buffer: this.lightBuffer } },
        { binding: 2, resource: { buffer: this.paramsBuffer } },
      ],
      label: 'fur-scene-bg',
    });

    this.lightingBG = this.buildLightingBG();
  }

  // ---- Scene uniforms -------------------------------------------------------

  /** Write viewProj and time into the shared SceneUniforms GPU buffer. */
  updateSceneUniforms(viewProj: Float32Array, time: number): void {
    this.sceneData.set(viewProj, 0);
    this.sceneData[16] = time;
    // [17..19] = implicit padding, stays zero
    this.device.queue.writeBuffer(this.sceneBuffer, 0, this.sceneData);
  }

  // ---- Skybox ---------------------------------------------------------------

  setSkybox(tex: GPUTexture): void {
    this.skyboxTex.destroy();
    this.skyboxTex  = tex;
    this.lightingBG = this.buildLightingBG();
  }

  // ---- Depth view -----------------------------------------------------------

  setDepthView(view: GPUTextureView): void {
    this.depthView  = view;
    this.lightingBG = this.buildLightingBG();
  }

  // ---- Resize ---------------------------------------------------------------

  resize(width: number, height: number): void {
    this.gbuf.resize(width, height);
    this.lightingBG = this.buildLightingBG();
  }

  // ---- Frame encode ---------------------------------------------------------

  encode(encoder: GPUCommandEncoder, swapView: GPUTextureView, depthView: GPUTextureView): void {
    this.syncGPUNodes();
    this.writeObjectUniforms();

    const visibleNodes = [...this.gpuNodes.entries()].filter(([n]) => n.visible);

    // ---- Pass 1: G-Buffer (all visible nodes) --------------------------------
    {
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          { view: this.gbuf.albedoView, clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' },
          { view: this.gbuf.normalView, clearValue: { r: 0.5, g: 0.5, b: 1, a: 1 }, loadOp: 'clear', storeOp: 'store' },
        ],
        depthStencilAttachment: { view: depthView, depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store' },
      });
      pass.setPipeline(this.gbufferPL);
      pass.setBindGroup(0, this.gbufferSceneBG);
      for (const [, gpuNode] of visibleNodes) {
        pass.setBindGroup(1, gpuNode.gbufferObjBG);
        pass.setVertexBuffer(0, gpuNode.vertexBuffer);
        pass.setIndexBuffer(gpuNode.indexBuffer, 'uint32');
        pass.drawIndexed(gpuNode.indexCount, 1);
      }
      pass.end();
    }

    // ---- Pass 2: Deferred lighting + skybox ---------------------------------
    {
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ view: swapView, clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }],
      });
      pass.setPipeline(this.lightingPL);
      pass.setBindGroup(0, this.lightingBG);
      pass.draw(3);
      pass.end();
    }

    // ---- Pass 3: Forward fur (all visible nodes) ----------------------------
    {
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ view: swapView, loadOp: 'load', storeOp: 'store' }],
        depthStencilAttachment: { view: depthView, depthLoadOp: 'load', depthStoreOp: 'store' },
      });
      pass.setPipeline(this.furPL);
      pass.setBindGroup(0, this.furSceneBG);
      for (const [node, gpuNode] of visibleNodes) {
        const forwardShells = Math.max(1, Math.floor(node.numShells) - 1);
        pass.setBindGroup(1, gpuNode.furObjBG);
        pass.setVertexBuffer(0, gpuNode.vertexBuffer);
        pass.setIndexBuffer(gpuNode.indexBuffer, 'uint32');
        pass.drawIndexed(gpuNode.indexCount, forwardShells);
      }
      pass.end();
    }
  }

  // ---- Cleanup --------------------------------------------------------------

  destroy(): void {
    this.gbuf.destroy();
    this.skyboxTex.destroy();
    this.sceneBuffer.destroy();
    for (const gpuNode of this.gpuNodes.values()) this.destroyGPUNode(gpuNode);
    this.gpuNodes.clear();
  }

  // ---- Private: GPU ↔ scene sync -------------------------------------------

  private syncGPUNodes(): void {
    const nodes = this.scene.nodes;

    // Create / update GPU resources for nodes that need it
    for (const node of nodes) {
      const existing = this.gpuNodes.get(node);
      if (!existing) {
        this.gpuNodes.set(node, this.createGPUNode(node));
        node.geometryDirty = false;
      } else if (node.geometryDirty) {
        this.rebuildGeometry(node, existing);
        node.geometryDirty = false;
      }
    }

    // Destroy GPU resources for nodes that left the scene
    const nodeSet = new Set(nodes);
    for (const [node, gpuNode] of this.gpuNodes) {
      if (!nodeSet.has(node)) {
        this.destroyGPUNode(gpuNode);
        this.gpuNodes.delete(node);
      }
    }
  }

  private createGPUNode(node: SceneNode): GPUNodeData {
    const vertexBuffer = this.uploadBuffer(node.geometry.vertices, GPUBufferUsage.VERTEX);
    const indexBuffer  = this.uploadBuffer(node.geometry.indices,  GPUBufferUsage.INDEX);
    const objectBuffer = this.device.createBuffer({
      size : OBJECT_UNIFORM_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: `${node.name}-obj-uniforms`,
    });

    const gbufferObjBG = this.device.createBindGroup({
      layout: this.gbufferPL.getBindGroupLayout(1),
      entries: [{ binding: 0, resource: { buffer: objectBuffer } }],
      label: `${node.name}-gbuf-obj-bg`,
    });
    const furObjBG = this.device.createBindGroup({
      layout: this.furPL.getBindGroupLayout(1),
      entries: [{ binding: 0, resource: { buffer: objectBuffer } }],
      label: `${node.name}-fur-obj-bg`,
    });

    return {
      vertexBuffer, indexBuffer,
      indexCount: node.geometry.indices.length,
      objectBuffer,
      gbufferObjBG, furObjBG,
      geometry: node.geometry,
    };
  }

  private rebuildGeometry(node: SceneNode, data: GPUNodeData): void {
    data.vertexBuffer.destroy();
    data.indexBuffer.destroy();
    data.vertexBuffer = this.uploadBuffer(node.geometry.vertices, GPUBufferUsage.VERTEX);
    data.indexBuffer  = this.uploadBuffer(node.geometry.indices,  GPUBufferUsage.INDEX);
    data.indexCount   = node.geometry.indices.length;
    data.geometry     = node.geometry;
  }

  private destroyGPUNode(data: GPUNodeData): void {
    data.vertexBuffer.destroy();
    data.indexBuffer.destroy();
    data.objectBuffer.destroy();
  }

  private writeObjectUniforms(): void {
    for (const [node, gpuNode] of this.gpuNodes) {
      if (!node.visible) continue;
      this.objData.set(node.getModelMatrix(), 0);
      this.objData[16] = node.numShells;
      this.objData[17] = node.furLength;
      this.objData[18] = 1;  // firstShell = 1 (skin goes to G-Buffer)
      // [19] = 0 (implicit pad)
      this.device.queue.writeBuffer(gpuNode.objectBuffer, 0, this.objData);
    }
  }

  private uploadBuffer(data: ArrayBufferView, usage: GPUBufferUsageFlags): GPUBuffer {
    const size = (data.byteLength + 3) & ~3;
    const buf  = this.device.createBuffer({ size, usage, mappedAtCreation: true });
    new Uint8Array(buf.getMappedRange()).set(
      new Uint8Array(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength),
    );
    buf.unmap();
    return buf;
  }

  // ---- Private: bind group builders ----------------------------------------

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
        { binding: 6, resource: { buffer: this.lightBuffer } },
        { binding: 7, resource: this.depthView },
      ],
      label: 'lighting-bg',
    });
  }
}
