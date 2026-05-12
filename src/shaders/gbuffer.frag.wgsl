// gbuffer.frag.wgsl - geometry pass fragment shader with procedural bump mapping
//
// Writes to two render targets:
//   location(0) albedo : rgba8unorm   - base skin color, alpha=1 marks valid geometry
//   location(1) normal : rgba16float  - bumped world-space normal packed [0,1]
//
// fur_params.wgsl is prepended by FurRenderer before this source reaches the GPU.

// FurParams binding for this pipeline (group 0, binding 1)
@group(0) @binding(1) var<uniform> params : FurParams;

struct GBufferOut {
  @location(0) albedo : vec4f,
  @location(1) normal : vec4f,
}

// ---- Value noise -------------------------------------------------------

fn hash2(p: vec2f) -> f32 {
  var q = fract(p * vec2f(0.1031, 0.1030));
  q    += dot(q, q.yx + 33.33);
  return fract((q.x + q.y) * q.x) * 2.0 - 1.0;  // [-1, 1]
}

fn noise2(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash2(i),                    hash2(i + vec2f(1.0, 0.0)), u.x),
    mix(hash2(i + vec2f(0.0, 1.0)), hash2(i + vec2f(1.0, 1.0)), u.x),
    u.y,
  );
}

fn fbm(p: vec2f) -> f32 {
  var v  = 0.0;
  var a  = 0.5;
  var pp = p;
  for (var i: i32 = 0; i < 3; i++) {
    v  += a * noise2(pp);
    pp  = pp * 2.13 + vec2f(5.3, 1.7);
    a  *= 0.5;
  }
  return v;
}

const BUMP_EPS : f32 = 0.01;

// ---- Main --------------------------------------------------------------

@fragment
fn main(
  @location(0) worldNormal : vec3f,
  @location(1) localPos    : vec3f,
) -> GBufferOut {
  // Spherical UV from local-space position (same as fur.frag mapping)
  let n  = normalize(localPos);
  let su = atan2(n.z, n.x) * 0.15915 + 0.5;
  let sv = asin(clamp(n.y, -1.0, 1.0)) * 0.31831 + 0.5;
  let uv = vec2f(su, sv) * params.bumpScale;

  // Orthonormal tangent frame (guard against N ≈ world-up at poles)
  let N  = normalize(worldNormal);
  let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(N.y) > 0.99);
  let T  = normalize(cross(up, N));
  let B  = cross(N, T);

  // Height-field gradient via forward finite differences
  let h0  = fbm(uv);
  let dhu = fbm(uv + vec2f(BUMP_EPS, 0.0)) - h0;
  let dhv = fbm(uv + vec2f(0.0, BUMP_EPS)) - h0;

  let tN      = normalize(vec3f(-dhu * params.bumpStr, -dhv * params.bumpStr, 1.0));
  let bumpedN = normalize(T * tN.x + B * tN.y + N * tN.z);

  let packedNormal = bumpedN * 0.5 + 0.5;

  var out: GBufferOut;
  out.albedo = vec4f(params.skinColor.rgb, 1.0);
  out.normal = vec4f(packedNormal, 1.0);
  return out;
}
