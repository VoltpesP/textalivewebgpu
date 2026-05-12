/**
 * OrbitCamera - Maya/3D-viewport-style interactive camera
 *
 * Controls:
 *   Left drag   -> orbit (tumble) around the target point
 *   Right drag  -> pan  (track)  the target point in screen space
 *   Scroll      -> dolly (zoom)  in / out
 *   Pinch       -> dolly (two-finger touch)
 *
 * Internally the camera is stored in spherical coordinates:
 *   azimuth   (theta) - horizontal angle around Y axis
 *   elevation (phi)   - vertical angle above the XZ plane
 *   radius            - distance from target
 *
 * getEye() converts these back to a Cartesian position for lookAt().
 */

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export interface OrbitCameraOptions {
  azimuth?   : number;
  elevation? : number;
  radius?    : number;
  target?    : [number, number, number];
}

export class OrbitCamera {
  private azimuth   : number;
  private elevation : number;
  private radius    : number;
  private target    : [number, number, number];

  // Active pointer tracking (supports mouse + touch)
  private readonly ptrs = new Map<number, { x: number; y: number }>();
  private activeMB      = -1;   // which mouse button started the drag
  private lastX         = 0;
  private lastY         = 0;
  private lastPinchDist = 0;

  private readonly ORBIT_SPEED = 0.006;
  private readonly PAN_SPEED   = 0.003;
  private readonly ZOOM_SPEED  = 0.12;
  private readonly MIN_RADIUS  = 0.5;
  private readonly MAX_RADIUS  = 50;

  private readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, opts: OrbitCameraOptions = {}) {
    this.canvas = canvas;
    this.azimuth   = opts.azimuth   ?? 0;
    this.elevation = opts.elevation ?? 0.15;
    this.radius    = opts.radius    ?? 3.5;
    this.target    = opts.target    ? [...opts.target] as [number, number, number] : [0, 0, 0];

    canvas.style.cursor = 'grab';

    // Pointer events unify mouse, touch, and stylus into one API
    canvas.addEventListener('pointerdown',   this.onPointerDown);
    canvas.addEventListener('pointermove',   this.onPointerMove);
    canvas.addEventListener('pointerup',     this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);

    // Prevent right-click context menu so right-drag can pan
    canvas.addEventListener('contextmenu', this.onContextMenu);

    // Wheel for scroll-to-zoom
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  // ---- event handlers (arrow props = stable references for removeEventListener) ----

  private readonly onContextMenu = (e: Event) => e.preventDefault();

  private readonly onPointerDown = (e: PointerEvent) => {
    // Capture so we keep receiving events even when the pointer leaves the canvas
    this.canvas.setPointerCapture(e.pointerId);
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.activeMB = e.button;
    this.lastX    = e.clientX;
    this.lastY    = e.clientY;
    this.canvas.style.cursor = 'grabbing';
  };

  private readonly onPointerMove = (e: PointerEvent) => {
    if (!this.ptrs.has(e.pointerId)) return;
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two-pointer pinch zoom (touch only)
    if (this.ptrs.size === 2) {
      const [a, b] = [...this.ptrs.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.lastPinchDist > 0) {
        this.radius = clamp(this.radius * this.lastPinchDist / dist, this.MIN_RADIUS, this.MAX_RADIUS);
      }
      this.lastPinchDist = dist;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      return;
    }
    this.lastPinchDist = 0;

    if (this.activeMB < 0) return;

    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;

    if (this.activeMB === 0) {
      // Left drag -> orbit
      // azimuth -= dx : drag right -> sphere appears to spin right (grab-and-spin metaphor)
      // elevation -= dy: drag up   -> camera rises -> we look down at the model
      this.azimuth   -= dx * this.ORBIT_SPEED;
      this.elevation  = clamp(
        this.elevation - dy * this.ORBIT_SPEED,
        -Math.PI / 2 + 0.05,   // clamp away from poles to avoid gimbal flip
        Math.PI  / 2 - 0.05,
      );
    } else if (this.activeMB === 2) {
      // Right drag -> pan (slide the look-at target in the camera's screen plane)
      this.pan(dx, dy);
    }
  };

  private readonly onPointerUp = (e: PointerEvent) => {
    this.ptrs.delete(e.pointerId);
    if (this.ptrs.size === 0) {
      this.activeMB      = -1;
      this.lastPinchDist = 0;
      this.canvas.style.cursor = 'grab';
    }
  };

  private readonly onWheel = (e: WheelEvent) => {
    e.preventDefault();
    // deltaY > 0 = scroll down = zoom out
    const factor = 1 + Math.sign(e.deltaY) * this.ZOOM_SPEED;
    this.radius = clamp(this.radius * factor, this.MIN_RADIUS, this.MAX_RADIUS);
  };

  // ---- pan helper ------------------------------------------------------------

  /**
   * Translate the target point in the camera's local right/up plane.
   * Scale by radius so panning feels consistent at any zoom level.
   */
  private pan(dx: number, dy: number): void {
    const right = this.getRightDir();
    const up    = this.getUpDir();
    const s     = this.radius * this.PAN_SPEED;

    // Negate dx on right because dragging right should move the scene right
    this.target[0] += (-dx * right[0] + dy * up[0]) * s;
    this.target[1] += (-dx * right[1] + dy * up[1]) * s;
    this.target[2] += (-dx * right[2] + dy * up[2]) * s;
  }

  // ---- public API -----------------------------------------------------------

  /**
   * Returns the camera's world-space eye position.
   * Pass this (and getTarget()) to lookAt() every frame.
   */
  getEye(): [number, number, number] {
    const cosEl = Math.cos(this.elevation);
    return [
      this.target[0] + this.radius * cosEl * Math.sin(this.azimuth),
      this.target[1] + this.radius * Math.sin(this.elevation),
      this.target[2] + this.radius * cosEl * Math.cos(this.azimuth),
    ];
  }

  getTarget(): [number, number, number] {
    return [...this.target] as [number, number, number];
  }

  destroy(): void {
    this.canvas.removeEventListener('pointerdown',   this.onPointerDown);
    this.canvas.removeEventListener('pointermove',   this.onPointerMove);
    this.canvas.removeEventListener('pointerup',     this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.removeEventListener('contextmenu',   this.onContextMenu);
    this.canvas.removeEventListener('wheel',         this.onWheel);
    this.canvas.style.cursor = '';
  }

  // ---- private helpers ------------------------------------------------------

  /**
   * Camera's local right direction = tangent to azimuth increase.
   * d/dTheta [cos(el)*sin(th), sin(el), cos(el)*cos(th)] = [cos(th), 0, -sin(th)]
   */
  private getRightDir(): [number, number, number] {
    return [Math.cos(this.azimuth), 0, -Math.sin(this.azimuth)];
  }

  /**
   * Camera's local up direction = tangent to elevation increase (points away from horizon).
   * d/dPhi [cos(el)*sin(th), sin(el), cos(el)*cos(th)] = [-sin(el)*sin(th), cos(el), -sin(el)*cos(th)]
   */
  private getUpDir(): [number, number, number] {
    const se = Math.sin(this.elevation);
    const ce = Math.cos(this.elevation);
    return [-se * Math.sin(this.azimuth), ce, -se * Math.cos(this.azimuth)];
  }
}
