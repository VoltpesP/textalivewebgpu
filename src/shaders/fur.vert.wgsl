// fur.vert.wgsl - shell-based fur vertex shader
//
// fur_params.wgsl is prepended by FurRenderer — FurParams struct is available.
//
// Group 0: SceneUniforms (binding 0) + FurParams (binding 2)
// Group 1: ObjectUniforms (binding 0)

struct SceneUniforms {
  viewProj : mat4x4<f32>,
  time     : f32,
}
@group(0) @binding(0) var<uniform> scene  : SceneUniforms;
@group(0) @binding(2) var<uniform> params : FurParams;

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

struct VertexOutput {
  @builtin(position) clip : vec4f,
  @location(0) worldNormal : vec3f,
  @location(1) shellT      : f32,
  @location(2) localPos    : vec3f,
  @location(3) worldPos    : vec3f,
}

@vertex
fn main(
  v: VertexInput,
  @builtin(instance_index) shell: u32,
) -> VertexOutput {
  let shellT = f32(shell + u32(obj.firstShell)) / obj.numShells;

  let worldNorm = normalize((obj.model * vec4f(v.normal, 0.0)).xyz);

  // Gravity: tips droop downward, magnitude from params
  let grav = vec3f(0.0, -params.gravity, 0.0) * shellT * shellT;

  // Wind: sinusoidal sway scaled by params
  let t    = scene.time * params.windSpd;
  let sway = vec3f(
    sin(t * 0.9 + v.position.z * 2.0) * 0.09,
    0.0,
    cos(t * 0.6 + v.position.x * 2.0) * 0.05,
  ) * (shellT * shellT * params.windStr);

  let worldPos = (obj.model * vec4f(v.position, 1.0)).xyz
               + worldNorm * shellT * obj.furLength
               + grav
               + sway;

  var out: VertexOutput;
  out.clip        = scene.viewProj * vec4f(worldPos, 1.0);
  out.worldNormal = worldNorm;
  out.shellT      = shellT;
  out.localPos    = v.position;
  out.worldPos    = worldPos;
  return out;
}
