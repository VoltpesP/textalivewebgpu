import type { InterleavedGeometry } from './GeometryUtils';
import { parseOBJ } from './parsers/OBJParser';
import { parseGLB } from './parsers/GLBParser';

/**
 * Load a 3D model from a File object (drag-drop / file-picker).
 * Detects format from the file extension.
 * Always normalizes the output: centered at origin, scaled to radius ≈ 1.
 */
export async function loadModelFromFile(file: File): Promise<InterleavedGeometry> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.obj')) {
    const text = await file.text();
    return normalizeGeometry(parseOBJ(text));
  }

  if (name.endsWith('.glb')) {
    const buf = await file.arrayBuffer();
    return normalizeGeometry(parseGLB(buf));
  }

  throw new Error(`Unsupported format: "${file.name}". Accepted: .obj  .glb`);
}

/**
 * Load a 3D model from a URL.
 * The format is inferred from the URL path extension.
 */
export async function loadModelFromURL(url: string): Promise<InterleavedGeometry> {
  const lower = url.split('?')[0].toLowerCase();

  if (lower.endsWith('.obj')) {
    const text = await (await fetch(url)).text();
    return normalizeGeometry(parseOBJ(text));
  }

  if (lower.endsWith('.glb')) {
    const buf = await (await fetch(url)).arrayBuffer();
    return normalizeGeometry(parseGLB(buf));
  }

  throw new Error(`Cannot determine format from URL: "${url}"`);
}

/**
 * Center the model at the origin and scale it so the longest axis fits in [-1, 1].
 * Normals are unit vectors and are left untouched.
 */
export function normalizeGeometry(geo: InterleavedGeometry): InterleavedGeometry {
  let minX =  Infinity, minY =  Infinity, minZ =  Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < geo.vertices.length; i += 6) {
    const x = geo.vertices[i], y = geo.vertices[i + 1], z = geo.vertices[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const span  = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
  const scale = span > 0 ? 2 / span : 1;

  const vertices = new Float32Array(geo.vertices);
  for (let i = 0; i < vertices.length; i += 6) {
    vertices[i]     = (vertices[i]     - cx) * scale;
    vertices[i + 1] = (vertices[i + 1] - cy) * scale;
    vertices[i + 2] = (vertices[i + 2] - cz) * scale;
    // i+3 .. i+5  are the normal — unit vectors, no scaling needed
  }

  return { vertices, indices: geo.indices, stride: geo.stride };
}
