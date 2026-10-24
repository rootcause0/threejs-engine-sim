import * as THREE from 'three';
import { createMaterialLibrary, own } from '../lib/materials.js';
import { SPEC, TAU, CYLINDERS, pistonState, cyclePhaseDeg, strokeForPhase, valveLift, PARTS_COPY } from './spec.js';
import { buildBlock } from './parts/block.js';
import { buildRotating } from './parts/rotating.js';
import { buildHeads } from './parts/heads.js';
import { buildIntake } from './parts/intake.js';
import { buildExhaust } from './parts/exhaust.js';
import { buildStand } from './parts/stand.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);
const ACCENT = 0xff6a2a;

function damp(current, target, lambda, dt) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export class V8Engine {
  constructor(scene) {
    this.M = createMaterialLibrary();
    this.scene = scene;
    this.parts = new Map();
    this.partList = [];
    this.cylinders = CYLINDERS;

    this.group = new THREE.Group();
    this.group.name = 'EngineAssembly';
    this.group.position.y = SPEC.engineY;
    scene.add(this.group);

    this.theta = 0;
    this.rpm = 0;
    this.load = 0;
    this.time = 0;
    this.cutTarget = 0;
    this.cutF = 0;
    this.explodeTarget = 0;
    this.explodeF = 0;
    this.highlighted = null;
    this._shellShadows = null;

    this.ctx = {
      M: this.M,
      spec: SPEC,
      cylinders: CYLINDERS,
      root: this.group,
      scene,
      own,
      part: (def) => this._addPart(def),
      banks: {},
    };

    // Shared bank frames — block casings, heads, cams, rods and pistons all
    // resolve in these two rotated coordinate systems.
    for (const sign of [-1, 1]) {
      const g = new THREE.Group();
      g.name = sign < 0 ? 'BankLeft' : 'BankRight';
      g.position.x = sign * SPEC.bankOffset;
      g.rotation.x = sign * SPEC.bankAngle;
      this.group.add(g);
      this.ctx.banks[sign] = g;
    }

    this._build();
  }

  /* ---------------------------------------------------------------- */
  /*  Assembly                                                        */
  /* ---------------------------------------------------------------- */
  _build() {
    const ctx = this.ctx;

    this.block = buildBlock(ctx);
    this.rotating = buildRotating(ctx);
    this.heads = buildHeads(ctx);
    this.intake = buildIntake(ctx);
    this.exhaust = buildExhaust(ctx);
    this.stand = buildStand(ctx);

    // Front dress: damper spins with the crank, its part lives in the crank group
    // (built inside rotating.js and returned).
    this.damper = this.rotating.damper;
    this.flywheel = this.rotating.flywheel;

    // Reference every moving component for the animation pass.
    this.cylinderRefs = this.rotating.cylinders;
    this.valveRefs = this.heads.valves;
    this.camRefs = this.heads.cams;

    this.group.traverse((o) => {
      if (o.isMesh) {
        const m = o.material;
        const ghost =
          m && ((m.transparent && m.opacity < 0.98) || m.blending === THREE.AdditiveBlending);
        o.castShadow = !ghost;
        o.receiveShadow = !ghost;
      }
    });
  }

  _addPart(def) {
    const {
      id,
      name,
      description,
      meta = [],
      group,
      cutaway = false,
      explode = null,
      manual = false,
      shell = undefined,
      copy = null,
    } = def;

    const copyData = copy || {};
    const part = {
      id,
      name: name || copyData.name || 'Component',
      description: description || copyData.description || '',
      meta: meta.length ? meta : copyData.meta || [],
      group,
      cutaway,
      explode,
      manual,
      materials: [],
      meshes: [],
      fadeMaterials: [],
      fadeMeshes: [],
      basePosition: group.position.clone(),
    };

    group.userData.partId = id;
    group.traverse((o) => {
      if (!o.isMesh) return;
      part.meshes.push(o);
      if (!part.materials.includes(o.material)) part.materials.push(o.material);
      o.userData.partId = id;
      const fades = shell === undefined ? o.userData.fade !== false : shell;
      if (cutaway && fades) {
        part.fadeMeshes.push(o);
        if (!part.fadeMaterials.includes(o.material)) part.fadeMaterials.push(o.material);
      }
    });

    for (const m of part.materials) {
      if (m.emissive) {
        m.userData.baseEmissive = m.emissive.clone();
        m.userData.baseEmissiveIntensity = m.emissiveIntensity ?? 1;
      }
      m.userData.baseOpacity = m.opacity;
    }
    for (const m of part.fadeMaterials) {
      m.transparent = true;
      m.depthWrite = true;
      m.userData.cutOpacity = m.userData.cutOpacity ?? 0.1;
    }

    this.parts.set(id, part);
    this.partList.push(part);
    return part;
  }

  /* ---------------------------------------------------------------- */
  /*  Modes                                                           */
  /* ---------------------------------------------------------------- */
  setCutaway(on) {
    this.cutTarget = on ? 1 : 0;
  }

  setExploded(on) {
    this.explodeTarget = on ? 1 : 0;
  }

  select(id) {
    if (this.highlighted && this.highlighted !== id) {
      const prev = this.parts.get(this.highlighted);
      if (prev) {
        for (const m of prev.materials) {
          if (m.emissive && m.userData.baseEmissive) {
            m.emissive.copy(m.userData.baseEmissive);
            m.emissiveIntensity = m.userData.baseEmissiveIntensity;
          }
        }
      }
    }
    this.highlighted = id;
    const part = this.parts.get(id);
    if (!part) return null;
    for (const m of part.materials) {
      if (m.emissive) {
        m.emissive.setHex(ACCENT);
        m.emissiveIntensity = 0.55;
      }
    }
    return part;
  }

  clearSelection() {
    if (this.highlighted) this.select(null);
    this.highlighted = null;
  }

  getPart(id) {
    return this.parts.get(id) || null;
  }

  /* ---------------------------------------------------------------- */
  /*  Simulation                                                      */
  /* ---------------------------------------------------------------- */
  update(dt, state) {
    dt = Math.min(dt, 0.05);
    this.time += dt;

    const target = state.running ? state.targetRPM : 0;
    const response = state.running ? 2.2 : 1.8;
    this.rpm = damp(this.rpm, target, response, dt);
    if (this.rpm < 1 && !state.running) this.rpm = 0;
    this.load = Math.min(1, this.rpm / 4000);

    const speed = state.slowmo ? 0.22 : 1;
    const omega = (this.rpm / 60) * TAU * speed;
    this.theta = (this.theta + omega * dt) % (4 * Math.PI);

    const theta = this.theta;
    const thetaDeg = (theta * 180) / Math.PI;
    const crankAngle = thetaDeg % 360;

    // Crank and its attached parts
    this.rotating.spin.rotation.x = theta;
    if (this.stand.coupling) this.stand.coupling.rotation.x = theta;

    // Piston / rod kinematics — exact slider-crank solution.
    const ease = this._explodeEase();
    for (const ref of this.cylinderRefs) {
      const { cyl, pistonGroup, rodGroup } = ref;
      const s = pistonState(cyl, theta);
      const localOffset = ref.explodeLocal;
      pistonGroup.position.set(cyl.x + localOffset.x * ease, s.pinY + localOffset.y * ease, localOffset.z * ease);
      rodGroup.position.set(cyl.x + localOffset.x * ease, s.crankY + localOffset.y * ease, s.crankZ + localOffset.z * ease);
      ref.dir.set(0, s.pinY - s.crankY, -s.crankZ).normalize();
      rodGroup.quaternion.setFromUnitVectors(ref.up, ref.dir);
    }

    // Camshafts at exactly half crank speed.
    for (const cam of this.camRefs) cam.rotation.x = theta * 0.5;

    // Valves, springs, combustion flashes
    const showFlash = this.cutF > 0.15 && this.rpm > 20;
    for (const v of this.valveRefs) {
      const lift = valveLift(theta, v.peak);
      v.moving.position.y = -lift;
      v.spring.scale.y = (v.springHeight - lift) / v.springHeight;
      const cyc = cyclePhaseDeg(v.cyl, theta);
      const flash = showFlash ? Math.max(0, Math.sin((Math.PI * Math.min(cyc, 70)) / 70)) ** 2 : 0;
      v.flashMat.opacity = flash * 0.85;
      v.flash.visible = flash > 0.005;
    }

    // Rotating-assembly explosion offset
    if (this.rotating.spinParent) {
      this.rotating.spinParent.position.y = -1.15 * ease;
    }

    // Gentle firing-frequency vibration.
    const shake = this.load * 0.006;
    this.group.position.y = SPEC.engineY + Math.sin(theta * 4) * shake;
    this.group.rotation.z = Math.sin(theta * 4 + 0.7) * shake * 0.12;
    this.group.rotation.x = Math.sin(theta * 2) * shake * 0.06;

    // Shell fade
    this.cutF = damp(this.cutF, this.cutTarget, 5.5, dt);
    this._applyCutaway(this.cutF);

    // Exploded positions
    this.explodeF = damp(this.explodeF, this.explodeTarget, 4.2, dt);
    this._applyExplode(this.explodeF);

    // Telemetry
    const cycles = this.cylinders.map((c) => {
      const phase = cyclePhaseDeg(c, theta);
      return { id: c.id, phase, stroke: strokeForPhase(phase) };
    });

    return {
      rpm: this.rpm,
      theta,
      crankAngle,
      camAngle: (crankAngle * 0.5) % 360,
      cycles,
      load: this.load,
    };
  }

  _explodeEase() {
    const t = this.explodeF;
    return t * t * (3 - 2 * t);
  }

  _applyExplode(f) {
    const e = f * f * (3 - 2 * f);
    for (const p of this.partList) {
      if (p.manual || !p.explode) continue;
      p.group.position.copy(p.basePosition).addScaledVector(p.explode, e);
    }
  }

  _applyCutaway(f) {
    const k = Math.min(1, f * 1.06);
    const shellLit = f < 0.05;
    for (const p of this.parts.values()) {
      if (!p.cutaway) continue;
      for (const m of p.fadeMaterials) {
        const target = m.userData.cutOpacity ?? 0.1;
        m.opacity = THREE.MathUtils.lerp(m.userData.baseOpacity ?? 1, target, k);
        m.depthWrite = k < 0.02;
        // A faded casting still catches the environment map hard enough to
        // read as glass; pull its reflection down so internals stay legible.
        if (m.envMapIntensity !== undefined) {
          if (m.userData.baseEnv === undefined) m.userData.baseEnv = m.envMapIntensity;
          m.envMapIntensity = m.userData.baseEnv * (1 - k * 0.8);
        }
      }
      if (p.cutShadows !== shellLit) {
        p.cutShadows = shellLit;
        for (const m of p.fadeMeshes) m.castShadow = shellLit;
      }
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material?.dispose();
      }
    });
  }
}
