(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin===`use-credentials`?t.credentials=`include`:e.crossOrigin===`anonymous`?t.credentials=`omit`:t.credentials=`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=class{device=null;queue=null;canvas=null;context=null;format=null;depthTexture=null;depthView=null;depthFormat=`depth32float`;async initialize(e){if(!navigator.gpu)throw Error(`WebGPU is not supported in this browser`);this.canvas=e;let t=await navigator.gpu.requestAdapter();if(!t)throw Error(`No WebGPU adapter found`);this.device=await t.requestDevice(),this.queue=this.device.queue;let n=e.getContext(`webgpu`);if(!n)throw Error(`Failed to get WebGPU context`);this.context=n,this.format=navigator.gpu.getPreferredCanvasFormat(),this.context.configure({device:this.device,format:this.format}),this.createDepthTexture(e.width,e.height),console.log(`WebGPU device initialized`)}createDepthTexture(e,t){if(!this.device)throw Error(`Device not initialized`);this.depthTexture&&this.depthTexture.destroy(),this.depthTexture=this.device.createTexture({size:[Math.max(1,e),Math.max(1,t)],format:this.depthFormat,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING,label:`depth-texture`}),this.depthView=this.depthTexture.createView()}getDepthTextureView(){if(!this.depthView)throw Error(`Depth texture not initialized`);return this.depthView}getDevice(){if(!this.device)throw Error(`Device not initialized`);return this.device}getQueue(){if(!this.queue)throw Error(`Queue not initialized`);return this.queue}getContext(){if(!this.context)throw Error(`Context not initialized`);return this.context}getFormat(){if(!this.format)throw Error(`Format not initialized`);return this.format}getCanvasSize(){if(!this.canvas)throw Error(`Canvas not initialized`);return{width:this.canvas.width,height:this.canvas.height}}resizeCanvas(e,t){if(!this.canvas)throw Error(`Canvas not initialized`);this.canvas.width=e,this.canvas.height=t,this.createDepthTexture(e,t)}getCurrentTexture(){if(!this.context)throw Error(`Context not initialized`);return this.context.getCurrentTexture()}createTexture(e){if(!this.device)throw Error(`Device not initialized`);return this.device.createTexture(e)}createSampler(e){if(!this.device)throw Error(`Device not initialized`);return this.device.createSampler(e)}createBuffer(e,t,n){if(!this.device)throw Error(`Device not initialized`);let r=(e instanceof ArrayBuffer,e.byteLength),i=this.device.createBuffer({size:r+3&-4,usage:t,mappedAtCreation:!0,label:n}),a=new Uint8Array(i.getMappedRange());if(e instanceof ArrayBuffer)a.set(new Uint8Array(e));else{let t=e;a.set(new Uint8Array(t.buffer,t.byteOffset,t.byteLength))}return i.unmap(),i}createUniformBuffer(e,t){if(!this.device)throw Error(`Device not initialized`);return this.device.createBuffer({size:e+15&-16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,label:t})}writeUniformBuffer(e,t,n=0){if(!this.device)throw Error(`Device not initialized`);this.device.queue.writeBuffer(e,n,t)}destroy(){this.depthTexture?.destroy(),this.device?.destroy()}},t=class{device;shaders=new Map;pipelines=new Map;constructor(e){this.device=e}createShaderModule(e,t){let n=this.shaders.get(e);if(n)return n;let r=this.device.getDevice().createShaderModule({code:t,label:e});return this.shaders.set(e,r),r}createPipeline(e,t,n,r,i={}){let a=this.pipelines.get(e);if(a)return a;let o=this.createShaderModule(`${e}-vertex`,t),s=this.createShaderModule(`${e}-fragment`,n),c=this.device.getDevice().createRenderPipeline({layout:`auto`,vertex:{module:o,entryPoint:`main`,buffers:i.bufferLayout??[]},fragment:{module:s,entryPoint:`main`,targets:i.targets??[{format:r,blend:i.blend}]},primitive:{topology:i.topology??`triangle-list`,cullMode:i.cullMode??`none`},depthStencil:i.depthStencil,label:e});return this.pipelines.set(e,c),c}getPipeline(e){return this.pipelines.get(e)}reloadShader(e,t){this.shaders.delete(e),this.createShaderModule(e,t)}clearCache(){this.shaders.clear(),this.pipelines.clear()}},n=class{device;pipelines=new Map;constructor(e){this.device=e}createPipeline(e,t){let n=this.pipelines.get(e);if(n)return n;let r=this.device.getDevice().createShaderModule({code:t,label:`${e}-compute-module`}),i=this.device.getDevice().createComputePipeline({layout:`auto`,compute:{module:r,entryPoint:`main`},label:e});return this.pipelines.set(e,i),console.log(`[Compute] Pipeline "${e}" compiled`),i}dispatch(e,t,n,r,i=1,a=1){let o=e.beginComputePass({label:`${t.label}-pass`});o.setPipeline(t),o.setBindGroup(0,n),o.dispatchWorkgroups(r,i,a),o.end()}clearCache(){this.pipelines.clear()}},r=class{device;shaderManager;computeManager;canvas;isRunning=!1;backgroundColor;frameCallback=null;lastFrameTime=0;resizeCallbacks=[];constructor(r){this.device=new e,this.shaderManager=new t(this.device),this.computeManager=new n(this.device),this.canvas=r.canvas,this.backgroundColor=r.backgroundColor??[0,0,0,1]}async initialize(){await this.device.initialize(this.canvas),this.setupResizeListener(),console.log(`WebGPU app initialized`)}start(e){this.isRunning||(this.isRunning=!0,this.frameCallback=e??null,this.lastFrameTime=performance.now(),this.renderLoop())}stop(){this.isRunning=!1}renderLoop=()=>{if(!this.isRunning)return;let e=performance.now(),t=(e-this.lastFrameTime)/1e3;this.lastFrameTime=e,this.frameCallback?this.frameCallback(t):this.renderEmpty(),requestAnimationFrame(this.renderLoop)};renderEmpty(){let e=this.device.getDevice(),t=e.createCommandEncoder();this.createRenderPass(t).end(),e.queue.submit([t.finish()])}createRenderPass(e,t){let n=this.device.getCurrentTexture().createView(),[r,i,a,o]=this.backgroundColor;return e.beginRenderPass({colorAttachments:t??[{view:n,clearValue:{r,g:i,b:a,a:o},loadOp:`clear`,storeOp:`store`}],depthStencilAttachment:{view:this.device.getDepthTextureView(),depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}})}submitCommands(e){this.device.getQueue().submit([e])}getDevice(){return this.device}getShaderManager(){return this.shaderManager}getComputeManager(){return this.computeManager}setBackgroundColor(e,t,n,r=1){this.backgroundColor=[e,t,n,r]}addResizeListener(e){this.resizeCallbacks.push(e)}setupResizeListener(){new ResizeObserver(()=>{let e=this.canvas.getBoundingClientRect(),t=Math.max(1,Math.floor(e.width*window.devicePixelRatio)),n=Math.max(1,Math.floor(e.height*window.devicePixelRatio));this.device.resizeCanvas(t,n),this.resizeCallbacks.forEach(e=>e(t,n))}).observe(this.canvas)}destroy(){this.stop(),this.device.destroy(),this.shaderManager.clearCache(),this.computeManager.clearCache()}};function i(e,t){let n=new Float32Array(16);for(let r=0;r<4;r++)for(let i=0;i<4;i++){let a=0;for(let n=0;n<4;n++)a+=e[n*4+i]*t[r*4+n];n[r*4+i]=a}return n}function a(e,t,n,r){let i=1/Math.tan(e/2),a=1/(n-r),o=new Float32Array(16);return o[0]=i/t,o[5]=i,o[10]=r*a,o[11]=-1,o[14]=r*n*a,o}function o(e,t,n){let[r,i,a]=e,[o,s,c]=t,[l,u,d]=n,f=r-o,p=i-s,m=a-c,h=Math.hypot(f,p,m)||1;f/=h,p/=h,m/=h;let g=u*m-d*p,_=d*f-l*m,v=l*p-u*f;h=Math.hypot(g,_,v),h===0?(g=1,_=0,v=0):(g/=h,_/=h,v/=h);let y=p*v-m*_,b=m*g-f*v,x=f*_-p*g,S=new Float32Array(16);return S[0]=g,S[1]=y,S[2]=f,S[3]=0,S[4]=_,S[5]=b,S[6]=p,S[7]=0,S[8]=v,S[9]=x,S[10]=m,S[11]=0,S[12]=-(g*r+_*i+v*a),S[13]=-(y*r+b*i+x*a),S[14]=-(f*r+p*i+m*a),S[15]=1,S}function s(e){let t=Math.cos(e),n=Math.sin(e);return new Float32Array([t,0,-n,0,0,1,0,0,n,0,t,0,0,0,0,1])}function c(e){let t=Math.cos(e),n=Math.sin(e);return new Float32Array([1,0,0,0,0,t,n,0,0,-n,t,0,0,0,0,1])}function l(e){let t=new Float32Array(16),n=e[0],r=e[1],i=e[2],a=e[3],o=e[4],s=e[5],c=e[6],l=e[7],u=e[8],d=e[9],f=e[10],p=e[11],m=e[12],h=e[13],g=e[14],_=e[15],v=n*s-r*o,y=n*c-i*o,b=n*l-a*o,x=r*c-i*s,S=r*l-a*s,C=i*l-a*c,w=u*h-d*m,T=u*g-f*m,E=u*_-p*m,D=d*g-f*h,O=d*_-p*h,k=f*_-p*g,A=v*k-y*O+b*D+x*E-S*T+C*w;return Math.abs(A)<1e-8?t:(A=1/A,t[0]=(s*k-c*O+l*D)*A,t[1]=(i*O-r*k-a*D)*A,t[2]=(h*C-g*S+_*x)*A,t[3]=(f*S-d*C-p*x)*A,t[4]=(c*E-o*k-l*T)*A,t[5]=(n*k-i*E+a*T)*A,t[6]=(g*b-m*C-_*y)*A,t[7]=(u*C-f*b+p*y)*A,t[8]=(o*O-s*E+l*w)*A,t[9]=(r*E-n*O-a*w)*A,t[10]=(m*S-h*b+_*v)*A,t[11]=(d*b-u*S-p*v)*A,t[12]=(s*T-o*D-c*w)*A,t[13]=(n*D-r*T+i*w)*A,t[14]=(h*y-m*x-g*v)*A,t[15]=(u*x-d*y+f*v)*A,t)}function u(e){return new Float32Array([e,0,0,0,0,e,0,0,0,0,e,0,0,0,0,1])}function d(e,t,n){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,e,t,n,1])}function f(e=1,t=48,n=24){let r=(t+1)*(n+1),i=new Float32Array(r*6),a=0;for(let r=0;r<=n;r++){let o=r/n*Math.PI,s=Math.sin(o),c=Math.cos(o);for(let n=0;n<=t;n++){let r=n/t*Math.PI*2,o=Math.sin(r),l=s*Math.cos(r),u=c,d=s*o;i[a++]=l*e,i[a++]=u*e,i[a++]=d*e,i[a++]=l,i[a++]=u,i[a++]=d}}let o=new Uint32Array(t*n*6),s=0;for(let e=0;e<n;e++)for(let n=0;n<t;n++){let r=e*(t+1)+n,i=r+(t+1);o[s++]=r,o[s++]=i,o[s++]=r+1,o[s++]=i,o[s++]=i+1,o[s++]=r+1}return{vertices:i,indices:o,stride:24}}function p(e,t,n){return Math.max(t,Math.min(n,e))}var m=class{azimuth;elevation;radius;target;ptrs=new Map;activeMB=-1;lastX=0;lastY=0;lastPinchDist=0;ORBIT_SPEED=.006;PAN_SPEED=.003;ZOOM_SPEED=.12;MIN_RADIUS=.5;MAX_RADIUS=50;canvas;constructor(e,t={}){this.canvas=e,this.azimuth=t.azimuth??0,this.elevation=t.elevation??.15,this.radius=t.radius??3.5,this.target=t.target?[...t.target]:[0,0,0],e.style.cursor=`grab`,e.addEventListener(`pointerdown`,this.onPointerDown),e.addEventListener(`pointermove`,this.onPointerMove),e.addEventListener(`pointerup`,this.onPointerUp),e.addEventListener(`pointercancel`,this.onPointerUp),e.addEventListener(`contextmenu`,this.onContextMenu),e.addEventListener(`wheel`,this.onWheel,{passive:!1})}onContextMenu=e=>e.preventDefault();onPointerDown=e=>{this.canvas.setPointerCapture(e.pointerId),this.ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY}),this.activeMB=e.button,this.lastX=e.clientX,this.lastY=e.clientY,this.canvas.style.cursor=`grabbing`};onPointerMove=e=>{if(!this.ptrs.has(e.pointerId))return;if(this.ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY}),this.ptrs.size===2){let[t,n]=[...this.ptrs.values()],r=Math.hypot(t.x-n.x,t.y-n.y);this.lastPinchDist>0&&(this.radius=p(this.radius*this.lastPinchDist/r,this.MIN_RADIUS,this.MAX_RADIUS)),this.lastPinchDist=r,this.lastX=e.clientX,this.lastY=e.clientY;return}if(this.lastPinchDist=0,this.activeMB<0)return;let t=e.clientX-this.lastX,n=e.clientY-this.lastY;this.lastX=e.clientX,this.lastY=e.clientY,this.activeMB===0?(this.azimuth-=t*this.ORBIT_SPEED,this.elevation=p(this.elevation-n*this.ORBIT_SPEED,-Math.PI/2+.05,Math.PI/2-.05)):this.activeMB===2&&this.pan(t,n)};onPointerUp=e=>{this.ptrs.delete(e.pointerId),this.ptrs.size===0&&(this.activeMB=-1,this.lastPinchDist=0,this.canvas.style.cursor=`grab`)};onWheel=e=>{e.preventDefault();let t=1+Math.sign(e.deltaY)*this.ZOOM_SPEED;this.radius=p(this.radius*t,this.MIN_RADIUS,this.MAX_RADIUS)};pan(e,t){let n=this.getRightDir(),r=this.getUpDir(),i=this.radius*this.PAN_SPEED;this.target[0]+=(-e*n[0]+t*r[0])*i,this.target[1]+=(-e*n[1]+t*r[1])*i,this.target[2]+=(-e*n[2]+t*r[2])*i}getEye(){let e=Math.cos(this.elevation);return[this.target[0]+this.radius*e*Math.sin(this.azimuth),this.target[1]+this.radius*Math.sin(this.elevation),this.target[2]+this.radius*e*Math.cos(this.azimuth)]}getTarget(){return[...this.target]}destroy(){this.canvas.removeEventListener(`pointerdown`,this.onPointerDown),this.canvas.removeEventListener(`pointermove`,this.onPointerMove),this.canvas.removeEventListener(`pointerup`,this.onPointerUp),this.canvas.removeEventListener(`pointercancel`,this.onPointerUp),this.canvas.removeEventListener(`contextmenu`,this.onContextMenu),this.canvas.removeEventListener(`wheel`,this.onWheel),this.canvas.style.cursor=``}getRightDir(){return[Math.cos(this.azimuth),0,-Math.sin(this.azimuth)]}getUpDir(){let e=Math.sin(this.elevation),t=Math.cos(this.elevation);return[-e*Math.sin(this.azimuth),t,-e*Math.cos(this.azimuth)]}},h=class{name;position;eulerY;eulerX;scale;visible;numShells;furLength;geometryDirty=!0;_geometry;constructor(e,t={}){this._geometry=e,this.name=t.name??`SceneNode`,this.position=t.position??[0,0,0],this.eulerY=t.eulerY??0,this.eulerX=t.eulerX??0,this.scale=t.scale??1,this.visible=t.visible??!0,this.numShells=t.numShells??32,this.furLength=t.furLength??.2}get geometry(){return this._geometry}set geometry(e){this._geometry=e,this.geometryDirty=!0}getModelMatrix(){let e=u(this.scale),t=c(this.eulerX),n=s(this.eulerY);return i(d(...this.position),i(n,i(t,e)))}},g=class{_nodes=[];get nodes(){return this._nodes}add(e,t,n={}){let r=new h(t,{name:e,...n});return this._nodes.push(r),r}remove(e){let t=this._nodes.indexOf(e);return t===-1?!1:(this._nodes.splice(t,1),!0)}find(e){return this._nodes.find(t=>t.name===e)}clear(){this._nodes.length=0}},_=`// gbuffer.vert.wgsl - geometry pass: renders the skin layer to the G-Buffer
//
// Group 0 (per-frame, shared across all objects):
//   binding 0 — SceneUniforms  viewProj + time
//
// Group 1 (per-object, set once per draw):
//   binding 0 — ObjectUniforms  model + shell settings

struct SceneUniforms {
  viewProj : mat4x4<f32>,
  time     : f32,
}
@group(0) @binding(0) var<uniform> scene : SceneUniforms;

struct ObjectUniforms {
  model     : mat4x4<f32>,
  numShells : f32,
  furLength : f32,
  firstShell: f32,
}
@group(1) @binding(0) var<uniform> obj : ObjectUniforms;

struct VertexInput {
  @location(0) position : vec3f,
  @location(1) normal   : vec3f,
}

struct VertexOutput {
  @builtin(position) clip : vec4f,
  @location(0) worldNormal : vec3f,
  @location(1) localPos    : vec3f,
}

@vertex
fn main(v: VertexInput) -> VertexOutput {
  let worldNorm = normalize((obj.model * vec4f(v.normal, 0.0)).xyz);
  let worldPos  = (obj.model * vec4f(v.position, 1.0)).xyz;

  var out: VertexOutput;
  out.clip        = scene.viewProj * vec4f(worldPos, 1.0);
  out.worldNormal = worldNorm;
  out.localPos    = v.position;
  return out;
}
`,v=`// gbuffer.frag.wgsl - geometry pass fragment shader with procedural bump mapping
//
// Writes to two render targets:
//   location(0) albedo : rgba8unorm   - base skin color, alpha=1 marks valid geometry
//   location(1) normal : rgba16float  - bumped world-space normal packed [0,1]
//
// fur_params.wgsl is prepended by FurRenderer before this source reaches the GPU.

// FurParams binding for this pipeline (group 0, binding 1)
@group(0) @binding(1) var<uniform> params : FurParams;

struct GBufferOut {
  @location(0) albedo : vec4f,
  @location(1) normal : vec4f,
}

// ---- Value noise -------------------------------------------------------

fn hash2(p: vec2f) -> f32 {
  var q = fract(p * vec2f(0.1031, 0.1030));
  q    += dot(q, q.yx + 33.33);
  return fract((q.x + q.y) * q.x) * 2.0 - 1.0;  // [-1, 1]
}

fn noise2(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash2(i),                    hash2(i + vec2f(1.0, 0.0)), u.x),
    mix(hash2(i + vec2f(0.0, 1.0)), hash2(i + vec2f(1.0, 1.0)), u.x),
    u.y,
  );
}

fn fbm(p: vec2f) -> f32 {
  var v  = 0.0;
  var a  = 0.5;
  var pp = p;
  for (var i: i32 = 0; i < 3; i++) {
    v  += a * noise2(pp);
    pp  = pp * 2.13 + vec2f(5.3, 1.7);
    a  *= 0.5;
  }
  return v;
}

const BUMP_EPS : f32 = 0.01;

// ---- Main --------------------------------------------------------------

@fragment
fn main(
  @location(0) worldNormal : vec3f,
  @location(1) localPos    : vec3f,
) -> GBufferOut {
  // Spherical UV from local-space position (same as fur.frag mapping)
  let n  = normalize(localPos);
  let su = atan2(n.z, n.x) * 0.15915 + 0.5;
  let sv = asin(clamp(n.y, -1.0, 1.0)) * 0.31831 + 0.5;
  let uv = vec2f(su, sv) * params.bumpScale;

  // Orthonormal tangent frame (guard against N ≈ world-up at poles)
  let N  = normalize(worldNormal);
  let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(N.y) > 0.99);
  let T  = normalize(cross(up, N));
  let B  = cross(N, T);

  // Height-field gradient via forward finite differences
  let h0  = fbm(uv);
  let dhu = fbm(uv + vec2f(BUMP_EPS, 0.0)) - h0;
  let dhv = fbm(uv + vec2f(0.0, BUMP_EPS)) - h0;

  let tN      = normalize(vec3f(-dhu * params.bumpStr, -dhv * params.bumpStr, 1.0));
  let bumpedN = normalize(T * tN.x + B * tN.y + N * tN.z);

  let packedNormal = bumpedN * 0.5 + 0.5;

  var out: GBufferOut;
  out.albedo = vec4f(params.skinColor.rgb, 1.0);
  out.normal = vec4f(packedNormal, 1.0);
  return out;
}
`,y=`// deferred_light.vert.wgsl - deferred lighting pass vertex shader\r
//\r
// Emits a single full-screen triangle that covers the entire viewport.\r
// Three hard-coded vertices (no vertex buffer) extend beyond clip space edges;\r
// the rasteriser clips them to the viewport so interpolated UVs cover [0,1]x[0,1].\r
\r
struct VertexOutput {\r
  @builtin(position) clip : vec4f,\r
  @location(0) uv         : vec2f,\r
}\r
\r
@vertex\r
fn main(@builtin(vertex_index) vid: u32) -> VertexOutput {\r
  var pos = array<vec2f, 3>(\r
    vec2f(-1.0, -1.0),  // bottom-left\r
    vec2f( 3.0, -1.0),  // bottom-right (clipped)\r
    vec2f(-1.0,  3.0),  // top-left     (clipped)\r
  );\r
  let p = pos[vid];\r
\r
  var out: VertexOutput;\r
  out.clip = vec4f(p, 0.0, 1.0);\r
  // NDC -> UV: x in [-1,1] -> u in [0,1]; y in [-1,1] -> v in [1,0] (Y-flip)\r
  out.uv = vec2f(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);\r
  return out;\r
}\r
`,b=`// deferred_light.frag.wgsl - deferred lighting pass + skybox background
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
`,x=`// fur.vert.wgsl - shell-based fur vertex shader
//
// fur_params.wgsl is prepended by FurRenderer — FurParams struct is available.
//
// Group 0: SceneUniforms (binding 0) + FurParams (binding 2)
// Group 1: ObjectUniforms (binding 0)

struct SceneUniforms {
  viewProj : mat4x4<f32>,
  time     : f32,
}
@group(0) @binding(0) var<uniform> scene  : SceneUniforms;
@group(0) @binding(2) var<uniform> params : FurParams;

struct ObjectUniforms {
  model     : mat4x4<f32>,
  numShells : f32,
  furLength : f32,
  firstShell: f32,
}
@group(1) @binding(0) var<uniform> obj : ObjectUniforms;

struct VertexInput {
  @location(0) position : vec3f,
  @location(1) normal   : vec3f,
}

struct VertexOutput {
  @builtin(position) clip : vec4f,
  @location(0) worldNormal : vec3f,
  @location(1) shellT      : f32,
  @location(2) localPos    : vec3f,
  @location(3) worldPos    : vec3f,
}

@vertex
fn main(
  v: VertexInput,
  @builtin(instance_index) shell: u32,
) -> VertexOutput {
  let shellT = f32(shell + u32(obj.firstShell)) / obj.numShells;

  let worldNorm = normalize((obj.model * vec4f(v.normal, 0.0)).xyz);

  // Gravity: tips droop downward, magnitude from params
  let grav = vec3f(0.0, -params.gravity, 0.0) * shellT * shellT;

  // Wind: sinusoidal sway scaled by params
  let t    = scene.time * params.windSpd;
  let sway = vec3f(
    sin(t * 0.9 + v.position.z * 2.0) * 0.09,
    0.0,
    cos(t * 0.6 + v.position.x * 2.0) * 0.05,
  ) * (shellT * shellT * params.windStr);

  let worldPos = (obj.model * vec4f(v.position, 1.0)).xyz
               + worldNorm * shellT * obj.furLength
               + grav
               + sway;

  var out: VertexOutput;
  out.clip        = scene.viewProj * vec4f(worldPos, 1.0);
  out.worldNormal = worldNorm;
  out.shellT      = shellT;
  out.localPos    = v.position;
  out.worldPos    = worldPos;
  return out;
}
`,S=`// fur.frag.wgsl - shell-based fur fragment shader
//
// fur_params.wgsl and lights.wgsl are prepended by FurRenderer.
//
// Group 0: SceneUniforms (binding 0, vertex) + LightBuffer (binding 1) + FurParams (binding 2)
// Group 1: ObjectUniforms (binding 0, vertex)

@group(0) @binding(1) var<storage, read> lightBuf : LightBuffer;
@group(0) @binding(2) var<uniform>       params   : FurParams;

// 2D value hash - returns a pseudo-random float in [0, 1)
fn hash21(p: vec2f) -> f32 {
  var q = fract(p * vec2f(127.1, 311.7));
  q += dot(q, q + 17.19);
  return fract(q.x * q.y);
}

@fragment
fn main(
  @location(0) worldNormal : vec3f,
  @location(1) shellT      : f32,
  @location(2) localPos    : vec3f,
  @location(3) worldPos    : vec3f,
) -> @location(0) vec4f {
  // -- UV from spherical projection --------------------------------------------
  let n       = normalize(localPos);
  let u_coord = atan2(n.z, n.x) * 0.15915 + 0.5;
  let v_coord = asin(clamp(n.y, -1.0, 1.0)) * 0.31831 + 0.5;

  // -- Hair grid (density driven by params) ------------------------------------
  let uv     = vec2f(u_coord, v_coord) * params.density;
  let cell   = floor(uv);
  let within = fract(uv);

  let cx   = 0.1 + hash21(cell) * 0.8;
  let cy   = 0.1 + hash21(cell + vec2f(37.3, 91.7)) * 0.8;
  let dist = length(within - vec2f(cx, cy));

  // Conical taper: full radius at skin, zero at tip
  let radius = 0.38 * (1.0 - shellT * shellT);
  if (shellT > 0.01 && dist > radius) { discard; }

  // -- Color (params-driven gradient) ------------------------------------------
  let furColor = mix(params.rootColor.rgb, params.tipColor.rgb, shellT);

  // Shell AO: inner shells slightly darker
  let ao = 0.4 + 0.6 * shellT;

  // -- Lighting ----------------------------------------------------------------
  let N   = normalize(worldNormal);
  var lit = vec3f(0.08);
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

  return vec4f(furColor * lit * ao, 1.0);
}
`,C=`// lights.wgsl — shared Light struct and evaluation helpers.
// Prepend this source to any fragment shader that uses the light buffer.
//
// direction convention: direction.xyz points FROM the light source TOWARD the scene.
// The shader negates it to get L (surface → light) for the dot product.

const LIGHT_DIR  : u32 = 0u;
const LIGHT_SPOT : u32 = 1u;
const LIGHT_SUN  : u32 = 2u;
const MAX_LIGHTS : u32 = 8u;

struct Light {
  posType   : vec4<f32>,  // xyz=world pos (spot), w=type (0=dir,1=spot,2=sun)
  direction : vec4<f32>,  // xyz=beam direction FROM light TOWARD scene, w=0
  color     : vec4<f32>,  // rgb=color, w=intensity
  params    : vec4<f32>,  // x=innerCos, y=outerCos, z=range (spot), w=0
}

struct LightBuffer {
  count : u32,
  _pad0 : u32,
  _pad1 : u32,
  _pad2 : u32,
  lights: array<Light, 8>,
}

fn eval_directional(lt: Light, N: vec3f) -> vec3f {
  let L = normalize(-lt.direction.xyz);            // surface → light
  return lt.color.rgb * lt.color.w * max(dot(N, L), 0.0);
}

fn eval_sun(lt: Light, N: vec3f) -> vec3f {
  let L    = normalize(-lt.direction.xyz);
  let diff = max(dot(N, L), 0.0);
  // Low elevation (sunrise/sunset) blends toward warm orange
  let elev = clamp(L.y, 0.0, 1.0);
  let tint = mix(vec3f(1.0, 0.55, 0.20), vec3f(1.0, 1.0, 1.0), elev * elev);
  return lt.color.rgb * lt.color.w * diff * tint;
}

fn eval_spot(lt: Light, N: vec3f, worldPos: vec3f) -> vec3f {
  let toLight = lt.posType.xyz - worldPos;
  let dist    = length(toLight);
  let range   = max(lt.params.z, 0.0001);
  if (dist >= range) { return vec3f(0.0); }

  let L        = toLight / dist;                   // surface → light
  let diff     = max(dot(N, L), 0.0);

  // Cone: beam axis points FROM spot TOWARD scene, so -L should align with it
  let cosAngle = dot(-L, normalize(lt.direction.xyz));
  let coneAttn = smoothstep(lt.params.y, lt.params.x, cosAngle);  // outer→inner

  // Quadratic range falloff
  let t        = 1.0 - dist / range;
  return lt.color.rgb * lt.color.w * diff * coneAttn * (t * t);
}
`,w=`// fur_params.wgsl — FurParams struct definition.
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
`,T=`rgba8unorm`,E=`rgba16float`,D=class e{device;albedoTex;normalTex;albedoView;normalView;constructor(t,n,r){this.device=t;let i=e.allocate(t,n,r);this.albedoTex=i.albedoTex,this.normalTex=i.normalTex,this.albedoView=i.albedoView,this.normalView=i.normalView}static allocate(e,t,n){let r=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING,i=e.createTexture({size:[t,n],format:T,usage:r,label:`gbuf-albedo`}),a=e.createTexture({size:[t,n],format:E,usage:r,label:`gbuf-normal`});return{albedoTex:i,normalTex:a,albedoView:i.createView(),normalView:a.createView()}}resize(t,n){this.albedoTex.destroy(),this.normalTex.destroy();let r=e.allocate(this.device,t,n);this.albedoTex=r.albedoTex,this.normalTex=r.normalTex,this.albedoView=r.albedoView,this.normalView=r.normalView}destroy(){this.albedoTex.destroy(),this.normalTex.destroy()}};async function O(e,t){let n=await createImageBitmap(e,{colorSpaceConversion:`none`}),r=k(n,t);return n.close(),r}function k(e,t){let n=t.createTexture({size:[e.width,e.height],format:`rgba8unorm`,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT,label:`skybox-cross`});return t.queue.copyExternalImageToTexture({source:e,flipY:!1},{texture:n},[e.width,e.height]),n}function A(e){let t=e.createTexture({size:[1,1],format:`rgba8unorm`,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST,label:`skybox-default`});return e.queue.writeTexture({texture:t},new Uint8Array([20,20,20,255]),{bytesPerRow:4},[1,1]),t}var j=80,M=80,N=class{gbuf;device;scene;skyUniformBuffer;lightBuffer;paramsBuffer;depthView;gbufferPL;lightingPL;furPL;sceneBuffer;gbufferSceneBG;furSceneBG;lightingBG;sampler;skyboxSampler;skyboxTex;gpuNodes=new Map;sceneData=new Float32Array(j/4);objData=new Float32Array(M/4);constructor(e){this.device=e.device,this.scene=e.scene,this.skyUniformBuffer=e.skyUniformBuffer,this.lightBuffer=e.lightBuffer,this.paramsBuffer=e.paramsBuffer,this.depthView=e.depthView,this.gbuf=new D(e.device,e.width,e.height),this.sampler=e.device.createSampler({magFilter:`nearest`,minFilter:`nearest`}),this.skyboxSampler=e.device.createSampler({magFilter:`linear`,minFilter:`linear`}),this.skyboxTex=A(e.device),this.sceneBuffer=e.device.createBuffer({size:j,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,label:`scene-uniforms`});let t=[{arrayStride:24,attributes:[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32x3`}]}],n={format:e.depthFormat,depthWriteEnabled:!0,depthCompare:`less`},r=e.shaderManager;this.gbufferPL=r.createPipeline(`gbuffer`,_,w+`
`+v,T,{bufferLayout:t,depthStencil:n,cullMode:`none`,targets:[{format:T},{format:E}]}),this.lightingPL=r.createPipeline(`deferred-light`,y,C+`
`+b,e.swapFormat),this.furPL=r.createPipeline(`fur`,w+`
`+x,w+`
`+C+`
`+S,e.swapFormat,{bufferLayout:t,depthStencil:n,cullMode:`none`}),this.gbufferSceneBG=e.device.createBindGroup({layout:this.gbufferPL.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.sceneBuffer}},{binding:1,resource:{buffer:this.paramsBuffer}}],label:`gbuffer-scene-bg`}),this.furSceneBG=e.device.createBindGroup({layout:this.furPL.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.sceneBuffer}},{binding:1,resource:{buffer:this.lightBuffer}},{binding:2,resource:{buffer:this.paramsBuffer}}],label:`fur-scene-bg`}),this.lightingBG=this.buildLightingBG()}updateSceneUniforms(e,t){this.sceneData.set(e,0),this.sceneData[16]=t,this.device.queue.writeBuffer(this.sceneBuffer,0,this.sceneData)}setSkybox(e){this.skyboxTex.destroy(),this.skyboxTex=e,this.lightingBG=this.buildLightingBG()}setDepthView(e){this.depthView=e,this.lightingBG=this.buildLightingBG()}resize(e,t){this.gbuf.resize(e,t),this.lightingBG=this.buildLightingBG()}encode(e,t,n){this.syncGPUNodes(),this.writeObjectUniforms();let r=[...this.gpuNodes.entries()].filter(([e])=>e.visible);{let t=e.beginRenderPass({colorAttachments:[{view:this.gbuf.albedoView,clearValue:{r:0,g:0,b:0,a:0},loadOp:`clear`,storeOp:`store`},{view:this.gbuf.normalView,clearValue:{r:.5,g:.5,b:1,a:1},loadOp:`clear`,storeOp:`store`}],depthStencilAttachment:{view:n,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});t.setPipeline(this.gbufferPL),t.setBindGroup(0,this.gbufferSceneBG);for(let[,e]of r)t.setBindGroup(1,e.gbufferObjBG),t.setVertexBuffer(0,e.vertexBuffer),t.setIndexBuffer(e.indexBuffer,`uint32`),t.drawIndexed(e.indexCount,1);t.end()}{let n=e.beginRenderPass({colorAttachments:[{view:t,clearValue:{r:0,g:0,b:0,a:1},loadOp:`clear`,storeOp:`store`}]});n.setPipeline(this.lightingPL),n.setBindGroup(0,this.lightingBG),n.draw(3),n.end()}{let i=e.beginRenderPass({colorAttachments:[{view:t,loadOp:`load`,storeOp:`store`}],depthStencilAttachment:{view:n,depthLoadOp:`load`,depthStoreOp:`store`}});i.setPipeline(this.furPL),i.setBindGroup(0,this.furSceneBG);for(let[e,t]of r){let n=Math.max(1,Math.floor(e.numShells)-1);i.setBindGroup(1,t.furObjBG),i.setVertexBuffer(0,t.vertexBuffer),i.setIndexBuffer(t.indexBuffer,`uint32`),i.drawIndexed(t.indexCount,n)}i.end()}}destroy(){this.gbuf.destroy(),this.skyboxTex.destroy(),this.sceneBuffer.destroy();for(let e of this.gpuNodes.values())this.destroyGPUNode(e);this.gpuNodes.clear()}syncGPUNodes(){let e=this.scene.nodes;for(let t of e){let e=this.gpuNodes.get(t);e?t.geometryDirty&&=(this.rebuildGeometry(t,e),!1):(this.gpuNodes.set(t,this.createGPUNode(t)),t.geometryDirty=!1)}let t=new Set(e);for(let[e,n]of this.gpuNodes)t.has(e)||(this.destroyGPUNode(n),this.gpuNodes.delete(e))}createGPUNode(e){let t=this.uploadBuffer(e.geometry.vertices,GPUBufferUsage.VERTEX),n=this.uploadBuffer(e.geometry.indices,GPUBufferUsage.INDEX),r=this.device.createBuffer({size:M,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,label:`${e.name}-obj-uniforms`}),i=this.device.createBindGroup({layout:this.gbufferPL.getBindGroupLayout(1),entries:[{binding:0,resource:{buffer:r}}],label:`${e.name}-gbuf-obj-bg`}),a=this.device.createBindGroup({layout:this.furPL.getBindGroupLayout(1),entries:[{binding:0,resource:{buffer:r}}],label:`${e.name}-fur-obj-bg`});return{vertexBuffer:t,indexBuffer:n,indexCount:e.geometry.indices.length,objectBuffer:r,gbufferObjBG:i,furObjBG:a,geometry:e.geometry}}rebuildGeometry(e,t){t.vertexBuffer.destroy(),t.indexBuffer.destroy(),t.vertexBuffer=this.uploadBuffer(e.geometry.vertices,GPUBufferUsage.VERTEX),t.indexBuffer=this.uploadBuffer(e.geometry.indices,GPUBufferUsage.INDEX),t.indexCount=e.geometry.indices.length,t.geometry=e.geometry}destroyGPUNode(e){e.vertexBuffer.destroy(),e.indexBuffer.destroy(),e.objectBuffer.destroy()}writeObjectUniforms(){for(let[e,t]of this.gpuNodes)e.visible&&(this.objData.set(e.getModelMatrix(),0),this.objData[16]=e.numShells,this.objData[17]=e.furLength,this.objData[18]=1,this.device.queue.writeBuffer(t.objectBuffer,0,this.objData))}uploadBuffer(e,t){let n=e.byteLength+3&-4,r=this.device.createBuffer({size:n,usage:t,mappedAtCreation:!0});return new Uint8Array(r.getMappedRange()).set(new Uint8Array(e.buffer,e.byteOffset,e.byteLength)),r.unmap(),r}buildLightingBG(){return this.device.createBindGroup({layout:this.lightingPL.getBindGroupLayout(0),entries:[{binding:0,resource:this.gbuf.albedoView},{binding:1,resource:this.gbuf.normalView},{binding:2,resource:this.sampler},{binding:3,resource:this.skyboxTex.createView()},{binding:4,resource:this.skyboxSampler},{binding:5,resource:{buffer:this.skyUniformBuffer}},{binding:6,resource:{buffer:this.lightBuffer}},{binding:7,resource:this.depthView}],label:`lighting-bg`})}},P=`// debug_blit.frag.wgsl\r
// Reads one texture and outputs it directly — used to display G-Buffer views\r
// as thumbnail overlays.  Values already in [0,1] (albedo rgba8, normal rgba16f\r
// packed to [0,1]) so no tone-mapping is needed.\r
\r
@group(0) @binding(0) var blitTex  : texture_2d<f32>;\r
@group(0) @binding(1) var blitSamp : sampler;\r
\r
@fragment\r
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {\r
  return vec4f(textureSample(blitTex, blitSamp, uv).rgb, 1.0);\r
}\r
`,F=`// debug_depth.frag.wgsl\r
// Visualizes the depth buffer as a linearized grayscale thumbnail.\r
// near/far match main.ts: perspectiveMatrix(PI/4, aspect, 0.1, 100)\r
\r
@group(0) @binding(0) var depthTex: texture_depth_2d;\r
\r
@fragment\r
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {\r
  let dims  = vec2f(textureDimensions(depthTex, 0));\r
  let coord = vec2i(clamp(uv * dims, vec2f(0.0), dims - 1.0));\r
  let d     = textureLoad(depthTex, coord, 0);\r
\r
  // Linearize perspective depth: NDC [0,1] -> view-space [near,far]\r
  let near = 0.1;\r
  let far  = 100.0;\r
  let lin  = (near * far) / (far - d * (far - near));\r
  let t    = clamp(lin / far, 0.0, 1.0);\r
\r
  return vec4f(t, t, t, 1.0);\r
}\r
`,I=5,L=10,R=class{canvas;dpr;device;blitPL;depthPL;sampler;albedoBG;normalBG;depthBG=null;fpsFrames=0;fpsElapsed=0;fpsEl;_visible=!1;get visible(){return this._visible}constructor(e){this.canvas=e.canvas,this.dpr=e.dpr,this.device=e.device,this.sampler=e.device.createSampler({magFilter:`linear`,minFilter:`linear`}),this.blitPL=e.shaderManager.createPipeline(`debug-blit`,y,P,e.swapFormat),this.depthPL=e.shaderManager.createPipeline(`debug-depth`,y,F,e.swapFormat),this.fpsEl=document.getElementById(`dbg-fps`),this.albedoBG=this.makeBG(e.initialGbuf.albedoView,`blit-albedo-bg`),this.normalBG=this.makeBG(e.initialGbuf.normalView,`blit-normal-bg`),document.addEventListener(`keydown`,e=>{e.key==="`"&&this.toggle()})}toggle(){this._visible=!this._visible,document.body.classList.toggle(`dbg-visible`,this._visible),this._visible&&this.positionLabels()}makeBG(e,t){return this.device.createBindGroup({layout:this.blitPL.getBindGroupLayout(0),entries:[{binding:0,resource:e},{binding:1,resource:this.sampler}],label:t})}makeDepthBG(e){return this.device.createBindGroup({layout:this.depthPL.getBindGroupLayout(0),entries:[{binding:0,resource:e}],label:`blit-depth-bg`})}setDepthView(e){this.depthBG=this.makeDepthBG(e)}onGBufferResize(e){this.albedoBG=this.makeBG(e.albedoView,`blit-albedo-bg`),this.normalBG=this.makeBG(e.normalView,`blit-normal-bg`),this._visible&&this.positionLabels()}updateFPS(e){this.fpsFrames+=1,this.fpsElapsed+=e,this.fpsElapsed>=1&&(this.fpsEl&&(this.fpsEl.textContent=`FPS: ${Math.round(this.fpsFrames/this.fpsElapsed)}`),this.fpsFrames=0,this.fpsElapsed=0)}encode(e,t,n,r){if(!this._visible)return;let i=Math.round(L*this.dpr),a=Math.floor(n/I),o=Math.floor(r/I),s=r-o-i,c=e.beginRenderPass({colorAttachments:[{view:t,loadOp:`load`,storeOp:`store`}]});c.setPipeline(this.blitPL),c.setViewport(i,s,a,o,0,1),c.setBindGroup(0,this.albedoBG),c.draw(3),c.setViewport(i+a+i,s,a,o,0,1),c.setBindGroup(0,this.normalBG),c.draw(3),this.depthBG&&(c.setPipeline(this.depthPL),c.setViewport(i+(a+i)*2,s,a,o,0,1),c.setBindGroup(0,this.depthBG),c.draw(3)),c.end()}positionLabels(){let e=this.canvas.getBoundingClientRect(),t=e.width/I,n=e.height/I,r=L,i=(e,i,a)=>{let o=document.getElementById(e),s=document.getElementById(i);o&&(o.style.left=`${a}px`,o.style.bottom=`${r}px`,o.style.width=`${t}px`,o.style.height=`${n}px`),s&&(s.style.left=`${a}px`,s.style.bottom=`${r+n}px`)};i(`dbg-border-albedo`,`dbg-label-albedo`,r),i(`dbg-border-normal`,`dbg-label-normal`,r+t+r),i(`dbg-border-depth`,`dbg-label-depth`,r+(t+r)*2)}};function z(e){let t=[],n=[],r=[],i=[],a=new Map,o=!1;for(let s of e.split(`
`)){let e=s.trim();if(!e||e[0]===`#`)continue;let c=e.split(/\s+/),l=c[0];if(l===`v`)t.push(+c[1],+c[2],+c[3]);else if(l===`vn`)n.push(+c[1],+c[2],+c[3]),o=!0;else if(l===`f`){let e=[];for(let i=1;i<c.length;i++){let o=c[i].split(`/`),s=B(+o[0],t.length/3),l=o[2]?B(+o[2],n.length/3):-1,u=`${s}_${l}`,d=a.get(u);if(d===void 0){d=r.length/6;let e=s*3;if(r.push(t[e],t[e+1],t[e+2]),l>=0){let e=l*3;r.push(n[e],n[e+1],n[e+2])}else r.push(0,1,0);a.set(u,d)}e.push(d)}for(let t=1;t<e.length-1;t++)i.push(e[0],e[t],e[t+1])}}let s=new Float32Array(r),c=new Uint32Array(i);return o||V(s,c),{vertices:s,indices:c,stride:24}}function B(e,t){return e<0?t+e:e-1}function V(e,t){let n=new Float32Array(e.length/6*3);for(let r=0;r<t.length;r+=3){let i=t[r],a=t[r+1],o=t[r+2],s=i*6,c=a*6,l=o*6,u=e[c]-e[s],d=e[c+1]-e[s+1],f=e[c+2]-e[s+2],p=e[l]-e[s],m=e[l+1]-e[s+1],h=e[l+2]-e[s+2],g=d*h-f*m,_=f*p-u*h,v=u*m-d*p;for(let e of[i,a,o])n[e*3]+=g,n[e*3+1]+=_,n[e*3+2]+=v}for(let t=0;t<e.length/6;t++){let r=t*3,i=Math.sqrt(n[r]**2+n[r+1]**2+n[r+2]**2),a=t*6+3;i>0?(e[a]=n[r]/i,e[a+1]=n[r+1]/i,e[a+2]=n[r+2]/i):(e[a]=0,e[a+1]=1,e[a+2]=0)}}var H=5121,U=5123,W=5125,G={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};function K(e){let t=new DataView(e);if(t.getUint32(0,!0)!==1179937895)throw Error(`Not a valid GLB file (bad magic)`);let n=t.getUint32(4,!0);if(n!==2)throw Error(`Unsupported glTF version: ${n}`);let r=12,i=null,a=null;for(;r<e.byteLength;){let n=t.getUint32(r,!0),o=t.getUint32(r+4,!0);r+=8,o===1313821514?i=e.slice(r,r+n):o===5130562&&(a=e.slice(r,r+n)),r+=n}if(!i)throw Error(`GLB has no JSON chunk`);if(!a)throw Error(`GLB has no BIN chunk`);let o=JSON.parse(new TextDecoder().decode(i));if(!o.meshes?.length)throw Error(`GLB contains no meshes`);let s;outer:for(let e of o.meshes)for(let t of e.primitives)if(t.attributes.POSITION!==void 0){s=t;break outer}if(!s)throw Error(`GLB has no mesh primitive with POSITION`);let c=q(o,a,s.attributes.POSITION),l=s.attributes.NORMAL!==void 0,u=l?q(o,a,s.attributes.NORMAL):null,d=s.indices===void 0?Y(c.length/3):J(o,a,s.indices),f=c.length/3,p=new Float32Array(f*6);for(let e=0;e<f;e++){let t=e*3,n=e*6;p[n]=c[t],p[n+1]=c[t+1],p[n+2]=c[t+2],u&&(p[n+3]=u[t],p[n+4]=u[t+1],p[n+5]=u[t+2])}return l||X(p,d),{vertices:p,indices:d,stride:24}}function q(e,t,n){let r=e.accessors[n],i=e.bufferViews[r.bufferView??0],a=G[r.type]??1,o=r.count,s=i.byteOffset??0,c=r.byteOffset??0,l=i.byteStride??a*4,u=new Float32Array(o*a),d=new DataView(t);for(let e=0;e<o;e++){let t=s+c+e*l;for(let n=0;n<a;n++)u[e*a+n]=d.getFloat32(t+n*4,!0)}return u}function J(e,t,n){let r=e.accessors[n],i=e.bufferViews[r.bufferView??0].byteOffset??0,a=r.byteOffset??0,o=r.count,s=new DataView(t),c=new Uint32Array(o),l=r.componentType===H?1:r.componentType===U?2:4;for(let e=0;e<o;e++){let t=i+a+e*l;r.componentType===H?c[e]=s.getUint8(t):r.componentType===U?c[e]=s.getUint16(t,!0):r.componentType===W&&(c[e]=s.getUint32(t,!0))}return c}function Y(e){let t=new Uint32Array(e);for(let n=0;n<e;n++)t[n]=n;return t}function X(e,t){let n=new Float32Array(e.length/6*3);for(let r=0;r<t.length;r+=3){let i=t[r],a=t[r+1],o=t[r+2],s=i*6,c=a*6,l=o*6,u=e[c]-e[s],d=e[c+1]-e[s+1],f=e[c+2]-e[s+2],p=e[l]-e[s],m=e[l+1]-e[s+1],h=e[l+2]-e[s+2],g=d*h-f*m,_=f*p-u*h,v=u*m-d*p;for(let e of[i,a,o])n[e*3]+=g,n[e*3+1]+=_,n[e*3+2]+=v}for(let t=0;t<e.length/6;t++){let r=t*3,i=Math.sqrt(n[r]**2+n[r+1]**2+n[r+2]**2),a=t*6+3;i>0?(e[a]=n[r]/i,e[a+1]=n[r+1]/i,e[a+2]=n[r+2]/i):(e[a]=0,e[a+1]=1,e[a+2]=0)}}async function Z(e){let t=e.name.toLowerCase();if(t.endsWith(`.obj`))return Q(z(await e.text()));if(t.endsWith(`.glb`))return Q(K(await e.arrayBuffer()));throw Error(`Unsupported format: "${e.name}". Accepted: .obj  .glb`)}function Q(e){let t=1/0,n=1/0,r=1/0,i=-1/0,a=-1/0,o=-1/0;for(let s=0;s<e.vertices.length;s+=6){let c=e.vertices[s],l=e.vertices[s+1],u=e.vertices[s+2];c<t&&(t=c),c>i&&(i=c),l<n&&(n=l),l>a&&(a=l),u<r&&(r=u),u>o&&(o=u)}let s=(t+i)/2,c=(n+a)/2,l=(r+o)/2,u=Math.max(i-t,a-n,o-r),d=u>0?2/u:1,f=new Float32Array(e.vertices);for(let e=0;e<f.length;e+=6)f[e]=(f[e]-s)*d,f[e+1]=(f[e+1]-c)*d,f[e+2]=(f[e+2]-l)*d;return{vertices:f,indices:e.indices,stride:e.stride}}var ee=class{onLoad;btnEl;nameEl;inputEl;hintEl;constructor(e,t){this.onLoad=t,this.btnEl=document.getElementById(`model-btn`),this.nameEl=document.getElementById(`model-name`),this.inputEl=document.getElementById(`model-input`),this.hintEl=document.getElementById(`drop-hint`),this.btnEl?.addEventListener(`click`,()=>this.inputEl?.click()),this.inputEl?.addEventListener(`change`,()=>{let e=this.inputEl?.files?.[0];e&&this.handleFile(e)}),e.addEventListener(`dragover`,e=>{e.preventDefault(),this.hintEl?.classList.add(`active`)}),e.addEventListener(`dragleave`,()=>this.hintEl?.classList.remove(`active`)),e.addEventListener(`drop`,e=>{e.preventDefault(),this.hintEl?.classList.remove(`active`);let t=e.dataTransfer?.files[0];t&&this.handleFile(t)})}async handleFile(e){this.setLoading(!0,`Loading…`);try{let t=await Z(e);this.setLoading(!1,e.name),this.onLoad(t,e.name)}catch(e){let t=e.message;this.setLoading(!1,`Error: ${t}`),console.error(`[ModelDropZone]`,e)}}setLoading(e,t){this.btnEl&&(this.btnEl.disabled=e),this.nameEl&&(this.nameEl.textContent=t),document.body.classList.toggle(`model-loading`,e)}},te=class{device;lights=[];buffer;constructor(e){this.device=e,this.buffer=e.createBuffer({size:528,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST,label:`light-buffer`})}addDirectional(e,t,n){return this.push({type:`directional`,direction:e,color:t,intensity:n,enabled:!0})}addSun(e,t,n){return this.push({type:`sun`,direction:e,color:t,intensity:n,enabled:!0})}addSpot(e,t,n,r,i,a,o){return this.push({type:`spot`,position:e,direction:t,innerAngleDeg:n,outerAngleDeg:r,range:i,color:a,intensity:o,enabled:!0})}setEnabled(e,t){e>=0&&e<this.lights.length&&(this.lights[e].enabled=t)}upload(){let e=new ArrayBuffer(528),t=new Uint32Array(e),n=new Float32Array(e),r=this.lights.filter(e=>e.enabled);t[0]=r.length,r.forEach((e,t)=>{let r=4+t*16,i=e.type===`directional`?0:e.type===`spot`?1:2;e.type===`spot`&&(n[r+0]=e.position[0],n[r+1]=e.position[1],n[r+2]=e.position[2]),n[r+3]=i;let[a,o,s]=e.direction,c=Math.hypot(a,o,s)||1;n[r+4]=a/c,n[r+5]=o/c,n[r+6]=s/c,n[r+8]=e.color[0],n[r+9]=e.color[1],n[r+10]=e.color[2],n[r+11]=e.intensity,e.type===`spot`&&(n[r+12]=Math.cos(e.innerAngleDeg*Math.PI/180),n[r+13]=Math.cos(e.outerAngleDeg*Math.PI/180),n[r+14]=e.range)}),this.device.queue.writeBuffer(this.buffer,0,e)}getBuffer(){return this.buffer}destroy(){this.buffer.destroy()}push(e){return this.lights.length>=8?(console.warn(`[LightManager] Max 8 lights — ignoring`),-1):(this.lights.push(e),this.lights.length-1)}},ne=class{density=22;gravity=.07;windStr=1;windSpd=1;rootColor=[.8,.8,.8];tipColor=[.9,.7,.35];skinColor=[.2,.1,.04];bumpStr=4;bumpScale=6;buffer;device;data=new Float32Array(20);constructor(e){this.device=e,this.buffer=e.createBuffer({size:80,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,label:`fur-params`}),this.upload()}upload(){let e=this.data;e[0]=this.density,e[1]=this.gravity,e[2]=this.windStr,e[3]=this.windSpd,e[4]=this.rootColor[0],e[5]=this.rootColor[1],e[6]=this.rootColor[2],e[7]=1,e[8]=this.tipColor[0],e[9]=this.tipColor[1],e[10]=this.tipColor[2],e[11]=1,e[12]=this.skinColor[0],e[13]=this.skinColor[1],e[14]=this.skinColor[2],e[15]=1,e[16]=this.bumpStr,e[17]=this.bumpScale,this.device.queue.writeBuffer(this.buffer,0,this.data)}destroy(){this.buffer.destroy()}},$=96;async function re(){let e=document.querySelector(`#webgpu-canvas`);if(!e){console.error(`Canvas not found`);return}let t=new r({canvas:e,backgroundColor:[.05,.05,.08,1]});await t.initialize();let n=t.getDevice(),s=n.getDevice(),c=window.devicePixelRatio??1;{let t=e.getBoundingClientRect();n.resizeCanvas(Math.max(1,Math.floor(t.width*c)),Math.max(1,Math.floor(t.height*c)))}console.log(`[WebGPU] Canvas:`,e.width,`x`,e.height);let u=n.createUniformBuffer($,`sky-uniforms`),d=new ArrayBuffer($),p=new Float32Array(d),h=new Uint32Array(d);h[20]=0;let _=new te(s);_.addSun([1,-2,1.5],[1,1,1],.8),_.addSpot([3,4,3],[-1,-1.3,-1],20,35,12,[.6,.8,1],6),_.upload(),console.log(`[Lights] Sun + spot initialized`);let v=new ne(s),y=new g,b=f(1,48,24),x=y.add(`Sphere`,b,{numShells:32,furLength:.2});console.log(`[Scene] Default sphere added —`,b.indices.length/3,`triangles`);let{width:S,height:C}=n.getCanvasSize(),w=new N({device:s,scene:y,skyUniformBuffer:u,lightBuffer:_.getBuffer(),paramsBuffer:v.buffer,depthView:n.getDepthTextureView(),shaderManager:t.getShaderManager(),swapFormat:n.getFormat(),depthFormat:n.depthFormat,width:S,height:C}),T=new R({canvas:e,dpr:c,device:s,shaderManager:t.getShaderManager(),swapFormat:n.getFormat(),initialGbuf:w.gbuf});T.setDepthView(n.getDepthTextureView());let E=document.getElementById(`dbg-shells`);E&&(E.textContent=`Shells: 1 deferred + ${x.numShells-1} forward`),new ee(e,(e,t)=>{x.geometry=e,console.log(`[Model] Loaded "${t}" — ${e.indices.length/3} triangles`)});let D=document.getElementById(`sky-btn`),k=document.getElementById(`sky-input`),A=document.getElementById(`sky-name`);D&&k&&(D.addEventListener(`click`,()=>k.click()),k.addEventListener(`change`,async()=>{let e=k.files?.[0];if(e){A&&(A.textContent=`loading…`);try{let t=await O(e,s);w.setSkybox(t),h[20]=1,A&&(A.textContent=e.name),console.log(`[Skybox] Loaded "${e.name}"`)}catch(e){console.error(`[Skybox] Load failed:`,e),A&&(A.textContent=`load failed`)}k.value=``}})),t.addResizeListener((e,t)=>{w.resize(e,t),w.setDepthView(n.getDepthTextureView()),T.onGBufferResize(w.gbuf),T.setDepthView(n.getDepthTextureView())});let j=new m(e,{elevation:.15,radius:3.5}),M=0;function P(e){let t=parseInt(e.slice(1),16);return[(t>>16&255)/255,(t>>8&255)/255,(t&255)/255]}function F(e,t){let n=document.getElementById(e);n&&n.addEventListener(`input`,()=>{t(parseFloat(n.value)),v.upload()})}function I(e,t){let n=document.getElementById(e);n&&n.addEventListener(`input`,()=>{t(P(n.value)),v.upload()})}F(`fp-shells`,e=>{x.numShells=Math.round(e)}),F(`fp-furlength`,e=>{x.furLength=e}),F(`fp-density`,e=>{v.density=e}),F(`fp-gravity`,e=>{v.gravity=e}),F(`fp-windstr`,e=>{v.windStr=e}),F(`fp-windspd`,e=>{v.windSpd=e}),F(`fp-bumpstr`,e=>{v.bumpStr=e}),F(`fp-bumpscale`,e=>{v.bumpScale=e}),I(`fp-rootcolor`,e=>{v.rootColor=e}),I(`fp-tipcolor`,e=>{v.tipColor=e}),I(`fp-skincolor`,e=>{v.skinColor=e}),window.addEventListener(`keydown`,e=>{(e.key===`p`||e.key===`P`)&&document.body.classList.toggle(`fp-visible`)}),t.start(e=>{M+=e,T.updateFPS(e);let{width:r,height:c}=n.getCanvasSize(),f=j.getEye(),m=o(f,j.getTarget(),[0,1,0]),h=i(a(Math.PI/4,r/c,.1,100),m);w.updateSceneUniforms(h,M);let g=l(h);p.set(g,0),p[16]=f[0],p[17]=f[1],p[18]=f[2],p[19]=0,s.queue.writeBuffer(u,0,d);let _=s.createCommandEncoder({label:`frame`}),v=n.getCurrentTexture().createView(),y=n.getDepthTextureView();w.encode(_,v,y),T.encode(_,v,r,c),t.submitCommands(_.finish())})}document.addEventListener(`DOMContentLoaded`,re);