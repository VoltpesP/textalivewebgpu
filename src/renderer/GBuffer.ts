export const ALBEDO_FORMAT: GPUTextureFormat = 'rgba8unorm';
export const NORMAL_FORMAT: GPUTextureFormat = 'rgba16float';

/**
 * Owns the two off-screen textures written by the geometry pass:
 *   albedo  — base skin colour  (rgba8unorm)
 *   normal  — packed world normal [0,1]  (rgba16float)
 *
 * Both views are public so bind-group builders can read them directly.
 * After resize() the views are replaced; callers must rebuild any bind
 * groups that reference them.
 */
export class GBuffer {
  private device   : GPUDevice;
  private albedoTex: GPUTexture;
  private normalTex: GPUTexture;

  albedoView: GPUTextureView;
  normalView : GPUTextureView;

  constructor(device: GPUDevice, width: number, height: number) {
    this.device = device;
    const t = GBuffer.allocate(device, width, height);
    this.albedoTex = t.albedoTex;
    this.normalTex = t.normalTex;
    this.albedoView = t.albedoView;
    this.normalView = t.normalView;
  }

  private static allocate(device: GPUDevice, width: number, height: number) {
    const usage = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;
    const albedoTex = device.createTexture({ size: [width, height], format: ALBEDO_FORMAT, usage, label: 'gbuf-albedo' });
    const normalTex = device.createTexture({ size: [width, height], format: NORMAL_FORMAT, usage, label: 'gbuf-normal' });
    return {
      albedoTex, normalTex,
      albedoView: albedoTex.createView(),
      normalView: normalTex.createView(),
    };
  }

  resize(width: number, height: number): void {
    this.albedoTex.destroy();
    this.normalTex.destroy();
    const t = GBuffer.allocate(this.device, width, height);
    this.albedoTex = t.albedoTex;
    this.normalTex = t.normalTex;
    this.albedoView = t.albedoView;
    this.normalView = t.normalView;
  }

  destroy(): void {
    this.albedoTex.destroy();
    this.normalTex.destroy();
  }
}
