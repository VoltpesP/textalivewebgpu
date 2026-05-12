// fur_params.wgsl — FurParams struct definition.
// Prepend this to any shader that needs runtime fur parameter access.
// Each shader then declares its own binding variable (group/binding indices differ per pipeline).
//
// CPU layout (80 bytes, 20 × f32):
//   [0]  density    [1]  gravity    [2]  windStr    [3]  windSpd
//   [4..7]  rootColor  rgba
//   [8..11] tipColor   rgba
//   [12..15] skinColor rgba
//   [16] bumpStr    [17] bumpScale  [18..19] padding

struct FurParams {
  density   : f32,        // hair strand grid density
  gravity   : f32,        // droop strength multiplier
  windStr   : f32,        // wind amplitude scale
  windSpd   : f32,        // wind frequency scale
  rootColor : vec4<f32>,  // fur base color   (a unused)
  tipColor  : vec4<f32>,  // fur tip color    (a unused)
  skinColor : vec4<f32>,  // skin base color  (a unused)
  bumpStr   : f32,        // bump tilt scale
  bumpScale : f32,        // bump UV noise scale
  _pad0     : f32,
  _pad1     : f32,
}
