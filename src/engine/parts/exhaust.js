import * as THREE from 'three';
import {
  chamferedCylinder,
  hexBolt,
  mesh,
  RoundedBoxGeometry,
  tubeGeometry,
} from '../../lib/geometry.js';
import { SPEC, PARTS_COPY, bankToEngine } from '../spec.js';

const UP = new THREE.Vector3(0, 1, 0);

/** Collector centre — engine space (below the head, outboard of the skid rail). */
const COLLECTOR = { x: 1.86, y: 0.78, z: 3.46 };
/** Wide end / narrow end of the 4-into-1 merge cone, along +X. */
const CONE_X0 = COLLECTOR.x - 0.58;
const CONE_X1 = COLLECTOR.x + 0.58;

export function buildExhaust(ctx) {
  const { M, own, part, root, cylinders } = ctx;

  const steelMat = own(M.headerSteel);
  const tintMat = own(M.headerTint);
  const flangeMat = own(M.machinedAluminum, { color: 0x9aa0a2, roughness: 0.4 });
  const boltMat = own(M.blackOxide);
  const hoseMat = own(M.rubber, { color: 0x141617 });
  const sensorMat = own(M.zinc);
  const wireMat = own(M.belt);

  for (const sign of [-1, 1]) {
    const a = sign * SPEC.bankAngle;
    const inboard = -Math.sign(a);
    // Exhaust ports are on the outboard face of each head.
    const faceZ = -inboard * SPEC.portFaceZ;
    const zs = Math.sign(faceZ); // +1 for the right bank, -1 for the left

    const group = new THREE.Group();
    group.name = sign < 0 ? 'HeaderLeft' : 'HeaderRight';
    root.add(group);

    const bankCyls = cylinders.filter((c) => c.sign === sign).sort((p, q) => p.x - q.x);

    // Outward normal of the exhaust face, taken from the real bank transform.
    const pIn = bankToEngine(a, 0, SPEC.portFaceY, faceZ * 0.92);
    const pOut = bankToEngine(a, 0, SPEC.portFaceY, faceZ * 1.14);
    const n = new THREE.Vector3(pOut.x - pIn.x, pOut.y - pIn.y, pOut.z - pIn.z).normalize();

    bankCyls.forEach((c, i) => {
      const pe = bankToEngine(a, c.x, SPEC.portFaceY, faceZ);
      const port = new THREE.Vector3(pe.x, pe.y, pe.z);

      /* ---- port flange against the head face ---- */
      const flange = new THREE.Group();
      flange.position.copy(port).addScaledVector(n, 0.045);
      flange.quaternion.setFromUnitVectors(UP, n);
      group.add(flange);

      const plate = mesh(new RoundedBoxGeometry(1.0, 0.07, 0.78, 2, 0.055), flangeMat);
      flange.add(plate);
      for (const sx of [-0.36, 0.36]) {
        for (const sz of [-0.28, 0.28]) {
          const b = hexBolt(boltMat, { headR: 0.05, headH: 0.04, length: 0.15 });
          b.position.set(sx, 0.04, sz);
          flange.add(b);
        }
      }

      /* ---- primary: out of the port, then down and aft ---- */
      const start = port.clone().addScaledVector(n, 0.1);
      const p1 = port.clone().addScaledVector(n, 0.46);
      const p2 = new THREE.Vector3(c.x + 0.1, 1.34, zs * 3.66);
      const p3 = new THREE.Vector3(c.x * 0.5 + 0.62, 1.0, zs * 3.58);
      const p4 = new THREE.Vector3(CONE_X0 + 0.06 + i * 0.07, COLLECTOR.y, zs * COLLECTOR.z);

      const hot = mesh(tubeGeometry([start, p1, p2, p3], 0.137, 12, 30), tintMat);
      group.add(hot);
      const cool = mesh(tubeGeometry([p3, p4], 0.135, 12, 18), steelMat);
      group.add(cool);

      // TIG weld bead at the port and a slip-joint ring mid-primary.
      const bead = mesh(new THREE.TorusGeometry(0.145, 0.022, 7, 22), tintMat);
      bead.position.copy(p1);
      bead.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), p2.clone().sub(p1).normalize());
      group.add(bead);
      const ring = mesh(new THREE.TorusGeometry(0.14, 0.019, 7, 22), steelMat);
      ring.position.copy(p3);
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), p4.clone().sub(p3).normalize());
      group.add(ring);
    });

    /* ---- 4-into-1 merge cone ---- */
    const coneGeo = new THREE.CylinderGeometry(0.24, 0.5, CONE_X1 - CONE_X0, 30, 1, true);
    coneGeo.rotateZ(-Math.PI / 2);
    const cone = mesh(coneGeo, steelMat);
    cone.position.set((CONE_X0 + CONE_X1) / 2, COLLECTOR.y, zs * COLLECTOR.z);
    group.add(cone);

    const rim = mesh(new THREE.TorusGeometry(0.5, 0.032, 8, 30), tintMat);
    rim.rotation.y = Math.PI / 2;
    rim.position.set(CONE_X0, COLLECTOR.y, zs * COLLECTOR.z);
    group.add(rim);
    const rim2 = mesh(new THREE.TorusGeometry(0.24, 0.026, 8, 26), steelMat);
    rim2.rotation.y = Math.PI / 2;
    rim2.position.set(CONE_X1, COLLECTOR.y, zs * COLLECTOR.z);
    group.add(rim2);

    // merge collar bridging the cone into the tailpipe
    const collar = mesh(chamferedCylinder(0.24, 0.2, 0.02, 26), tintMat);
    collar.rotation.z = Math.PI / 2;
    collar.position.set(CONE_X1 + 0.1, COLLECTOR.y, zs * COLLECTOR.z);
    group.add(collar);

    /* ---- O2 sensor in the collector ---- */
    const o2x = CONE_X1 - 0.14;
    const bung = mesh(chamferedCylinder(0.085, 0.18, 0.01, 6), tintMat);
    bung.position.set(o2x, COLLECTOR.y + 0.28, zs * COLLECTOR.z);
    group.add(bung);
    const o2nut = mesh(chamferedCylinder(0.08, 0.09, 0.012, 6), sensorMat);
    o2nut.position.set(o2x, COLLECTOR.y + 0.37, zs * COLLECTOR.z);
    group.add(o2nut);
    const o2 = mesh(chamferedCylinder(0.048, 0.24, 0.01, 14), sensorMat);
    o2.position.set(o2x, COLLECTOR.y + 0.5, zs * COLLECTOR.z);
    group.add(o2);
    const o2wire = mesh(
      tubeGeometry(
        [
          new THREE.Vector3(o2x, COLLECTOR.y + 0.7, zs * COLLECTOR.z),
          new THREE.Vector3(o2x - 0.22, COLLECTOR.y + 0.86, zs * (COLLECTOR.z - 0.18)),
          new THREE.Vector3(o2x - 0.62, COLLECTOR.y + 0.84, zs * (COLLECTOR.z - 0.3)),
          new THREE.Vector3(o2x - 0.95, COLLECTOR.y + 0.6, zs * (COLLECTOR.z - 0.34)),
        ],
        0.022,
        6,
        20
      ),
      wireMat
    );
    group.add(o2wire);

    /* ---- tailpipe down the front of the skid ---- */
    const tailPts = [
      new THREE.Vector3(CONE_X1 + 0.2, COLLECTOR.y, zs * COLLECTOR.z),
      new THREE.Vector3(3.2, 0.72, zs * 3.5),
      new THREE.Vector3(3.84, 0.5, zs * 3.54),
      new THREE.Vector3(4.08, -0.7, zs * 3.55),
      new THREE.Vector3(4.16, -2.42, zs * 3.55),
    ];
    const tail = mesh(tubeGeometry(tailPts, 0.175, 14, 44), steelMat);
    group.add(tail);

    const tipRing = mesh(new THREE.TorusGeometry(0.175, 0.028, 8, 26), tintMat);
    tipRing.rotation.x = Math.PI / 2;
    tipRing.position.set(4.16, -2.44, zs * 3.55);
    group.add(tipRing);

    /* ---- flexible extraction hose into the floor duct ---- */
    const hosePoints = [
      new THREE.Vector3(4.16, -2.46, zs * 3.55),
      new THREE.Vector3(4.24, -2.78, zs * 3.55),
      new THREE.Vector3(4.3, -3.06, zs * 3.55),
      new THREE.Vector3(4.32, -3.16, zs * 3.55),
    ];
    const hose = mesh(tubeGeometry(hosePoints, 0.185, 14, 22), hoseMat);
    group.add(hose);
    for (let i = 0; i < 4; i++) {
      const rib = mesh(new THREE.TorusGeometry(0.192, 0.016, 6, 18), hoseMat);
      rib.position.set(4.2 + i * 0.03, -2.55 - i * 0.16, zs * 3.55);
      rib.rotation.x = Math.PI / 2;
      group.add(rib);
    }

    /* ---- heat shield over the front primaries ---- */
    // A floating plate here read as a stray white sheet; the primaries are
    // better left exposed, the way a dyno mule is actually plumbed.

    part({
      id: sign < 0 ? 'exhaustL' : 'exhaustR',
      copy: sign < 0 ? PARTS_COPY.exhaustL : PARTS_COPY.exhaustR,
      group,
      cutaway: false,
      explode: new THREE.Vector3(0, -0.5, zs * 2.0),
    });
  }
}
