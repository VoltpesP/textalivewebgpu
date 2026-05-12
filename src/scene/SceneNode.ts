/**
 * SceneNode — a single renderable object in the scene.
 *
 * Pure data: no GPU state lives here.  FurRenderer maintains a shadow
 * GPUNodeData entry for each SceneNode and rebuilds it when geometryDirty is set.
 *
 * Transform convention:
 *   model = T * Ry(eulerY) * Rx(eulerX) * S(scale)
 *   i.e. scale first, then tilt (pitch), then yaw, then translate.
 */

import type { InterleavedGeometry } from '../utils/GeometryUtils';
import {
  multiplyMatrices,
  rotationX,
  rotationY,
  scaleMatrix,
  translation,
} from '../utils/MathUtils';

export interface SceneNodeOptions {
  name        ?: string;
  position    ?: [number, number, number];
  eulerY      ?: number;   // yaw around world Y (radians)
  eulerX      ?: number;   // pitch around local X (radians)
  scale       ?: number;
  visible     ?: boolean;
  numShells   ?: number;
  furLength   ?: number;
}

export class SceneNode {
  name      : string;
  position  : [number, number, number];
  eulerY    : number;
  eulerX    : number;
  scale     : number;
  visible   : boolean;
  numShells : number;
  furLength : number;

  /** Set to true when geometry is replaced — FurRenderer re-uploads on next frame. */
  geometryDirty = true;

  private _geometry: InterleavedGeometry;

  constructor(geometry: InterleavedGeometry, opts: SceneNodeOptions = {}) {
    this._geometry = geometry;
    this.name      = opts.name      ?? 'SceneNode';
    this.position  = opts.position  ?? [0, 0, 0];
    this.eulerY    = opts.eulerY    ?? 0;
    this.eulerX    = opts.eulerX    ?? 0;
    this.scale     = opts.scale     ?? 1;
    this.visible   = opts.visible   ?? true;
    this.numShells = opts.numShells ?? 32;
    this.furLength = opts.furLength ?? 0.20;
  }

  get geometry(): InterleavedGeometry { return this._geometry; }

  set geometry(geo: InterleavedGeometry) {
    this._geometry  = geo;
    this.geometryDirty = true;
  }

  /** Compose TRS model matrix (column-major). */
  getModelMatrix(): Float32Array {
    const S  = scaleMatrix(this.scale);
    const Rx = rotationX(this.eulerX);
    const Ry = rotationY(this.eulerY);
    const T  = translation(...this.position);
    return multiplyMatrices(T, multiplyMatrices(Ry, multiplyMatrices(Rx, S)));
  }
}
