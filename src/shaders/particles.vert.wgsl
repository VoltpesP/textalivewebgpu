// particles.vert.wgsl - vertex shader for billboard particles
//
// No vertex buffer is used. Instead:
//   instance_index -> which particle to read from the storage buffer
//   vertex_index   -> which corner of the billboard quad (0-5, two triangles)
//
// Each particle becomes a tiny screen-aligned quad (billboard) so it always
// faces the camera, regardless of viewing angle.

struct Particle {
  pos      : vec3f,
  lifetime : f32,
  vel      : vec3f,
  pad      : f32,
}

// View x Projection matrix (particles are already in world space, no model matrix)
struct SceneUniforms {
  viewProj : mat4x4<f32>,
}

// read: the vertex shader only reads particle data, never writes
@group(0) @binding(0) var<storage, read> particles  : array<Particle>;
@group(0) @binding(1) var<uniform>       scene      : SceneUniforms;

struct VertexOutput {
  @builtin(position) position : vec4f,
  @location(0) lifetime       : f32,
  @location(1) speed          : f32,
}

// Half-size of each billboard in NDC (normalized device coordinates).
// Multiply by w (clip-space w) to keep visual size constant regardless of depth.
const HALF_SIZE : f32 = 0.009;

@vertex
fn main(
  @builtin(vertex_index)   vi : u32,  // 0-5: which quad corner
  @builtin(instance_index) ii : u32,  // which particle
) -> VertexOutput {
  // Two triangles forming a quad. Corners in local [-1, 1] space.
  let corners = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0,  1.0),
    vec2f(-1.0,  1.0), vec2f(1.0, -1.0), vec2f( 1.0,  1.0)
  );

  let p      = particles[ii];
  let corner = corners[vi];

  // Project particle center to clip space
  let clipCenter = scene.viewProj * vec4f(p.pos, 1.0);

  // Billboard offset: multiply by clipCenter.w so the size stays constant
  // in screen space after the GPU divides xyz by w (perspective divide)
  let offset = corner * HALF_SIZE * clipCenter.w;

  var out: VertexOutput;
  out.position = vec4f(clipCenter.xy + offset, clipCenter.zw);
  out.lifetime = p.lifetime;
  out.speed    = length(p.vel);
  return out;
}
