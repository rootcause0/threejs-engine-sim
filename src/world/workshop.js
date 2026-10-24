import * as THREE from 'three';
import {
  chamferedCylinder,
  chamferedTube,
  mesh,
  RoundedBoxGeometry,
  tubeGeometry,
} from '../lib/geometry.js';
import { createWorldMaterials, own } from '../lib/materials.js';
import { makeTextTexture, makeDoorTexture } from '../lib/textures.js';

const ROOM = {
  x0: -18,
  x1: 22,
  z0: -15,
  z1: 16,
  h: 15,
  cx: 2,
  cz: 0.5,
};

function hazardTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#1a1b1c';
  g.fillRect(0, 0, 256, 64);
  g.strokeStyle = '#c69a22';
  g.lineWidth = 26;
  for (let i = -64; i < 320; i += 52) {
    g.beginPath();
    g.moveTo(i, 66);
    g.lineTo(i + 62, -2);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#b9cfe0');
  grad.addColorStop(0.45, '#cfdfe8');
  grad.addColorStop(0.72, '#9fb2bd');
  grad.addColorStop(1, '#63727a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 256);
  // faint cloud banding
  for (let i = 0; i < 16; i++) {
    g.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.04})`;
    g.fillRect(0, Math.random() * 256, 64, 4 + Math.random() * 18);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function iBeam(height, depth, width, mat) {
  const g = new THREE.Group();
  const flange = () => new RoundedBoxGeometry(depth, 0.1, width, 1, 0.015);
  const top = mesh(flange(), mat);
  top.position.y = height / 2 - 0.05;
  g.add(top);
  const bottom = mesh(flange(), mat);
  bottom.position.y = -height / 2 + 0.05;
  g.add(bottom);
  const web = mesh(new RoundedBoxGeometry(depth * 0.16, height - 0.14, 0.05, 1, 0.01), mat);
  g.add(web);
  return g;
}

export function createWorkshop(scene) {
  const W = createWorldMaterials();
  const group = new THREE.Group();
  group.name = 'Workshop';
  scene.add(group);

  const { x0, x1, z0, z1, h } = ROOM;
  const width = x1 - x0;
  const depth = z1 - z0;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;

  W.floor.map.repeat.set(9, 7);
  W.floor.roughnessMap.repeat.set(9, 7);

  /* ---------------- shell ---------------- */
  const floor = mesh(new THREE.PlaneGeometry(width, depth), W.floor, { cast: false });
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  group.add(floor);

  const ceiling = mesh(new THREE.PlaneGeometry(width, depth), W.ceiling, { cast: false });
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(cx, h, cz);
  group.add(ceiling);

  const wallGeo = (w) => new THREE.PlaneGeometry(w, h);
  const back = mesh(wallGeo(width), W.wall, { cast: false });
  back.position.set(cx, h / 2, z0);
  group.add(back);

  const front = mesh(wallGeo(width), W.wall, { cast: false });
  front.position.set(cx, h / 2, z1);
  front.rotation.y = Math.PI;
  group.add(front);

  const left = mesh(wallGeo(depth), W.wall, { cast: false });
  left.position.set(x0, h / 2, cz);
  left.rotation.y = Math.PI / 2;
  group.add(left);

  const right = mesh(wallGeo(depth), W.wall, { cast: false });
  right.position.set(x1, h / 2, cz);
  right.rotation.y = -Math.PI / 2;
  group.add(right);

  // skirt / wainscot around the walls
  const wainMat = own(W.wallDark, { color: 0x4c5152 });
  const skirtH = 1.35;
  const capMat = new THREE.MeshStandardMaterial({ color: 0x2c3032, roughness: 0.5, metalness: 0.6 });
  for (const w of [
    { x: cx, z: z0, rot: 0, len: width, nx: 0, nz: 1 },
    { x: cx, z: z1, rot: Math.PI, len: width, nx: 0, nz: -1 },
    { x: x0, z: cz, rot: Math.PI / 2, len: depth, nx: 1, nz: 0 },
    { x: x1, z: cz, rot: -Math.PI / 2, len: depth, nx: -1, nz: 0 },
  ]) {
    const skirt = mesh(new THREE.PlaneGeometry(w.len, skirtH), wainMat, { cast: false });
    skirt.position.set(w.x + w.nx * 0.05, skirtH / 2, w.z + w.nz * 0.05);
    skirt.rotation.y = w.rot;
    group.add(skirt);
    const cap = mesh(new RoundedBoxGeometry(w.len, 0.07, 0.13, 1, 0.01), capMat, { cast: false });
    cap.position.set(w.x + w.nx * 0.07, skirtH, w.z + w.nz * 0.07);
    cap.rotation.y = w.rot;
    group.add(cap);
  }

  // wall panel seams
  const seamMat = new THREE.MeshStandardMaterial({ color: 0x2b2f31, roughness: 0.8, metalness: 0.2 });
  for (let x = x0 + 3; x < x1; x += 3.6) {
    const seam = mesh(new RoundedBoxGeometry(0.05, h - 1.4, 0.06, 1, 0.01), seamMat, { cast: false });
    seam.position.set(x, (h + 1.4) / 2, z0 + 0.03);
    group.add(seam);
  }

  /* ---------------- structural columns ---------------- */
  const beamMat = W.beam;
  for (const [x, z] of [
    [x0 + 0.35, z0 + 0.35],
    [x0 + 0.35, z1 - 0.35],
    [x1 - 0.35, z0 + 0.35],
    [x1 - 0.35, z1 - 0.35],
    [x0 + 0.35, cz],
    [x1 - 0.35, cz],
  ]) {
    const col = iBeam(h, 0.42, 0.42, beamMat);
    col.position.set(x, h / 2, z);
    if (z === z0 + 0.35) col.rotation.y = 0;
    group.add(col);
  }

  // ceiling beams spanning z
  for (const x of [-13, -7.4, -1.8, 3.8, 9.4, 15, 18.8]) {
    const beam = mesh(new RoundedBoxGeometry(0.34, 0.44, depth, 2, 0.04), beamMat);
    beam.position.set(x, h - 0.32, cz);
    group.add(beam);
    const flange = mesh(new RoundedBoxGeometry(0.62, 0.05, depth, 1, 0.02), beamMat);
    flange.position.set(x, h - 0.08, cz);
    group.add(flange);
  }
  // purlins
  for (const z of [-8, -2.5, 3, 8.5]) {
    const p = mesh(new RoundedBoxGeometry(width, 0.12, 0.2, 1, 0.02), beamMat);
    p.position.set(cx, h - 0.62, z);
    group.add(p);
  }

  /* ---------------- strip lighting ---------------- */
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x25292b, roughness: 0.5, metalness: 0.7 });
  const tubeMat = new THREE.MeshBasicMaterial({ color: 0xf6f2e6 });
  for (const [x, z] of [[-8, -5], [-8, 5], [2, -5], [2, 5], [12, -5], [12, 5]]) {
    const housing = mesh(new RoundedBoxGeometry(4.2, 0.15, 0.36, 2, 0.05), housingMat, { cast: false });
    housing.position.set(x, h - 1.02, z);
    group.add(housing);
    const tube = mesh(new RoundedBoxGeometry(3.9, 0.05, 0.2, 1, 0.02), tubeMat, { cast: false, receive: false });
    tube.position.set(x, h - 1.11, z);
    group.add(tube);
    // hangers
    for (const dx of [-1.6, 1.6]) {
      const rod = mesh(chamferedCylinder(0.022, 0.9, 0.004, 8), housingMat, { cast: false });
      rod.position.set(x + dx, h - 0.55, z);
      group.add(rod);
    }
  }

  /* ---------------- window band on the back wall ---------------- */
  const winX0 = -8.2;
  const winX1 = 10.4;
  const winY0 = 4.4;
  const winY1 = 9.6;
  const winW = winX1 - winX0;
  const winH = winY1 - winY0;
  const glowMat = new THREE.MeshBasicMaterial({ map: skyTexture(), toneMapped: false });
  const glow = mesh(new THREE.PlaneGeometry(winW, winH), glowMat, { cast: false, receive: false });
  glow.position.set((winX0 + winX1) / 2, (winY0 + winY1) / 2, z0 + 0.06);
  group.add(glow);

  const frameMat = own(W.beam, { color: 0x33383a });
  const winFrame = (w, hh, x, y, d = 0.16) => {
    const f = mesh(new RoundedBoxGeometry(w, hh, d, 2, 0.02), frameMat);
    f.position.set(x, y, z0 + 0.14);
    group.add(f);
  };
  winFrame(winW + 0.5, 0.28, (winX0 + winX1) / 2, winY1 + 0.14);
  winFrame(winW + 0.5, 0.28, (winX0 + winX1) / 2, winY0 - 0.14);
  const mullions = 5;
  for (let i = 0; i <= mullions; i++) {
    const x = winX0 + (winW / mullions) * i;
    winFrame(0.16, winH + 0.28, x, (winY0 + winY1) / 2);
  }
  winFrame(winW + 0.5, 0.12, (winX0 + winX1) / 2, winY1 - 0.02);
  // window sill
  const sill = mesh(new RoundedBoxGeometry(winW + 1.1, 0.22, 0.5, 2, 0.03), frameMat);
  sill.position.set((winX0 + winX1) / 2, winY0 - 0.34, z0 + 0.24);
  group.add(sill);

  // wall signage above the window
  const signTex = makeTextTexture(['DYNAMOMETER TEST CELL 03'], {
    width: 2048,
    height: 256,
    color: '#d8d4ca',
    font: '300 96px "Helvetica Neue", Arial, sans-serif',
  });
  const signMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true, toneMapped: false });
  const sign = mesh(new THREE.PlaneGeometry(8.6, 1.07), signMat, { cast: false, receive: false });
  sign.position.set(1.2, 11.1, z0 + 0.07);
  group.add(sign);

  /* ---------------- roller door on the left wall ---------------- */
  const doorW = 5.4;
  const doorH = 5.9;
  const doorTex = makeDoorTexture();
  doorTex.repeat.set(3, 3);
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0x9aa1a1,
    map: doorTex,
    metalness: 0.55,
    roughness: 0.5,
    envMapIntensity: 0.5,
  });
  const door = mesh(new THREE.PlaneGeometry(doorW, doorH), doorMat, { cast: false });
  door.position.set(x0 + 0.07, doorH / 2 + 0.05, -3.4);
  door.rotation.y = Math.PI / 2;
  group.add(door);
  const doorFrameMat = own(W.beam, { color: 0x3c4143 });
  for (const [z, w, hh] of [
    [-3.4 - doorW / 2 - 0.14, 0.28, doorH + 0.4],
    [-3.4 + doorW / 2 + 0.14, 0.28, doorH + 0.4],
  ]) {
    const f = mesh(new RoundedBoxGeometry(0.3, hh, w, 2, 0.03), doorFrameMat, { cast: false });
    f.position.set(x0 + 0.16, doorH / 2 + 0.05, z);
    group.add(f);
  }
  const lintel = mesh(new RoundedBoxGeometry(0.3, 0.3, doorW + 0.6, 2, 0.03), doorFrameMat);
  lintel.position.set(x0 + 0.16, doorH + 0.2, -3.4);
  group.add(lintel);
  // rolled slats at the top
  const roll = mesh(chamferedCylinder(0.34, doorW, 0.03, 28), own(W.door, { color: 0x7c8283 }));
  roll.rotation.x = Math.PI / 2;
  roll.position.set(x0 + 0.3, doorH + 0.65, -3.4);
  group.add(roll);

  /* ---------------- hazard + floor markings ---------------- */
  const hazardMat = new THREE.MeshStandardMaterial({
    map: hazardTexture(),
    roughness: 0.7,
    metalness: 0.1,
  });
  hazardMat.map.repeat.set(6, 1);
  for (const z of [-2.6, 2.6]) {
    const strip = mesh(new THREE.PlaneGeometry(13.6, 0.18), hazardMat, { cast: false });
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(1.9, 0.012, z);
    group.add(strip);
  }
  const lineMat = own(W.floorLine, { color: 0xb98d20 });
  // safety box around the skid
  for (const [x, z, w, d] of [
    [1.55, -4.6, 14.2, 0.12],
    [1.55, 4.6, 14.2, 0.12],
    [-5.3, 0, 0.12, 9.2],
    [8.4, 0, 0.12, 9.2],
  ]) {
    const line = mesh(new THREE.PlaneGeometry(w, d), lineMat, { cast: false });
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.014, z);
    group.add(line);
  }
  // dashed walkway
  for (let i = 0; i < 14; i++) {
    const dash = mesh(new THREE.PlaneGeometry(1.1, 0.14), own(W.floorLine, { color: 0x8f8c82 }), { cast: false });
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(-13.5 + i * 2.2, 0.012, 9.4);
    group.add(dash);
  }

  // floor drain grate
  const drainMat = own(W.beam, { color: 0x3a3f41 });
  const drain = mesh(new RoundedBoxGeometry(2.4, 0.03, 0.6, 1, 0.02), drainMat, { cast: false });
  drain.position.set(4.3, 0.015, -6.4);
  group.add(drain);
  for (let i = 0; i < 9; i++) {
    const s = mesh(new RoundedBoxGeometry(0.06, 0.02, 0.5, 1, 0.005), new THREE.MeshStandardMaterial({ color: 0x0a0b0c, roughness: 0.9 }));
    s.position.set(3.35 + i * 0.24, 0.035, -6.4);
    group.add(s);
  }

  /* ---------------- workbench ---------------- */
  const bench = new THREE.Group();
  bench.position.set(-11.4, 0, -11.6);
  group.add(bench);

  const benchMat = own(W.beam, { color: 0x3f4547 });
  const benchTopMat = new THREE.MeshStandardMaterial({ color: 0x5c5346, roughness: 0.72, metalness: 0.25 });
  const top = mesh(new RoundedBoxGeometry(4.4, 0.12, 1.1, 2, 0.03), benchTopMat);
  top.position.y = 1.02;
  bench.add(top);
  const apron = mesh(new RoundedBoxGeometry(4.4, 0.28, 0.06, 1, 0.01), benchMat);
  apron.position.set(0, 0.84, -0.5);
  bench.add(apron);
  for (const x of [-2.0, 2.0]) {
    for (const z of [-0.42, 0.42]) {
      const leg = mesh(new RoundedBoxGeometry(0.1, 1.0, 0.1, 1, 0.015), benchMat);
      leg.position.set(x, 0.5, z);
      bench.add(leg);
    }
  }
  const shelf = mesh(new RoundedBoxGeometry(4.2, 0.06, 0.9, 1, 0.02), benchMat);
  shelf.position.y = 0.34;
  bench.add(shelf);

  // pegboard
  const pegMat = new THREE.MeshStandardMaterial({ color: 0x4a4841, roughness: 0.85, metalness: 0.1 });
  const peg = mesh(new RoundedBoxGeometry(4.2, 1.5, 0.06, 1, 0.01), pegMat);
  peg.position.set(0, 1.85, -0.5);
  bench.add(peg);
  const toolMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a2, metalness: 0.95, roughness: 0.28 });
  for (let i = 0; i < 9; i++) {
    const t = mesh(chamferedCylinder(0.022, 0.42 + (i % 3) * 0.08, 0.006, 8), toolMat);
    t.position.set(-1.75 + i * 0.18, 1.9, -0.45);
    bench.add(t);
  }
  for (let i = 0; i < 4; i++) {
    const w = mesh(new RoundedBoxGeometry(0.09, 0.34, 0.03, 1, 0.01), toolMat);
    w.position.set(0.7 + i * 0.22, 2.1, -0.45);
    bench.add(w);
  }
  // vise
  const vise = new THREE.Group();
  vise.position.set(1.55, 1.1, 0.1);
  bench.add(vise);
  const viseBase = mesh(new RoundedBoxGeometry(0.34, 0.16, 0.3, 2, 0.02), own(W.beam, { color: 0x4e5b52 }));
  vise.add(viseBase);
  const viseJaw = mesh(new RoundedBoxGeometry(0.12, 0.24, 0.34, 2, 0.02), own(W.beam, { color: 0x4e5b52 }));
  viseJaw.position.x = 0.2;
  vise.add(viseJaw);
  const handle = mesh(chamferedCylinder(0.022, 0.7, 0.005, 10), toolMat);
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0.2, 0.06, 0);
  vise.add(handle);

  /* ---------------- tool chest ---------------- */
  const chest = new THREE.Group();
  chest.position.set(-14.4, 0, -8.6);
  chest.rotation.y = 0.24;
  group.add(chest);
  const chestMat = new THREE.MeshStandardMaterial({ color: 0x7d2019, metalness: 0.5, roughness: 0.44 });
  const chestBody = mesh(new RoundedBoxGeometry(1.5, 1.42, 0.86, 3, 0.06), chestMat);
  chestBody.position.y = 0.92;
  chest.add(chestBody);
  for (let i = 0; i < 6; i++) {
    const drawer = mesh(new RoundedBoxGeometry(1.4, 0.19, 0.03, 1, 0.01), new THREE.MeshStandardMaterial({ color: 0x6b1b15, metalness: 0.55, roughness: 0.4 }));
    drawer.position.set(0, 0.4 + i * 0.22, 0.44);
    chest.add(drawer);
    const pull = mesh(new RoundedBoxGeometry(0.66, 0.035, 0.05, 1, 0.01), toolMat);
    pull.position.set(0, 0.4 + i * 0.22, 0.48);
    chest.add(pull);
  }
  const castorMat = new THREE.MeshStandardMaterial({ color: 0x141516, roughness: 0.8 });
  for (const x of [-0.56, 0.56]) {
    for (const z of [-0.3, 0.3]) {
      const c = mesh(chamferedCylinder(0.12, 0.1, 0.02, 14), castorMat);
      c.rotation.x = Math.PI / 2;
      c.position.set(x, 0.12, z);
      chest.add(c);
    }
  }
  const chestTop = mesh(new RoundedBoxGeometry(1.54, 0.05, 0.9, 2, 0.02), new THREE.MeshStandardMaterial({ color: 0x2f2a24, roughness: 0.5, metalness: 0.3 }));
  chestTop.position.y = 1.66;
  chest.add(chestTop);

  /* ---------------- oil drums ---------------- */
  const drumMats = [
    new THREE.MeshStandardMaterial({ color: 0x21506e, metalness: 0.6, roughness: 0.44 }),
    new THREE.MeshStandardMaterial({ color: 0x24282a, metalness: 0.55, roughness: 0.5 }),
    new THREE.MeshStandardMaterial({ color: 0x6f2a1f, metalness: 0.55, roughness: 0.48 }),
  ];
  const drumPositions = [
    [14.6, -9.8, 0],
    [15.9, -9.2, 0.6],
    [14.2, -8.4, -0.4],
  ];
  drumPositions.forEach(([x, z, rot], i) => {
    const drum = mesh(chamferedCylinder(0.46, 1.12, 0.04, 26), drumMats[i % 3]);
    drum.position.set(x, 0.56, z);
    drum.rotation.y = rot;
    group.add(drum);
    for (const y of [0.32, 0.78, 1.1]) {
      const ring = mesh(new THREE.TorusGeometry(0.465, 0.028, 6, 26), new THREE.MeshStandardMaterial({ color: 0x9aa0a0, metalness: 0.9, roughness: 0.4 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, y, z);
      group.add(ring);
    }
    const bung = mesh(chamferedCylinder(0.075, 0.05, 0.01, 6), boltMatLike);
    bung.position.set(x + 0.2, 1.14, z + 0.12);
    group.add(bung);
  });

  /* ---------------- rolling cart ---------------- */
  const cart = new THREE.Group();
  cart.position.set(11.2, 0, 6.6);
  cart.rotation.y = -0.35;
  group.add(cart);
  const cartMat = own(W.beam, { color: 0x445052 });
  const cartTop = mesh(new RoundedBoxGeometry(1.7, 0.08, 0.9, 2, 0.02), cartMat);
  cartTop.position.y = 1.02;
  cart.add(cartTop);
  for (const x of [-0.75, 0.75]) {
    for (const z of [-0.36, 0.36]) {
      const leg = mesh(new RoundedBoxGeometry(0.07, 1.0, 0.07, 1, 0.01), cartMat);
      leg.position.set(x, 0.51, z);
      cart.add(leg);
      const wheel = mesh(chamferedCylinder(0.1, 0.06, 0.015, 14), castorMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.1, z);
      cart.add(wheel);
    }
  }
  const cartShelf = mesh(new RoundedBoxGeometry(1.6, 0.05, 0.82, 1, 0.01), cartMat);
  cartShelf.position.y = 0.42;
  cart.add(cartShelf);
  const partMat = new THREE.MeshStandardMaterial({ color: 0x9ba0a2, metalness: 0.9, roughness: 0.3 });
  const part1 = mesh(new RoundedBoxGeometry(0.34, 0.22, 0.28, 2, 0.03), partMat);
  part1.position.set(-0.35, 1.17, 0.05);
  cart.add(part1);
  const part2 = mesh(chamferedCylinder(0.13, 0.3, 0.02, 18), partMat);
  part2.position.set(0.3, 1.21, -0.1);
  cart.add(part2);

  /* ---------------- wall details ---------------- */
  // fire extinguisher
  const extGroup = new THREE.Group();
  extGroup.position.set(19.6, 0, 4.2);
  extGroup.rotation.y = -Math.PI / 2;
  group.add(extGroup);
  const ext = mesh(chamferedCylinder(0.15, 0.62, 0.03, 20), new THREE.MeshStandardMaterial({ color: 0x8e1c16, metalness: 0.4, roughness: 0.5 }));
  ext.position.y = 1.2;
  extGroup.add(ext);
  const extTop = mesh(chamferedCylinder(0.06, 0.16, 0.01, 12), new THREE.MeshStandardMaterial({ color: 0x1a1c1d, metalness: 0.8, roughness: 0.3 }));
  extTop.position.y = 1.58;
  extGroup.add(extTop);
  const bracket = mesh(new RoundedBoxGeometry(0.24, 0.1, 0.1, 1, 0.01), castorMat);
  bracket.position.set(0, 1.44, -0.16);
  extGroup.add(bracket);

  // wall clock
  const clockFace = mesh(new THREE.CircleGeometry(0.34, 32), new THREE.MeshStandardMaterial({ color: 0xe7e2d6, roughness: 0.6 }), { cast: false });
  clockFace.position.set(-13.2, 8.6, z0 + 0.06);
  group.add(clockFace);
  const clockRim = mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 32), frameMat);
  clockRim.position.set(-13.2, 8.6, z0 + 0.07);
  group.add(clockRim);
  for (let i = 0; i < 2; i++) {
    const hand = mesh(new RoundedBoxGeometry(0.015, i ? 0.12 : 0.2, 0.01, 1, 0.004), new THREE.MeshStandardMaterial({ color: 0x1b1d1e }), { cast: false });
    hand.position.set(-13.2 + (i ? 0.05 : 0.08), 8.6 + (i ? 0.06 : 0.09), z0 + 0.08);
    hand.rotation.z = i ? 0.9 : -0.5;
    group.add(hand);
  }
  // safety sign
  const safetyTex = makeTextTexture(['HEARING PROTECTION'], {
    width: 512,
    height: 512,
    color: '#e9c13f',
    font: '600 54px "Helvetica Neue", Arial, sans-serif',
  });
  const safetyMat = new THREE.MeshBasicMaterial({ map: safetyTex, transparent: true, toneMapped: false });
  const safety = mesh(new THREE.PlaneGeometry(1.0, 1.0), safetyMat, { cast: false, receive: false });
  safety.position.set(18.9, 3.2, z0 + 0.07);
  group.add(safety);

  // air hose reel on the back wall
  const reel = new THREE.Group();
  reel.position.set(12.6, 4.2, z0 + 0.3);
  group.add(reel);
  const reelDrum = mesh(chamferedCylinder(0.42, 0.34, 0.03, 26), new THREE.MeshStandardMaterial({ color: 0x2f3436, metalness: 0.6, roughness: 0.5 }));
  reelDrum.rotation.x = Math.PI / 2;
  reel.add(reelDrum);
  for (const z of [-0.16, 0.16]) {
    const plate = mesh(chamferedCylinder(0.44, 0.04, 0.015, 26), frameMat);
    plate.rotation.x = Math.PI / 2;
    plate.position.z = z;
    reel.add(plate);
  }
  const hoseCoil = mesh(new THREE.TorusGeometry(0.36, 0.07, 8, 26), new THREE.MeshStandardMaterial({ color: 0x151617, roughness: 0.9 }));
  hoseCoil.position.z = 0.02;
  reel.add(hoseCoil);
  const airHose = mesh(tubeGeometry(
    [
      new THREE.Vector3(12.2, 4.2, z0 + 0.4),
      new THREE.Vector3(11.4, 3.2, z0 + 0.6),
      new THREE.Vector3(10.6, 1.4, z0 + 0.8),
      new THREE.Vector3(9.8, 0.2, z0 + 0.9),
    ],
    0.055,
    8,
    30
  ), new THREE.MeshStandardMaterial({ color: 0x141617, roughness: 0.88 }));
  group.add(airHose);

  // wall-mounted electrical boxes
  for (const [x, y] of [[-4.6, 3.4], [6.2, 3.5]]) {
    const box = mesh(new RoundedBoxGeometry(0.5, 0.66, 0.24, 2, 0.03), new THREE.MeshStandardMaterial({ color: 0x5a6264, metalness: 0.5, roughness: 0.5 }));
    box.position.set(x, y, z0 + 0.16);
    group.add(box);
    const conduit = mesh(chamferedCylinder(0.045, y - 0.3, 0.008, 10), frameMat);
    conduit.position.set(x, (y - 0.33) / 2, z0 + 0.1);
    group.add(conduit);
  }

  // pallet + crate stack in the far corner
  const palletMat = new THREE.MeshStandardMaterial({ color: 0x6b5a42, roughness: 0.9 });
  const pallet = mesh(new RoundedBoxGeometry(1.9, 0.14, 1.3, 1, 0.02), palletMat);
  pallet.position.set(17.2, 0.1, -11.4);
  group.add(pallet);
  const crate = mesh(new RoundedBoxGeometry(1.5, 1.1, 1.0, 2, 0.04), new THREE.MeshStandardMaterial({ color: 0x5f6a55, roughness: 0.85, metalness: 0.1 }));
  crate.position.set(17.2, 0.72, -11.4);
  group.add(crate);
  const crate2 = mesh(new RoundedBoxGeometry(1.1, 0.8, 0.8, 2, 0.03), new THREE.MeshStandardMaterial({ color: 0x6a6b5c, roughness: 0.85 }));
  crate2.position.set(16.9, 1.67, -11.3);
  group.add(crate2);

  /* ---------------- work light over the engine ---------------- */
  // a hanging task lamp to motivate the warm key light
  const lampArm = mesh(new RoundedBoxGeometry(0.06, 0.06, 2.2, 1, 0.01), frameMat);
  lampArm.position.set(3.2, 10.1, 3.4);
  group.add(lampArm);
  const lampCord = mesh(chamferedCylinder(0.02, 3.0, 0.004, 8), frameMat, { cast: false });
  lampCord.position.set(3.2, 11.6, 4.4);
  group.add(lampCord);
  const lamp = mesh(new THREE.ConeGeometry(0.55, 0.5, 26, 1, true), new THREE.MeshStandardMaterial({ color: 0x2c3133, metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide }));
  lamp.position.set(3.2, 9.8, 2.35);
  lamp.rotation.x = 0.35;
  group.add(lamp);
  const bulb = mesh(new THREE.SphereGeometry(0.16, 16, 10), new THREE.MeshBasicMaterial({ color: 0xfff1d4 }));
  bulb.position.set(3.2, 9.72, 2.3);
  group.add(bulb);

  return { group, room: ROOM };
}

// local shared material for small dark fittings
const boltMatLike = new THREE.MeshStandardMaterial({ color: 0x7d8385, metalness: 0.9, roughness: 0.45 });

/* ------------------------------------------------------------------ *
 *  Lighting rig
 * ------------------------------------------------------------------ */
export function createLighting(scene, renderer) {
  const hemi = new THREE.HemisphereLight(0xa8c7dc, 0x24262a, 0.42);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xcfe2ee, 1.55);
  sun.position.set(-6, 12.5, -15);
  sun.target.position.set(1.5, 3.4, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -14;
  sun.shadow.camera.right = 14;
  sun.shadow.camera.top = 13;
  sun.shadow.camera.bottom = -6;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 45;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.035;
  scene.add(sun, sun.target);

  // warm key over the engine
  const key = new THREE.SpotLight(0xffe3bf, 85, 34, 0.74, 0.85, 1.6);
  key.position.set(1.2, 12.2, 5.4);
  key.target.position.set(0.6, 3.2, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 30;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  scene.add(key, key.target);

  // cool fill from the window side
  const fill = new THREE.DirectionalLight(0x9cc0d8, 0.55);
  fill.position.set(2, 7, -12);
  fill.target.position.set(0, 3, 2);
  scene.add(fill, fill.target);

  // warm rim from the right
  const rim = new THREE.PointLight(0xffb178, 40, 26, 1.7);
  rim.position.set(11, 5.4, 6.5);
  scene.add(rim);

  // low bounce so the underside of the block and the pan keep some shape
  const bounce = new THREE.PointLight(0xbfd2dd, 20, 18, 1.9);
  bounce.position.set(2.4, 1.1, 6.2);
  scene.add(bounce);

  // broad top fill keeps horizontal surfaces from going black
  const top = new THREE.DirectionalLight(0xdfe9f0, 0.34);
  top.position.set(-2, 20, 6);
  top.target.position.set(0.8, 3, 0);
  scene.add(top, top.target);

  // practical strip ambience
  for (const [x, z] of [[-8, 5], [2, -5], [12, 5]]) {
    const p = new THREE.PointLight(0xdfe8ee, 36, 22, 1.8);
    p.position.set(x, 11.2, z);
    scene.add(p);
  }

  return { hemi, sun, key, fill, rim };
}
