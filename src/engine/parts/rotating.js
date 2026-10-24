import * as THREE from 'three';
import {
  chamferedCylinder,
  chamferedTube,
  disc,
  gearGeometry,
  mesh,
  pistonGeometry,
  rodGeometry,
  hexBolt,
  pulleyGeometry,
  RoundedBoxGeometry,
} from '../../lib/geometry.js';
import { SPEC, TAU, PARTS_COPY } from '../spec.js';

const UP = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);

function counterweightGeometry(radius, thickness, segments = 30) {
  const shape = new THREE.Shape();
  shape.moveTo(-radius, 0);
  for (let i = 0; i <= segments; i++) {
    const a = Math.PI + (i / segments) * Math.PI;
    shape.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSize: 0.025,
    bevelThickness: 0.02,
    bevelSegments: 2,
    curveSegments: 4,
    steps: 1,
  });
  geo.translate(0, 0, -thickness / 2);
  geo.rotateY(Math.PI / 2);
  return geo;
}

export function buildRotating(ctx) {
  const { M, own, part, root, cylinders } = ctx;

  const crankParent = new THREE.Group();
  crankParent.name = 'RotatingAssembly';
  root.add(crankParent);
  const spin = new THREE.Group();
  spin.name = 'CrankSpin';
  crankParent.add(spin);

  const forged = own(M.forgedSteel);
  const polished = own(M.polishedSteel);
  const dark = own(M.darkSteel);

  const crankGroup = new THREE.Group();
  crankGroup.name = 'Crankshaft';
  spin.add(crankGroup);

  const R = SPEC.crankRadius;

  /* ---- main journals ---- */
  const mainGeo = chamferedCylinder(0.36, 0.42, 0.03, 36);
  for (const x of SPEC.mainsX) {
    const j = mesh(mainGeo, polished);
    j.rotation.z = Math.PI / 2;
    j.position.x = x;
    crankGroup.add(j);
    // oil hole
    const hole = mesh(chamferedCylinder(0.055, 0.02, 0.005, 10), dark);
    hole.position.set(x, 0.36, 0);
    crankGroup.add(hole);
  }

  /* ---- throws ---- */
  for (let i = 0; i < 4; i++) {
    const p = SPEC.throwAngleDeg[i] * (Math.PI / 180);
    const x = SPEC.journalX[i];
    const py = R * Math.cos(p);
    const pz = R * Math.sin(p);

    const journal = mesh(chamferedCylinder(0.3, 1.18, 0.03, 32), polished);
    journal.rotation.z = Math.PI / 2;
    journal.position.set(x, py, pz);
    crankGroup.add(journal);

    const oil1 = mesh(chamferedCylinder(0.05, 0.02, 0.004, 8), dark);
    oil1.position.set(x, py + 0.3, pz);
    crankGroup.add(oil1);
    const oil2 = oil1.clone();
    oil2.position.set(x, py - 0.3, pz);
    crankGroup.add(oil2);

    for (const side of [-1, 1]) {
      const web = new THREE.Group();
      web.position.x = x + side * 0.65;
      web.rotation.x = p;
      crankGroup.add(web);

      const blade = mesh(new RoundedBoxGeometry(0.24, 1.16, 0.78, 3, 0.09), forged);
      blade.position.y = 0.5;
      web.add(blade);

      const cw = mesh(counterweightGeometry(0.98, 0.24), forged);
      web.add(cw);

      // machined edge highlight ring
      const edge = mesh(new THREE.TorusGeometry(0.92, 0.018, 6, 40, Math.PI), own(M.steel));
      edge.rotation.y = Math.PI / 2;
      edge.rotation.z = Math.PI / 2;
      edge.position.y = 0;
      web.add(edge);
    }
  }

  /* ---- rear flange + nose ---- */
  const flange = mesh(chamferedCylinder(0.74, 0.16, 0.03, 40), forged);
  flange.rotation.z = Math.PI / 2;
  flange.position.x = 3.5;
  crankGroup.add(flange);

  const nose = mesh(chamferedCylinder(0.32, 0.66, 0.03, 32), polished);
  nose.rotation.z = Math.PI / 2;
  nose.position.x = -3.72;
  crankGroup.add(nose);
  const noseKey = mesh(new RoundedBoxGeometry(0.5, 0.08, 0.12, 2, 0.01), dark);
  noseKey.position.set(-3.68, 0.26, 0);
  crankGroup.add(noseKey);

  const crankPart = part({
    id: 'crank',
    copy: PARTS_COPY.crank,
    group: crankGroup,
    manual: true,
  });

  /* ---- flywheel ---- */
  const flywheelGroup = new THREE.Group();
  flywheelGroup.name = 'Flywheel';
  spin.add(flywheelGroup);
  const flyMat = own(M.forgedSteel, { color: 0x6a7074 });
  const flyFace = own(M.machinedAluminum, { color: 0xaeb3b5, roughness: 0.28 });

  const flyDisc = mesh(chamferedCylinder(1.0, 0.24, 0.04, 72), flyMat);
  flyDisc.rotation.z = Math.PI / 2;
  flyDisc.position.x = 3.76;
  flywheelGroup.add(flyDisc);

  const flyFacePlate = mesh(chamferedCylinder(0.88, 0.05, 0.02, 64), flyFace);
  flyFacePlate.rotation.z = Math.PI / 2;
  flyFacePlate.position.x = 3.62;
  flywheelGroup.add(flyFacePlate);

  const ring = mesh(gearGeometry(56, 1.03, 0.22, 0.085, 0.95), dark);
  ring.position.x = 3.76;
  flywheelGroup.add(ring);

  const hub = mesh(chamferedCylinder(0.4, 0.3, 0.03, 32), polished);
  hub.rotation.z = Math.PI / 2;
  hub.position.x = 3.92;
  flywheelGroup.add(hub);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const b = hexBolt(own(M.blackOxide), { headR: 0.09, headH: 0.06, length: 0.2 });
    b.position.set(3.94, Math.cos(a) * 0.24, Math.sin(a) * 0.24);
    b.rotation.z = -Math.PI / 2;
    flywheelGroup.add(b);
  }

  part({
    id: 'flywheel',
    copy: PARTS_COPY.flywheel,
    group: flywheelGroup,
    manual: true,
  });

  /* ---- torsional damper ---- */
  const damperGroup = new THREE.Group();
  damperGroup.name = 'Damper';
  spin.add(damperGroup);
  const damperMat = own(M.darkSteel, { color: 0x565c60 });
  const pulleyMat = own(M.blackOxide, { color: 0x2a2d2f });

  const damperHub = mesh(chamferedCylinder(0.24, 0.4, 0.03, 32), polished);
  damperHub.rotation.z = Math.PI / 2;
  damperHub.position.x = -3.98;
  damperGroup.add(damperHub);

  const inertia = mesh(chamferedTube(0.42, 0.72, 0.32, 0.03, 56), damperMat);
  inertia.rotation.z = Math.PI / 2;
  inertia.position.x = -3.98;
  damperGroup.add(inertia);

  const elastomer = mesh(new THREE.TorusGeometry(0.41, 0.06, 10, 56), own(M.rubber));
  elastomer.rotation.y = Math.PI / 2;
  elastomer.position.x = -3.98;
  damperGroup.add(elastomer);

  for (const g of pulleyGeometry(0.66, 0.32, 6, 56)) {
    const m = mesh(g, pulleyMat);
    m.position.x = -4.06;
    damperGroup.add(m);
  }

  part({
    id: 'damper',
    copy: PARTS_COPY.damper,
    group: damperGroup,
    manual: true,
  });

  /* ---- pistons and rods ---- */
  const pistonRefs = [];
  const valveRefs = [];
  for (const cyl of cylinders) {
    const rodGroup = new THREE.Group();
    rodGroup.name = `Rod-${cyl.id}`;
    const pistonGroup = new THREE.Group();
    pistonGroup.name = `Piston-${cyl.id}`;

    const a = cyl.a;
    const explodeLocal = new THREE.Vector3(0, -0.85, 0).applyAxisAngle(X_AXIS, -a);

    // The bank group owns these transforms; callers attach them to the bank.
    const bank = ctx.banks[cyl.sign];
    bank.add(rodGroup);
    bank.add(pistonGroup);

    const rodMat = own(M.forgedSteel, { color: 0x70777b });
    const pinMat = own(M.polishedSteel);
    const pistonMat = own(M.machinedAluminumWarm, { color: 0xb9b6ae, roughness: 0.44, metalness: 0.72 });
    const skirtMat = own(M.satinBlack, { color: 0x2a2d2f });

    const rodGeo = rodGeometry(SPEC.rodLength, 0.37, 0.15, 0.18);
    const rod = mesh(rodGeo, rodMat);
    rodGroup.add(rod);

    const bearing = mesh(chamferedTube(0.302, 0.342, 0.2, 0.012, 32), own(M.copper, { color: 0x9a6c45 }));
    bearing.rotation.z = Math.PI / 2;
    rodGroup.add(bearing);

    const capSeam = mesh(new RoundedBoxGeometry(0.22, 0.02, 0.78, 1, 0.005), pinMat);
    capSeam.position.set(0, 0.03, 0);
    rodGroup.add(capSeam);

    for (const zs of [-0.21, 0.21]) {
      const b = hexBolt(own(M.blackOxide), { headR: 0.06, headH: 0.05, length: 0.16 });
      b.position.set(0, 0.06, zs);
      b.rotation.x = Math.PI;
      rodGroup.add(b);
    }

    // Piston: origin at wrist pin
    const piston = mesh(pistonGeometry(SPEC.pistonR, SPEC.pinToCrown), pistonMat);
    pistonGroup.add(piston);

    const skirt = mesh(chamferedTube(SPEC.pistonR * 0.72, SPEC.pistonR * 1.002, 0.16, 0.01, 48), skirtMat);
    skirt.position.y = -0.2;
    pistonGroup.add(skirt);

    for (const y of [0.16, 0.22, 0.28]) {
      const ringBand = mesh(chamferedTube(SPEC.pistonR * 0.94, SPEC.pistonR * 0.995, 0.035, 0.005, 48), own(M.darkSteel, { color: 0x6a6d6e }));
      ringBand.position.y = y;
      pistonGroup.add(ringBand);
    }

    const pin = mesh(chamferedCylinder(0.1, 0.58, 0.012, 24), pinMat);
    pin.rotation.z = Math.PI / 2;
    pistonGroup.add(pin);

    const crown = mesh(chamferedCylinder(0.46, 0.02, 0.008, 40), own(M.machinedAluminumWarm, { color: 0xb2afa8, roughness: 0.38, metalness: 0.78 }));
    crown.position.y = SPEC.pinToCrown + 0.005;
    pistonGroup.add(crown);

    part({
      id: `piston${cyl.id}`,
      name: `Piston — Cylinder ${cyl.id}`,
      description: PARTS_COPY.piston.description,
      meta: [`CYLINDER ${cyl.id}`, cyl.bank === 'L' ? 'LEFT BANK' : 'RIGHT BANK', 'FORGED'],
      group: pistonGroup,
      manual: true,
    });

    part({
      id: `rod${cyl.id}`,
      name: `Connecting Rod — Cylinder ${cyl.id}`,
      description: PARTS_COPY.piston.description,
      meta: [`CYLINDER ${cyl.id}`, 'I-BEAM', 'FORGED'],
      group: rodGroup,
      manual: true,
    });

    pistonRefs.push({
      cyl,
      pistonGroup,
      rodGroup,
      explodeLocal,
      dir: new THREE.Vector3(0, 1, 0),
      up: new THREE.Vector3(0, 1, 0),
    });
  }

  return {
    spin,
    spinParent: crankParent,
    crankGroup,
    crankPart,
    cylinders: pistonRefs,
    damperGroup,
    flywheelGroup,
    valveRefs,
  };
}

export function makePistonRingGeometry(radius) {
  return chamferedTube(radius * 0.94, radius, 0.03, 0.004, 48);
}
