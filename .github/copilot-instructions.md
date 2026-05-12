# TextAlive WebGPU Framework Project

## Project Overview
A modern WebGPU framework built with TypeScript and Vite, designed for creating lyric-synchronized GPU visualizations using the TextAlive API.

## Architecture

### Core Framework (`src/core/`)
- **WebGPUDevice.ts** - GPU device initialization, canvas management, texture handling
- **WebGPUApp.ts** - Main application framework with render loop and pipeline management  
- **ShaderManager.ts** - WGSL shader compilation, caching, and pipeline creation

### Shader System (`src/shaders/`)
- **BasicShaders.ts** - Collection of ready-to-use WGSL shader examples:
  - Fullscreen rendering shaders
  - Gradient animations
  - Time-based effects
  - Lyric-responsive visualizations
  - Particle system templates

### TextAlive Integration (`src/textalive/`)
- **TextAliveManager.ts** - Lyric phrase management and music state tracking

### Utilities (`src/utils/`)
- **GeometryUtils.ts** - Geometry helpers (quad, cube, pyramid, sphere)

## Features

? **Framework**
- WebGPU device and context management
- Automatic canvas resizing and DPI scaling
- Render loop with delta time tracking
- Command buffer submission

? **Shader System**
- WGSL shader module compilation and caching
- Render pipeline creation with automatic layout
- Hot reload support for development
- Example shaders for quick start

? **TextAlive Ready**
- Lyric phrase synchronization
- Music state tracking (time, duration, playing state)
- Phrase progress calculation
- Event-based timing information

## Build & Dev

```bash
npm install      # Install dependencies
npm run dev      # Start development server with HMR
npm run build    # Build for production
npm run preview  # Preview production build
```

## Usage Example

```typescript
import { WebGPUApp } from './core/WebGPUApp';

const app = new WebGPUApp({
  canvas: document.querySelector('#webgpu-canvas'),
  backgroundColor: [0.1, 0.1, 0.15, 1.0],
});

await app.initialize();

const shaderManager = app.getShaderManager();
const pipeline = shaderManager.createPipeline(
  'my-shader',
  vertexSource,
  fragmentSource,
  bufferLayout,
  format
);

app.start(() => {
  // Render here
});
```

## TextAlive Integration

To integrate with TextAlive:

1. Register at https://textalive.jp/
2. Load TextAlive SDK (via CDN or local)
3. Implement song loading in TextAliveManager
4. Update music state in render loop

```typescript
const textAlive = new TextAliveManager();
await textAlive.initializeSong('song-id');
textAlive.updateMusicState(currentTime, isPlaying);

const phrase = textAlive.getCurrentPhrase();
const progress = textAlive.getCurrentPhraseProgress();
```

## Browser Support

Requires WebGPU support:
- Chrome 113+
- Edge 113+  
- Safari 18+ (macOS Sonoma and later)

## Next Steps

- Customize example shaders in `src/shaders/`
- Create custom vertex/fragment shader pairs
- Integrate TextAlive API for lyric synchronization
- Add mouse/keyboard input handling
- Create shader animation parameters
- Build lyric-synchronized visualizations
