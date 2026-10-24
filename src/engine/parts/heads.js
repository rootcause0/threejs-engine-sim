import * as THREE from 'three';
import {
  chamferedCylinder,
  chamferedTube,
  camLobeGeometry,
  hexBolt,
  mesh,
  springGeometry,
  tubeGeometry,
  valveGeometry,
  makeBadge,
  RoundedBoxGeometry,
} from '../../lib/geometry.js';
import { makeTextTexture } from '../../lib/textures.js';
import { SPEC, TAU, PARTS_COPY } from '../spec.js';

const DECK = SPEC.deckY;
const HEAD_W = SPEC.bankWidth;

function markSolid(group) {
  group.traverse((o) => {
    if (o.isMesh) o.userData.fade = false;
  });
  return group;
}

export function buildHeads(ctx) {
  const { M, own, part, cylinders } = ctx;

  const valves = [];
  const cams = [];

  for (const sign of [-1, 1]) {
    const a = sign * SPEC.bankAngle;
    const inboard = -Math.sign(a);
    const bankCyls = cylinders.filter((c) => c.sign === sign);
    const bank = ctx.banks[sign];

    /* ============================================================ *
     *  CYLINDER HEAD
     * ============================================================ */
    const head = new THREE.Group();
    head.name = sign < 0 ? 'HeadLeft' : 'HeadRight';
    bank.add(head);

    const castMat = own(M.castAluminum, { color: 0x9ea3a6 });
    const castDark = own(M.castAluminumDark, { color: 0x6b7174 });
    const machined = own(M.machinedAluminum);
    const boltMat = own(M.blackOxide);
    const portMat = own(M.machinedAluminum, { color: 0x848b8e, roughness: 0.44, metalness: 0.9 });
    const valveMat = own(M.polishedSteel, { color: 0xbcc1c3, roughness: 0.2 });
    const springMat = own(M.darkSteel, { color: 0x565c60, roughness: 0.34 });
    const bucketMat = own(M.machinedAluminum, { color: 0xb4b9bb });
    const plugMat = own(M.zinc);
    const ceramicMat = own(M.ceramic);
    const camMat = own(M.forgedSteel, { color: 0x666d71 });
    const lobeMat = own(M.polishedSteel, { color: 0xa5abad, roughness: 0.24 });

    /* ---- main casting ---- */
    const lower = mesh(new RoundedBoxGeometry(6.9, 0.62, HEAD_W, 3, 0.16), castMat);
    lower.position.y = DECK + 0.31;
    head.add(lower);

    // cam carrier deck
    const carrier = mesh(new RoundedBoxGeometry(6.84, 0.32, HEAD_W - 0.1, 2, 0.08), castDark);
    carrier.position.y = DECK + 0.78;
    head.add(carrier);

    // bearing rails
    for (const z of [-0.72, 0, 0.72]) {
      const rail = mesh(new RoundedBoxGeometry(6.86, 0.22, 0.12, 2, 0.04), castMat);
      rail.position.set(0, DECK + 0.99, z);
      head.add(rail);
    }
    // end walls
    for (const x of [-3.38, 3.38]) {
      const wall = mesh(new RoundedBoxGeometry(0.16, 0.92, HEAD_W, 2, 0.05), castMat);
      wall.position.set(x, DECK + 0.63, 0);
      head.add(wall);
    }

    // cam towers + caps
    for (const x of [-3.2, -1.6, 0, 1.6, 3.2]) {
      const tower = mesh(new RoundedBoxGeometry(0.28, 0.58, HEAD_W - 0.14, 2, 0.05), castDark);
      tower.position.set(x, DECK + 0.98, 0);
      head.add(tower);
      const cap = mesh(new RoundedBoxGeometry(0.34, 0.15, HEAD_W, 2, 0.04), castMat);
      cap.position.set(x, SPEC.camY + 0.24, 0);
      head.add(cap);
      for (const bz of [-0.66, 0.66]) {
        const b = hexBolt(boltMat, { headR: 0.05, headH: 0.045, length: 0.2 });
        b.position.set(x, SPEC.camY + 0.32, bz);
        head.add(b);
      }
    }

    // port flanges on both faces
    for (const c of bankCyls) {
      for (const side of [1, -1]) {
        const zc = side * SPEC.portFaceZ;
        const flange = mesh(new RoundedBoxGeometry(1.06, 0.74, 0.07, 2, 0.05), castMat);
        flange.position.set(c.x, SPEC.portFaceY, zc);
        head.add(flange);
        for (const dz of [-0.36, 0.36]) {
          const b = hexBolt(boltMat, { headR: 0.045, headH: 0.04, length: 0.15 });
          b.position.set(c.x + dz, SPEC.portFaceY + 0.24, zc + side * 0.06);
          b.rotation.x = side > 0 ? Math.PI / 2 : -Math.PI / 2;
          head.add(b);
        }
      }
    }

    // head bolts around each bore
    for (const c of bankCyls) {
      for (const z of [-0.66, 0.66]) {
        for (const dx of [-0.5, 0.5]) {
          const b = hexBolt(boltMat, { headR: 0.075, headH: 0.06, length: 0.26 });
          b.position.set(c.x + dx, DECK + 0.58, z);
          head.add(b);
        }
      }
    }

    /* ---- spark plugs ---- */
    for (const c of bankCyls) {
      const plug = new THREE.Group();
      plug.position.set(c.x, DECK + 0.42, 0);
      const hex = mesh(chamferedCylinder(0.1, 0.15, 0.014, 6), plugMat);
      hex.position.y = 0.06;
      plug.add(hex);
      const insulator = mesh(chamferedCylinder(0.058, 0.3, 0.02, 18), ceramicMat);
      insulator.position.y = 0.28;
      plug.add(insulator);
      const terminal = mesh(chamferedCylinder(0.028, 0.14, 0.006, 10), plugMat);
      terminal.position.y = 0.5;
      plug.add(terminal);
      markSolid(plug);
      head.add(plug);
    }

    /* ---- ports (opaque internals, revealed by cutaway) ---- */
    for (const c of bankCyls) {
      for (const side of [1, -1]) {
        const isIntake = side === inboard;
        const faceZ = side * SPEC.portFaceZ;
        const seatZ = isIntake ? inboard * SPEC.valveZ : -inboard * SPEC.valveZ;
        const pts = [
          new THREE.Vector3(c.x, isIntake ? SPEC.portFaceY + 0.06 : SPEC.portFaceY, faceZ),
          new THREE.Vector3(c.x * 0.99, SPEC.portFaceY - 0.14, faceZ * 0.72),
          new THREE.Vector3(c.x * 0.98, DECK + 0.22, seatZ + side * 0.14),
          new THREE.Vector3(c.x, DECK + 0.08, seatZ + side * 0.03),
        ];
        const tube = mesh(tubeGeometry(pts, 0.155, 12, 24), portMat);
        tube.userData.fade = false;
        head.add(tube);
        for (const dx of [-0.14, 0.14]) {
          const bp = [
            new THREE.Vector3(c.x, DECK + 0.09, seatZ + side * 0.03),
            new THREE.Vector3(c.x + dx * 0.5, DECK + 0.04, seatZ),
            new THREE.Vector3(c.x + dx, DECK + 0.0, seatZ),
          ];
          const branch = mesh(tubeGeometry(bp, 0.105, 8, 12), portMat);
          branch.userData.fade = false;
          head.add(branch);
        }
      }
    }

    /* ---- valves, springs, buckets ---- */
    const valveGeo = valveGeometry(SPEC.valveHeadR, SPEC.valveStemLen);
    const springGeo = springGeometry(0.082, 0.5, 6, 0.012, 80);
    const retainerGeo = chamferedCylinder(0.072, 0.03, 0.008, 18);
    const bucketGeo = chamferedCylinder(0.082, 0.09, 0.012, 22);

    for (const c of bankCyls) {
      for (const side of [1, -1]) {
        const isIntake = side === inboard;
        const z = isIntake ? inboard * SPEC.valveZ : -inboard * SPEC.valveZ;
        const peak = isIntake ? c.intakePeak : c.exhaustPeak;
        for (const dx of [-SPEC.valveDX, SPEC.valveDX]) {
          const x = c.x + dx;
          const valve = new THREE.Group();
          valve.position.set(x, DECK, z);
          head.add(valve);

          const seat = mesh(
            chamferedTube(SPEC.valveHeadR * 0.9, SPEC.valveHeadR + 0.045, 0.04, 0.008, 24),
            castDark
          );
          seat.position.y = -0.012;
          seat.userData.fade = false;
          valve.add(seat);

          const moving = new THREE.Group();
          valve.add(moving);

          const vMesh = mesh(valveGeo, valveMat);
          vMesh.userData.fade = false;
          moving.add(vMesh);

          const retainer = mesh(retainerGeo, bucketMat);
          retainer.position.y = SPEC.valveStemLen - 0.06;
          retainer.userData.fade = false;
          moving.add(retainer);

          const bucket = mesh(bucketGeo, bucketMat);
          bucket.position.y = SPEC.valveStemLen + 0.01;
          bucket.userData.fade = false;
          moving.add(bucket);

          const spring = mesh(springGeo, springMat);
          spring.position.y = 0.32;
          spring.userData.fade = false;
          valve.add(spring);

          const flashMat = new THREE.MeshBasicMaterial({
            color: 0xff7a2a,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          });
          const flash = mesh(new THREE.SphereGeometry(0.3, 16, 10), flashMat, { cast: false, receive: false });
          flash.scale.set(1, 0.3, 1);
          flash.position.set(x, DECK + 0.02, z);
          flash.visible = false;
          flash.userData.fade = false;
          head.add(flash);

          valves.push({
            cyl: c,
            peak,
            valve,
            moving,
            spring,
            springHeight: 0.5,
            flash,
            flashMat,
            isIntake,
          });
        }
      }
    }

    /* ---- camshafts ---- */
    for (const isIntake of [true, false]) {
      const z = isIntake ? inboard * SPEC.camZ : -inboard * SPEC.camZ;
      const cam = new THREE.Group();
      cam.position.set(0, SPEC.camY, z);
      head.add(cam);

      const shaft = mesh(chamferedCylinder(0.16, 6.7, 0.03, 24), camMat);
      shaft.rotation.z = Math.PI / 2;
      cam.add(shaft);

      for (const x of [-3.2, -1.6, 0, 1.6, 3.2]) {
        const j = mesh(chamferedCylinder(0.205, 0.24, 0.02, 24), lobeMat);
        j.rotation.z = Math.PI / 2;
        j.position.x = x;
        cam.add(j);
      }

      for (const c of bankCyls) {
        const peak = isIntake ? c.intakePeak : c.exhaustPeak;
        for (const dx of [-SPEC.valveDX, SPEC.valveDX]) {
          const lobeGeo = camLobeGeometry(SPEC.camBaseR, SPEC.valveLift, 0.11, SPEC.valveHalfDuration);
          const lobe = mesh(lobeGeo, lobeMat);
          lobe.position.x = c.x + dx;
          lobe.rotation.x = Math.PI - peak / 2;
          lobe.userData.fade = false;
          cam.add(lobe);
        }
      }

      // front drive flange + bolt
      const drive = mesh(chamferedCylinder(0.3, 0.11, 0.02, 28), lobeMat);
      drive.rotation.z = Math.PI / 2;
      drive.position.x = -3.4;
      cam.add(drive);
      const driveBolt = hexBolt(boltMat, { headR: 0.055, headH: 0.045, length: 0.16 });
      driveBolt.position.set(-3.47, 0, 0);
      driveBolt.rotation.z = Math.PI / 2;
      cam.add(driveBolt);

      markSolid(cam);
      cams.push(cam);
    }

    const headPart = part({
      id: sign < 0 ? 'headL' : 'headR',
      copy: sign < 0 ? PARTS_COPY.headL : PARTS_COPY.headR,
      group: head,
      cutaway: true,
      explode: new THREE.Vector3(0, 1.6, 0),
    });

    /* ============================================================ *
     *  CAM COVER
     * ============================================================ */
    const cover = new THREE.Group();
    cover.name = sign < 0 ? 'CoverLeft' : 'CoverRight';
    bank.add(cover);

    const coverMat = own(M.crinkleBlack);
    const finMat = own(M.machinedAluminum, { color: 0x8d9295, roughness: 0.52, metalness: 0.8 });
    const accentMat = own(M.anodizedOrange, { color: 0xd85a22 });
    const coilMat = own(M.plasticBlack);
    const outboard = sign;

    const body = mesh(new RoundedBoxGeometry(6.88, 0.9, SPEC.coverWidth, 5, 0.28), coverMat);
    body.position.y = SPEC.coverBottomY + 0.47;
    cover.add(body);

    const lip = mesh(new RoundedBoxGeometry(6.96, 0.1, SPEC.coverWidth + 0.06, 2, 0.04), coverMat);
    lip.position.y = SPEC.coverBottomY + 0.04;
    cover.add(lip);

    // Raised centre pad and machined ribs: a narrow strip down the middle so
    // the crinkle finish still reads on the cover's shoulders.
    const pad = mesh(new RoundedBoxGeometry(5.5, 0.07, 0.72, 3, 0.045), finMat);
    pad.position.y = SPEC.coverBottomY + 0.92;
    cover.add(pad);
    for (const x of [-2.0, -1.0, 0, 1.0, 2.0]) {
      const fin = mesh(new RoundedBoxGeometry(0.1, 0.05, 0.64, 2, 0.02), finMat);
      fin.position.set(x, SPEC.coverBottomY + 0.955, 0);
      cover.add(fin);
    }

    // orange pinstripe along the outboard shoulder
    const stripe = mesh(new RoundedBoxGeometry(6.6, 0.035, 0.05, 1, 0.01), accentMat);
    stripe.position.set(0, SPEC.coverBottomY + 0.14, outboard * (SPEC.coverWidth / 2 + 0.01));
    cover.add(stripe);

    // machined badge on the outboard face
    const badgeTex = makeTextTexture(['V8', '32 VALVE · DOHC'], {
      width: 1024,
      height: 320,
      color: '#e9e5dd',
      font: '600 150px "Helvetica Neue", Arial, sans-serif',
      subFont: '400 40px "SF Mono", monospace',
    });
    const badgePlate = mesh(new RoundedBoxGeometry(2.5, 0.6, 0.04, 2, 0.05), own(M.satinBlack));
    badgePlate.position.set(0.15, SPEC.coverBottomY + 0.47, outboard * (SPEC.coverWidth / 2 + 0.005));
    cover.add(badgePlate);
    const badge = makeBadge(2.35, 0.72, badgeTex, finMat);
    badge.position.set(0.15, SPEC.coverBottomY + 0.47, outboard * (SPEC.coverWidth / 2 + 0.035));
    badge.rotation.y = outboard > 0 ? 0 : Math.PI;
    cover.add(badge);

    const filler = mesh(chamferedCylinder(0.21, 0.1, 0.03, 28), own(M.satinBlack));
    filler.position.set(-2.75, SPEC.coverBottomY + 0.94, 0.42);
    cover.add(filler);
    const fillerRib = mesh(new THREE.TorusGeometry(0.175, 0.022, 6, 28), finMat);
    fillerRib.rotation.x = Math.PI / 2;
    fillerRib.position.set(-2.75, SPEC.coverBottomY + 0.99, 0.42);
    cover.add(fillerRib);

    // coil-on-plug packs
    for (const c of bankCyls) {
      const coil = new THREE.Group();
      coil.position.set(c.x, SPEC.coverBottomY + 0.98, -0.1);
      const bodyBox = mesh(new RoundedBoxGeometry(0.4, 0.18, 0.46, 2, 0.06), coilMat);
      coil.add(bodyBox);
      const connector = mesh(new RoundedBoxGeometry(0.16, 0.12, 0.18, 2, 0.03), coilMat);
      connector.position.set(-0.14, 0.01, 0.28);
      coil.add(connector);
      cover.add(coil);
    }
    // wiring loom along the cover
    const loomPts = [
      new THREE.Vector3(-2.9, SPEC.coverBottomY + 0.93, -0.52),
      new THREE.Vector3(-1.6, SPEC.coverBottomY + 0.95, -0.56),
      new THREE.Vector3(0, SPEC.coverBottomY + 0.95, -0.56),
      new THREE.Vector3(1.6, SPEC.coverBottomY + 0.95, -0.56),
      new THREE.Vector3(2.9, SPEC.coverBottomY + 0.91, -0.52),
    ];
    const loom = mesh(tubeGeometry(loomPts, 0.06, 8, 30), own(M.rubber));
    cover.add(loom);

    // perimeter bolts
    for (let i = 0; i < 6; i++) {
      for (const z of [-0.82, 0.82]) {
        const b = hexBolt(boltMat, { headR: 0.058, headH: 0.045, length: 0.18 });
        b.position.set(-2.79 + i * 1.12, SPEC.coverBottomY + 0.08, z);
        b.rotation.x = z > 0 ? Math.PI / 2 : -Math.PI / 2;
        cover.add(b);
      }
    }

    part({
      id: sign < 0 ? 'coverL' : 'coverR',
      copy: sign < 0 ? PARTS_COPY.coverL : PARTS_COPY.coverR,
      group: cover,
      cutaway: true,
      // Lift and spread outboard: straight up stacked the covers into the
      // heads and the manifold, which read as one undifferentiated block.
      explode: new THREE.Vector3(0, 2.3, sign * 2.1),
    });
  }

  return { valves, cams };
}
