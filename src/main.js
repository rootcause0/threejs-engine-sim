import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { V8Engine } from './engine/engine.js';
import { createWorkshop, createLighting } from './world/workshop.js';
import { CameraRig } from './camera/CameraRig.js';
import { UI } from './ui/ui.js';

/* ------------------------------------------------------------------ *
 *  Renderer
 * ------------------------------------------------------------------ */
const container = document.querySelector('#viewport');
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  stencil: false,
});
const DPR = Math.min(window.devicePixelRatio || 1, 1.8);
renderer.setPixelRatio(DPR);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.96;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);
renderer.domElement.tabIndex = 0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0c0d);
scene.fog = new THREE.FogExp2(0x0b0e10, 0.0125);

const camera = new THREE.PerspectiveCamera(43, window.innerWidth / window.innerHeight, 0.1, 140);

/* ------------------------------------------------------------------ *
 *  Environment
 * ------------------------------------------------------------------ */
const pmrem = new THREE.PMREMGenerator(renderer);
const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
scene.environment = envRT.texture;
scene.environmentIntensity = 0.3;
pmrem.dispose();

const workshop = createWorkshop(scene);
const lights = createLighting(scene, renderer);

/* ------------------------------------------------------------------ *
 *  Engine + test cell
 * ------------------------------------------------------------------ */
const engine = new V8Engine(scene);
const rig = new CameraRig(camera, renderer.domElement, {
  room: workshop.room,
  onModeChange: (mode) => {
    // handled by UI.setMode; this fires for programmatic mode changes too
    document.body.classList.toggle('walking', mode === 'walk');
  },
});
const ui = new UI(engine, rig, engine.stand);

// gentle intro sweep
rig.orbit.theta -= 0.4;
rig.orbit.phi += 0.05;
rig.orbit.radius = 22;

/* ------------------------------------------------------------------ *
 *  Post-processing
 * ------------------------------------------------------------------ */
const size = new THREE.Vector2(window.innerWidth, window.innerHeight);
// 8-bit MSAA target: HalfFloat render targets come back black on some
// Metal/ANGLE drivers (verified headless), and the scene is tone mapped
// before the target anyway, so 8 bits per channel is all we need.
const rt = new THREE.WebGLRenderTarget(
  Math.floor(window.innerWidth * DPR),
  Math.floor(window.innerHeight * DPR),
  { type: THREE.UnsignedByteType, samples: 4 }
);
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(size, 0.15, 0.62, 1.35);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ------------------------------------------------------------------ *
 *  Interaction — part picking
 * ------------------------------------------------------------------ */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const pickables = [engine.group, engine.stand.root];

function pick(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickables, true);
  for (const hit of hits) {
    const mat = hit.object.material;
    if (mat && mat.transparent && mat.opacity < 0.35) continue;
    let node = hit.object;
    while (node && !node.userData.partId) node = node.parent;
    if (node?.userData.partId) return engine.getPart(node.userData.partId);
  }
  return null;
}

let down = null;
const canvas = renderer.domElement;

canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  down = {
    x: e.clientX,
    y: e.clientY,
    locked: rig.pointerLocked,
    mode: rig.mode,
  };
});

canvas.addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  const captureClick = down.mode === 'walk' && !down.locked;
  down = null;
  if (moved > 5 || rig.dragMoved || captureClick) return;
  const part = pick(e.clientX, e.clientY);
  if (part) ui.selectPart(part);
  else ui.clearSelection();
});

let hoverAt = 0;
canvas.addEventListener('pointermove', (e) => {
  const now = performance.now();
  if (now - hoverAt < 90) return;
  hoverAt = now;
  if (rig.dragMoved || rig.pointerLocked) return;
  const part = pick(e.clientX, e.clientY);
  if (rig.mode === 'walk') canvas.style.cursor = 'crosshair';
  else canvas.style.cursor = part ? 'pointer' : 'grab';
});

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    canvas.style.cursor = 'none';
    ui.toast('MOUSE CAPTURED · ESC TO RELEASE');
  } else {
    canvas.style.cursor = rig.mode === 'walk' ? 'crosshair' : 'grab';
  }
});

/* ------------------------------------------------------------------ *
 *  Resize + loop
 * ------------------------------------------------------------------ */
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  lights.key.shadow.mapSize.set(
    w > 1500 ? 2048 : 1024,
    w > 1500 ? 2048 : 1024
  );
}
window.addEventListener('resize', onResize);

const timer = new THREE.Timer();
timer.connect(document);
let frames = 0;
let paused = false;

function animate(timestamp) {
  timer.update(timestamp);
  const dt = Math.min(timer.getDelta(), 0.05);

  if (!paused) {
    rig.update(dt);
    const tel = engine.update(dt, ui.state);
    ui.update(tel, dt);

    composer.render();

    if (frames === 2) document.body.classList.add('ready');
    frames++;
  }

  requestAnimationFrame(animate);
}

// start with a considered first frame before the fade-in
rig.update(0.016);
engine.update(0.016, ui.state);
composer.render();
requestAnimationFrame(animate);

/* ------------------------------------------------------------------ *
 *  Debug / automation hook
 * ------------------------------------------------------------------ */
window.v8 = {
  engine,
  ui,
  rig,
  camera,
  scene,
  renderer,
  composer,
  lights,
  setView: (n) => {
    rig.setView(n);
    ui.setModeButtons('orbit');
  },
  pause: () => {
    paused = true;
  },
  resume: () => {
    paused = false;
    timer.reset();
  },
  frame: (dt = 0.016) => {
    rig.update(dt);
    const tel = engine.update(dt, ui.state);
    ui.update(tel, dt);
    composer.render();
  },
  renderDirect: () => {
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  },
  info: () => ({
    calls: renderer.info.render.calls,
    tris: renderer.info.render.triangles,
    cam: camera.position.toArray(),
    orbit: { theta: rig.orbit.theta, phi: rig.orbit.phi, radius: rig.orbit.radius },
    shot: [renderer.domElement.width, renderer.domElement.height],
  }),
  ready: false,
};
