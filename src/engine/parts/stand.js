import * as THREE from 'three';
import {
  chamferedCylinder,
  chamferedTube,
  hexBolt,
  makeBadge,
  mesh,
  RoundedBoxGeometry,
  tubeGeometry,
} from '../../lib/geometry.js';
import { makeTextTexture, makeScreenTexture } from '../../lib/textures.js';
import { PARTS_COPY } from '../spec.js';

const RAIL_TOP = 2.18;
const RAIL_Z = 2.05;
const BASE_TOP = 0.42;
const ENGINE_Y = 3.55;

/**
 * The test stand lives in world space (not in the engine group) so the
 * engine can vibrate against its mounts without shaking the building.
 */
export function buildStand(ctx) {
  const { M, own, part, scene } = ctx;

  const paint = own(M.standPaint);
  const paintLight = own(M.standPaint, { color: 0x37474a });
  const steel = own(M.steel);
  const dark = own(M.darkSteel);
  const black = own(M.blackOxide);
  const yellow = own(M.safetyYellow);
  const zinc = own(M.zinc);
  const rubber = own(M.rubber, { color: 0x0d0f10 });
  const red = own(M.cabinetRed);

  const root = new THREE.Group();
  root.name = 'TestStand';
  scene.add(root);

  /* ============================================================ *
   *  SKID
   * ============================================================ */
  const skid = new THREE.Group();
  skid.name = 'Skid';
  root.add(skid);

  const X0 = -4.55;
  const X1 = 8.7;
  const baseY = 0.3;

  // perimeter frame
  const frameTube = (w, h, d) => new RoundedBoxGeometry(w, h, d, 2, 0.045);
  for (const z of [-2.15, 2.15]) {
    const beam = mesh(frameTube(X1 - X0, 0.24, 0.2), paint);
    beam.position.set((X0 + X1) / 2, baseY, z);
    skid.add(beam);
  }
  for (const x of [X0, X1]) {
    const beam = mesh(frameTube(0.2, 0.24, 4.5), paint);
    beam.position.set(x, baseY, 0);
    skid.add(beam);
  }
  for (const x of [-3.7, -1.2, 1.3, 3.8, 6.2, 8.2]) {
    const cross = mesh(frameTube(0.16, 0.18, 4.16), paint);
    cross.position.set(x, baseY, 0);
    skid.add(cross);
  }

  // levelling feet
  for (const x of [X0 + 0.3, -1.2, 3.8, X1 - 0.3]) {
    for (const z of [-2.15, 2.15]) {
      const pad = mesh(chamferedCylinder(0.26, 0.16, 0.02, 20), dark);
      pad.position.set(x, 0.08, z);
      skid.add(pad);
      const stem = mesh(chamferedCylinder(0.1, 0.3, 0.015, 12), zinc);
      stem.position.set(x, 0.24, z);
      skid.add(stem);
      const nut = hexBolt(black, { headR: 0.13, headH: 0.1, length: 0.1 });
      nut.position.set(x, 0.34, z);
      skid.add(nut);
    }
  }

  // uprights + top rails
  const railTopY = RAIL_TOP - 0.12;
  for (const z of [-RAIL_Z, RAIL_Z]) {
    const rail = mesh(new RoundedBoxGeometry(11.9, 0.24, 0.3, 2, 0.05), paintLight);
    rail.position.set(1.75, railTopY, z);
    skid.add(rail);
    // machined top strip
    const strip = mesh(new RoundedBoxGeometry(11.9, 0.02, 0.22, 2, 0.02), steel);
    strip.position.set(1.75, RAIL_TOP + 0.005, z);
    skid.add(strip);

    for (const x of [-3.75, -1.35, 1.05, 3.45]) {
      const leg = mesh(new RoundedBoxGeometry(0.24, 1.44, 0.3, 2, 0.04), paint);
      leg.position.set(x, (BASE_TOP + railTopY - 0.12) / 2 + 0.02, z);
      skid.add(leg);

      // gusset
      const gusset = mesh(new RoundedBoxGeometry(0.5, 0.06, 0.3, 2, 0.02), paint);
      gusset.position.set(x + 0.2, BASE_TOP + 0.06, z);
      skid.add(gusset);
    }

    // side diagonal bracing
    for (const x of [-2.55, 2.25]) {
      const diag = mesh(new RoundedBoxGeometry(0.12, 2.16, 0.1, 2, 0.02), paint);
      diag.position.set(x, 1.18, z - Math.sign(z) * 0.02);
      diag.rotation.z = x < 0 ? 0.72 : -0.72;
      skid.add(diag);
    }
  }

  // cross bracing under the engine
  for (const x of [-3.75, 3.45]) {
    const cross = mesh(new RoundedBoxGeometry(0.2, 0.2, 4.1, 2, 0.03), paint);
    cross.position.set(x, railTopY, 0);
    skid.add(cross);
  }

  // mount pads
  for (const x of [-2.3, 2.3]) {
    for (const z of [-RAIL_Z, RAIL_Z]) {
      const plate = mesh(new RoundedBoxGeometry(0.62, 0.045, 0.62, 2, 0.02), steel);
      plate.position.set(x, RAIL_TOP + 0.03, z);
      skid.add(plate);
      for (const dx of [-0.21, 0.21]) {
        for (const dz of [-0.21, 0.21]) {
          const b = hexBolt(black, { headR: 0.055, headH: 0.04, length: 0.1 });
          b.position.set(x + dx, RAIL_TOP + 0.05, z + dz);
          skid.add(b);
        }
      }
    }
  }

  // hazard plates on the skid corners
  for (const x of [X0 + 0.06, X1 - 0.06]) {
    for (const z of [-2.15, 2.15]) {
      const plate = mesh(new RoundedBoxGeometry(0.32, 0.26, 0.12, 2, 0.01), yellow);
      plate.position.set(x, baseY + 0.1, z);
      skid.add(plate);
    }
  }

  // drip tray under the engine
  const tray = mesh(new RoundedBoxGeometry(5.9, 0.05, 3.2, 2, 0.04), own(M.zinc, { color: 0x6c7173, roughness: 0.5 }));
  tray.position.set(0.1, 0.62, 0);
  skid.add(tray);
  for (const z of [-1.6, 1.6]) {
    const lip = mesh(new RoundedBoxGeometry(5.9, 0.12, 0.05, 2, 0.02), paintLight);
    lip.position.set(0.1, 0.68, z);
    skid.add(lip);
  }
  for (const x of [-2.85, 3.05]) {
    const lip = mesh(new RoundedBoxGeometry(0.05, 0.12, 3.2, 2, 0.02), paintLight);
    lip.position.set(x, 0.68, 0);
    skid.add(lip);
  }

  // cable tray along the back of the skid
  const trayRail = mesh(new RoundedBoxGeometry(9.4, 0.1, 0.24, 2, 0.02), zinc);
  trayRail.position.set(2.2, 1.7, -2.32);
  skid.add(trayRail);
  for (const x of [-2.2, 0.6, 3.4, 6.0]) {
    const drop = mesh(new RoundedBoxGeometry(0.06, 0.5, 0.06, 1, 0.01), zinc);
    drop.position.set(x, 1.46, -2.32);
    skid.add(drop);
  }

  // skid nameplate
  const plateTex = makeTextTexture(['DYNO CELL 03'], {
    width: 1024,
    height: 220,
    color: '#e6e2d9',
    font: '600 84px "Helvetica Neue", Arial, sans-serif',
  });
  const plate = makeBadge(1.9, 0.4, plateTex, zinc);
  plate.position.set(-1.2, 0.3, 2.26);
  skid.add(plate);

  part({ id: 'stand', copy: PARTS_COPY.stand, group: skid });

  /* ============================================================ *
   *  EDDY-CURRENT ABSORBER
   * ============================================================ */
  const dyno = new THREE.Group();
  dyno.name = 'Dyno';
  root.add(dyno);

  const dynoX = 6.55;
  const bodyR = 0.94;

  // pedestal
  const pedestal = mesh(new RoundedBoxGeometry(2.0, 1.92, 1.9, 3, 0.1), paint);
  pedestal.position.set(dynoX, BASE_TOP + 0.96, 0);
  dyno.add(pedestal);
  const pedestalTop = mesh(new RoundedBoxGeometry(1.7, 0.34, 1.66, 2, 0.06), paintLight);
  pedestalTop.position.set(dynoX, 2.7, 0);
  dyno.add(pedestalTop);

  // absorber body
  const shell = mesh(new THREE.CylinderGeometry(bodyR, bodyR, 1.9, 40, 1, false), paintLight);
  shell.rotation.z = Math.PI / 2;
  shell.position.set(dynoX, ENGINE_Y, 0);
  dyno.add(shell);

  const endR = mesh(chamferedCylinder(1.02, 0.16, 0.04, 44), dark);
  endR.rotation.z = Math.PI / 2;
  endR.position.set(dynoX - 0.98, ENGINE_Y, 0);
  dyno.add(endR);
  const endL = mesh(chamferedCylinder(1.02, 0.16, 0.04, 44), dark);
  endL.rotation.z = Math.PI / 2;
  endL.position.set(dynoX + 0.98, ENGINE_Y, 0);
  dyno.add(endL);

  const nose = mesh(chamferedCylinder(0.42, 0.34, 0.04, 30), steel);
  nose.rotation.z = Math.PI / 2;
  nose.position.set(dynoX - 1.18, ENGINE_Y, 0);
  dyno.add(nose);

  // bolt rings on both end caps
  for (const x of [dynoX - 1.07, dynoX + 1.07]) {
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2;
      const b = hexBolt(black, { headR: 0.055, headH: 0.04, length: 0.1 });
      b.position.set(x, ENGINE_Y + Math.sin(ang) * 0.88, Math.cos(ang) * 0.88);
      b.rotation.z = Math.PI / 2;
      dyno.add(b);
    }
  }

  // cooling water manifold + hoses
  const manifold = mesh(new RoundedBoxGeometry(0.7, 0.28, 0.5, 2, 0.04), zinc);
  manifold.position.set(dynoX + 0.1, ENGINE_Y + bodyR + 0.12, 0);
  dyno.add(manifold);
  const hosePts = (z) => [
    new THREE.Vector3(dynoX + 0.1, ENGINE_Y + bodyR + 0.16, z),
    new THREE.Vector3(dynoX + 0.1, ENGINE_Y + bodyR + 0.36, z * 1.6),
    new THREE.Vector3(dynoX + 0.3, ENGINE_Y + bodyR + 0.2, z * 2.4),
    new THREE.Vector3(dynoX + 0.15, ENGINE_Y + bodyR - 0.4, z * 2.2),
  ];
  for (const z of [-0.18, 0.18]) {
    const hose = mesh(tubeGeometry(hosePts(z), 0.085, 10, 26), own(M.rubberRed));
    dyno.add(hose);
  }
  // hose runs down to the base
  const drain = mesh(
    tubeGeometry(
      [
        new THREE.Vector3(dynoX + 0.55, ENGINE_Y - bodyR - 0.05, 0.5),
        new THREE.Vector3(dynoX + 0.72, 2.6, 0.85),
        new THREE.Vector3(dynoX + 0.85, 1.4, 1.15),
        new THREE.Vector3(dynoX + 0.9, BASE_TOP + 0.12, 1.4),
      ],
      0.075,
      8,
      30
    ),
    own(M.rubber)
  );
  dyno.add(drain);

  // nameplate
  const dynoTex = makeTextTexture(['EDDY-CURRENT', 'ABSORBER · 600 kW'], {
    width: 1024,
    height: 360,
    color: '#e9e4d8',
    font: '600 96px "Helvetica Neue", Arial, sans-serif',
    subFont: '400 46px "SF Mono", monospace',
  });
  const dynoBadge = makeBadge(1.2, 0.42, dynoTex, zinc);
  dynoBadge.position.set(dynoX - 1.172, ENGINE_Y - 0.16, 0.3);
  dynoBadge.rotation.y = -Math.PI / 2;
  dyno.add(dynoBadge);

  // warning label
  const warnTex = makeTextTexture(['⚠ ROTATING'], {
    width: 512,
    height: 160,
    color: '#d8b24a',
    font: '700 74px "Helvetica Neue", Arial, sans-serif',
  });
  const warn = makeBadge(0.72, 0.22, warnTex, yellow);
  warn.position.set(dynoX - 1.172, ENGINE_Y + 0.52, 0.24);
  warn.rotation.y = -Math.PI / 2;
  dyno.add(warn);

  part({ id: 'dyno', copy: PARTS_COPY.dyno, group: dyno, explode: new THREE.Vector3(1.4, 0, 0) });

  /* ============================================================ *
   *  COUPLING + GUARD
   * ============================================================ */
  const coupling = new THREE.Group();
  coupling.name = 'Coupling';
  coupling.position.set(4.35, ENGINE_Y, 0);
  root.add(coupling);

  const shaft = mesh(chamferedCylinder(0.135, 1.2, 0.02, 24), steel);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.x = 0.55;
  coupling.add(shaft);

  const cvJoint = mesh(new RoundedBoxGeometry(0.34, 0.34, 0.34, 3, 0.08), dark);
  cvJoint.position.x = 0.28;
  coupling.add(cvJoint);

  for (const x of [0.02, 1.14]) {
    const flange = mesh(chamferedCylinder(0.38, 0.09, 0.02, 32), own(M.forgedSteel, { color: 0x73797c }));
    flange.rotation.z = Math.PI / 2;
    flange.position.x = x;
    coupling.add(flange);
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const b = hexBolt(black, { headR: 0.05, headH: 0.04, length: 0.12 });
      b.position.set(x + 0.055, Math.sin(ang) * 0.29, Math.cos(ang) * 0.29);
      b.rotation.z = -Math.PI / 2;
      coupling.add(b);
    }
  }

  // guard: half shroud over the shaft
  const guardGeo = new THREE.CylinderGeometry(0.52, 0.52, 1.7, 30, 1, true, 0, Math.PI);
  guardGeo.rotateZ(Math.PI / 2);
  const guardMat = own(M.safetyYellow, { color: 0xb08714 });
  const guard = mesh(guardGeo, guardMat);
  guard.position.set(4.35 + 0.62, ENGINE_Y + 0.04, 0);
  guard.material.side = THREE.DoubleSide;
  root.add(guard);

  const guardEdge = mesh(new THREE.TorusGeometry(0.52, 0.022, 6, 30, Math.PI), yellow);
  guardEdge.rotation.y = Math.PI / 2;
  guardEdge.position.set(4.35 - 0.24, ENGINE_Y + 0.04, 0);
  root.add(guardEdge);
  const guardEdge2 = guardEdge.clone();
  guardEdge2.position.x = 4.35 + 1.48;
  root.add(guardEdge2);

  // guard supports
  for (const x of [4.15, 5.75]) {
    const post = mesh(new RoundedBoxGeometry(0.08, 0.62, 0.08, 1, 0.01), zinc);
    post.position.set(x, ENGINE_Y - 0.42, 0.5);
    root.add(post);
  }

  /* ============================================================ *
   *  CONTROL CABINET
   * ============================================================ */
  const cabinet = new THREE.Group();
  cabinet.name = 'ControlCabinet';
  cabinet.position.set(8.45, 0, -3.35);
  cabinet.rotation.y = -0.82;
  root.add(cabinet);

  const plinth = mesh(new RoundedBoxGeometry(1.5, 0.12, 0.9, 2, 0.02), dark);
  plinth.position.y = 0.06;
  cabinet.add(plinth);

  const body = mesh(new RoundedBoxGeometry(1.42, 1.98, 0.82, 3, 0.07), own(M.standPaint, { color: 0x3b4346 }));
  body.position.y = 1.11;
  cabinet.add(body);

  const panel = mesh(new RoundedBoxGeometry(1.34, 1.82, 0.06, 2, 0.03), own(M.standPaint, { color: 0x2b3235 }));
  panel.position.set(0, 1.12, 0.43);
  cabinet.add(panel);

  const screenData = makeScreenTexture();
  const screenMat = new THREE.MeshBasicMaterial({ map: screenData.texture, toneMapped: false });
  const screenMesh = mesh(new THREE.PlaneGeometry(0.88, 0.55), screenMat, { cast: false, receive: false });
  screenMesh.position.set(-0.02, 1.52, 0.465);
  cabinet.add(screenMesh);

  const bezel = mesh(new RoundedBoxGeometry(0.96, 0.63, 0.03, 2, 0.02), black);
  bezel.position.set(-0.02, 1.52, 0.452);
  cabinet.add(bezel);

  // e-stop
  const estop = new THREE.Group();
  estop.position.set(0.42, 1.02, 0.47);
  cabinet.add(estop);
  const estopBase = mesh(chamferedCylinder(0.15, 0.06, 0.01, 24), yellow);
  estopBase.rotation.x = Math.PI / 2;
  estop.add(estopBase);
  const estopCap = mesh(chamferedCylinder(0.115, 0.11, 0.02, 24), red);
  estopCap.rotation.x = Math.PI / 2;
  estopCap.position.z = 0.07;
  estop.add(estopCap);

  // gauges
  for (const x of [-0.42, 0, 0.42]) {
    const gauge = new THREE.Group();
    gauge.position.set(x - 0.02, 1.02, 0.46);
    const ring = mesh(new THREE.TorusGeometry(0.085, 0.012, 6, 24), zinc);
    gauge.add(ring);
    const face = mesh(new THREE.CircleGeometry(0.078, 24), own(M.ceramic, { color: 0xe6e1d4 }));
    face.position.z = 0.005;
    gauge.add(face);
    const needle = mesh(new RoundedBoxGeometry(0.006, 0.06, 0.004, 1, 0.001), black);
    needle.position.set(0, 0.022, 0.012);
    needle.rotation.z = -0.7;
    gauge.add(needle);
    cabinet.add(gauge);
  }

  // key switch + buttons
  const keySwitch = mesh(chamferedCylinder(0.04, 0.05, 0.01, 16), zinc);
  keySwitch.rotation.x = Math.PI / 2;
  keySwitch.position.set(-0.5, 0.82, 0.47);
  cabinet.add(keySwitch);
  for (const [i, col] of [[0, 0x3f7a4a], [1, 0xb8862a]]) {
    const btn = mesh(chamferedCylinder(0.032, 0.03, 0.008, 16), own(M.plasticBlack, { color: col }));
    btn.rotation.x = Math.PI / 2;
    btn.position.set(0.02 + i * 0.13, 0.82, 0.47);
    cabinet.add(btn);
  }

  // bezel label
  const cabTex = makeTextTexture(['DYNO CONTROL'], {
    width: 1024,
    height: 200,
    color: '#cfd3d2',
    font: '600 74px "Helvetica Neue", Arial, sans-serif',
  });
  const cabBadge = makeBadge(0.9, 0.18, cabTex, zinc);
  cabBadge.position.set(-0.02, 1.86, 0.468);
  cabinet.add(cabBadge);

  // signal beacon
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0x2a0f0c,
    emissive: new THREE.Color(0x6b1a10),
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.92,
    roughness: 0.25,
    metalness: 0.1,
  });
  const beaconStem = mesh(chamferedCylinder(0.05, 0.16, 0.01, 12), zinc);
  beaconStem.position.set(0, 2.2, 0);
  cabinet.add(beaconStem);
  const beacon = mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.24, 20), beaconMat);
  beacon.position.set(0, 2.39, 0);
  beacon.castShadow = false;
  cabinet.add(beacon);
  const cap = mesh(chamferedCylinder(0.1, 0.03, 0.01, 20), black);
  cap.position.set(0, 2.53, 0);
  cabinet.add(cap);

  // cable gland + floor cable
  const gland = mesh(chamferedCylinder(0.075, 0.12, 0.01, 16), zinc);
  gland.position.set(0.5, 0.18, -0.35);
  cabinet.add(gland);
  const cable = mesh(
    tubeGeometry(
      [
        new THREE.Vector3(8.45 + 0.2, 0.12, -3.55),
        new THREE.Vector3(8.0, 0.05, -3.2),
        new THREE.Vector3(7.4, 0.05, -2.6),
        new THREE.Vector3(6.9, 0.05, -2.4),
      ],
      0.055,
      8,
      30
    ),
    own(M.rubber)
  );
  root.add(cable);

  part({ id: 'cabinet', copy: PARTS_COPY.cabinet, group: cabinet });

  /* ============================================================ *
   *  FLOOR EXTRACTION DUCTS
   * ============================================================ */
  for (const z of [-1, 1]) {
    const duct = new THREE.Group();
    duct.position.set(4.32, 0, z * 3.55);
    const collar = mesh(chamferedTube(0.28, 0.34, 0.26, 0.03, 24), dark);
    collar.position.y = 0.13;
    duct.add(collar);
    const hood = mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.16, 24, 1, true), zinc);
    hood.position.y = 0.3;
    duct.add(hood);
    root.add(duct);
  }

  return { root, coupling, screen: screenData, beacon: beaconMat };
}
