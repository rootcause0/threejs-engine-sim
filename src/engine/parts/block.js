import * as THREE from 'three';
import {
  chamferedCylinder,
  chamferedTube,
  hexBolt,
  mesh,
  RoundedBoxGeometry,
} from '../../lib/geometry.js';
import { SPEC, TAU, PARTS_COPY } from '../spec.js';

function roundedRectPath(shape, w, h, r) {
  const x = -w / 2;
  const y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(x + w, y + h - r);
  shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  shape.lineTo(x + r, y + h);
  shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(x, y + r);
  shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
}

/** Bank casing: extruded slab with four through-bores. */
export function bankCasingGeometry(cylinders, width, depth, height) {
  const shape = new THREE.Shape();
  roundedRectPath(shape, width, depth, 0.22);
  for (const c of cylinders) {
    const hole = new THREE.Path();
    hole.absarc(c.x, 0, SPEC.boreR + 0.075, 0, TAU, true);
    shape.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelSize: 0.04,
    bevelThickness: 0.04,
    bevelSegments: 2,
    curveSegments: 24,
    steps: 1,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/** V-shaped valley casting that fills the gap under the intake manifold. */
function valleyGeometry(length, halfZ, y0, y1, topHalfZ) {
  const shape = new THREE.Shape();
  shape.moveTo(-halfZ, y0);
  shape.lineTo(halfZ, y0);
  shape.lineTo(topHalfZ, y1);
  shape.lineTo(-topHalfZ, y1);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: length,
    bevelEnabled: true,
    bevelSize: 0.05,
    bevelThickness: 0.04,
    bevelSegments: 2,
    curveSegments: 2,
    steps: 1,
  });
  geo.translate(0, 0, -length / 2);
  geo.rotateY(Math.PI / 2);
  return geo;
}

export function buildBlock(ctx) {
  const { M, own, part, root, cylinders } = ctx;
  const blockMat = own(M.castAluminum);
  const blockMat2 = own(M.castAluminumDark);
  const linerMat = own(M.castIron, { color: 0x6f7476 });
  const darkMat = own(M.darkSteel);
  const gasketMat = own(M.gasket);
  const plugMat = own(M.zinc);
  const boltMat = own(M.blackOxide);
  const rubberMat = own(M.rubber);

  const blockGroup = new THREE.Group();
  blockGroup.name = 'Block';
  root.add(blockGroup);

  /* ---- central crankcase ---- */
  const crankcase = mesh(new RoundedBoxGeometry(6.86, 1.55, 2.55, 4, 0.26), blockMat);
  crankcase.position.y = -0.22;
  blockGroup.add(crankcase);

  // main bearing bulkheads bulging out of the sides
  for (const x of SPEC.mainsX) {
    for (const s of [-1, 1]) {
      const bulge = mesh(new RoundedBoxGeometry(0.42, 0.9, 0.3, 3, 0.12), blockMat);
      bulge.position.set(x, -0.42, s * 1.28);
      blockGroup.add(bulge);
    }
  }

  const rail = mesh(new RoundedBoxGeometry(6.7, 0.34, 2.78, 2, 0.1), blockMat2);
  rail.position.y = -1.03;
  blockGroup.add(rail);

  for (let i = 0; i < 5; i++) {
    const x = -2.8 + i * 1.4;
    for (const s of [-1, 1]) {
      const rib = mesh(new RoundedBoxGeometry(0.08, 1.2, 0.1, 2, 0.02), blockMat2);
      rib.position.set(x, -0.45, s * 1.29);
      blockGroup.add(rib);
    }
  }

  /* ---- valley casting between the banks ---- */
  const valley = mesh(valleyGeometry(6.5, 1.62, 0.5, 2.15, 0.86), blockMat);
  blockGroup.add(valley);

  // valley floor plate + ribs
  const floorPlate = mesh(new RoundedBoxGeometry(6.2, 0.1, 1.45, 2, 0.05), blockMat2);
  floorPlate.position.y = 2.17;
  blockGroup.add(floorPlate);
  for (let i = 0; i < 4; i++) {
    const rib = mesh(new RoundedBoxGeometry(0.16, 0.09, 1.3, 2, 0.02), blockMat);
    rib.position.set(-2.1 + i * 1.4, 2.24, 0);
    blockGroup.add(rib);
  }
  const breather = mesh(chamferedCylinder(0.15, 0.2, 0.02, 20), darkMat);
  breather.position.set(1.9, 2.28, 0.3);
  blockGroup.add(breather);
  const knock = mesh(chamferedCylinder(0.09, 0.15, 0.012, 14), darkMat);
  knock.rotation.z = Math.PI / 2;
  knock.position.set(2.3, 0.85, 1.33);
  blockGroup.add(knock);

  /* ---- the two cylinder banks ---- */
  for (const sign of [-1, 1]) {
    const a = sign * SPEC.bankAngle;
    const bank = new THREE.Group();
    bank.position.x = sign * SPEC.bankOffset;
    bank.rotation.x = a;
    blockGroup.add(bank);

    const bankCyLs = cylinders.filter((c) => c.sign === sign);
    const casing = mesh(
      bankCasingGeometry(bankCyLs, 6.88, SPEC.bankWidth, SPEC.deckY - SPEC.bankBaseY),
      blockMat
    );
    casing.position.y = SPEC.bankBaseY + (SPEC.deckY - SPEC.bankBaseY) / 2;
    bank.add(casing);

    // deck lip
    for (const s of [-1, 1]) {
      const lip = mesh(new RoundedBoxGeometry(6.9, 0.09, 0.13, 2, 0.03), blockMat2);
      lip.position.set(0, SPEC.deckY - 0.03, s * (SPEC.bankWidth / 2 - 0.02));
      bank.add(lip);
    }
    const gasket = mesh(new RoundedBoxGeometry(6.84, 0.035, SPEC.bankWidth - 0.02, 2, 0.03), gasketMat);
    gasket.position.y = SPEC.deckY + 0.005;
    bank.add(gasket);

    for (const c of bankCyLs) {
      const sleeve = new THREE.Group();
      sleeve.position.set(c.x, 0, 0);
      const tube = mesh(
        chamferedTube(SPEC.boreR, SPEC.sleeveOuterR, SPEC.deckY - 1.1, 0.025, 40),
        linerMat
      );
      tube.position.y = 1.1 + (SPEC.deckY - 1.1) / 2;
      sleeve.add(tube);
      const flange = mesh(chamferedTube(SPEC.boreR, SPEC.sleeveOuterR + 0.075, 0.09, 0.02, 40), linerMat);
      flange.position.y = SPEC.deckY - 0.05;
      sleeve.add(flange);
      const hone = mesh(
        chamferedTube(SPEC.boreR - 0.004, SPEC.boreR, SPEC.deckY - 1.2, 0.002, 40),
        own(M.forgedSteel, { color: 0x8b8f91 })
      );
      hone.position.y = 1.1 + (SPEC.deckY - 1.2) / 2;
      sleeve.add(hone);
      bank.add(sleeve);

      const outboard = Math.sign(a);
      // core (freeze) plug on the outboard jacket face
      const plug = mesh(chamferedCylinder(0.14, 0.05, 0.014, 22), plugMat);
      plug.rotation.x = Math.PI / 2;
      plug.position.set(c.x, SPEC.deckY - 1.35, outboard * (SPEC.bankWidth / 2 + 0.01));
      bank.add(plug);
      // oil drain-back boss on the inboard face
      const drain = mesh(chamferedCylinder(0.09, 0.04, 0.01, 14), darkMat);
      drain.rotation.x = Math.PI / 2;
      drain.position.set(c.x, 1.5, -outboard * (SPEC.bankWidth / 2 + 0.005));
      bank.add(drain);
    }

    // jacket ribs on the outboard face
    const outboard = Math.sign(a);
    for (let i = 0; i < 3; i++) {
      const rib = mesh(new RoundedBoxGeometry(6.1, 0.08, 0.08, 2, 0.015), blockMat2);
      rib.position.set(0, 1.15 + i * 0.5, outboard * (SPEC.bankWidth / 2 + 0.01));
      bank.add(rib);
    }
    for (const ex of [-3.24, 3.24]) {
      const rib = mesh(new RoundedBoxGeometry(0.08, 2.3, 0.08, 2, 0.015), blockMat2);
      rib.position.set(ex, 1.85, outboard * (SPEC.bankWidth / 2 + 0.01));
      bank.add(rib);
    }
    // forging marks / casting pads
    for (const s of [-1, 1]) {
      const p = mesh(chamferedCylinder(0.1, 0.045, 0.008, 6), boltMat);
      p.rotation.z = Math.PI / 2;
      p.position.set(3.44 * s, 2.0, outboard * (SPEC.bankWidth / 2 - 0.2));
      bank.add(p);
    }
  }

  /* ---- oil filter, dipstick, sensors ---- */
  const filterBase = mesh(chamferedCylinder(0.26, 0.18, 0.03, 24), blockMat);
  filterBase.rotation.z = Math.PI / 2;
  filterBase.rotation.x = 0.5;
  filterBase.position.set(-1.1, -0.55, 1.4);
  blockGroup.add(filterBase);
  const filter = mesh(
    chamferedCylinder(0.24, 0.6, 0.05, 28),
    own(M.anodizedBlue, { color: 0x22323c, metalness: 0.75 })
  );
  filter.position.set(-1.34, -0.85, 1.72);
  filter.rotation.x = 0.5;
  filter.rotation.z = Math.PI / 2;
  blockGroup.add(filter);

  const dipstickTube = mesh(chamferedCylinder(0.04, 1.15, 0.01, 10), own(M.zinc));
  dipstickTube.position.set(-2.55, 0.25, -1.3);
  dipstickTube.rotation.x = -0.24;
  blockGroup.add(dipstickTube);
  const handle = mesh(new THREE.TorusGeometry(0.11, 0.025, 8, 20), rubberMat);
  handle.position.set(-2.55, 0.86, -1.45);
  handle.rotation.x = Math.PI / 2 - 0.24;
  blockGroup.add(handle);

  const sender = mesh(chamferedCylinder(0.08, 0.2, 0.015, 14), own(M.brass));
  sender.rotation.z = Math.PI / 2;
  sender.position.set(-2.9, 1.0, -1.35);
  blockGroup.add(sender);

  for (const sx of [-1, 1]) {
    for (const z of [-0.5, 0.5]) {
      const p = mesh(chamferedCylinder(0.12, 0.045, 0.01, 18), plugMat);
      p.rotation.z = Math.PI / 2;
      p.position.set(sx * 3.42, 1.9, z);
      blockGroup.add(p);
    }
  }

  const blockPart = part({
    id: 'block',
    copy: PARTS_COPY.block,
    group: blockGroup,
    cutaway: true,
  });

  /* ---- oil pan ---- */
  const panGroup = new THREE.Group();
  panGroup.name = 'OilPan';
  root.add(panGroup);
  const panMat = own(M.castAluminum, { color: 0x888d90 });

  const flange = mesh(new RoundedBoxGeometry(6.1, 0.1, 2.5, 2, 0.12), panMat);
  flange.position.y = -1.16;
  panGroup.add(flange);
  const panBody = mesh(new RoundedBoxGeometry(5.7, 0.42, 2.2, 3, 0.14), panMat);
  panBody.position.y = -1.38;
  panGroup.add(panBody);
  const sump = mesh(new RoundedBoxGeometry(2.2, 0.5, 1.9, 3, 0.14), panMat);
  sump.position.set(-1.35, -1.58, 0);
  panGroup.add(sump);
  for (let i = 0; i < 3; i++) {
    const rib = mesh(new RoundedBoxGeometry(0.1, 0.4, 2.0, 2, 0.02), blockMat2);
    rib.position.set(0.5 + i * 0.55, -1.42, 0);
    panGroup.add(rib);
  }
  const drain = mesh(chamferedCylinder(0.12, 0.11, 0.02, 6), boltMat);
  drain.position.set(1.6, -1.66, 0.2);
  panGroup.add(drain);
  for (let i = 0; i < 9; i++) {
    const x = -2.45 + i * 0.6;
    for (const z of [-1.05, 1.05]) {
      const b = hexBolt(boltMat, { headR: 0.06, headH: 0.045, length: 0.13 });
      b.position.set(x, -1.12, z);
      b.rotation.x = Math.PI;
      panGroup.add(b);
    }
  }
  const panPart = part({
    id: 'pan',
    copy: PARTS_COPY.pan,
    group: panGroup,
    cutaway: true,
    explode: new THREE.Vector3(0, -1.5, 0),
  });

  /* ---- timing cover ---- */
  const timingGroup = new THREE.Group();
  timingGroup.name = 'TimingCover';
  root.add(timingGroup);
  const coverMat = own(M.castAluminum, { color: 0x9da2a4 });
  const coverDark = own(M.castAluminumDark, { color: 0x767c7f });
  const cover = mesh(new RoundedBoxGeometry(0.3, 3.62, 2.3, 4, 0.24), coverMat);
  cover.position.set(-3.62, 0.8, 0);
  timingGroup.add(cover);
  // bolted perimeter flange
  const flangeRing = mesh(new RoundedBoxGeometry(0.14, 3.5, 2.44, 2, 0.1), coverDark);
  flangeRing.position.set(-3.47, 0.8, 0);
  timingGroup.add(flangeRing);
  // stamped ribs across the face
  for (const y of [-0.5, 0.1, 1.9]) {
    const rib = mesh(new RoundedBoxGeometry(0.07, 0.16, 2.0, 2, 0.03), coverDark);
    rib.position.set(-3.79, y, 0);
    timingGroup.add(rib);
  }
  // raised centre pad under the water pump
  const pad = mesh(new RoundedBoxGeometry(0.1, 1.0, 1.24, 3, 0.2), coverMat);
  pad.position.set(-3.8, 1.55, 0);
  timingGroup.add(pad);
  const pump = mesh(chamferedCylinder(0.4, 0.26, 0.05, 40), coverMat);
  pump.rotation.z = Math.PI / 2;
  pump.position.set(-3.95, 1.55, 0);
  timingGroup.add(pump);
  const pumpRing = mesh(new THREE.TorusGeometry(0.33, 0.035, 8, 40), coverDark);
  pumpRing.rotation.y = Math.PI / 2;
  pumpRing.position.set(-4.07, 1.55, 0);
  timingGroup.add(pumpRing);
  // crank nose seal boss
  const seal = mesh(new THREE.TorusGeometry(0.34, 0.06, 10, 40), rubberMat);
  seal.rotation.y = Math.PI / 2;
  seal.position.set(-3.79, 0, 0);
  timingGroup.add(seal);
  const boss = mesh(chamferedCylinder(0.4, 0.22, 0.03, 32), coverMat);
  boss.rotation.z = Math.PI / 2;
  boss.position.set(-3.79, 0, 0);
  timingGroup.add(boss);
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * TAU;
    const b = hexBolt(boltMat, { headR: 0.06, headH: 0.045, length: 0.14 });
    b.position.set(-3.53, 0.8 + Math.sin(ang) * 1.62, Math.cos(ang) * 1.08);
    b.rotation.z = Math.PI / 2;
    timingGroup.add(b);
  }
  const timingPart = part({
    id: 'timing',
    copy: PARTS_COPY.timing,
    group: timingGroup,
    cutaway: true,
    explode: new THREE.Vector3(-1.8, 0, 0),
  });

  /* ---- engine mounts ---- */
  const mountGroup = new THREE.Group();
  mountGroup.name = 'EngineMounts';
  root.add(mountGroup);
  const mountMat = own(M.standPaint, { color: 0x3a4244 });
  const padY = 2.18 - SPEC.engineY;
  for (const s of [-1, 1]) {
    for (const x of [-2.3, 2.3]) {
      const bracket = mesh(new RoundedBoxGeometry(0.36, 0.9, 0.62, 2, 0.06), mountMat);
      bracket.position.set(x, -0.85, s * 1.62);
      bracket.rotation.x = s * 0.22;
      mountGroup.add(bracket);
      const pad = mesh(chamferedCylinder(0.26, 0.14, 0.03, 24), rubberMat);
      pad.position.set(x, padY + 0.09, s * 2.05);
      mountGroup.add(pad);
      const washer = mesh(chamferedCylinder(0.32, 0.05, 0.015, 24), boltMat);
      washer.position.set(x, padY + 0.16, s * 2.05);
      mountGroup.add(washer);
      const bolt = hexBolt(boltMat, { headR: 0.1, headH: 0.07, length: 0.3 });
      bolt.position.set(x, padY + 0.17, s * 2.05);
      bolt.rotation.x = Math.PI;
      mountGroup.add(bolt);
      const stay = mesh(new RoundedBoxGeometry(0.3, 0.08, 0.5, 2, 0.02), mountMat);
      stay.position.set(x, padY + 0.03, s * 1.85);
      mountGroup.add(stay);
    }
  }
  part({ id: 'mount', copy: PARTS_COPY.mount, group: mountGroup });

  return { blockPart, panPart, timingPart, blockGroup, panGroup, timingGroup, mountGroup };
}
