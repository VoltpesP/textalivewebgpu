import type { InterleavedGeometry } from '../utils/GeometryUtils';
import { loadModelFromFile } from '../utils/ModelLoader';

/**
 * ModelDropZone — file picker button + full-canvas drag-drop handler.
 *
 * Wires together:
 *   #model-btn    — "Load Model" button; click opens the hidden file input
 *   #model-input  — hidden <input type="file"> for the native picker
 *   #model-name   — label showing the currently loaded model name
 *   #drop-hint    — full-screen overlay that appears while dragging over the canvas
 *
 * Call onLoad(geo, fileName) when parsing succeeds.
 */
export class ModelDropZone {
  private onLoad: (geo: InterleavedGeometry, name: string) => void;

  private btnEl   : HTMLButtonElement  | null;
  private nameEl  : HTMLElement        | null;
  private inputEl : HTMLInputElement   | null;
  private hintEl  : HTMLElement        | null;

  constructor(canvas: HTMLCanvasElement, onLoad: (geo: InterleavedGeometry, name: string) => void) {
    this.onLoad = onLoad;
    this.btnEl   = document.getElementById('model-btn')   as HTMLButtonElement | null;
    this.nameEl  = document.getElementById('model-name')  as HTMLElement       | null;
    this.inputEl = document.getElementById('model-input') as HTMLInputElement  | null;
    this.hintEl  = document.getElementById('drop-hint')   as HTMLElement       | null;

    this.btnEl?.addEventListener('click', () => this.inputEl?.click());

    this.inputEl?.addEventListener('change', () => {
      const file = this.inputEl?.files?.[0];
      if (file) this.handleFile(file);
    });

    // Drag-drop on the canvas
    canvas.addEventListener('dragover',  (e) => { e.preventDefault(); this.hintEl?.classList.add('active'); });
    canvas.addEventListener('dragleave', ()  => this.hintEl?.classList.remove('active'));
    canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      this.hintEl?.classList.remove('active');
      const file = e.dataTransfer?.files[0];
      if (file) this.handleFile(file);
    });
  }

  private async handleFile(file: File): Promise<void> {
    this.setLoading(true, 'Loading…');
    try {
      const geo = await loadModelFromFile(file);
      this.setLoading(false, file.name);
      this.onLoad(geo, file.name);
    } catch (err) {
      const msg = (err as Error).message;
      this.setLoading(false, `Error: ${msg}`);
      console.error('[ModelDropZone]', err);
    }
  }

  private setLoading(loading: boolean, label: string): void {
    if (this.btnEl)  this.btnEl.disabled = loading;
    if (this.nameEl) this.nameEl.textContent = label;
    document.body.classList.toggle('model-loading', loading);
  }
}
