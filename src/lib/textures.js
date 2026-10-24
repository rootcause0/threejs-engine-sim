import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 *  Deterministic procedural textures — everything is generated at
 *  runtime, nothing is downloaded.
 * ------------------------------------------------------------------ */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

/** Fine multi-octave value noise, used as a bump map for cast metal. */
export function makeNoiseTexture({ size = 256, seed = 7, scale = 18, octaves = 4, contrast = 0.55 } = {}) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  const grid = [];
  for (let o = 0; o < octaves; o++) {
    const n = scale * 2 ** o;
    const field = new Float32Array(n * n);
    for (let i = 0; i < field.length; i++) field[i] = rnd();
    grid.push({ n, field });
  }
  const img = ctx.createImageData(size, size);
  const smooth = (t) => t * t * (3 - 2 * t);
  const sample = (field, n, x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = smooth(x - xi), fy = smooth(y - yi);
    const x0 = ((xi % n) + n) % n, y0 = ((yi % n) + n) % n;
    const x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
    const a = field[y0 * n + x0], b = field[y0 * n + x1];
    const cc = field[y1 * n + x0], d = field[y1 * n + x1];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (cc * (1 - fx) + d * fx) * fy;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0, amp = 0.5, tot = 0;
      for (let o = 0; o < octaves; o++) {
        const { n, field } = grid[o];
        v += sample(field, n, (x / size) * n * 2, (y / size) * n * 2) * amp;
        tot += amp;
        amp *= 0.5;
      }
      v /= tot;
      const g = Math.max(0, Math.min(255, (0.5 + (v - 0.5) * contrast * 2) * 255));
      const i = (y * size + x) * 4;
      img.data[i] = g;
      img.data[i + 1] = g;
      img.data[i + 2] = g;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Brushed-metal streaks used as a roughness map. */
export function makeBrushedTexture({ size = 512, seed = 21 } = {}) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  ctx.fillStyle = '#8a8a8a';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 4200; i++) {
    const y = Math.floor(rnd() * size);
    const v = 110 + Math.floor(rnd() * 90);
    ctx.strokeStyle = `rgba(${v},${v},${v},${0.25 + rnd() * 0.35})`;
    ctx.lineWidth = rnd() < 0.15 ? 2 : 1;
    const x = rnd() * size;
    const len = 60 + rnd() * 320;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (rnd() - 0.5) * 1.5);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

/** Concrete slab: mottled albedo plus matching roughness. */
export function makeConcreteTextures({ size = 1024, seed = 91 } = {}) {
  const albedo = canvas(size);
  const rough = canvas(size);
  const a = albedo.getContext('2d');
  const r = rough.getContext('2d');
  const rnd = mulberry32(seed);

  a.fillStyle = '#6d6c68';
  a.fillRect(0, 0, size, size);
  r.fillStyle = '#c8c8c8';
  r.fillRect(0, 0, size, size);

  // large soft mottling
  for (let i = 0; i < 240; i++) {
    const x = rnd() * size, y = rnd() * size, rad = 30 + rnd() * 190;
    const g = a.createRadialGradient(x, y, 0, x, y, rad);
    const light = rnd() > 0.5;
    const v = Math.floor((light ? 125 : 82) + rnd() * 22);
    g.addColorStop(0, `rgba(${v},${v - 1},${v - 4},${0.05 + rnd() * 0.12})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    a.fillStyle = g;
    a.beginPath();
    a.arc(x, y, rad, 0, Math.PI * 2);
    a.fill();
  }
  // fine aggregate
  for (let i = 0; i < 26000; i++) {
    const x = rnd() * size, y = rnd() * size;
    const s = 0.5 + rnd() * 1.9;
    const v = Math.floor(58 + rnd() * 90);
    a.fillStyle = `rgba(${v},${v},${v - 2},${0.12 + rnd() * 0.3})`;
    a.fillRect(x, y, s, s);
    if (rnd() < 0.4) {
      const rv = Math.floor(120 + rnd() * 100);
      r.fillStyle = `rgba(${rv},${rv},${rv},0.25)`;
      r.fillRect(x, y, s * 1.4, s * 1.4);
    }
  }
  // oil / water stains
  for (let i = 0; i < 12; i++) {
    const x = rnd() * size, y = rnd() * size, rad = 30 + rnd() * 90;
    const g = a.createRadialGradient(x, y, rad * 0.2, x, y, rad);
    g.addColorStop(0, `rgba(30,28,24,${0.05 + rnd() * 0.1})`);
    g.addColorStop(1, 'rgba(30,28,24,0)');
    a.fillStyle = g;
    a.beginPath();
    a.arc(x, y, rad, 0, Math.PI * 2);
    a.fill();
    const rg = r.createRadialGradient(x, y, rad * 0.2, x, y, rad);
    rg.addColorStop(0, 'rgba(70,70,70,0.35)');
    rg.addColorStop(1, 'rgba(70,70,70,0)');
    r.fillStyle = rg;
    r.beginPath();
    r.arc(x, y, rad, 0, Math.PI * 2);
    r.fill();
  }
  // saw-cut expansion joints
  a.strokeStyle = 'rgba(38,37,34,0.85)';
  a.lineWidth = 5;
  a.beginPath();
  a.moveTo(0, size / 2);
  a.lineTo(size, size / 2);
  a.moveTo(size / 2, 0);
  a.lineTo(size / 2, size);
  a.stroke();

  const map = new THREE.CanvasTexture(albedo);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 16;

  const roughness = new THREE.CanvasTexture(rough);
  roughness.wrapS = roughness.wrapT = THREE.RepeatWrapping;
  roughness.anisotropy = 8;

  return { map, roughness };
}

/** Painted / panelled workshop wall. */
export function makeWallTextures({ size = 512, seed = 33, base = '#3a3d3d' } = {}) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 5000; i++) {
    const x = rnd() * size, y = rnd() * size;
    const v = 40 + Math.floor(rnd() * 34);
    ctx.fillStyle = `rgba(${v},${v + 2},${v + 1},${rnd() * 0.16})`;
    ctx.fillRect(x, y, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  // horizontal panel seams
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  for (let y = 0; y < size; y += size / 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.beginPath();
    ctx.moveTo(0, y + 2);
    ctx.lineTo(size, y + 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  }
  const g = ctx.createLinearGradient(0, size * 0.62, 0, size);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

/** Corrugated roller-shutter door. */
export function makeDoorTexture({ size = 512 } = {}) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const grd = ctx.createLinearGradient(0, 0, 0, size / 8);
  grd.addColorStop(0, '#4b4f50');
  grd.addColorStop(0.45, '#5b6061');
  grd.addColorStop(0.55, '#3b3f40');
  grd.addColorStop(1, '#2c2f30');
  for (let y = 0; y < size; y += size / 8) {
    ctx.save();
    ctx.translate(0, y);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size / 8);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, size / 8 - 2, size, 2);
    ctx.restore();
  }
  const rnd = mulberry32(5);
  for (let i = 0; i < 1200; i++) {
    ctx.fillStyle = `rgba(255,255,255,${rnd() * 0.035})`;
    ctx.fillRect(rnd() * size, rnd() * size, rnd() * 30, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

/** Transparent decal texture: wordmark for the cam covers / signage. */
export function makeTextTexture(lines, {
  width = 1024,
  height = 256,
  color = '#e8e6e0',
  font = '600 120px "Helvetica Neue", Arial, sans-serif',
  subFont = '400 44px "SF Mono", monospace',
  align = 'center',
  bg = null,
} = {}) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  const x = align === 'center' ? width / 2 : 36;
  let y = height / 2;
  if (lines.length > 1) y = height * 0.42;
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.fillText(lines[0], x, y);
  if (lines[1]) {
    ctx.font = subFont;
    ctx.globalAlpha = 0.72;
    ctx.fillText(lines[1], x, y + height * 0.24);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Small LCD / instrument screen face. Rendered mostly by UI canvas. */
export function makeScreenTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 320;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { canvas: c, ctx: c.getContext('2d'), texture: tex };
}
