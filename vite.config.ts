import { defineConfig } from 'vite';

export default defineConfig({
  // In production (GitHub Actions sets GITHUB_PAGES=true), serve from the repo sub-path.
  // Local dev keeps base '/' so the dev server works without a prefix.
  base: process.env.GITHUB_PAGES === 'true' ? '/textalivewebgpu/' : '/',
});
