/**
 * WebGPU Device Manager
 * Handles device initialization, canvas setup, GPU context, and depth texture.
 */

export class WebGPUDevice {
  private device: GPUDevice | null = null;
  private queue: GPUQueue | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private context: GPUCanvasContext | null = null;
  private format: GPUTextureFormat | null = null;
  private depthTexture: GPUTexture | null = null;
  private depthView   : GPUTextureView  | null = null;
  readonly depthFormat: GPUTextureFormat = 'depth32float';

  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    if (!navigator.gpu) {
      throw new Error('WebGPU is not supported in this browser');
    }

    this.canvas = canvas;

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error('No WebGPU adapter found');
    }

    this.device = await adapter.requestDevice();
    this.queue = this.device.queue;

    const context = canvas.getContext('webgpu');
    if (!context) {
      throw new Error('Failed to get WebGPU context');
    }

    this.context = context as GPUCanvasContext;
    this.format = navigator.gpu.getPreferredCanvasFormat();

    this.context.configure({
      device: this.device,
      format: this.format,
    });

    this.createDepthTexture(canvas.width, canvas.height);
    console.log('WebGPU device initialized');
  }

  private createDepthTexture(width: number, height: number): void {
    if (!this.device) throw new Error('Device not initialized');
    if (this.depthTexture) this.depthTexture.destroy();
    this.depthTexture = this.device.createTexture({
      size: [Math.max(1, width), Math.max(1, height)],
      format: this.depthFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      label: 'depth-texture',
    });
    this.depthView = this.depthTexture.createView();
  }

  getDepthTextureView(): GPUTextureView {
    if (!this.depthView) throw new Error('Depth texture not initialized');
    return this.depthView;
  }

  getDevice(): GPUDevice {
    if (!this.device) throw new Error('Device not initialized');
    return this.device;
  }

  getQueue(): GPUQueue {
    if (!this.queue) throw new Error('Queue not initialized');
    return this.queue;
  }

  getContext(): GPUCanvasContext {
    if (!this.context) throw new Error('Context not initialized');
    return this.context;
  }

  getFormat(): GPUTextureFormat {
    if (!this.format) throw new Error('Format not initialized');
    return this.format;
  }

  getCanvasSize(): { width: number; height: number } {
    if (!this.canvas) throw new Error('Canvas not initialized');
    return { width: this.canvas.width, height: this.canvas.height };
  }

  resizeCanvas(width: number, height: number): void {
    if (!this.canvas) throw new Error('Canvas not initialized');
    this.canvas.width = width;
    this.canvas.height = height;
    this.createDepthTexture(width, height);
  }

  getCurrentTexture(): GPUTexture {
    if (!this.context) throw new Error('Context not initialized');
    return this.context.getCurrentTexture();
  }

  createTexture(descriptor: GPUTextureDescriptor): GPUTexture {
    if (!this.device) throw new Error('Device not initialized');
    return this.device.createTexture(descriptor);
  }

  createSampler(descriptor?: GPUSamplerDescriptor): GPUSampler {
    if (!this.device) throw new Error('Device not initialized');
    return this.device.createSampler(descriptor);
  }

  createBuffer(data: ArrayBuffer | ArrayBufferView, usage: GPUBufferUsageFlags, label?: string): GPUBuffer {
    if (!this.device) throw new Error('Device not initialized');
    const byteLength =
      data instanceof ArrayBuffer
        ? data.byteLength
        : (data as ArrayBufferView).byteLength;

    const buffer = this.device.createBuffer({
      size: (byteLength + 3) & ~3,
      usage,
      mappedAtCreation: true,
      label,
    });

    const dst = new Uint8Array(buffer.getMappedRange());
    if (data instanceof ArrayBuffer) {
      dst.set(new Uint8Array(data));
    } else {
      // ArrayBufferView (Float32Array, Uint32Array, ...)
      const view = data as ArrayBufferView;
      dst.set(new Uint8Array(view.buffer as ArrayBuffer, view.byteOffset, view.byteLength));
    }
    buffer.unmap();
    return buffer;
  }

  createUniformBuffer(byteSize: number, label?: string): GPUBuffer {
    if (!this.device) throw new Error('Device not initialized');
    return this.device.createBuffer({
      size: (byteSize + 15) & ~15,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label,
    });
  }

  writeUniformBuffer(buffer: GPUBuffer, data: Float32Array, offset: number = 0): void {
    if (!this.device) throw new Error('Device not initialized');
    this.device.queue.writeBuffer(buffer, offset, data);
  }

  destroy(): void {
    this.depthTexture?.destroy();
    this.device?.destroy();
  }
}
