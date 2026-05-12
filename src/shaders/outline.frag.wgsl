// outline.frag.wgsl — flat dark color for the inverted-hull outline.

@fragment
fn main() -> @location(0) vec4f {
  return vec4f(0.04, 0.04, 0.04, 1.0);
}
