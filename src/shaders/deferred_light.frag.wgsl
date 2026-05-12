// deferred_light.frag.wgsl - deferred lighting pass + skybox background
//
// Reads the G-Buffer and computes illumination for the skin layer.
// Background pixels (G-Buffer alpha == 0) are filled with the skybox colour.
// If no skybox is loaded the procedural gradient sky is used as fallback.
//
// Sky uniform buffer layout (96 bytes):
//   offset  0: invViewProj  mat4x4<f32>  (64 bytes) - reconstructs world ray + worldPos
//   offset 64: eyePos       vec4<f32>    (16 bytes) - camera world position
//   offset 80: hasSkybox    u32          (4 bytes)  - 1 if skybox is loaded
//
// lights.wgsl is prepended by FurRenderer before this source reaches the GPU.

@group(0) @binding(0) var albedoTex   : texture_2d<f32>;
@group(0) @binding(1) var normalTex   : texture_2d<f32>;
@group(0) @binding(2) var gbufSampler : sampler;
@group(0) @binding(3) var skyboxTex   : texture_2d<f32>;
@group(0) @binding(4) var skyboxSamp  : sampler;

struct SkyUniforms {
  invViewProj : mat4x4<f32>,  // offset 0
  eyePos      : vec4<f32>,    // offset 64
  hasSkybox   : u32,          // offset 80
}
@group(0) @binding(5) var<uniform>       sky      : SkyUniforms;
@group(0) @binding(6) var<storage, read> lightBuf : LightBuffer;
@group(0) @binding(7) var depthTex : texture_depth_2d;

// ---- Cross-layout UV mapping -----------------------------------------------
//
// Horizontal cross, 4 tiles wide × 3 tiles tall:
//   [  ][+Y][  ][  ]
//   [-X][+Z][+X][-Z]
//   [  ][-Y][  ][  ]
//
// Face projection follows OpenGL cubemap conventions (right-hand rule).

fn cross_uv(dir: vec3f) -> vec2f {
  let ax = abs(dir);
  var fu    : vec2f;
  var offset: vec2f;

  if (ax.x >= ax.y && ax.x >= ax.z) {
    let ma = ax.x;
    if (dir.x > 0.0) {             // +X  col=2  row=1
      fu = vec2f(-dir.z / ma, -dir.y / ma) * 0.5 + 0.5;
      offset = vec2f(2.0, 1.0);
    } else {                        // -X  col=0  row=1
      fu = vec2f( dir.z / ma, -dir.y / ma) * 0.5 + 0.5;
      offset = vec2f(0.0, 1.0);
    }
  } else if (ax.y >= ax.z) {
    let ma = ax.y;
    if (dir.y > 0.0) {             // +Y  col=1  row=0
      fu = vec2f( dir.x / ma,  dir.z / ma) * 0.5 + 0.5;
      offset = vec2f(1.0, 0.0);
    } else {                        // -Y  col=1  row=2
      fu = vec2f( dir.x / ma, -dir.z / ma) * 0.5 + 0.5;
      offset = vec2f(1.0, 2.0);
    }
  } else {
    let ma = ax.z;
    if (dir.z > 0.0) {             // +Z  col=1  row=1
      fu = vec2f( dir.x / ma, -dir.y / ma) * 0.5 + 0.5;
      offset = vec2f(1.0, 1.0);
    } else {                        // -Z  col=3  row=1
      fu = vec2f(-dir.x / ma, -dir.y / ma) * 0.5 + 0.5;
      offset = vec2f(3.0, 1.0);
    }
  }

  return (offset + fu) / vec2f(4.0, 3.0);
}

// ---- Procedural sky (fallback when no skybox image is loaded) --------------

fn procedural_sky(dir: vec3f) -> vec3f {
  let t      = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
  let zenith = vec3f(0.06, 0.14, 0.40);
  let horiz  = vec3f(0.50, 0.68, 0.85);
  return mix(horiz, zenith, t * t);
}

// ---- Main ------------------------------------------------------------------

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  // All textureSample calls must precede any non-uniform branching (WGSL rule)
  let albedoSample = textureSample(albedoTex, gbufSampler, uv);
  let normalSample = textureSample(normalTex, gbufSampler, uv);

  // Reconstruct world-space view ray from screen UV + inverse view-projection
  let ndc      = vec4f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 1.0, 1.0);
  let worldFarH = sky.invViewProj * ndc;
  let dir       = normalize(worldFarH.xyz / worldFarH.w - sky.eyePos.xyz);

  let skyAtlasUV = cross_uv(dir);
  let skySample  = textureSample(skyboxTex, skyboxSamp, skyAtlasUV);

  // Background: G-Buffer alpha == 0 (nothing was drawn to this pixel)
  if (albedoSample.a < 0.5) {
    if (sky.hasSkybox == 1u) {
      return vec4f(skySample.rgb, 1.0);
    }
    return vec4f(procedural_sky(dir), 1.0);
  }

  // Geometry: unpack G-Buffer
  let albedo      = albedoSample.rgb;
  let worldNormal = normalize(normalSample.rgb * 2.0 - 1.0);
  let N           = worldNormal;

  // Reconstruct world position from depth (needed for spot lights)
  let dims     = vec2f(textureDimensions(depthTex, 0));
  let coord    = vec2i(clamp(uv * dims, vec2f(0.0), dims - 1.0));
  let depth    = textureLoad(depthTex, coord, 0);
  let ndcPos   = vec4f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, depth, 1.0);
  let worldH   = sky.invViewProj * ndcPos;
  let worldPos = worldH.xyz / worldH.w;

  // Evaluate all lights
  var lit = vec3f(0.08);  // ambient floor
  let cnt = min(lightBuf.count, MAX_LIGHTS);
  for (var i = 0u; i < cnt; i++) {
    let lt = lightBuf.lights[i];
    let tp = u32(lt.posType.w);
    if (tp == LIGHT_DIR) {
      lit += eval_directional(lt, N);
    } else if (tp == LIGHT_SPOT) {
      lit += eval_spot(lt, N, worldPos);
    } else {
      lit += eval_sun(lt, N);
    }
  }

  return vec4f(albedo * lit, 1.0);
}
