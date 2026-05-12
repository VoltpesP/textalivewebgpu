// outline.vert.wgsl — inverted-hull outline pass vertex shader.
// fur_params.wgsl is prepended by FurRenderer.
//
// Vertices are pushed to the outermost fur shell position (shellT = 1)
// including gravity and wind, so the outline hugs the full fur silhouette.
//
// Group 0: SceneUniforms (binding 0) + FurParams (binding 1)
// Group 1: ObjectUniforms (binding 0)

struct SceneUniforms {
  viewProj : mat4x4<f32>,
  time     : f32,
}
@group(0) @binding(0) var<uniform> scene  : SceneUniforms;
@group(0) @binding(1) var<uniform> params : FurParams;

struct ObjectUniforms {
  model     : mat4x4<f32>,
  numShells : f32,
  furLength : f32,
  firstShell: f32,
}
@group(1) @binding(0) var<uniform> obj : ObjectUniforms;

struct VertexInput {
  @location(0) position : vec3f,
  @location(1) normal   : vec3f,
}

@vertex
fn main(v: VertexInput) -> @builtin(position) vec4f {
  let worldNorm = normalize((obj.model * vec4f(v.normal, 0.0)).xyz);

  // Gravity droop at shellT = 1 (fur tip)
  let grav = vec3f(0.0, -params.gravity, 0.0);

  // Wind sway at tip (same formula as fur.vert, shellT² = 1)
  let t    = scene.time * params.windSpd;
  let sway = vec3f(
    sin(t * 0.9 + v.position.z * 2.0) * 0.09,
    0.0,
    cos(t * 0.6 + v.position.x * 2.0) * 0.05,
  ) * params.windStr;

  // Place vertex at outermost fur shell (shellT = 1)
  let worldPos = (obj.model * vec4f(v.position, 1.0)).xyz
               + worldNorm * obj.furLength
               + grav
               + sway;

  var clip = scene.viewProj * vec4f(worldPos, 1.0);

  // Expand outward along projected normal for outline thickness.
  // Multiply by clip.w to keep screen-space width constant across depths.
  let cn = (scene.viewProj * vec4f(worldNorm, 0.0)).xy;
  let ln = length(cn);
  if (ln > 0.0001) {
    clip.x += (cn.x / ln) * params.outlineWidth * clip.w;
    clip.y += (cn.y / ln) * params.outlineWidth * clip.w;
  }

  return clip;
}
