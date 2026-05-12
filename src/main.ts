/**
 * main.ts — entry point.
 * Wires up the WebGPU app, geometry, camera, renderer, debug overlay, and model/skybox loaders.
 */

import './style.css';
import { WebGPUApp } from './core/WebGPUApp';
import { perspectiveMatrix, lookAt, multiplyMatrices, createIdentityMatrix, invertMatrix4x4 } from './utils/MathUtils';
import { createSphereInterleaved } from './utils/GeometryUtils';
import { OrbitCamera } from './utils/OrbitCamera';
import { FurRenderer } from './renderer/FurRenderer';
import { DebugOverlay } from './renderer/DebugOverlay';
import { ModelDropZone } from './renderer/ModelDropZone';
import { loadSkyboxFromFile } from './utils/SkyboxLoader';

// -- Constants ----------------------------------------------------------------

const NUM_SHELLS = 32;
const FUR_LENGTH = 0.20;

// Uniform layout: viewProj(64) + model(64) + time(4) + numShells(4) + furLength(4) + firstShell(4) = 144 bytes
const UNIFORM_FLOATS = 36;

// Sky uniform layout (96 bytes):
//   invViewProj mat4x4<f32>  offset  0 — 64 bytes
//   eyePos      vec4<f32>    offset 64 — 16 bytes
//   hasSkybox   u32          offset 80 —  4 bytes  (written as Uint32)
const SKY_UNIFORM_BYTES = 96;

// -- Boot ---------------------------------------------------------------------

async function main(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#webgpu-canvas');
  if (!canvas) { console.error('Canvas not found'); return; }

  const app = new WebGPUApp({ canvas, backgroundColor: [0.05, 0.05, 0.08, 1] });
  await app.initialize();

  const gpuDevice = app.getDevice();
  const rawDevice = gpuDevice.getDevice();
  const dpr = window.devicePixelRatio ?? 1;

  {
    const r = canvas.getBoundingClientRect();
    gpuDevice.resizeCanvas(
      Math.max(1, Math.floor(r.width  * dpr)),
      Math.max(1, Math.floor(r.height * dpr)),
    );
  }
  console.log('[WebGPU] Canvas:', canvas.width, 'x', canvas.height);

  // -- Uniform buffers --------------------------------------------------------
  const uniformBuffer    = gpuDevice.createUniformBuffer(UNIFORM_FLOATS * 4, 'uniforms');
  const skyUniformBuffer = gpuDevice.createUniformBuffer(SKY_UNIFORM_BYTES,  'sky-uniforms');

  // CPU-side sky uniform backing store
  const skyBufAB  = new ArrayBuffer(SKY_UNIFORM_BYTES);
  const skyBufF32 = new Float32Array(skyBufAB);
  const skyBufU32 = new Uint32Array(skyBufAB);
  // hasSkybox flag at byte offset 80 (u32 index 20) — 0 until a skybox is loaded
  skyBufU32[20] = 0;

  // -- Default geometry (sphere) ----------------------------------------------
  const sphere = createSphereInterleaved(1.0, 48, 24);
  console.log('[Geometry] Default sphere:', sphere.indices.length / 3, 'triangles');

  // -- Renderer ---------------------------------------------------------------
  const { width, height } = gpuDevice.getCanvasSize();
  const renderer = new FurRenderer({
    device          : rawDevice,
    uniformBuffer,
    skyUniformBuffer,
    geometry        : sphere,
    shaderManager   : app.getShaderManager(),
    swapFormat      : gpuDevice.getFormat(),
    depthFormat     : gpuDevice.depthFormat,
    numShells       : NUM_SHELLS,
    width,
    height,
  });

  // -- Debug overlay ----------------------------------------------------------
  const debug = new DebugOverlay({
    canvas,
    dpr,
    device       : rawDevice,
    shaderManager: app.getShaderManager(),
    swapFormat   : gpuDevice.getFormat(),
    numShells    : NUM_SHELLS,
    initialGbuf  : renderer.gbuf,
  });

  // Wire initial depth view into the debug overlay
  debug.setDepthView(gpuDevice.getDepthTextureView());

  // -- Model drop zone --------------------------------------------------------
  new ModelDropZone(canvas, (geo, name) => {
    renderer.setGeometry(geo);
    console.log(`[Model] Loaded "${name}" — ${geo.indices.length / 3} triangles, ${geo.vertices.length / 6} vertices`);
  });

  // -- Skybox loader ----------------------------------------------------------
  const skyBtn   = document.getElementById('sky-btn') as HTMLButtonElement | null;
  const skyInput = document.getElementById('sky-input') as HTMLInputElement | null;
  const skyName  = document.getElementById('sky-name') as HTMLSpanElement  | null;

  if (skyBtn && skyInput) {
    skyBtn.addEventListener('click', () => skyInput.click());
    skyInput.addEventListener('change', async () => {
      const file = skyInput.files?.[0];
      if (!file) return;
      if (skyName) skyName.textContent = 'loading…';
      try {
        const tex = await loadSkyboxFromFile(file, rawDevice);
        renderer.setSkybox(tex);
        skyBufU32[20] = 1;  // enable skybox sampling in shader
        if (skyName) skyName.textContent = file.name;
        console.log(`[Skybox] Loaded "${file.name}"`);
      } catch (e) {
        console.error('[Skybox] Load failed:', e);
        if (skyName) skyName.textContent = 'load failed';
      }
      skyInput.value = '';
    });
  }

  // -- Resize -----------------------------------------------------------------
  app.addResizeListener((w, h) => {
    renderer.resize(w, h);
    debug.onGBufferResize(renderer.gbuf);
    debug.setDepthView(gpuDevice.getDepthTextureView());
  });

  console.log('[Fur] Hybrid deferred+forward — ` toggles debug overlay');

  // -- Camera -----------------------------------------------------------------
  const camera = new OrbitCamera(canvas, { elevation: 0.15, radius: 3.5 });

  // -- Per-frame uniform data -------------------------------------------------
  const uniformData = new Float32Array(UNIFORM_FLOATS);
  const model       = createIdentityMatrix();
  uniformData[35]   = 1;  // firstShell = 1 (skin is deferred, fur starts at shell 1)

  let totalTime = 0;

  // -- Render loop ------------------------------------------------------------
  app.start((deltaTime: number) => {
    totalTime += deltaTime;
    debug.updateFPS(deltaTime);

    const { width, height } = gpuDevice.getCanvasSize();
    const eye      = camera.getEye();
    const target   = camera.getTarget();
    const view     = lookAt(eye, target, [0, 1, 0]);
    const proj     = perspectiveMatrix(Math.PI / 4, width / height, 0.1, 100);
    const viewProj = multiplyMatrices(proj, view);

    uniformData.set(viewProj, 0);
    uniformData.set(model,    16);
    uniformData[32] = totalTime;
    uniformData[33] = NUM_SHELLS;
    uniformData[34] = FUR_LENGTH;

    gpuDevice.writeUniformBuffer(uniformBuffer, uniformData);

    // Sky uniforms: inverse view-projection + camera eye position
    const invViewProj = invertMatrix4x4(viewProj);
    skyBufF32.set(invViewProj, 0);          // offset 0: invViewProj
    skyBufF32[16] = eye[0];                  // offset 64: eyePos.x
    skyBufF32[17] = eye[1];                  // offset 68: eyePos.y
    skyBufF32[18] = eye[2];                  // offset 72: eyePos.z
    skyBufF32[19] = 0;                       // offset 76: eyePos.w (padding)
    // skyBufU32[20] at offset 80 (hasSkybox) is set when loading/clearing the skybox
    rawDevice.queue.writeBuffer(skyUniformBuffer, 0, skyBufAB);

    const encoder   = rawDevice.createCommandEncoder({ label: 'frame' });
    const swapView  = gpuDevice.getCurrentTexture().createView();
    const depthView = gpuDevice.getDepthTextureView();

    renderer.encode(encoder, swapView, depthView);
    debug.encode(encoder, swapView, width, height);

    app.submitCommands(encoder.finish());
  });
}

document.addEventListener('DOMContentLoaded', main);
