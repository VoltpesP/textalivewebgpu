/**
 * SkyboxLoader — loads a single cross-layout image into a GPU texture.
 *
 * Expected image format: horizontal cross, 4 tiles wide × 3 tiles tall.
 *
 *   [  ][+Y][  ][  ]   ← row 0
 *   [-X][+Z][+X][-Z]   ← row 1
 *   [  ][-Y][  ][  ]   ← row 2
 *
 * Accepts any image format the browser can decode (PNG, JPG, WebP, …).
 */

export async function loadSkyboxFromFile(
  file  : File,
  device: GPUDevice,
): Promise<GPUTexture> {
  const bitmap = await createImageBitmap(file, { colorSpaceConversion: 'none' });
  const tex    = uploadBitmap(bitmap, device);
  bitmap.close();
  return tex;
}

export async function loadSkyboxFromURL(
  url   : string,
  device: GPUDevice,
): Promise<GPUTexture> {
  const resp   = await fetch(url);
  const blob   = await resp.blob();
  const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none' });
  const tex    = uploadBitmap(bitmap, device);
  bitmap.close();
  return tex;
}

function uploadBitmap(bitmap: ImageBitmap, device: GPUDevice): GPUTexture {
  const tex = device.createTexture({
    size : [bitmap.width, bitmap.height],
    format: 'rgba8unorm',
    usage : GPUTextureUsage.TEXTURE_BINDING
          | GPUTextureUsage.COPY_DST
          | GPUTextureUsage.RENDER_ATTACHMENT,
    label : 'skybox-cross',
  });
  device.queue.copyExternalImageToTexture(
    { source: bitmap, flipY: false },
    { texture: tex },
    [bitmap.width, bitmap.height],
  );
  return tex;
}

/** 1×1 grey fallback used before a skybox image is loaded. */
export function createDefaultSkyboxTexture(device: GPUDevice): GPUTexture {
  const tex = device.createTexture({
    size  : [1, 1],
    format: 'rgba8unorm',
    usage : GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    label : 'skybox-default',
  });
  device.queue.writeTexture(
    { texture: tex },
    new Uint8Array([20, 20, 20, 255]),
    { bytesPerRow: 4 },
    [1, 1],
  );
  return tex;
}
