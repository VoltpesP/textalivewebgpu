// gbuffer.vert.wgsl - geometry pass: renders the skin layer to the G-Buffer
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
  @location(1) localPos    : vec3f,
}

@vertex
fn main(v: VertexInput) -> VertexOutput {
  let worldNorm = normalize((obj.model * vec4f(v.normal, 0.0)).xyz);
  let worldPos  = (obj.model * vec4f(v.position, 1.0)).xyz;

  var out: VertexOutput;
  out.clip        = scene.viewProj * vec4f(worldPos, 1.0);
  out.worldNormal = worldNorm;
  out.localPos    = v.position;
  return out;
}
