/**
 * WebGPU Application Framework
 * Orchestrates device, shaders, depth testing, and the render loop.
 */

import { WebGPUDevice } from './WebGPUDevice';
import { ShaderManager } from './ShaderManager';
import { ComputeManager } from './ComputeManager';

export interface AppConfig {
  canvas: HTMLCanvasElement;
  backgroundColor?: [number, number, number, number];
}

export class WebGPUApp {
  private device: WebGPUDevice;
  private shaderManager: ShaderManager;
  private computeManager: ComputeManager;
  private canvas: HTMLCanvasElement;
  private isRunning: boolean = false;
  private backgroundColor: [number, number, number, number];
  private frameCallback: ((deltaTime: number) => void) | null = null;
  private lastFrameTime: number = 0;
  private resizeCallbacks: Array<(w: number, h: number) => void> = [];

  constructor(config: AppConfig) {
    this.device = new WebGPUDevice();
    this.shaderManager = new ShaderManager(this.device);
    this.computeManager = new ComputeManager(this.device);
    this.canvas = config.canvas;
    this.backgroundColor = config.backgroundColor ?? [0, 0, 0, 1];
  }

  async initialize(): Promise<void> {
    await this.device.initialize(this.canvas);
    this.setupResizeListener();
    console.log('WebGPU app initialized');
  }

  start(frameCallback?: (deltaTime: number) => void): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.frameCallback = frameCallback ?? null;
    this.lastFrameTime = performance.now();
    this.renderLoop();
  }

  stop(): void {
    this.isRunning = false;
  }

  private renderLoop = (): void => {
    if (!this.isRunning) return;
    const now = performance.now();
    const deltaTime = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;

    if (this.frameCallback) {
      this.frameCallback(deltaTime);
    } else {
      this.renderEmpty();
    }

    requestAnimationFrame(this.renderLoop);
  };

  private renderEmpty(): void {
    const device = this.device.getDevice();
    const encoder = device.createCommandEncoder();
    const pass = this.createRenderPass(encoder);
    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  /**
   * Create a render pass that includes a depth/stencil attachment.
   * Pass colorAttachments to override the default clear-to-background behavior.
   */
  createRenderPass(
    commandEncoder: GPUCommandEncoder,
    colorAttachments?: GPURenderPassColorAttachment[]
  ): GPURenderPassEncoder {
    const textureView = this.device.getCurrentTexture().createView();
    const [r, g, b, a] = this.backgroundColor;

    return commandEncoder.beginRenderPass({
      colorAttachments: colorAttachments ?? [
        {
          view: textureView,
          clearValue: { r, g, b, a },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: this.device.getDepthTextureView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    });
  }

  submitCommands(commandBuffer: GPUCommandBuffer): void {
    this.device.getQueue().submit([commandBuffer]);
  }

  getDevice(): WebGPUDevice {
    return this.device;
  }

  getShaderManager(): ShaderManager {
    return this.shaderManager;
  }

  getComputeManager(): ComputeManager {
    return this.computeManager;
  }

  setBackgroundColor(r: number, g: number, b: number, a: number = 1): void {
    this.backgroundColor = [r, g, b, a];
  }

  addResizeListener(cb: (width: number, height: number) => void): void {
    this.resizeCallbacks.push(cb);
  }

  private setupResizeListener(): void {
    const observer = new ResizeObserver(() => {
      const rect = this.canvas.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width * window.devicePixelRatio));
      const h = Math.max(1, Math.floor(rect.height * window.devicePixelRatio));
      this.device.resizeCanvas(w, h);
      this.resizeCallbacks.forEach(cb => cb(w, h));
    });
    observer.observe(this.canvas);
  }

  destroy(): void {
    this.stop();
    this.device.destroy();
    this.shaderManager.clearCache();
    this.computeManager.clearCache();
  }
}
