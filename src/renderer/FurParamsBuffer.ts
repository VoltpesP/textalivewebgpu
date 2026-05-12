/**
 * FurParamsBuffer — owns the GPU uniform buffer for all real-time fur parameters.
 *
 * Modify the public properties then call upload() to push changes to the GPU.
 * Cheap to call every frame (80 bytes).
 */
export class FurParamsBuffer {
  // Geometry
  density  = 22.0;   // hair strand grid cells across the sphere
  gravity  = 0.07;   // droop strength (quadratic per shell)
  windStr  = 1.0;    // wind amplitude multiplier (1 = original)
  windSpd  = 1.0;    // wind frequency multiplier (1 = original)

  // Colors  (linear-space RGB, range [0, 1])
  rootColor : [number, number, number] = [0.80, 0.80, 0.80];
  tipColor  : [number, number, number] = [0.90, 0.70, 0.35];
  skinColor : [number, number, number] = [0.20, 0.10, 0.04];

  // Bump mapping
  bumpStr   = 4.0;   // tilt strength
  bumpScale = 6.0;   // UV scale for noise field

  readonly buffer: GPUBuffer;
  private readonly device: GPUDevice;
  private readonly data = new Float32Array(20);  // 80 bytes

  constructor(device: GPUDevice) {
    this.device = device;
    this.buffer = device.createBuffer({
      size : 80,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: 'fur-params',
    });
    this.upload();
  }

  /** Pack all properties into the GPU buffer. ~80 bytes, cheap per-frame. */
  upload(): void {
    const d = this.data;
    d[0]  = this.density;
    d[1]  = this.gravity;
    d[2]  = this.windStr;
    d[3]  = this.windSpd;
    d[4]  = this.rootColor[0]; d[5]  = this.rootColor[1]; d[6]  = this.rootColor[2]; d[7]  = 1;
    d[8]  = this.tipColor[0];  d[9]  = this.tipColor[1];  d[10] = this.tipColor[2];  d[11] = 1;
    d[12] = this.skinColor[0]; d[13] = this.skinColor[1]; d[14] = this.skinColor[2]; d[15] = 1;
    d[16] = this.bumpStr;
    d[17] = this.bumpScale;
    // d[18], d[19] = padding, stay 0
    this.device.queue.writeBuffer(this.buffer, 0, this.data);
  }

  destroy(): void { this.buffer.destroy(); }
}
