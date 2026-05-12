// gbuffer.vert.wgsl - geometry pass: renders the skin layer to the G-Buffer
//
// This is the deferred half of the hybrid pipeline.
// Draws the base sphere once (no shell offset) and outputs world-space data
// that the deferred lighting pass reads to compute final illumination.

struct Uniforms {
  viewProj : mat4x4<f32>,  // offset   0  (64 bytes)
  model    : mat4x4<f32>,  // offset  64  (64 bytes)
  // remaining fields (time, numShells, furLength, firstShell) unused here
}
@group(0) @binding(0) var<uniform> u : Uniforms;

struct VertexInput {
  @location(0) position : vec3f,
  @location(1) normal   : vec3f,
}

struct VertexOutput {
  @builtin(position) clip : vec4f,
  @location(0) worldNormal : vec3f,
  @location(1) localPos    : vec3f,  // original local-space pos for UV derivation
}

@vertex
fn main(v: VertexInput) -> VertexOutput {
  let worldNorm = normalize((u.model * vec4f(v.normal, 0.0)).xyz);
  let worldPos  = (u.model * vec4f(v.position, 1.0)).xyz;

  var out: VertexOutput;
  out.clip        = u.viewProj * vec4f(worldPos, 1.0);
  out.worldNormal = worldNorm;
  out.localPos    = v.position;
  return out;
}
