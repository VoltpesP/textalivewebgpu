// deferred_light.vert.wgsl - deferred lighting pass vertex shader
//
// Emits a single full-screen triangle that covers the entire viewport.
// Three hard-coded vertices (no vertex buffer) extend beyond clip space edges;
// the rasteriser clips them to the viewport so interpolated UVs cover [0,1]x[0,1].

struct VertexOutput {
  @builtin(position) clip : vec4f,
  @location(0) uv         : vec2f,
}

@vertex
fn main(@builtin(vertex_index) vid: u32) -> VertexOutput {
  var pos = array<vec2f, 3>(
    vec2f(-1.0, -1.0),  // bottom-left
    vec2f( 3.0, -1.0),  // bottom-right (clipped)
    vec2f(-1.0,  3.0),  // top-left     (clipped)
  );
  let p = pos[vid];

  var out: VertexOutput;
  out.clip = vec4f(p, 0.0, 1.0);
  // NDC -> UV: x in [-1,1] -> u in [0,1]; y in [-1,1] -> v in [1,0] (Y-flip)
  out.uv = vec2f(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  return out;
}
