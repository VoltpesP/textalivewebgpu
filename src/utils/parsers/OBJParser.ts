import type { InterleavedGeometry } from '../GeometryUtils';

/**
 * Minimal OBJ parser.
 *
 * Supports:
 *   v  x y z           — vertex positions
 *   vn x y z           — vertex normals
 *   f  v[/[vt]/vn] …   — triangle and quad faces (fan-triangulated)
 *
 * OBJ uses separate indices for positions and normals, so we deduplicate
 * (posIdx, normIdx) pairs into a flat interleaved vertex list compatible
 * with InterleavedGeometry [px py pz nx ny nz].
 *
 * If the file contains no normals, smooth normals are computed from the
 * face geometry (accumulated cross-products, area-weighted).
 */
export function parseOBJ(text: string): InterleavedGeometry {
  const rawPos : number[] = [];  // position pool:  3 floats per entry
  const rawNorm: number[] = [];  // normal pool:     3 floats per entry

  // Final interleaved vertex buffer and index buffer (built during face parsing)
  const verts : number[] = [];
  const idxArr: number[] = [];
  const seen   = new Map<string, number>();  // "posIdx_normIdx" -> vertex index

  let hasNormals = false;

  for (const rawLine of text.split('\n')) {
    const line  = rawLine.trim();
    if (!line || line[0] === '#') continue;

    const tok = line.split(/\s+/);
    const cmd = tok[0];

    if (cmd === 'v') {
      rawPos.push(+tok[1], +tok[2], +tok[3]);
    } else if (cmd === 'vn') {
      rawNorm.push(+tok[1], +tok[2], +tok[3]);
      hasNormals = true;
    } else if (cmd === 'f') {
      // Parse each corner reference, build unique vertices, then triangulate
      const corner: number[] = [];

      for (let i = 1; i < tok.length; i++) {
        const refs = tok[i].split('/');
        // OBJ is 1-based; negative = relative from end
        const pi = resolveIdx(+refs[0], rawPos.length  / 3);
        const ni = refs[2] ? resolveIdx(+refs[2], rawNorm.length / 3) : -1;

        const key = `${pi}_${ni}`;
        let vi = seen.get(key);
        if (vi === undefined) {
          vi = verts.length / 6;
          const b = pi * 3;
          verts.push(rawPos[b], rawPos[b + 1], rawPos[b + 2]);
          if (ni >= 0) {
            const nb = ni * 3;
            verts.push(rawNorm[nb], rawNorm[nb + 1], rawNorm[nb + 2]);
          } else {
            verts.push(0, 1, 0);  // placeholder; overwritten below if needed
          }
          seen.set(key, vi);
        }
        corner.push(vi);
      }

      // Fan-triangulate (works for convex polygons)
      for (let i = 1; i < corner.length - 1; i++) {
        idxArr.push(corner[0], corner[i], corner[i + 1]);
      }
    }
  }

  const vertices = new Float32Array(verts);
  const indices  = new Uint32Array(idxArr);

  if (!hasNormals) {
    computeSmoothNormals(vertices, indices);
  }

  return { vertices, indices, stride: 24 };
}

// Resolve a 1-based (possibly negative) OBJ index to 0-based
function resolveIdx(raw: number, len: number): number {
  return raw < 0 ? len + raw : raw - 1;
}

/**
 * Accumulate face normals to each vertex (area-weighted by cross-product magnitude),
 * then normalize.  Modifies the interleaved `vertices` array in-place.
 */
function computeSmoothNormals(vertices: Float32Array, indices: Uint32Array): void {
  const acc = new Float32Array(vertices.length / 6 * 3);  // one vec3 per vertex

  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i], i1 = indices[i + 1], i2 = indices[i + 2];
    const p0 = i0 * 6, p1 = i1 * 6, p2 = i2 * 6;

    const ax = vertices[p1] - vertices[p0], ay = vertices[p1 + 1] - vertices[p0 + 1], az = vertices[p1 + 2] - vertices[p0 + 2];
    const bx = vertices[p2] - vertices[p0], by = vertices[p2 + 1] - vertices[p0 + 1], bz = vertices[p2 + 2] - vertices[p0 + 2];

    // Cross product (magnitude = 2 * triangle area — natural area weighting)
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
    const ni = i * 3;
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
