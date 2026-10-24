import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export { RoundedBoxGeometry };

const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ *
 *  Machined primitives
 * ------------------------------------------------------------------ */

/** Cylinder with chamfered rims, lathed so the edges catch light. */
export function chamferedCylinder(radius, height, chamfer = 0.02, segments = 32) {
  const r = Math.max(0.001, radius);
  const h = Math.max(0.001, height);
  const c = Math.max(0, Math.min(chamfer, Math.min(r * 0.4, h * 0.45)));
  const pts = [
    new THREE.Vector2(0, -h / 2),
    new THREE.Vector2(r - c, -h / 2),
    new THREE.Vector2(r, -h / 2 + c),
    new THREE.Vector2(r, h / 2 - c),
    new THREE.Vector2(r - c, h / 2),
    new THREE.Vector2(0, h / 2),
  ];
  return new THREE.LatheGeometry(pts, segments);
}

/** Hollow sleeve / tube with clean square or chamfered ends. */
export function chamferedTube(innerRadius, outerRadius, height, chamfer = 0.015, segments = 40) {
  const ri = Math.min(innerRadius, outerRadius - 0.005);
  const ro = outerRadius;
  const h = height;
  const c = Math.min(chamfer, (ro - ri) * 0.4, h * 0.4);
  const pts = [
    new THREE.Vector2(ri, -h / 2),
    new THREE.Vector2(ro - c, -h / 2),
    new THREE.Vector2(ro, -h / 2 + c),
    new THREE.Vector2(ro, h / 2 - c),
    new THREE.Vector2(ro - c, h / 2),
    new THREE.Vector2(ri, h / 2),
    new THREE.Vector2(ri, -h / 2),
  ];
  return new THREE.LatheGeometry(pts, segments);
}

export function disc(radius, thickness, segments = 32, chamfer = 0.012) {
  const g = chamferedCylinder(radius, thickness, chamfer, segments);
  g.rotateX(Math.PI / 2); // axis along Z
  return g;
}

/* ------------------------------------------------------------------ *
 *  Fasteners
 * ------------------------------------------------------------------ */

const boltGeoCache = new Map();

function boltGeometries(shankR, length, headR, headH) {
  const key = `${shankR}|${length}|${headR}|${headH}`;
  if (boltGeoCache.has(key)) return boltGeoCache.get(key);
  const shank = new THREE.CylinderGeometry(shankR * 0.94, shankR, length, 10, 1);
  shank.translate(0, -length / 2 + 0.001, 0);
  const head = new THREE.CylinderGeometry(headR * 0.9, headR, headH, 6, 1);
  head.translate(0, headH / 2, 0);
  const washer = new THREE.CylinderGeometry(headR * 1.28, headR * 1.28, headH * 0.16, 18, 1);
  washer.translate(0, headH * 0.06, 0);
  const set = { shank, head, washer };
  boltGeoCache.set(key, set);
  return set;
}

/**
 * Hex bolt group, origin at the seating face, head pointing +Y.
 * Use `orientTo(group, direction)` to place it on an arbitrary surface.
 */
export function hexBolt(mat, {
  shankR = 0.035,
  length = 0.18,
  headR = 0.075,
  headH = 0.06,
  washer = true,
  washerMat = null,
} = {}) {
  const g = new THREE.Group();
  const { shank, head, washer: wg } = boltGeometries(shankR, length, headR, headH);
  const s = new THREE.Mesh(shank, mat);
  s.castShadow = true;
  g.add(s);
  const h = new THREE.Mesh(head, mat);
  h.castShadow = true;
  g.add(h);
  if (washer) {
    const w = new THREE.Mesh(wg, washerMat || mat);
    w.castShadow = true;
    g.add(w);
  }
  return g;
}

export function orientTo(obj, dir) {
  const d = dir.clone().normalize();
  obj.quaternion.setFromUnitVectors(UP, d);
  return obj;
}

/* ------------------------------------------------------------------ *
 *  Curves and tubes
 * ------------------------------------------------------------------ */

export function makeTube(points, radius, {
  radial = 8,
  tension = 0.5,
  closed = false,
  segments = 64,
} = {}) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'catmullrom', tension);
  const geo = new THREE.TubeGeometry(curve, segments, radius, radial, closed);
  return { mesh: new THREE.Mesh(geo), curve, geometry: geo };
}

export function tubeGeometry(points, radius, radial = 8, segments = 64, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'catmullrom', 0.5);
  return new THREE.TubeGeometry(curve, segments, radius, radial, closed);
}

class HelixCurve extends THREE.Curve {
  constructor(radius, height, coils) {
    super();
    this.radius = radius;
    this.height = height;
    this.coils = coils;
  }
  getPoint(t, target = new THREE.Vector3()) {
    const a = t * this.coils * TAU;
    return target.set(Math.cos(a) * this.radius, t * this.height, Math.sin(a) * this.radius);
  }
}

export function springGeometry(radius, height, coils, wire = 0.018, segments = null) {
  const curve = new HelixCurve(radius, height, coils);
  return new THREE.TubeGeometry(curve, segments || Math.ceil(coils * 14), wire, 5, false);
}

/* ------------------------------------------------------------------ *
 *  Gears, pulleys, flywheels
 * ------------------------------------------------------------------ */

export function gearGeometry(teeth, rootRadius, thickness, toothHeight, holeRadius = 0, bevel = 0.01) {
  const shape = new THREE.Shape();
  const step = TAU / teeth;
  const tip = rootRadius + toothHeight;
  const pts = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    pts.push([rootRadius, a + step * 0.02]);
    pts.push([tip, a + step * 0.22]);
    pts.push([tip, a + step * 0.5]);
    pts.push([rootRadius, a + step * 0.7]);
    pts.push([rootRadius, a + step * 0.92]);
  }
  shape.moveTo(Math.cos(pts[0][1]) * pts[0][0], Math.sin(pts[0][1]) * pts[0][0]);
  for (let i = 1; i < pts.length; i++) {
    const [r, a] = pts[i];
    shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.closePath();
  if (holeRadius > 0) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, holeRadius, 0, TAU, true);
    shape.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 1,
    curveSegments: 18,
    steps: 1,
  });
  geo.translate(0, 0, -thickness / 2);
  geo.rotateY(Math.PI / 2); // axis along X, gear plane in YZ
  return geo;
}

/** Ribbed serpentine / V-belt pulley, axis along X. */
export function pulleyGeometry(radius, width, ribs = 6, segments = 48) {
  const geos = [];
  const hub = chamferedCylinder(radius * 0.35, width * 1.1, 0.01, 24);
  hub.rotateZ(Math.PI / 2);
  geos.push(hub);
  const rim = chamferedTube(radius * 0.38, radius, width, 0.012, segments);
  rim.rotateZ(Math.PI / 2);
  geos.push(rim);
  for (let i = 0; i < ribs; i++) {
    const z = -width / 2 + (width / (ribs + 1)) * (i + 1);
    const g = new THREE.TorusGeometry(radius * 0.985, width * 0.018, 6, segments);
    g.rotateY(Math.PI / 2);
    g.translate(z, 0, 0);
    geos.push(g);
  }
  return geos;
}

/* ------------------------------------------------------------------ *
 *  Engine-specific profiles
 * ------------------------------------------------------------------ */

/** Valve: flared head and long stem.  Origin at the valve face, stem +Y. */
export function valveGeometry(headRadius = 0.15, stemLength = 1.12, stemRadius = 0.028) {
  const pts = [
    new THREE.Vector2(0, -0.035),
    new THREE.Vector2(headRadius * 0.72, -0.035),
    new THREE.Vector2(headRadius, -0.012),
    new THREE.Vector2(headRadius, 0.012),
    new THREE.Vector2(headRadius * 0.6, 0.055),
    new THREE.Vector2(stemRadius * 2.2, 0.1),
    new THREE.Vector2(stemRadius, 0.145),
    new THREE.Vector2(stemRadius, stemLength - 0.02),
    new THREE.Vector2(stemRadius * 0.72, stemLength),
    new THREE.Vector2(0, stemLength),
  ];
  return new THREE.LatheGeometry(pts, 22);
}

/** Piston with three ring lands and a slight crown dish. Origin at wrist pin. */
export function pistonGeometry(r = 0.615, crown = 0.62, bottom = -0.36) {
  const pts = [];
  const push = (radius, y) => pts.push(new THREE.Vector2(radius, y));
  push(0, bottom);
  push(r * 0.78, bottom);
  push(r * 0.95, bottom + 0.045);
  push(r, bottom + 0.09);
  // ring belt with three grooves
  const ringTop = crown - 0.1;
  push(r, ringTop - 0.24);
  for (let i = 0; i < 3; i++) {
    const y0 = ringTop - 0.22 + i * 0.072;
    push(r, y0);
    push(r - 0.032, y0 + 0.008);
    push(r - 0.032, y0 + 0.048);
    push(r, y0 + 0.056);
  }
  push(r, crown - 0.055);
  push(r * 0.94, crown - 0.012);
  push(r * 0.76, crown + 0.008);
  push(r * 0.45, crown + 0.018);
  push(0, crown + 0.012);
  return new THREE.LatheGeometry(pts, 44);
}

/** Forged connecting rod, big end at origin, small end at +Y = length. */
export function rodGeometry(length, bigR = 0.31, smallR = 0.17, thickness = 0.19) {
  const d = length;
  const phi = Math.asin(Math.min(0.9, (bigR - smallR) / d));
  const shape = new THREE.Shape();
  const arc = (cx, cy, radius, a0, a1, n = 24) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      const x = cx + Math.cos(a) * radius;
      const y = cy + Math.sin(a) * radius;
      if (i === 0 && shape.curves.length === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
  };
  // big end bottom, sweeping clockwise from right tangent around the bottom
  arc(0, 0, bigR, phi, -Math.PI - phi, 30);
  // left shank up to the small end
  shape.lineTo(-smallR * Math.cos(phi), d + smallR * Math.sin(phi));
  // small end crown, clockwise over the top
  arc(0, d, smallR, Math.PI - phi, phi, 22);
  shape.closePath();

  const bigHole = new THREE.Path();
  bigHole.absarc(0, 0, bigR - 0.075, 0, TAU, true);
  shape.holes.push(bigHole);
  const smallHole = new THREE.Path();
  smallHole.absarc(0, d, smallR - 0.035, 0, TAU, true);
  shape.holes.push(smallHole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSize: 0.018,
    bevelThickness: 0.014,
    bevelSegments: 1,
    curveSegments: 24,
    steps: 1,
  });
  geo.translate(0, 0, -thickness / 2);
  geo.rotateY(Math.PI / 2); // big-end pin axis along X
  return geo;
}

/** Cam lobe extrusion with a true cam profile (base + lift curve), axis X. */
export function camLobeGeometry(baseRadius, lift, thickness, halfDuration = Math.PI * (62.5 / 180)) {
  const shape = new THREE.Shape();
  const N = 96;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * TAU; // measured from +Y (peak direction)
    // angle from peak
    let da = a - Math.PI / 2;
    while (da > Math.PI) da -= TAU;
    while (da < -Math.PI) da += TAU;
    let r = baseRadius;
    if (Math.abs(da) < halfDuration) {
      const u = da / halfDuration;
      const t = 0.5 + 0.5 * Math.cos(Math.PI * u);
      r += lift * Math.pow(t, 1.15);
    }
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSize: 0.008,
    bevelThickness: 0.008,
    bevelSegments: 1,
    curveSegments: 4,
    steps: 1,
  });
  geo.translate(0, 0, -thickness / 2);
  geo.rotateY(Math.PI / 2); // axis along X, peak remains +Y
  return geo;
}

/* ------------------------------------------------------------------ *
 *  Assembly conveniences
 * ------------------------------------------------------------------ */

export function mesh(geo, mat, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

export function addBolts(parent, positions, mat, options = {}, normal = UP) {
  const group = new THREE.Group();
  for (const p of positions) {
    const b = hexBolt(mat, options);
    b.position.copy(p);
    orientTo(b, normal);
    group.add(b);
  }
  parent.add(group);
  return group;
}

/** Rounded rectangular plate with bolt holes suggested by inset rings. */
export function plate(w, h, d, radius = 0.04, segments = 2) {
  return new RoundedBoxGeometry(w, h, d, segments, Math.min(radius, Math.min(w, h, d) * 0.45));
}

/** Cached canvas wordmark on a thin plate. */
export function makeBadge(w, h, texture, metalMat) {
  const geo = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    metalness: 0.9,
    roughness: 0.28,
    envMapIntensity: 1.2,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const m = new THREE.Mesh(geo, mat);
  return m;
}
