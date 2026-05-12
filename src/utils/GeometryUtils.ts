/**
 * Geometry utilities for creating basic GPU geometry
 */

// UV sphere with interleaved [pos(vec3), normal(vec3)] - 24 bytes per vertex.
// Normal = unit position direction on a sphere, so pos/radius gives normal directly.
export function createSphereInterleaved(
  radius: number = 1,
  widthSegments: number = 48,
  heightSegments: number = 24,
): InterleavedGeometry {
  const floatsPerVert = 6; // 3 pos + 3 normal
  const vertCount = (widthSegments + 1) * (heightSegments + 1);
  const vertices = new Float32Array(vertCount * floatsPerVert);

  let vi = 0;
  for (let y = 0; y <= heightSegments; y++) {
    const phi    = (y / heightSegments) * Math.PI; // 0 (top) -> pi (bottom)
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    for (let x = 0; x <= widthSegments; x++) {
      const theta    = (x / widthSegments) * Math.PI * 2;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      // Normal = unit direction; position = normal * radius
      const nx = sinPhi * cosTheta;
      const ny = cosPhi;
      const nz = sinPhi * sinTheta;

      vertices[vi++] = nx * radius;
      vertices[vi++] = ny * radius;
      vertices[vi++] = nz * radius;
      vertices[vi++] = nx;
      vertices[vi++] = ny;
      vertices[vi++] = nz;
    }
  }

  const indices = new Uint32Array(widthSegments * heightSegments * 6);
  let ii = 0;
  for (let y = 0; y < heightSegments; y++) {
    for (let x = 0; x < widthSegments; x++) {
      const a = y * (widthSegments + 1) + x;
      const b = a + (widthSegments + 1);
      indices[ii++] = a;     indices[ii++] = b;     indices[ii++] = a + 1;
      indices[ii++] = b;     indices[ii++] = b + 1; indices[ii++] = a + 1;
    }
  }

  return { vertices, indices, stride: floatsPerVert * 4 };
}

export interface InterleavedGeometry {
  /** Interleaved float32 data: [px, py, pz, nx, ny, nz] per vertex */
  vertices: Float32Array;
  indices: Uint32Array;
  /** Stride in bytes between consecutive vertices */
  stride: number;
}

/**
 * Cube with 24 unique vertices (4 per face) so each face has a flat normal.
 * Vertex layout: position (vec3f) | normal (vec3f) - 24 bytes per vertex.
 */
export function createCubeInterleaved(size: number = 1): InterleavedGeometry {
  const s = size / 2;

  // [px, py, pz, nx, ny, nz]
  const faceData: [number, number, number, number, number, number][][] = [
    // +Z front
    [[-s,-s, s, 0,0,1],[s,-s, s, 0,0,1],[s, s, s, 0,0,1],[-s, s, s, 0,0,1]],
    // -Z back
    [[ s,-s,-s, 0,0,-1],[-s,-s,-s, 0,0,-1],[-s, s,-s, 0,0,-1],[s, s,-s, 0,0,-1]],
    // +Y top
    [[-s, s, s, 0,1,0],[s, s, s, 0,1,0],[s, s,-s, 0,1,0],[-s, s,-s, 0,1,0]],
    // -Y bottom
    [[-s,-s,-s, 0,-1,0],[s,-s,-s, 0,-1,0],[s,-s, s, 0,-1,0],[-s,-s, s, 0,-1,0]],
    // +X right
    [[ s,-s, s, 1,0,0],[s,-s,-s, 1,0,0],[s, s,-s, 1,0,0],[s, s, s, 1,0,0]],
    // -X left
    [[-s,-s,-s,-1,0,0],[-s,-s, s,-1,0,0],[-s, s, s,-1,0,0],[-s, s,-s,-1,0,0]],
  ];

  const vertexFloats = 6; // 3 pos + 3 normal
  const vertices = new Float32Array(24 * vertexFloats);
  const indices = new Uint32Array(36);

  for (let f = 0; f < 6; f++) {
    const face = faceData[f];
    const baseVert = f * 4;
    const baseIdx = f * 6;
    for (let v = 0; v < 4; v++) {
      const offset = (baseVert + v) * vertexFloats;
      vertices.set(face[v], offset);
    }
    indices.set([
      baseVert, baseVert+1, baseVert+2,
      baseVert, baseVert+2, baseVert+3,
    ], baseIdx);
  }

  return { vertices, indices, stride: vertexFloats * 4 };
}

export interface VertexData {
  positions: Float32Array;
  indices: Uint32Array;
  normals?: Float32Array;
  uvs?: Float32Array;
}

/**
 * Create a simple fullscreen quad (for post-processing)
 */
export function createFullscreenQuad(): VertexData {
  const positions = new Float32Array([
    -1, -1, 0,  // bottom-left
     1, -1, 0,  // bottom-right
     1,  1, 0,  // top-right
    -1,  1, 0,  // top-left
  ]);

  const indices = new Uint32Array([
    0, 1, 2,  // first triangle
    0, 2, 3,  // second triangle
  ]);

  const uvs = new Float32Array([
    0, 1,  // bottom-left
    1, 1,  // bottom-right
    1, 0,  // top-right
    0, 0,  // top-left
  ]);

  return { positions, indices, uvs };
}

/**
 * Create a simple cube
 */
export function createCube(size: number = 1): VertexData {
  const s = size / 2;

  const positions = new Float32Array([
    // Front
    -s, -s,  s,
     s, -s,  s,
     s,  s,  s,
    -s,  s,  s,
    // Back
    -s, -s, -s,
     s, -s, -s,
     s,  s, -s,
    -s,  s, -s,
  ]);

  const indices = new Uint32Array([
    // Front
    0, 1, 2, 0, 2, 3,
    // Back
    5, 4, 7, 5, 7, 6,
    // Top
    3, 2, 6, 3, 6, 7,
    // Bottom
    4, 5, 1, 4, 1, 0,
    // Right
    1, 5, 6, 1, 6, 2,
    // Left
    4, 0, 3, 4, 3, 7,
  ]);

  return { positions, indices };
}

/**
 * Create a simple pyramid
 */
export function createPyramid(size: number = 1): VertexData {
  const s = size / 2;

  const positions = new Float32Array([
    // Base
    -s, 0, -s,
     s, 0, -s,
     s, 0,  s,
    -s, 0,  s,
    // Apex
    0, size, 0,
  ]);

  const indices = new Uint32Array([
    // Base
    0, 2, 1,
    0, 3, 2,
    // Sides
    0, 4, 1,
    1, 4, 2,
    2, 4, 3,
    3, 4, 0,
  ]);

  return { positions, indices };
}

/**
 * Create UV sphere
 */
export function createSphere(radius: number = 1, widthSegments: number = 32, heightSegments: number = 16): VertexData {
  const positions: number[] = [];
  const indices: number[] = [];

  for (let y = 0; y <= heightSegments; y++) {
    const v = y / heightSegments;
    const sinV = Math.sin((v - 0.5) * Math.PI);
    const cosV = Math.cos((v - 0.5) * Math.PI);

    for (let x = 0; x <= widthSegments; x++) {
      const u = x / widthSegments;
      const angle = u * Math.PI * 2;

      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      positions.push(
        radius * cosV * cosA,
        radius * sinV,
        radius * cosV * sinA
      );
    }
  }

  for (let y = 0; y < heightSegments; y++) {
    for (let x = 0; x < widthSegments; x++) {
      const a = y * (widthSegments + 1) + x;
      const b = a + widthSegments + 1;

      indices.push(a, b, a + 1);
      indices.push(b, b + 1, a + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  };
}
