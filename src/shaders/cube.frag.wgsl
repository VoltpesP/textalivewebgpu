// cube.frag.wgsl - fragment shader for a 3D lit cube
//
// Receives interpolated world-space normal and position from the vertex shader.
// Computes Lambert diffuse lighting + ambient, coloured by time and lyric progress.

struct Uniforms {
  mvp           : mat4x4<f32>,
  model         : mat4x4<f32>,
  time          : f32,
  lyricProgress : f32,
  phraseEnergy  : f32,
  pad           : f32,
}
@group(0) @binding(0) var<uniform> u : Uniforms;

@fragment
fn main(
  @location(0) worldNormal : vec3f,
  @location(1) worldPos    : vec3f,  // available for future use (e.g. specular, fog)
) -> @location(0) vec4f {

  // --- Lighting ---
  // A fixed directional light coming from the upper-right-front
  let lightDir = normalize(vec3f(1.0, 2.0, 3.0));

  // Lambert diffuse: how much the surface faces the light (0 = away, 1 = toward)
  let diffuse = max(dot(normalize(worldNormal), lightDir), 0.0);
  let ambient = 0.15; // minimum brightness so back faces are not pitch black

  // --- Colour driven by TextAlive lyric state ---
  let t        = u.time;
  let progress = u.lyricProgress;   // 0->1 within the current phrase
  let energy   = u.phraseEnergy;    // spikes at phrase start, decays to 0

  // RGB channels shift at different speeds for a continuously changing hue
  let baseColor = vec3f(
    sin(t * 0.5 + progress * 3.14159) * 0.5 + 0.5,
    cos(t * 0.3 + progress * 2.0)     * 0.5 + 0.5,
    sin(t * 0.7 + 1.0)                * 0.5 + 0.5
  );

  // phraseEnergy boosts brightness on each new lyric phrase
  let brightness = ambient + diffuse * (0.6 + energy * 0.4);

  return vec4f(baseColor * brightness, 1.0);
}
