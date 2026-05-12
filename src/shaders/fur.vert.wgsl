// fur.vert.wgsl - shell-based fur vertex shader
//
// Shell fur technique:
//   Draw the same mesh NUM_SHELLS times (instances).
//   Each instance (shell) is pushed outward along the surface normal by
//   shellT * furLength, where shellT = (instanceIndex + firstShell) / numShells.
//   Shell 0  -> skin layer (rendered by G-Buffer pass, skipped here when firstShell=1)
//   Shell N-1 -> fur tips, fully displaced outward
//
// Group 0 (per-frame, shared across all objects):
//   binding 0 — SceneUniforms  viewProj + time
//
// Group 1 (per-object, set once per draw):
//   binding 0 — ObjectUniforms  model + shell settings

struct SceneUniforms {
  viewProj : mat4x4<f32>,
  time     : f32,
}
@group(0) @binding(0) var<uniform> scene : SceneUniforms;

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
  @location(1) shellT      : f32,    // 0 = skin, 1 = tip
  @location(2) localPos    : vec3f,  // original local-space pos for UV hash
  @location(3) worldPos    : vec3f,  // displaced world position for spot lights
}

@vertex
fn main(
  v: VertexInput,
  @builtin(instance_index) shell: u32,
) -> VertexOutput {
  let shellT = f32(shell + u32(obj.firstShell)) / obj.numShells;

  let worldNorm = normalize((obj.model * vec4f(v.normal, 0.0)).xyz);

  // Gravity: tips droop downward, quadratic so base stays straight
  let gravity = vec3f(0.0, -0.07, 0.0) * shellT * shellT;

  // Wind: gentle sinusoidal sway, stronger at tips
  let sway = vec3f(
    sin(scene.time * 0.9 + v.position.z * 2.0) * 0.09,
    0.0,
    cos(scene.time * 0.6 + v.position.x * 2.0) * 0.05,
  ) * shellT * shellT;

  let worldPos = (obj.model * vec4f(v.position, 1.0)).xyz
               + worldNorm * shellT * obj.furLength
               + gravity
               + sway;

  var out: VertexOutput;
  out.clip        = scene.viewProj * vec4f(worldPos, 1.0);
  out.worldNormal = worldNorm;
  out.shellT      = shellT;
  out.localPos    = v.position;
  out.worldPos    = worldPos;
  return out;
}
