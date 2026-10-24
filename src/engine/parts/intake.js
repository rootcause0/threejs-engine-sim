import * as THREE from 'three';
import {
  chamferedCylinder,
  chamferedTube,
  hexBolt,
  makeBadge,
  mesh,
  orientTo,
  RoundedBoxGeometry,
  tubeGeometry,
} from '../../lib/geometry.js';
import { makeTextTexture } from '../../lib/textures.js';
import { SPEC, PARTS_COPY, bankToEngine } from '../spec.js';

const UP = new THREE.Vector3(0, 1, 0);

/** Plenum, sitting in the valley between the banks. */
const PLENUM_Y = 2.95;
const PLENUM_W = 4.9;
const PLENUM_H = 0.84;
const PLENUM_D = 2.1;

export function buildIntake(ctx) {
  const { M, own, part, root, cylinders } = ctx;

  const bodyMat = own(M.castAluminum, { color: 0x9a9fa2, roughness: 0.56, envMapIntensity: 0.8 });
  const darkCast = own(M.castAluminumDark, { color: 0x788083 });
  const machined = own(M.machinedAluminum);
  const boltMat = own(M.blackOxide);
  const plasticMat = own(M.plasticBlack);
  const railMat = own(M.steel, { color: 0x9aa0a2, roughness: 0.28 });
  const injectorMat = own(M.zinc, { color: 0x8b8f91 });
  const anodized = own(M.anodizedOrange, { color: 0xc4511d });

  const group = new THREE.Group();
  group.name = 'IntakeManifold';
  root.add(group);

  /* ------------------------------------------------------------ *
   *  Plenum
   * ------------------------------------------------------------ */
  const plenum = mesh(
    new RoundedBoxGeometry(PLENUM_W, PLENUM_H, PLENUM_D, 5, 0.22),
    bodyMat
  );
  plenum.position.y = PLENUM_Y;
  group.add(plenum);

  const lid = mesh(
    new RoundedBoxGeometry(PLENUM_W * 0.97, 0.08, PLENUM_D * 0.93, 3, 0.09),
    bodyMat
  );
  lid.position.y = PLENUM_Y + PLENUM_H / 2 + 0.02;
  group.add(lid);

  for (let i = 0; i < 7; i++) {
    const x = -2.05 + i * 0.68;
    const rib = mesh(new RoundedBoxGeometry(0.11, 0.055, PLENUM_D * 0.8, 2, 0.02), machined);
    rib.position.set(x, PLENUM_Y + PLENUM_H / 2 + 0.06, 0);
    group.add(rib);
  }

  for (let i = 0; i < 9; i++) {
    const x = -2.16 + i * 0.54;
    for (const z of [-PLENUM_D * 0.41, PLENUM_D * 0.41]) {
      const b = hexBolt(boltMat, { headR: 0.05, headH: 0.04, length: 0.13 });
      b.position.set(x, PLENUM_Y + PLENUM_H / 2 + 0.02, z);
      group.add(b);
    }
  }

  const badgeTex = makeTextTexture(['V8', '5.0 L · 32V · NATURALLY ASPIRATED'], {
    width: 1024,
    height: 300,
    color: '#efece4',
    font: '600 132px "Helvetica Neue", Arial, sans-serif',
    subFont: '400 38px "SF Mono", monospace',
  });
  const badge = makeBadge(2.3, 0.67, badgeTex, machined);
  badge.rotation.x = -Math.PI / 2;
  badge.position.set(0.1, PLENUM_Y + PLENUM_H / 2 + 0.07, 0);
  group.add(badge);

  const map = mesh(new RoundedBoxGeometry(0.3, 0.14, 0.22, 2, 0.04), plasticMat);
  map.position.set(-1.85, PLENUM_Y + PLENUM_H / 2 + 0.08, 0.1);
  group.add(map);
  const vac = mesh(chamferedCylinder(0.04, 0.24, 0.008, 12), own(M.brass));
  vac.rotation.z = Math.PI / 2;
  vac.position.set(2.0, PLENUM_Y + PLENUM_H / 2 + 0.09, -0.32);
  group.add(vac);

  /* ------------------------------------------------------------ *
   *  Runners, port flanges, injector bosses
   * ------------------------------------------------------------ */
  const runners = [];

  for (const c of cylinders) {
    const a = c.a;
    const sign = Math.sign(a);
    const port = bankToEngine(a, c.x, SPEC.portFaceY, c.inboard * SPEC.portFaceZ);
    // outward normal of the intake face
    const pOut = bankToEngine(a, c.x, SPEC.portFaceY, c.inboard * (SPEC.portFaceZ + 0.2));
    const n = new THREE.Vector3(pOut.x - port.x, pOut.y - port.y, pOut.z - port.z).normalize();

    const side = Math.sign(port.z) || sign;
    const p0 = new THREE.Vector3(c.x, PLENUM_Y - 0.12, side * 0.85);
    const p1 = new THREE.Vector3(c.x, PLENUM_Y - 0.2, side * 1.2);
    const p2 = new THREE.Vector3(c.x, PLENUM_Y - 0.14, side * 1.5);
    const p3 = new THREE.Vector3(port.x, port.y - 0.06, port.z - side * 0.2);
    const p4 = new THREE.Vector3(port.x, port.y, port.z - side * 0.02);

    const runner = mesh(tubeGeometry([p0, p1, p2, p3, p4], 0.165, 14, 40), bodyMat);
    group.add(runner);
    runners.push(runner);

    const boss = mesh(chamferedCylinder(0.21, 0.26, 0.03, 22), bodyMat);
    boss.position.set(c.x, PLENUM_Y - 0.1, side * 0.95);
    orientTo(boss, new THREE.Vector3(0, 0.1, side * 1.2));
    group.add(boss);

    const flangeGroup = new THREE.Group();
    flangeGroup.position.copy(port).addScaledVector(n, 0.05);
    flangeGroup.quaternion.setFromUnitVectors(UP, n);
    group.add(flangeGroup);

    const flange = mesh(chamferedCylinder(0.26, 0.06, 0.014, 28), machined);
    flangeGroup.add(flange);
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const b = hexBolt(boltMat, { headR: 0.04, headH: 0.032, length: 0.11 });
      b.position.set(Math.cos(ang) * 0.215, 0.03, Math.sin(ang) * 0.215);
      flangeGroup.add(b);
    }

    const boss2 = mesh(chamferedCylinder(0.08, 0.18, 0.012, 14), darkCast);
    boss2.position.set(c.x + sign * 0.06, PLENUM_Y + 0.05, side * 1.42);
    boss2.rotation.x = side * 0.3;
    group.add(boss2);
  }

  // valley pedestal under the plenum
  const bracket = mesh(new RoundedBoxGeometry(1.0, 0.34, 3.2, 2, 0.06), darkCast);
  bracket.position.set(-0.2, PLENUM_Y - PLENUM_H / 2 - 0.15, 0);
  group.add(bracket);

  part({
    id: 'intake',
    copy: PARTS_COPY.intake,
    group,
    cutaway: true,
    explode: new THREE.Vector3(0, 3.0, 0),
  });

  /* ------------------------------------------------------------ *
   *  Throttle body
   * ------------------------------------------------------------ */
  const tb = new THREE.Group();
  tb.name = 'ThrottleBody';
  tb.position.set(-PLENUM_W / 2 - 0.28, PLENUM_Y + 0.05, 0);
  group.add(tb);

  const bore = mesh(chamferedTube(0.22, 0.3, 0.44, 0.03, 32), bodyMat);
  bore.rotation.z = Math.PI / 2;
  tb.add(bore);

  const backPlate = mesh(chamferedCylinder(0.33, 0.06, 0.014, 32), machined);
  backPlate.rotation.z = Math.PI / 2;
  backPlate.position.x = 0.19;
  tb.add(backPlate);

  const horn = mesh(chamferedTube(0.24, 0.35, 0.3, 0.05, 32), bodyMat);
  horn.rotation.z = Math.PI / 2;
  horn.position.x = -0.35;
  tb.add(horn);

  const blade = mesh(chamferedCylinder(0.216, 0.032, 0.01, 26), own(M.machinedAluminum, { color: 0xc5c9cb }));
  blade.scale.z = 0.985;
  blade.rotation.z = Math.PI / 2;
  blade.rotation.y = 0.36;
  tb.add(blade);
  const shaft = mesh(chamferedCylinder(0.032, 0.68, 0.006, 12), own(M.steel));
  shaft.rotation.x = Math.PI / 2;
  tb.add(shaft);
  const motor = mesh(new RoundedBoxGeometry(0.2, 0.18, 0.22, 2, 0.04), plasticMat);
  motor.position.set(0.02, 0.08, 0.35);
  tb.add(motor);
  const tps = mesh(new RoundedBoxGeometry(0.14, 0.14, 0.14, 2, 0.03), plasticMat);
  tps.position.set(0.02, -0.05, -0.33);
  tb.add(tps);

  const screen = mesh(new THREE.CircleGeometry(0.25, 26), own(M.darkSteel, { color: 0x2c3032 }));
  screen.rotation.y = -Math.PI / 2;
  screen.position.x = -0.49;
  tb.add(screen);

  part({
    id: 'throttle',
    copy: PARTS_COPY.throttle,
    group: tb,
    explode: new THREE.Vector3(-2.2, 0.85, 0),
  });

  /* ------------------------------------------------------------ *
   *  Fuel rails + injectors
   * ------------------------------------------------------------ */
  for (const sign of [-1, 1]) {
    const railGroup = new THREE.Group();
    railGroup.name = sign < 0 ? 'FuelRailLeft' : 'FuelRailRight';
    group.add(railGroup);

    const z = sign * 1.28;
    const rail = mesh(chamferedCylinder(0.075, 4.6, 0.02, 22), railMat);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0.1, PLENUM_Y + 0.3, z);
    railGroup.add(rail);

    for (const x of [-2.2, 2.4]) {
      const cap = mesh(chamferedCylinder(0.09, 0.08, 0.02, 22), boltMat);
      cap.rotation.z = Math.PI / 2;
      cap.position.set(x, PLENUM_Y + 0.3, z);
      railGroup.add(cap);
    }
    const feed = mesh(chamferedCylinder(0.05, 0.3, 0.012, 14), own(M.zinc));
    feed.position.set(-2.12, PLENUM_Y + 0.46, z);
    railGroup.add(feed);
    const damper = mesh(chamferedCylinder(0.1, 0.18, 0.02, 18), darkCast);
    damper.position.set(2.28, PLENUM_Y + 0.44, z);
    railGroup.add(damper);

    for (const c of cylinders) {
      if (c.sign !== sign) continue;

      const injector = new THREE.Group();
      injector.position.set(c.x, PLENUM_Y + 0.18, z - sign * 0.1);
      injector.rotation.x = sign * 0.26;
      railGroup.add(injector);

      const body = mesh(chamferedCylinder(0.055, 0.32, 0.012, 16), injectorMat);
      injector.add(body);
      const tip = mesh(chamferedCylinder(0.032, 0.11, 0.008, 12), own(M.brass));
      tip.position.y = -0.2;
      injector.add(tip);
      const plug = mesh(new RoundedBoxGeometry(0.12, 0.1, 0.12, 2, 0.03), plasticMat);
      plug.position.set(0, 0.14, 0.11);
      injector.add(plug);
      const clip = mesh(new THREE.TorusGeometry(0.065, 0.011, 6, 18), anodized);
      clip.rotation.x = Math.PI / 2;
      clip.position.y = 0.08;
      injector.add(clip);
    }

    for (const x of [-1.5, 0.1, 1.7]) {
      const tab = mesh(new RoundedBoxGeometry(0.16, 0.18, 0.09, 2, 0.02), darkCast);
      tab.position.set(x, PLENUM_Y + 0.18, z - sign * 0.07);
      railGroup.add(tab);
    }

    part({
      id: sign < 0 ? 'railL' : 'railR',
      copy: PARTS_COPY.injector,
      group: railGroup,
      explode: new THREE.Vector3(0, 2.55, sign * 0.6),
    });
  }

  return { group, runners };
}
