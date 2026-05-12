/**
 * DebugOverlay — G-Buffer thumbnail viewer + FPS counter.
 *
 * Toggle with the ` (backtick) key.
 *
 * When visible, encodes Pass 4 into the command buffer:
 *   Two full-screen-triangle blits, each constrained to a small viewport
 *   in the bottom-left corner of the swap-chain texture:
 *     ① Albedo   — base skin colour from the G-Buffer
 *     ② Normal   — packed world normal (blue-ish sphere)
 *
 * The HTML info panel (top-right) and CSS borders/labels (over the thumbnails)
 * are managed here as well so all debug concerns stay in one place.
 */

import DEFERRED_VERT    from '../shaders/deferred_light.vert.wgsl?raw';
import DEBUG_BLIT_FRAG  from '../shaders/debug_blit.frag.wgsl?raw';
import DEBUG_DEPTH_FRAG from '../shaders/debug_depth.frag.wgsl?raw';

import type { ShaderManager } from '../core/ShaderManager';
import type { GBuffer } from './GBuffer';

// Thumbnail layout — values are in CSS logical pixels; converted to physical in encode()
const THUMB_DIV = 5;    // thumbnails are 1/THUMB_DIV of canvas size
const THUMB_PAD = 10;   // gap from canvas edge and between thumbnails (CSS px)

export interface DebugOverlayOptions {
  canvas       : HTMLCanvasElement;
  dpr          : number;
  device       : GPUDevice;
  shaderManager: ShaderManager;
  swapFormat   : GPUTextureFormat;
  numShells    : number;
  initialGbuf  : GBuffer;
}

export class DebugOverlay {
  private canvas  : HTMLCanvasElement;
  private dpr     : number;
  private device  : GPUDevice;
  private blitPL   : GPURenderPipeline;
  private depthPL  : GPURenderPipeline;
  private sampler  : GPUSampler;
  private albedoBG : GPUBindGroup;
  private normalBG : GPUBindGroup;
  private depthBG  : GPUBindGroup | null = null;

  private fpsFrames  = 0;
  private fpsElapsed = 0;

  private fpsEl  : HTMLElement | null;
  private _visible = false;

  get visible(): boolean { return this._visible; }

  constructor(opts: DebugOverlayOptions) {
    this.canvas  = opts.canvas;
    this.dpr     = opts.dpr;
    this.device  = opts.device;

    // Linear sampler for smooth downscaled thumbnail display
    this.sampler = opts.device.createSampler({ magFilter: 'linear', minFilter: 'linear' });

    // Reuse the full-screen triangle vertex shader from the lighting pass
    this.blitPL = opts.shaderManager.createPipeline(
      'debug-blit', DEFERRED_VERT, DEBUG_BLIT_FRAG, opts.swapFormat,
    );
    // Depth blit has a different bind group layout (texture_depth_2d, no sampler)
    this.depthPL = opts.shaderManager.createPipeline(
      'debug-depth', DEFERRED_VERT, DEBUG_DEPTH_FRAG, opts.swapFormat,
    );

    this.fpsEl = document.getElementById('dbg-fps');

    const shellsEl = document.getElementById('dbg-shells');
    if (shellsEl) shellsEl.textContent = `Shells: 1 deferred + ${opts.numShells - 1} forward`;

    this.albedoBG = this.makeBG(opts.initialGbuf.albedoView, 'blit-albedo-bg');
    this.normalBG = this.makeBG(opts.initialGbuf.normalView, 'blit-normal-bg');

    document.addEventListener('keydown', (e) => {
      if (e.key === '`') this.toggle();
    });
  }

  private toggle(): void {
    this._visible = !this._visible;
    document.body.classList.toggle('dbg-visible', this._visible);
    if (this._visible) this.positionLabels();
  }

  private makeBG(view: GPUTextureView, label: string): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.blitPL.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: view },
        { binding: 1, resource: this.sampler },
      ],
      label,
    });
  }

  private makeDepthBG(view: GPUTextureView): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.depthPL.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: view }],
      label: 'blit-depth-bg',
    });
  }

  /** Call after resize so the depth bind group references the new depth texture view. */
  setDepthView(view: GPUTextureView): void {
    this.depthBG = this.makeDepthBG(view);
  }

  /**
   * Call after renderer.resize() so bind groups reference the fresh texture views.
   * Must be called in the correct order: renderer.resize() first, then this.
   */
  onGBufferResize(gbuf: GBuffer): void {
    this.albedoBG = this.makeBG(gbuf.albedoView, 'blit-albedo-bg');
    this.normalBG = this.makeBG(gbuf.normalView, 'blit-normal-bg');
    if (this._visible) this.positionLabels();
  }

  /** Call every frame with the frame delta to drive the FPS counter. */
  updateFPS(deltaTime: number): void {
    this.fpsFrames  += 1;
    this.fpsElapsed += deltaTime;
    if (this.fpsElapsed >= 1.0) {
      if (this.fpsEl) this.fpsEl.textContent = `FPS: ${Math.round(this.fpsFrames / this.fpsElapsed)}`;
      this.fpsFrames  = 0;
      this.fpsElapsed = 0;
    }
  }

  /**
   * Encodes Pass 4 (debug blit) into `encoder`.
   * No-ops when the overlay is hidden — zero GPU cost.
   * `width` and `height` are physical canvas pixels.
   */
  encode(encoder: GPUCommandEncoder, swapView: GPUTextureView, width: number, height: number): void {
    if (!this._visible) return;

    // Convert CSS-pixel pad to physical pixels for the WebGPU viewport
    const physPad = Math.round(THUMB_PAD * this.dpr);
    const tw = Math.floor(width  / THUMB_DIV);
    const th = Math.floor(height / THUMB_DIV);
    const y0 = height - th - physPad;  // WebGPU: y=0 is top

    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: swapView, loadOp: 'load', storeOp: 'store' }],
    });
    pass.setPipeline(this.blitPL);

    // ① Albedo
    pass.setViewport(physPad, y0, tw, th, 0, 1);
    pass.setBindGroup(0, this.albedoBG);
    pass.draw(3);

    // ② Normal
    pass.setViewport(physPad + tw + physPad, y0, tw, th, 0, 1);
    pass.setBindGroup(0, this.normalBG);
    pass.draw(3);

    // ③ Depth (separate pipeline — texture_depth_2d, no sampler)
    if (this.depthBG) {
      pass.setPipeline(this.depthPL);
      pass.setViewport(physPad + (tw + physPad) * 2, y0, tw, th, 0, 1);
      pass.setBindGroup(0, this.depthBG);
      pass.draw(3);
    }

    pass.end();
  }

  /** Align CSS thumbnail borders and labels with the WebGPU viewport positions. */
  private positionLabels(): void {
    const rect  = this.canvas.getBoundingClientRect();
    // CSS logical-pixel thumbnail dimensions
    const csTw  = rect.width  / THUMB_DIV;
    const csTh  = rect.height / THUMB_DIV;
    const csPad = THUMB_PAD;

    const setThumb = (borderId: string, labelId: string, cssLeft: number) => {
      const border = document.getElementById(borderId);
      const label  = document.getElementById(labelId);
      if (border) {
        border.style.left   = `${cssLeft}px`;
        border.style.bottom = `${csPad}px`;
        border.style.width  = `${csTw}px`;
        border.style.height = `${csTh}px`;
      }
      if (label) {
        label.style.left   = `${cssLeft}px`;
        label.style.bottom = `${csPad + csTh}px`;  // just above the border top edge
      }
    };

    setThumb('dbg-border-albedo', 'dbg-label-albedo', csPad);
    setThumb('dbg-border-normal', 'dbg-label-normal', csPad + csTw + csPad);
    setThumb('dbg-border-depth',  'dbg-label-depth',  csPad + (csTw + csPad) * 2);
  }
}
