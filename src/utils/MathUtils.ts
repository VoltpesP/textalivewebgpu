/**
 * Matrix math utilities - all matrices use COLUMN-MAJOR storage,
 * which matches WGSL's mat4x4<f32> layout.
 *
 * Column-major layout: element at math position (row, col) is stored
 * at array index  col*4 + row.
 *
 * Because WGSL does  `matrix * column_vector`,  the correct CPU multiply
 * order for "apply model first, then view, then projection" is:
 *   mvp = proj * view * model
 */

export function createIdentityMatrix(): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,   // col 0
    0, 1, 0, 0,   // col 1
    0, 0, 1, 0,   // col 2
    0, 0, 0, 1,   // col 3
  ]);
}

/** Column-major matrix multiply: C = A * B */
export function multiplyMatrices(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        // a[k*4+row] = element (row, k) of A
        // b[col*4+k] = element (k, col) of B
        sum += a[k * 4 + row] * b[col * 4 + k];
      }
      out[col * 4 + row] = sum; // store element (row, col)
    }
  }
  return out;
}

/**
 * Perspective projection - WebGPU depth range [0, 1].
 *
 * How it works:
 *   - fovYRadians: vertical field of view in radians (e.g. Math.PI/3 = 60deg)
 *   - aspect: canvas width / height
 *   - near/far: clip planes (near must be > 0)
 *
 * The w component after multiply = -z_view.
 * Dividing xyz by w gives NDC coords in [-1,1] for x/y and [0,1] for z.
 */
export function perspectiveMatrix(
  fovYRadians: number,
  aspect: number,
  near: number,
  far: number,
): Float32Array {
  const f   = 1.0 / Math.tan(fovYRadians / 2.0);
  const nf  = 1.0 / (near - far); // 1/(n-f), negative
  const out = new Float32Array(16);

  // col 0
  out[0] = f / aspect;
  // col 1
  out[5] = f;
  // col 2  (z -> [0,1] for WebGPU, differs from OpenGL's [-1,1])
  out[10] = far * nf;          // -f/(f-n)
  out[11] = -1;                // sets w_clip = -z_view (perspective divide)
  // col 3
  out[14] = far * near * nf;  // -fn/(f-n)

  return out;
}

/**
 * View matrix from camera position/target/up.
 *
 * Think of it as: "given where the camera sits and what it looks at,
 * rotate and translate the world so the camera is at the origin looking down -Z."
 */
export function lookAt(
  eye:    [number, number, number],
  target: [number, number, number],
  up:     [number, number, number],
): Float32Array {
  const [ex, ey, ez] = eye;
  const [tx, ty, tz] = target;
  const [ux, uy, uz] = up;

  // Z-axis points from target to eye (camera looks down -Z)
  let zx = ex - tx, zy = ey - ty, zz = ez - tz;
  let len = Math.hypot(zx, zy, zz) || 1;
  zx /= len; zy /= len; zz /= len;

  // X-axis = right = up x Z
  let xx = uy * zz - uz * zy;
  let xy = uz * zx - ux * zz;
  let xz = ux * zy - uy * zx;
  len = Math.hypot(xx, xy, xz);
  if (len === 0) { xx = 1; xy = 0; xz = 0; }
  else { xx /= len; xy /= len; xz /= len; }

  // Y-axis = Z x X  (re-orthogonalise)
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  // Column-major storage.
  // Translation = -dot(axis, eye) so world points move relative to camera.
  const out = new Float32Array(16);
  // col 0  (right vector)
  out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
  // col 1  (up vector)
  out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
  // col 2  (back vector)
  out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
  // col 3  (translation: move world so camera is at origin)
  out[12] = -(xx * ex + xy * ey + xz * ez);
  out[13] = -(yx * ex + yy * ey + yz * ez);
  out[14] = -(zx * ex + zy * ey + zz * ez);
  out[15] = 1;
  return out;
}

/** Rotation around the Y axis (column-major). */
export function rotationY(angleRadians: number): Float32Array {
  const c = Math.cos(angleRadians);
  const s = Math.sin(angleRadians);
  return new Float32Array([
     c, 0, -s, 0,  // col 0
     0, 1,  0, 0,  // col 1
     s, 0,  c, 0,  // col 2
     0, 0,  0, 1,  // col 3
  ]);
}

/** Rotation around the X axis (column-major). */
export function rotationX(angleRadians: number): Float32Array {
  const c = Math.cos(angleRadians);
  const s = Math.sin(angleRadians);
  return new Float32Array([
    1,  0,  0, 0,  // col 0
    0,  c,  s, 0,  // col 1
    0, -s,  c, 0,  // col 2
    0,  0,  0, 1,  // col 3
  ]);
}

/**
 * 4×4 matrix inverse (column-major, general case).
 * Returns a zero matrix if singular.
 * Uses the cofactor / adjugate method (same convention as glMatrix).
 */
export function invertMatrix4x4(m: Float32Array): Float32Array {
  const out = new Float32Array(16);
  // Naming: aRC = element at column R, row C (column-major)
  const a00=m[0],  a01=m[1],  a02=m[2],  a03=m[3];
  const a10=m[4],  a11=m[5],  a12=m[6],  a13=m[7];
  const a20=m[8],  a21=m[9],  a22=m[10], a23=m[11];
  const a30=m[12], a31=m[13], a32=m[14], a33=m[15];

  const b00 = a00*a11 - a01*a10,  b01 = a00*a12 - a02*a10;
  const b02 = a00*a13 - a03*a10,  b03 = a01*a12 - a02*a11;
  const b04 = a01*a13 - a03*a11,  b05 = a02*a13 - a03*a12;
  const b06 = a20*a31 - a21*a30,  b07 = a20*a32 - a22*a30;
  const b08 = a20*a33 - a23*a30,  b09 = a21*a32 - a22*a31;
  const b10 = a21*a33 - a23*a31,  b11 = a22*a33 - a23*a32;

  let det = b00*b11 - b01*b10 + b02*b09 + b03*b08 - b04*b07 + b05*b06;
  if (Math.abs(det) < 1e-8) return out;
  det = 1 / det;

  out[0]  = (a11*b11 - a12*b10 + a13*b09) * det;
  out[1]  = (a02*b10 - a01*b11 - a03*b09) * det;
  out[2]  = (a31*b05 - a32*b04 + a33*b03) * det;
  out[3]  = (a22*b04 - a21*b05 - a23*b03) * det;
  out[4]  = (a12*b08 - a10*b11 - a13*b07) * det;
  out[5]  = (a00*b11 - a02*b08 + a03*b07) * det;
  out[6]  = (a32*b02 - a30*b05 - a33*b01) * det;
  out[7]  = (a20*b05 - a22*b02 + a23*b01) * det;
  out[8]  = (a10*b10 - a11*b08 + a13*b06) * det;
  out[9]  = (a01*b08 - a00*b10 - a03*b06) * det;
  out[10] = (a30*b04 - a31*b02 + a33*b00) * det;
  out[11] = (a21*b02 - a20*b04 - a23*b00) * det;
  out[12] = (a11*b07 - a10*b09 - a12*b06) * det;
  out[13] = (a00*b09 - a01*b07 + a02*b06) * det;
  out[14] = (a31*b01 - a30*b03 - a32*b00) * det;
  out[15] = (a20*b03 - a21*b01 + a22*b00) * det;

  return out;
}

/** Uniform scale matrix (column-major). */
export function scaleMatrix(s: number): Float32Array {
  return new Float32Array([
    s, 0, 0, 0,
    0, s, 0, 0,
    0, 0, s, 0,
    0, 0, 0, 1,
  ]);
}

/** Translation matrix (column-major). */
export function translation(x: number, y: number, z: number): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,  // col 0
    0, 1, 0, 0,  // col 1
    0, 0, 1, 0,  // col 2
    x, y, z, 1,  // col 3  <- translation lives in the last column
  ]);
}
