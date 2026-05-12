// cube.vert.wgsl - vertex shader for a 3D lit cube
//
// Uniform buffer layout (must match main.ts exactly):
//   offset   0 : mvp           mat4x4<f32>   - model x view x projection
//   offset  64 : model         mat4x4<f32>   - model matrix (world transform)
//   offset 128 : time          f32
//   offset 132 : lyricProgress f32
//   offset 136 : phraseEnergy  f32
//   offset 140 : pad           f32

struct Uniforms {
  mvp           : mat4x4<f32>,
  model         : mat4x4<f32>,
  time          : f32,
  lyricProgress : f32,
  phraseEnergy  : f32,
  pad           : f32,
}
@group(0) @binding(0) var<uniform> u : Uniforms;

// Vertex attributes - must match GPUVertexBufferLayout in main.ts
//   @location(0) position : first  12 bytes per vertex (vec3f)
//   @location(1) normal   : next   12 bytes per vertex (vec3f)
struct VertexInput {
  @location(0) position : vec3f,
  @location(1) normal   : vec3f,
}

struct VertexOutput {
  // @builtin(position) is the clip-space position the GPU uses for rasterisation
  @builtin(position) position : vec4f,
  // These are interpolated across the triangle and read by the fragment shader
  @location(0) worldNormal    : vec3f,
  @location(1) worldPos       : vec3f,
}

@vertex
fn main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;

  // u.mvp transforms: model space -> world -> view -> clip space
  // The GPU automatically divides xyz by w to get NDC coords [-1,1] (xy) and [0,1] (z)
  out.position = u.mvp * vec4f(input.position, 1.0);

  // u.model transforms into world space so lighting is calculated correctly
  // Normals use w=0 so translation is not applied (they are directions, not points)
  out.worldNormal = (u.model * vec4f(input.normal, 0.0)).xyz;
  out.worldPos    = (u.model * vec4f(input.position, 1.0)).xyz;

  return out;
}
