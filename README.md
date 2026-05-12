# TextAlive WebGPU Framework

A modern WebGPU framework built with TypeScript and Vite, designed for easy shader development and TextAlive API integration for lyric-synchronized GPU visualizations.

## Features

? **Easy Shader Development**
- Simple shader manager for WGSL shader creation and caching
- Hot reload support for development
- Pipeline management system

? **TextAlive Integration**
- Manager for lyric synchronization
- Music state tracking
- Phrase-based event system

? **Developer Friendly**
- TypeScript throughout for type safety
- Vite for fast development and building
- Clear, modular architecture
- Ready-to-use example shaders

## Quick Start

### Install Dependencies
```bash
npm install
```

### Development Server
```bash
npm run dev
```

The development server starts at `http://localhost:5173`. The app uses HMR (Hot Module Replacement) for instant shader updates.

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

## Project Structure

```
src/
„¥„Ÿ„Ÿ core/
„    „¥„Ÿ„Ÿ WebGPUDevice.ts      # GPU device and context management
„    „¥„Ÿ„Ÿ WebGPUApp.ts         # Main application framework
„    „¤„Ÿ„Ÿ ShaderManager.ts     # Shader compilation and caching
„¥„Ÿ„Ÿ shaders/
„    „¤„Ÿ„Ÿ BasicShaders.ts      # Example WGSL shaders
„¥„Ÿ„Ÿ textalive/
„    „¤„Ÿ„Ÿ TextAliveManager.ts  # Lyric data and music state
„¥„Ÿ„Ÿ utils/
„    „¤„Ÿ„Ÿ GeometryUtils.ts     # Geometry creation helpers
„¥„Ÿ„Ÿ main.ts                  # Application entry point
„¤„Ÿ„Ÿ style.css               # Styling
```

## Usage Example

### Basic Setup

```typescript
import { WebGPUApp } from './core/WebGPUApp';
import { FULLSCREEN_VERTEX, GRADIENT_FRAGMENT } from './shaders/BasicShaders';

// Create app
const app = new WebGPUApp({
  canvas: document.querySelector('#webgpu-canvas'),
  backgroundColor: [0.1, 0.1, 0.15, 1.0],
});

// Initialize
await app.initialize();

// Create shader pipeline
const shaderManager = app.getShaderManager();
const pipeline = shaderManager.createPipeline(
  'my-shader',
  vertexShader,
  fragmentShader,
  bufferLayout,
  format
);

// Start render loop
app.start((deltaTime) => {
  // Your render code here
});
```

### Using TextAlive Integration

```typescript
import { TextAliveManager } from './textalive/TextAliveManager';

const textAlive = new TextAliveManager();

// Load lyrics (implement with TextAlive API)
await textAlive.initializeSong('song-id');

// Update in render loop
textAlive.updateMusicState(currentTime, isPlaying);

// Get current lyric info
const phrase = textAlive.getCurrentPhrase();
const progress = textAlive.getCurrentPhraseProgress();
```

### Creating Custom Shaders

```typescript
const vertexShader = `
@vertex
fn main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  // Your vertex shader code
}
`;

const fragmentShader = `
@fragment
fn main() -> @location(0) vec4f {
  // Your fragment shader code
  return vec4f(1.0, 0.0, 0.0, 1.0);
}
`;
```

## Available Shaders

The `BasicShaders.ts` file includes several example shaders:

- `FULLSCREEN_VERTEX` - Fullscreen quad vertex shader
- `SOLID_COLOR_FRAGMENT` - Simple solid color
- `GRADIENT_FRAGMENT` - Linear gradient
- `TIME_ANIMATION_FRAGMENT` - Time-based animation
- `LYRIC_RESPONSIVE_FRAGMENT` - Syncs with lyric timing
- `PARTICLE_VERTEX` - Particle system base

Shader sources are also available as standalone files in `src/shaders/`:
- `*.wgsl` for WebGPU use
- `*.glsl` as reference GLSL versions
- `*.hlsl` as reference HLSL versions

> Note: Browser WebGPU only accepts WGSL directly. The `.glsl` and `.hlsl` files are reference files for editing or translation.

## Integration with TextAlive

To fully integrate with TextAlive API:

1. Register your application at https://textalive.jp/
2. Get your API credentials
3. Load the TextAlive SDK (via CDN or local copy)
4. Implement song loading in `TextAliveManager.initializeSong()`

Example with CDN:
```html
<script src="https://alpha.textalive.jp/latest/index.min.js"></script>
```

## Browser Support

Requires a browser with WebGPU support:
- Chrome 113+
- Edge 113+
- Safari 18+ (on macOS Sonoma and later)

## Development Tips

### Hot Reload Shaders
Modify shader code in `BasicShaders.ts` or your custom shader files. The dev server will automatically recompile.

### Debug Canvas Size
The canvas automatically scales to window size. Check browser DevTools for actual canvas resolution.

### Performance
- Use shader caching to avoid recompilation
- Profile with Chrome DevTools GPU profiler
- Test on target hardware

## Next Steps

1. **Customize Shaders**: Edit shaders in `src/shaders/` or `main.ts`
2. **Add Geometry**: Use helpers from `GeometryUtils.ts` or create custom
3. **Integrate TextAlive**: Load real lyrics and sync animations
4. **Add Interactivity**: Handle mouse/touch input in your render loop
5. **Optimize**: Profile and optimize for your target platforms

## Resources

- [WebGPU Specification](https://gpuweb.github.io/gpuweb/)
- [WGSL Specification](https://gpuweb.github.io/gpuweb/wgsl/)
- [Vite Documentation](https://vite.dev/)
- [TextAlive](https://textalive.jp/)
- [TypeScript Documentation](https://www.typescriptlang.org/)

## License

MIT

## Support

For issues with the framework, please check:
1. Browser WebGPU support
2. Canvas size and DPI settings  
3. Shader syntax and entry points
4. GPU device initialization logs in console
