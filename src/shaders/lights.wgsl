// lights.wgsl — shared Light struct and evaluation helpers.
// Prepend this source to any fragment shader that uses the light buffer.
//
// direction convention: direction.xyz points FROM the light source TOWARD the scene.
// The shader negates it to get L (surface → light) for the dot product.

const LIGHT_DIR  : u32 = 0u;
const LIGHT_SPOT : u32 = 1u;
const LIGHT_SUN  : u32 = 2u;
const MAX_LIGHTS : u32 = 8u;

struct Light {
  posType   : vec4<f32>,  // xyz=world pos (spot), w=type (0=dir,1=spot,2=sun)
  direction : vec4<f32>,  // xyz=beam direction FROM light TOWARD scene, w=0
  color     : vec4<f32>,  // rgb=color, w=intensity
  params    : vec4<f32>,  // x=innerCos, y=outerCos, z=range (spot), w=0
}

struct LightBuffer {
  count : u32,
  _pad0 : u32,
  _pad1 : u32,
  _pad2 : u32,
  lights: array<Light, 8>,
}

fn eval_directional(lt: Light, N: vec3f) -> vec3f {
  let L = normalize(-lt.direction.xyz);            // surface → light
  return lt.color.rgb * lt.color.w * max(dot(N, L), 0.0);
}

fn eval_sun(lt: Light, N: vec3f) -> vec3f {
  let L    = normalize(-lt.direction.xyz);
  let diff = max(dot(N, L), 0.0);
  // Low elevation (sunrise/sunset) blends toward warm orange
  let elev = clamp(L.y, 0.0, 1.0);
  let tint = mix(vec3f(1.0, 0.55, 0.20), vec3f(1.0, 1.0, 1.0), elev * elev);
  return lt.color.rgb * lt.color.w * diff * tint;
}

fn eval_spot(lt: Light, N: vec3f, worldPos: vec3f) -> vec3f {
  let toLight = lt.posType.xyz - worldPos;
  let dist    = length(toLight);
  let range   = max(lt.params.z, 0.0001);
  if (dist >= range) { return vec3f(0.0); }

  let L        = toLight / dist;                   // surface → light
  let diff     = max(dot(N, L), 0.0);

  // Cone: beam axis points FROM spot TOWARD scene, so -L should align with it
  let cosAngle = dot(-L, normalize(lt.direction.xyz));
  let coneAttn = smoothstep(lt.params.y, lt.params.x, cosAngle);  // outer→inner

  // Quadratic range falloff
  let t        = 1.0 - dist / range;
  return lt.color.rgb * lt.color.w * diff * coneAttn * (t * t);
}
