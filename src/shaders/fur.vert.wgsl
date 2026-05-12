// fur.vert.wgsl - shell-based fur vertex shader
//
// Shell fur technique:
//   Draw the same sphere mesh NUM_SHELLS times (instances).
//   Each instance (shell) is pushed outward along the surface normal by
//   shellT * furLength, where shellT = instanceIndex / numShells.
//   Shell 0  -> skin layer, no offset (just the sphere surface)
//   Shell N-1 -> fur tips, fully displaced outward
//
// The fragment shader punches holes in outer shells to reveal hair strands.

struct Uniforms {
  viewProj  : mat4x4<f32>,  // camera view * projection  (64 bytes, offset   0)
  model     : mat4x4<f32>,  // mesh world transform       (64 bytes, offset  64)
  time      : f32,          // total elapsed seconds      ( 4 bytes, offset 128)
  numShells : f32,          //                            ( 4 bytes, offset 132)
  furLength  : f32,         // max outward displacement   ( 4 bytes, offset 136)
  firstShell : f32,         // shell index offset (0 = full, 1 = skip skin)  ( 4 bytes, offset 140)
}

@group(0) @binding(0) var<uniform> u : Uniforms;

struct VertexInput {
  @location(0) position : vec3f,
  @location(1) normal   : vec3f,
}

struct VertexOutput {
  @builtin(position) clip : vec4f,
  @location(0) worldNormal : vec3f,
  @location(1) shellT      : f32,    // 0 = skin, 1 = tip
  @location(2) localPos    : vec3f,  // original local-space pos for UV hash
}

@vertex
fn main(
  v: VertexInput,
  @builtin(instance_index) shell: u32,
) -> VertexOutput {
  // firstShell = 1 in hybrid mode: the skin (shell 0) is rendered by the deferred pass
  let shellT = f32(shell + u32(u.firstShell)) / u.numShells;

  // Transform normal to world space (normalize handles non-uniform scale)
  let worldNorm = normalize((u.model * vec4f(v.normal, 0.0)).xyz);

  // Gravity: tips droop downward, quadratic so base stays straight
  let gravity = vec3f(0.0, -0.07, 0.0) * shellT * shellT;

  // Wind: gentle sinusoidal sway, stronger at tips (quadratic falloff)
  let sway = vec3f(
    sin(u.time * 0.9 + v.position.z * 2.0) * 0.09,
    0.0,
    cos(u.time * 0.6 + v.position.x * 2.0) * 0.05,
  ) * shellT * shellT;

  // Displace vertex along world normal, then add motion
  let worldPos = (u.model * vec4f(v.position, 1.0)).xyz
               + worldNorm * shellT * u.furLength
               + gravity
               + sway;

  var out: VertexOutput;
  out.clip        = u.viewProj * vec4f(worldPos, 1.0);
  out.worldNormal = worldNorm;
  out.shellT      = shellT;
  out.localPos    = v.position;  // passed through unchanged for hash
  return out;
}
