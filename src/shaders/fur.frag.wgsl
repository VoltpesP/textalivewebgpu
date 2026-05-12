// fur.frag.wgsl - shell-based fur fragment shader
//
// The core idea: each fragment decides whether it is "inside a hair strand"
// by looking up a random grid. Fragments outside strands are discarded (alpha test).
//
// How strands are created:
//   1. Map the sphere surface to a 2D UV grid (spherical projection)
//   2. Each grid cell contains one hair strand, at a random center position
//   3. Compute distance from this fragment to the strand center
//   4. Hair radius = thick at shell 0, tapers to 0 at shell N (conical profile)
//   5. Discard if outside the radius -> only strand pixels survive
//   6. Shell 0 (skin) is kept fully solid so the base is not see-through
//
// lights.wgsl is prepended by FurRenderer before this source reaches the GPU.

// 2D value hash - returns a pseudo-random float in [0, 1)
fn hash21(p: vec2f) -> f32 {
  var q = fract(p * vec2f(127.1, 311.7));
  q += dot(q, q + 17.19);
  return fract(q.x * q.y);
}

// How many hair cells across the sphere (higher = denser fur)
const DENSITY : f32 = 22.0;

// binding 0 (Uniforms) lives only in the vertex stage — not needed here
@group(0) @binding(1) var<storage, read> lightBuf : LightBuffer;

@fragment
fn main(
  @location(0) worldNormal : vec3f,
  @location(1) shellT      : f32,
  @location(2) localPos    : vec3f,
  @location(3) worldPos    : vec3f,
) -> @location(0) vec4f {
  // -- UV from spherical projection --------------------------------------------
  let n = normalize(localPos);
  let u_coord = atan2(n.z, n.x) * 0.15915 + 0.5;  // 1 / (2*pi)
  let v_coord = asin(clamp(n.y, -1.0, 1.0)) * 0.31831 + 0.5;  // 1 / pi

  // -- Hair grid ---------------------------------------------------------------
  let uv     = vec2f(u_coord, v_coord) * DENSITY;
  let cell   = floor(uv);
  let within = fract(uv);

  let cx = 0.1 + hash21(cell) * 0.8;
  let cy = 0.1 + hash21(cell + vec2f(37.3, 91.7)) * 0.8;
  let dist   = length(within - vec2f(cx, cy));
  let radius = 0.38 * (1.0 - shellT * shellT);

  if (shellT > 0.01 && dist > radius) {
    discard;
  }

  // -- Color -------------------------------------------------------------------
  let rootColor = vec3f(0.80, 0.80, 0.80);
  let tipColor  = vec3f(0.90, 0.70, 0.35);
  let furColor  = mix(rootColor, tipColor, shellT);

  // Shell AO: inner shells sit in shadow of outer shells
  let ao = 0.4 + 0.6 * shellT;

  // -- Lighting via LightManager -----------------------------------------------
  let N   = normalize(worldNormal);
  var lit = vec3f(0.08);  // ambient floor
  let cnt = min(lightBuf.count, MAX_LIGHTS);
  for (var i = 0u; i < cnt; i++) {
    let lt = lightBuf.lights[i];
    let tp = u32(lt.posType.w);
    if (tp == LIGHT_DIR) {
      lit += eval_directional(lt, N);
    } else if (tp == LIGHT_SPOT) {
      lit += eval_spot(lt, N, worldPos);
    } else {
      lit += eval_sun(lt, N);
    }
  }

  return vec4f(furColor * lit * ao, 1.0);
}
