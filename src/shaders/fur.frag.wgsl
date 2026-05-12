// fur.frag.wgsl - shell-based fur fragment shader
//
// fur_params.wgsl and lights.wgsl are prepended by FurRenderer.
//
// Group 0: SceneUniforms (binding 0, vertex) + LightBuffer (binding 1) + FurParams (binding 2)
// Group 1: ObjectUniforms (binding 0, vertex)

@group(0) @binding(1) var<storage, read> lightBuf : LightBuffer;
@group(0) @binding(2) var<uniform>       params   : FurParams;

// 2D value hash - returns a pseudo-random float in [0, 1)
fn hash21(p: vec2f) -> f32 {
  var q = fract(p * vec2f(127.1, 311.7));
  q += dot(q, q + 17.19);
  return fract(q.x * q.y);
}

@fragment
fn main(
  @location(0) worldNormal : vec3f,
  @location(1) shellT      : f32,
  @location(2) localPos    : vec3f,
  @location(3) worldPos    : vec3f,
) -> @location(0) vec4f {
  // -- UV from spherical projection --------------------------------------------
  let n       = normalize(localPos);
  let u_coord = atan2(n.z, n.x) * 0.15915 + 0.5;
  let v_coord = asin(clamp(n.y, -1.0, 1.0)) * 0.31831 + 0.5;

  // -- Hair grid (density driven by params) ------------------------------------
  let uv     = vec2f(u_coord, v_coord) * params.density;
  let cell   = floor(uv);
  let within = fract(uv);

  let cx   = 0.1 + hash21(cell) * 0.8;
  let cy   = 0.1 + hash21(cell + vec2f(37.3, 91.7)) * 0.8;
  let dist = length(within - vec2f(cx, cy));

  // Conical taper: full radius at skin, zero at tip
  let radius = 0.38 * (1.0 - shellT * shellT);
  if (shellT > 0.01 && dist > radius) { discard; }

  // -- Color (params-driven gradient) ------------------------------------------
  let furColor = mix(params.rootColor.rgb, params.tipColor.rgb, shellT);

  // Shell AO: inner shells slightly darker
  let ao = 0.4 + 0.6 * shellT;

  // -- Lighting ----------------------------------------------------------------
  let N   = normalize(worldNormal);
  var lit = vec3f(0.08);
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
