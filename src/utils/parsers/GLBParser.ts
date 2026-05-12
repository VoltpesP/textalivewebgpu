import type { InterleavedGeometry } from '../GeometryUtils';

/**
 * Minimal binary glTF (GLB) parser.
 *
 * Reads the first mesh primitive that has a POSITION attribute.
 * If a NORMAL attribute is absent, smooth normals are computed.
 * All index types (uint8 / uint16 / uint32) are promoted to Uint32.
 * Buffer-view byteStride is respected (handles interleaved source data).
 *
 * GLB binary layout:
 *   [12-byte header] [JSON chunk] [BIN chunk]
 */

// glTF component type constants (index types only; positions/normals are always FLOAT=5126)
const UNSIGNED_BYTE  = 5121;
const UNSIGNED_SHORT = 5123;
const UNSIGNED_INT   = 5125;

const TYPE_COMPONENTS: Record<string, number> = {
  SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16,
};

// ---- GLTF JSON types -------------------------------------------------------

interface GltfAccessor {
  bufferView?   : number;
  byteOffset?   : number;
  componentType : number;
  count         : number;
  type          : string;
}

interface GltfBufferView {
  buffer     : number;
  byteOffset?: number;
  byteLength : number;
  byteStride?: number;
}

interface GltfJson {
  meshes      : Array<{ primitives: Array<{ attributes: Record<string, number>; indices?: number }> }>;
  accessors   : GltfAccessor[];
  bufferViews : GltfBufferView[];
}

// ---- Public API ------------------------------------------------------------

export function parseGLB(buffer: ArrayBuffer): InterleavedGeometry {
  const view = new DataView(buffer);

  // Header
  const magic = view.getUint32(0, true);
  if (magic !== 0x46546C67) throw new Error('Not a valid GLB file (bad magic)');
  const version = view.getUint32(4, true);
  if (version !== 2) throw new Error(`Unsupported glTF version: ${version}`);

  // Parse chunks
  let pos = 12;
  let jsonChunk: ArrayBuffer | null = null;
  let binChunk : ArrayBuffer | null = null;

  while (pos < buffer.byteLength) {
    const chunkLen  = view.getUint32(pos,     true);
    const chunkType = view.getUint32(pos + 4, true);
    pos += 8;

    if (chunkType === 0x4E4F534A) {          // JSON
      jsonChunk = buffer.slice(pos, pos + chunkLen);
    } else if (chunkType === 0x004E4942) {   // BIN
      binChunk = buffer.slice(pos, pos + chunkLen);
    }
    pos += chunkLen;
  }

  if (!jsonChunk) throw new Error('GLB has no JSON chunk');
  if (!binChunk)  throw new Error('GLB has no BIN chunk');

  const gltf: GltfJson = JSON.parse(new TextDecoder().decode(jsonChunk));
  if (!gltf.meshes?.length) throw new Error('GLB contains no meshes');

  // Find the first primitive with a POSITION attribute
  let prim: { attributes: Record<string, number>; indices?: number } | undefined;
  outer:
  for (const mesh of gltf.meshes) {
    for (const p of mesh.primitives) {
      if (p.attributes.POSITION !== undefined) { prim = p; break outer; }
    }
  }
  if (!prim) throw new Error('GLB has no mesh primitive with POSITION');

  const posData  = readFloat32(gltf, binChunk, prim.attributes.POSITION);
  const hasNorms = prim.attributes.NORMAL !== undefined;
  const normData = hasNorms ? readFloat32(gltf, binChunk, prim.attributes.NORMAL) : null;

  const indices = prim.indices !== undefined
    ? readIndices(gltf, binChunk, prim.indices)
    : defaultIndices(posData.length / 3);

  // Interleave positions and normals
  const vertCount = posData.length / 3;
  const vertices  = new Float32Array(vertCount * 6);
  for (let i = 0; i < vertCount; i++) {
    const src = i * 3, dst = i * 6;
    vertices[dst]     = posData[src];
    vertices[dst + 1] = posData[src + 1];
    vertices[dst + 2] = posData[src + 2];
    if (normData) {
      vertices[dst + 3] = normData[src];
      vertices[dst + 4] = normData[src + 1];
      vertices[dst + 5] = normData[src + 2];
    }
  }

  if (!hasNorms) computeSmoothNormals(vertices, indices);

  return { vertices, indices, stride: 24 };
}

// ---- Accessor helpers ------------------------------------------------------

function readFloat32(gltf: GltfJson, bin: ArrayBuffer, accIdx: number): Float32Array {
  const acc  = gltf.accessors[accIdx];
  const bv   = gltf.bufferViews[acc.bufferView ?? 0];
  const n    = TYPE_COMPONENTS[acc.type] ?? 1;
  const count = acc.count;
  const bvOffset  = bv.byteOffset  ?? 0;
  const accOffset = acc.byteOffset ?? 0;
  const stride = bv.byteStride ?? (n * 4);  // tightly packed if no byteStride

  const out  = new Float32Array(count * n);
  const dv   = new DataView(bin);

  for (let i = 0; i < count; i++) {
    const base = bvOffset + accOffset + i * stride;
    for (let c = 0; c < n; c++) {
      out[i * n + c] = dv.getFloat32(base + c * 4, true);
    }
  }
  return out;
}

function readIndices(gltf: GltfJson, bin: ArrayBuffer, accIdx: number): Uint32Array {
  const acc = gltf.accessors[accIdx];
  const bv  = gltf.bufferViews[acc.bufferView ?? 0];
  const bvOffset  = bv.byteOffset  ?? 0;
  const accOffset = acc.byteOffset ?? 0;
  const count = acc.count;
  const dv    = new DataView(bin);
  const out   = new Uint32Array(count);

  const compSize = acc.componentType === UNSIGNED_BYTE  ? 1
                 : acc.componentType === UNSIGNED_SHORT ? 2
                 : 4;  // UNSIGNED_INT

  for (let i = 0; i < count; i++) {
    const off = bvOffset + accOffset + i * compSize;
    if      (acc.componentType === UNSIGNED_BYTE)  out[i] = dv.getUint8(off);
    else if (acc.componentType === UNSIGNED_SHORT) out[i] = dv.getUint16(off, true);
    else if (acc.componentType === UNSIGNED_INT)   out[i] = dv.getUint32(off, true);
  }
  return out;
}

function defaultIndices(vertCount: number): Uint32Array {
  const idx = new Uint32Array(vertCount);
  for (let i = 0; i < vertCount; i++) idx[i] = i;
  return idx;
}

// ---- Smooth normal computation ---------------------------------------------

function computeSmoothNormals(vertices: Float32Array, indices: Uint32Array): void {
  const acc = new Float32Array(vertices.length / 6 * 3);

  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i], i1 = indices[i + 1], i2 = indices[i + 2];
    const p0 = i0 * 6, p1 = i1 * 6, p2 = i2 * 6;

    const ax = vertices[p1] - vertices[p0], ay = vertices[p1 + 1] - vertices[p0 + 1], az = vertices[p1 + 2] - vertices[p0 + 2];
    const bx = vertices[p2] - vertices[p0], by = vertices[p2 + 1] - vertices[p0 + 1], bz = vertices[p2 + 2] - vertices[p0 + 2];

    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;

    for (const vi of [i0, i1, i2]) {
      acc[vi * 3]     += nx;
      acc[vi * 3 + 1] += ny;
      acc[vi * 3 + 2] += nz;
    }
  }

  for (let i = 0; i < vertices.length / 6; i++) {
    const ni  = i * 3;
    const len = Math.sqrt(acc[ni] ** 2 + acc[ni + 1] ** 2 + acc[ni + 2] ** 2);
    const vi  = i * 6 + 3;
    if (len > 0) {
      vertices[vi]     = acc[ni]     / len;
      vertices[vi + 1] = acc[ni + 1] / len;
      vertices[vi + 2] = acc[ni + 2] / len;
    } else {
      vertices[vi] = 0; vertices[vi + 1] = 1; vertices[vi + 2] = 0;
    }
  }
}
