/**
 * LightManager — manages up to 8 GPU lights and packs them into a storage buffer.
 *
 * GPU buffer layout (528 bytes):
 *   offset   0: count u32 + 3 padding u32s  (16 bytes)
 *   offset  16: Light[0]                    (64 bytes each)
 *   ...
 *   offset 464: Light[7]
 *
 * Each Light (64 bytes = 4 × vec4<f32>):
 *   posType   vec4f — xyz=world pos (spot), w=type (0=dir,1=spot,2=sun)
 *   direction vec4f — xyz=beam direction FROM light TOWARD scene, w=0
 *   color     vec4f — rgb=color, w=intensity
 *   params    vec4f — x=innerCos, y=outerCos, z=range (spot), w=0
 */

import type { LightDescriptor, Vec3 } from './types';

export const LIGHT_BUFFER_SIZE = 528;

export class LightManager {
  private readonly device: GPUDevice;
  private readonly lights: LightDescriptor[] = [];
  readonly buffer: GPUBuffer;

  constructor(device: GPUDevice) {
    this.device = device;
    this.buffer = device.createBuffer({
      size : LIGHT_BUFFER_SIZE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      label: 'light-buffer',
    });
  }

  addDirectional(direction: Vec3, color: Vec3, intensity: number): number {
    return this.push({ type: 'directional', direction, color, intensity, enabled: true });
  }

  addSun(direction: Vec3, color: Vec3, intensity: number): number {
    return this.push({ type: 'sun', direction, color, intensity, enabled: true });
  }

  addSpot(
    position: Vec3,
    direction: Vec3,
    innerAngleDeg: number,
    outerAngleDeg: number,
    range: number,
    color: Vec3,
    intensity: number,
  ): number {
    return this.push({
      type: 'spot', position, direction,
      innerAngleDeg, outerAngleDeg, range,
      color, intensity, enabled: true,
    });
  }

  setEnabled(index: number, enabled: boolean): void {
    if (index >= 0 && index < this.lights.length) this.lights[index].enabled = enabled;
  }

  /** Pack all enabled lights into the GPU storage buffer. Call once per frame (or on change). */
  upload(): void {
    const ab  = new ArrayBuffer(LIGHT_BUFFER_SIZE);
    const u32 = new Uint32Array(ab);
    const f32 = new Float32Array(ab);

    const active = this.lights.filter(l => l.enabled);
    u32[0] = active.length;  // count at offset 0; pads 1-3 stay zero

    active.forEach((light, i) => {
      const b = 4 + i * 16;  // float32 base index (after 16-byte header)

      const typeId = light.type === 'directional' ? 0 : light.type === 'spot' ? 1 : 2;

      // posType — position only meaningful for spot
      if (light.type === 'spot') {
        f32[b + 0] = light.position[0];
        f32[b + 1] = light.position[1];
        f32[b + 2] = light.position[2];
      }
      f32[b + 3] = typeId;

      // direction — normalize defensively
      const [dx, dy, dz] = light.direction;
      const len = Math.hypot(dx, dy, dz) || 1;
      f32[b + 4] = dx / len;
      f32[b + 5] = dy / len;
      f32[b + 6] = dz / len;
      // f32[b + 7] = 0 by default

      // color + intensity
      f32[b + 8]  = light.color[0];
      f32[b + 9]  = light.color[1];
      f32[b + 10] = light.color[2];
      f32[b + 11] = light.intensity;

      // cone + range — only used by spot
      if (light.type === 'spot') {
        f32[b + 12] = Math.cos(light.innerAngleDeg * Math.PI / 180);
        f32[b + 13] = Math.cos(light.outerAngleDeg * Math.PI / 180);
        f32[b + 14] = light.range;
      }
      // f32[b + 15] = 0 by default
    });

    this.device.queue.writeBuffer(this.buffer, 0, ab);
  }

  getBuffer(): GPUBuffer { return this.buffer; }

  destroy(): void { this.buffer.destroy(); }

  private push(light: LightDescriptor): number {
    if (this.lights.length >= 8) {
      console.warn('[LightManager] Max 8 lights — ignoring');
      return -1;
    }
    this.lights.push(light);
    return this.lights.length - 1;
  }
}
