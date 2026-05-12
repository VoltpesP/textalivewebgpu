// debug_blit.frag.wgsl
// Reads one texture and outputs it directly — used to display G-Buffer views
// as thumbnail overlays.  Values already in [0,1] (albedo rgba8, normal rgba16f
// packed to [0,1]) so no tone-mapping is needed.

@group(0) @binding(0) var blitTex  : texture_2d<f32>;
@group(0) @binding(1) var blitSamp : sampler;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  return vec4f(textureSample(blitTex, blitSamp, uv).rgb, 1.0);
}
