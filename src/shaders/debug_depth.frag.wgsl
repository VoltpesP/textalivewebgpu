// debug_depth.frag.wgsl
// Visualizes the depth buffer as a linearized grayscale thumbnail.
// near/far match main.ts: perspectiveMatrix(PI/4, aspect, 0.1, 100)

@group(0) @binding(0) var depthTex: texture_depth_2d;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let dims  = vec2f(textureDimensions(depthTex, 0));
  let coord = vec2i(clamp(uv * dims, vec2f(0.0), dims - 1.0));
  let d     = textureLoad(depthTex, coord, 0);

  // Linearize perspective depth: NDC [0,1] -> view-space [near,far]
  let near = 0.1;
  let far  = 100.0;
  let lin  = (near * far) / (far - d * (far - near));
  let t    = clamp(lin / far, 0.0, 1.0);

  return vec4f(t, t, t, 1.0);
}
