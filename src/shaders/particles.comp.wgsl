// particles.comp.wgsl - GPU particle simulation
//
// This is a COMPUTE shader. Unlike vertex/fragment shaders that run once per
// vertex or pixel, a compute shader runs once per "invocation" with no fixed
// output format - it just reads and writes data in storage buffers.
//
// How it fits in the frame loop:
//   CPU dispatches this shader -> GPU updates every particle in parallel
//   -> render pass reads the updated positions and draws them

// -- Data structs ------------------------------------------------------------
// Must match the CPU-side layout in main.ts (32 bytes per particle)
struct Particle {
  pos      : vec3f,  // world-space position
  lifetime : f32,    // 1.0 = just born -> 0.0 = dead -> respawn
  vel      : vec3f,  // velocity (units/second)
  pad      : f32,
}

// Updated by the CPU every frame (16 bytes)
struct Uniforms {
  deltaTime     : f32,   // seconds since last frame
  time          : f32,   // total elapsed seconds
  phraseEnergy  : f32,   // 1.0 at lyric phrase start, decays to 0
  lyricProgress : f32,   // 0->1 progress through the current phrase
}

// -- Bindings -----------------------------------------------------------------
// read_write: the compute shader can both read AND update particle data
@group(0) @binding(0) var<storage, read_write> particles : array<Particle>;
@group(0) @binding(1) var<uniform>             u         : Uniforms;

// -- Random number helper -----------------------------------------------------
// PCG hash - cheap pseudo-random float [0, 1) from a uint seed.
// Using particle index + time-derived seed so each frame/particle differs.
fn rand(seed: u32) -> f32 {
  var s = seed * 747796405u + 2891336453u;
  let w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return f32((w >> 22u) ^ w) / 4294967295.0;
}

// -- Entry point ---------------------------------------------------------------
// @workgroup_size(64): each workgroup processes 64 particles in parallel.
// Dispatching ceil(N/64) workgroups covers all N particles.
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;

  // Guard: extra threads in the last workgroup must do nothing
  if (i >= arrayLength(&particles)) { return; }

  var p = particles[i];

  // Age the particle (lifetime drains from 1 -> 0 over ~2 seconds)
  p.lifetime -= u.deltaTime * 0.5;

  // -- Respawn dead particles -----------------------------------------------
  if (p.lifetime <= 0.0) {
    // Unique seed per particle + current millisecond so respawns vary over time
    let ms   = u32(u.time * 1000.0);
    let seed = i * 1664525u + ms;

    // Random direction on a sphere via spherical coordinates
    let theta = rand(seed)          * 6.28318; // 0 -> 2pi (azimuth)
    let phi   = rand(seed + 100u)   * 3.14159; // 0 -> pi  (polar)
    let sinPhi = sin(phi);

    // Burst speed is boosted when a new lyric phrase hits (phraseEnergy spikes)
    let speed = 0.8 + rand(seed + 200u) * 1.2 + u.phraseEnergy * 4.0;

    p.vel = vec3f(
      sinPhi * cos(theta),
      cos(phi),
      sinPhi * sin(theta)
    ) * speed;

    p.pos      = vec3f(0.0); // spawn at origin
    p.lifetime = 1.0;
  }

  // -- Physics --------------------------------------------------------------
  // Gravity pulls particles downward
  p.vel.y -= u.deltaTime * 3.5;

  // Turbulence: small sine-wave nudges so the cloud breathes
  let fi = f32(i);
  let t  = u.time;
  p.vel.x += sin(t * 2.3 + fi * 0.017) * u.deltaTime * 0.4;
  p.vel.z += cos(t * 1.7 + fi * 0.013) * u.deltaTime * 0.4;

  // Lyric progress adds a slight inward pull near phrase end (collapse effect)
  let pull = u.lyricProgress * 0.5;
  p.vel -= normalize(p.pos + vec3f(0.001)) * pull * u.deltaTime;

  // Integrate: move position by velocity
  p.pos += p.vel * u.deltaTime;

  // Write result back to the storage buffer
  particles[i] = p;
}
