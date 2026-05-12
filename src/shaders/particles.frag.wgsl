// particles.frag.wgsl - fragment shader for particles
//
// Colors each particle based on lifetime and speed.
// Works with additive blending: overlapping particles stack and glow brighter.

@fragment
fn main(
  @location(0) lifetime : f32,  // 1.0 = just born, 0.0 = dying
  @location(1) speed    : f32,  // magnitude of velocity
) -> @location(0) vec4f {
  let t = clamp(lifetime, 0.0, 1.0);

  // Hot-white at birth -> orange-red -> dark ember as it dies
  let hotWhite  = vec3f(1.0, 0.95, 0.8);
  let ember     = vec3f(1.0, 0.35, 0.05);
  let dead      = vec3f(0.15, 0.03, 0.0);

  var color = mix(dead, ember,   clamp(t * 2.0,       0.0, 1.0));
  color     = mix(color, hotWhite, clamp(t * 2.0 - 1.0, 0.0, 1.0));

  // Fast-moving particles are slightly brighter
  color *= 1.0 + clamp(speed * 0.1, 0.0, 0.5);

  // Circular soft dot: fade edges using distance from quad center
  // @builtin(position) gives pixel coords; we use the interpolated lifetime
  // as a proxy for radial fade (simpler than passing uv coordinates)
  let alpha = t * t * 0.9;

  return vec4f(color, alpha);
}
