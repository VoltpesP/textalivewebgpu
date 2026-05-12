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

// 2D value hash - returns a pseudo-random float in [0, 1)
fn hash21(p: vec2f) -> f32 {
  var q = fract(p * vec2f(127.1, 311.7));
  q += dot(q, q + 17.19);
  return fract(q.x * q.y);
}

// How many hair cells across the sphere (higher = denser fur)
const DENSITY : f32 = 22.0;

@fragment
fn main(
  @location(0) worldNormal : vec3f,
  @location(1) shellT      : f32,
  @location(2) localPos    : vec3f,
) -> @location(0) vec4f {
  // -- UV from spherical projection --------------------------------------------
  // localPos is the local-space position on a unit sphere -> same as the normal.
  // atan2 maps azimuth to [0, 1), asin maps elevation to [0, 1).
  let n = normalize(localPos);
  let u = atan2(n.z, n.x) * 0.15915 + 0.5;  // 1 / (2*pi)
  let v = asin(clamp(n.y, -1.0, 1.0)) * 0.31831 + 0.5;  // 1 / pi

  // -- Hair grid ---------------------------------------------------------------
  let uv     = vec2f(u, v) * DENSITY;
  let cell   = floor(uv);       // which hair cell are we in?
  let within = fract(uv);       // where inside the cell (0..1 in each axis)

  // Each cell gets a unique random center for its strand
  let cx = 0.1 + hash21(cell) * 0.8;
  let cy = 0.1 + hash21(cell + vec2f(37.3, 91.7)) * 0.8;

  // Distance from this fragment to the strand center
  let dist = length(within - vec2f(cx, cy));

  // Strand radius: full circle at skin, tapers to a point at tip
  // shellT^2 taper -> conical hair profile
  let radius = 0.38 * (1.0 - shellT * shellT);

  // Discard fragments outside this strand (skip for shell 0 so skin is solid)
  if (shellT > 0.01 && dist > radius) {
    discard;
  }

  // -- Color -------------------------------------------------------------------
  // Dark root -> golden tip mimics natural hair gradients
  let rootColor = vec3f(0.80, 0.80, 0.80);
  let tipColor  = vec3f(0.90, 0.70, 0.35);
  let furColor  = mix(rootColor, tipColor, shellT);

  // Ambient occlusion approximation: inner shells are slightly darker
  // (they sit in the shadow of the outer shells)
  let ao = 0.4 + 0.6 * shellT;

  // Simple Lambertian diffuse
  let lightDir = normalize(vec3f(-1.0, 2.0, -1.5));
  let diffuse  = max(dot(worldNormal, lightDir), 0.0) * 0.8 + 0.2;

  return vec4f(furColor * diffuse * ao, 1.0);
}
