/**
 * main.ts — entry point.
 * Wires up the WebGPU app, scene manager, camera, renderer, debug overlay,
 * and model/skybox loaders.
 */

import './style.css';
import { WebGPUApp } from './core/WebGPUApp';
import { perspectiveMatrix, lookAt, multiplyMatrices, invertMatrix4x4 } from './utils/MathUtils';
import { createSphereInterleaved } from './utils/GeometryUtils';
import { OrbitCamera } from './utils/OrbitCamera';
import { SceneManager } from './scene/SceneManager';
import { FurRenderer } from './renderer/FurRenderer';
import { DebugOverlay } from './renderer/DebugOverlay';
import { ModelDropZone } from './renderer/ModelDropZone';
import { loadSkyboxFromFile } from './utils/SkyboxLoader';
import { LightManager } from './lights/LightManager';

// -- Constants ----------------------------------------------------------------

// Sky uniform layout (96 bytes):
//   invViewProj mat4x4<f32>  offset  0 — 64 bytes
//   eyePos      vec4<f32>    offset 64 — 16 bytes
//   hasSkybox   u32          offset 80 —  4 bytes
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

  // -- Sky uniform buffer (invViewProj + eyePos + hasSkybox) ------------------
  const skyUniformBuffer = gpuDevice.createUniformBuffer(SKY_UNIFORM_BYTES, 'sky-uniforms');
  const skyBufAB  = new ArrayBuffer(SKY_UNIFORM_BYTES);
  const skyBufF32 = new Float32Array(skyBufAB);
  const skyBufU32 = new Uint32Array(skyBufAB);
  skyBufU32[20] = 0;  // hasSkybox = false

  // -- Light manager ----------------------------------------------------------
  const lights = new LightManager(rawDevice);
  lights.addSun(
    [1.0, -2.0, 1.5],    // direction FROM sun TOWARD scene
    [1.0, 1.0, 1.0],     // white
    0.80,
  );
  lights.addSpot(
    [3.0, 4.0, 3.0],     // world position
    [-1.0, -1.3, -1.0],  // direction toward scene center
    20, 35,              // inner/outer cone angles (degrees)
    12.0,                // range
    [0.6, 0.8, 1.0],     // cool blue-white
    6.0,
  );
  lights.upload();
  console.log('[Lights] Sun + spot initialized');

  // -- Scene ------------------------------------------------------------------
  const scene = new SceneManager();

  const sphere = createSphereInterleaved(1.0, 48, 24);
  const mainNode = scene.add('Sphere', sphere, { numShells: 32, furLength: 0.20 });
  console.log('[Scene] Default sphere added —', sphere.indices.length / 3, 'triangles');

  // -- Renderer ---------------------------------------------------------------
  const { width, height } = gpuDevice.getCanvasSize();
  const renderer = new FurRenderer({
    device          : rawDevice,
    scene,
    skyUniformBuffer,
    lightBuffer     : lights.getBuffer(),
    depthView       : gpuDevice.getDepthTextureView(),
    shaderManager   : app.getShaderManager(),
    swapFormat      : gpuDevice.getFormat(),
    depthFormat     : gpuDevice.depthFormat,
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
    initialGbuf  : renderer.gbuf,
  });
  debug.setDepthView(gpuDevice.getDepthTextureView());

  // Shells info in debug panel
  const shellsEl = document.getElementById('dbg-shells');
  if (shellsEl) shellsEl.textContent = `Shells: 1 deferred + ${mainNode.numShells - 1} forward`;

  // -- Model drop zone --------------------------------------------------------
  new ModelDropZone(canvas, (geo, name) => {
    mainNode.geometry = geo;  // geometryDirty flag set automatically
    console.log(`[Model] Loaded "${name}" — ${geo.indices.length / 3} triangles`);
  });

  // -- Skybox loader ----------------------------------------------------------
  const skyBtn   = document.getElementById('sky-btn')   as HTMLButtonElement | null;
  const skyInput = document.getElementById('sky-input') as HTMLInputElement  | null;
  const skyName  = document.getElementById('sky-name')  as HTMLSpanElement   | null;

  if (skyBtn && skyInput) {
    skyBtn.addEventListener('click', () => skyInput.click());
    skyInput.addEventListener('change', async () => {
      const file = skyInput.files?.[0];
      if (!file) return;
      if (skyName) skyName.textContent = 'loading…';
      try {
        const tex = await loadSkyboxFromFile(file, rawDevice);
        renderer.setSkybox(tex);
        skyBufU32[20] = 1;
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
    renderer.setDepthView(gpuDevice.getDepthTextureView());
    debug.onGBufferResize(renderer.gbuf);
    debug.setDepthView(gpuDevice.getDepthTextureView());
  });

  // -- Camera -----------------------------------------------------------------
  const camera = new OrbitCamera(canvas, { elevation: 0.15, radius: 3.5 });

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

    // Scene uniforms (shared across all objects)
    renderer.updateSceneUniforms(viewProj, totalTime);

    // Sky uniforms
    const invViewProj = invertMatrix4x4(viewProj);
    skyBufF32.set(invViewProj, 0);
    skyBufF32[16] = eye[0];
    skyBufF32[17] = eye[1];
    skyBufF32[18] = eye[2];
    skyBufF32[19] = 0;
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
