import * as THREE from 'three';

const DEFAULT_ORBIT = {
  theta: -0.58,
  phi: 1.27,
  radius: 18.6,
  target: new THREE.Vector3(0.9, 3.85, 0),
};

const VIEWS = [
  { theta: -0.58, phi: 1.27, radius: 18.6, target: new THREE.Vector3(0.9, 3.85, 0) },
  { theta: 0.04, phi: 1.4, radius: 13.4, target: new THREE.Vector3(0.7, 3.6, 0) },
  { theta: -0.42, phi: 0.5, radius: 16.6, target: new THREE.Vector3(0.8, 3.4, 0) },
];

const STAND_BLOCK = { x0: -5.4, x1: 9.3, z0: -3.3, z1: 6.1 };

export class CameraRig {
  constructor(camera, dom, { room, onModeChange } = {}) {
    this.camera = camera;
    this.dom = dom;
    this.room = room || { x0: -18, x1: 22, z0: -15, z1: 16, h: 15 };
    this.onModeChange = onModeChange || (() => {});

    this.mode = 'orbit';
    this.enabled = true;
    this.dragMoved = false;

    this.orbit = {
      theta: DEFAULT_ORBIT.theta,
      phi: DEFAULT_ORBIT.phi,
      radius: DEFAULT_ORBIT.radius,
      target: DEFAULT_ORBIT.target.clone(),
    };
    this.goal = {
      theta: DEFAULT_ORBIT.theta,
      phi: DEFAULT_ORBIT.phi,
      radius: DEFAULT_ORBIT.radius,
      target: DEFAULT_ORBIT.target.clone(),
    };

    this.walk = {
      pos: new THREE.Vector3(-11.2, 1.68, 13.2),
      yaw: -0.68,
      pitch: 0.13,
      vel: new THREE.Vector3(),
      bob: 0,
    };

    this.keys = new Set();
    this.pointers = new Map();
    this._dragging = false;
    this._panning = false;
    this._last = { x: 0, y: 0 };
    this._start = { x: 0, y: 0 };
    this._locked = false;
    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
    this._bind();
    this.apply(1);
  }

  /* ------------------------------------------------------------ */
  _bind() {
    const dom = this.dom;
    this._onPointerDown = (e) => {
      if (!this.enabled) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size > 1) return;
      dom.setPointerCapture?.(e.pointerId);
      this._dragging = true;
      this._panning = e.button === 2 || e.shiftKey;
      this._last = { x: e.clientX, y: e.clientY };
      this._start = { x: e.clientX, y: e.clientY };
      this.dragMoved = false;
      if (this.mode === 'walk' && !this._locked && e.button === 0) {
        // left drag looks around when pointer lock is unavailable
      }
    };

    this._onPointerMove = (e) => {
      if (!this.enabled) return;
      if (!this._dragging || !this.pointers.has(e.pointerId)) return;
      const dx = e.clientX - this._last.x;
      const dy = e.clientY - this._last.y;
      this._last = { x: e.clientX, y: e.clientY };
      if (Math.hypot(e.clientX - this._start.x, e.clientY - this._start.y) > 4) {
        this.dragMoved = true;
      }

      if (this.mode === 'orbit') {
        if (this._panning) this._pan(dx, dy);
        else this._orbitBy(dx, dy);
      } else if (!this._locked) {
        this.walk.yaw -= dx * 0.0024;
        this.walk.pitch = THREE.MathUtils.clamp(this.walk.pitch - dy * 0.0024, -1.3, 1.3);
      }
    };

    this._onPointerUp = (e) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size === 0) {
        this._dragging = false;
        this._panning = false;
        dom.releasePointerCapture?.(e.pointerId);
      }
    };

    this._onWheel = (e) => {
      if (!this.enabled || this.mode !== 'orbit') return;
      e.preventDefault();
      const scale = Math.exp(e.deltaY * 0.0009);
      this.goal.radius = THREE.MathUtils.clamp(this.goal.radius * scale, 6.2, 26);
    };

    this._onMouseMoveLocked = (e) => {
      if (!this._locked) return;
      this.walk.yaw -= e.movementX * 0.0022;
      this.walk.pitch = THREE.MathUtils.clamp(this.walk.pitch - e.movementY * 0.0022, -1.3, 1.3);
    };

    this._onLockChange = () => {
      this._locked = document.pointerLockElement === dom;
    };

    this._onClick = () => {
      if (this.mode === 'walk' && !this._locked) {
        dom.requestPointerLock?.();
      }
    };

    this._onKeyDown = (e) => {
      this.keys.add(e.code);
      if (this.mode === 'walk') {
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
          e.preventDefault();
        }
      }
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onBlur = () => this.keys.clear();

    dom.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('pointercancel', this._onPointerUp);
    dom.addEventListener('wheel', this._onWheel, { passive: false });
    dom.addEventListener('click', this._onClick);
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousemove', this._onMouseMoveLocked);
    document.addEventListener('pointerlockchange', this._onLockChange);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
  }

  get pointerLocked() {
    return this._locked;
  }

  _orbitBy(dx, dy) {
    this.goal.theta -= dx * 0.0042;
    this.goal.phi = THREE.MathUtils.clamp(this.goal.phi - dy * 0.0034, 0.16, 1.53);
  }

  _pan(dx, dy) {
    const scale = this.orbit.radius * 0.0016;
    const right = this._tmp.setFromMatrixColumn(this.camera.matrix, 0);
    const up = this._tmp2.setFromMatrixColumn(this.camera.matrix, 1);
    this.goal.target.addScaledVector(right, -dx * scale);
    this.goal.target.addScaledVector(up, dy * scale);
    this.goal.target.x = THREE.MathUtils.clamp(this.goal.target.x, -6, 9.5);
    this.goal.target.y = THREE.MathUtils.clamp(this.goal.target.y, 1.0, 8.6);
    this.goal.target.z = THREE.MathUtils.clamp(this.goal.target.z, -4.5, 5.4);
  }

  /* ------------------------------------------------------------ */
  setMode(mode) {
    if (mode === this.mode) return;
    if (mode === 'walk') {
      // Continue from where the camera is, but aim the head at the engine:
      // inheriting the orbit pitch pointed the first-person view at the floor.
      const p = this.camera.position.clone();
      p.y = 1.68;
      this._clampWalk(p);
      const aim = new THREE.Vector3(0.8, 4.2, 0).sub(p);
      this.walk.pos.copy(p);
      this.walk.yaw = Math.atan2(-aim.x, -aim.z);
      this.walk.pitch = THREE.MathUtils.clamp(
        Math.atan2(aim.y, Math.hypot(aim.x, aim.z) || 1),
        -1.2,
        1.2
      );
      this.keys.clear();
      this.mode = 'walk';
    } else {
      this.mode = 'orbit';
      if (document.pointerLockElement === this.dom) document.exitPointerLock?.();
      this.goal.theta = this.orbit.theta;
      this.goal.phi = this.orbit.phi;
      this.goal.radius = this.orbit.radius;
      this.goal.target.copy(this.orbit.target);
    }
    document.body.classList.toggle('walking', this.mode === 'walk');
    this.onModeChange(this.mode, this._locked);
  }

  reset() {
    this.setMode('orbit');
    this.goal.theta = DEFAULT_ORBIT.theta;
    this.goal.phi = DEFAULT_ORBIT.phi;
    this.goal.radius = DEFAULT_ORBIT.radius;
    this.goal.target.copy(DEFAULT_ORBIT.target);
  }

  setView(n) {
    const v = VIEWS[THREE.MathUtils.clamp(n - 1, 0, VIEWS.length - 1)];
    this.setMode('orbit');
    this.goal.theta = v.theta;
    this.goal.phi = v.phi;
    this.goal.radius = v.radius;
    this.goal.target.copy(v.target);
  }

  _clampWalk(p) {
    const r = this.room;
    p.x = THREE.MathUtils.clamp(p.x, r.x0 + 1.0, r.x1 - 1.0);
    p.z = THREE.MathUtils.clamp(p.z, r.z0 + 1.0, r.z1 - 1.0);
    const b = STAND_BLOCK;
    if (p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1) {
      // push out to the nearest face
      const d = [p.x - b.x0, b.x1 - p.x, p.z - b.z0, b.z1 - p.z];
      const m = Math.min(...d);
      if (m === d[0]) p.x = b.x0;
      else if (m === d[1]) p.x = b.x1;
      else if (m === d[2]) p.z = b.z0;
      else p.z = b.z1;
    }
  }

  update(dt) {
    dt = Math.min(dt, 0.05);
    if (this.mode === 'walk') this._updateWalk(dt);
    else this._updateOrbit(dt);
  }

  _updateOrbit(dt) {
    const k = 1 - Math.exp(-7.5 * dt);
    this.orbit.theta += (this.goal.theta - this.orbit.theta) * k;
    this.orbit.phi += (this.goal.phi - this.orbit.phi) * k;
    this.orbit.radius += (this.goal.radius - this.orbit.radius) * k;
    this.orbit.target.lerp(this.goal.target, k);
    this.apply(k);
  }

  apply() {
    const { theta, phi, radius, target } = this.orbit;
    const sp = Math.sin(phi);
    const x = target.x + radius * sp * Math.sin(theta);
    const y = target.y + radius * Math.cos(phi);
    const z = target.z + radius * sp * Math.cos(theta);
    const r = this.room;
    this.camera.position.set(
      THREE.MathUtils.clamp(x, r.x0 + 0.9, r.x1 - 0.9),
      THREE.MathUtils.clamp(y, 0.75, r.h - 0.8),
      THREE.MathUtils.clamp(z, r.z0 + 0.9, r.z1 - 0.9)
    );
    this.camera.lookAt(target);
  }

  _updateWalk(dt) {
    const w = this.walk;
    const speed = (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 8.2 : 3.6);
    let f = 0;
    let s = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) f += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) f -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) s += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) s -= 1;

    const sin = Math.sin(w.yaw);
    const cos = Math.cos(w.yaw);
    const dir = this._tmp.set(-sin * f + cos * s, 0, -cos * f - sin * s);
    if (dir.lengthSq() > 0) dir.normalize();

    w.vel.x += (dir.x * speed - w.vel.x) * (1 - Math.exp(-11 * dt));
    w.vel.z += (dir.z * speed - w.vel.z) * (1 - Math.exp(-11 * dt));

    w.pos.x += w.vel.x * dt;
    w.pos.z += w.vel.z * dt;
    this._clampWalk(w.pos);

    const moving = Math.hypot(w.vel.x, w.vel.z);
    w.bob += moving * dt * 2.4;
    const bobY = Math.sin(w.bob) * 0.022 * Math.min(1, moving / 2);
    w.pos.y = 1.68 + bobY;

    this.camera.position.copy(w.pos);
    this.camera.rotation.set(0, 0, 0);
    const euler = new THREE.Euler(w.pitch, w.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);
  }

  dispose() {
    const dom = this.dom;
    dom.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('pointercancel', this._onPointerUp);
    dom.removeEventListener('wheel', this._onWheel);
    dom.removeEventListener('click', this._onClick);
    document.removeEventListener('mousemove', this._onMouseMoveLocked);
    document.removeEventListener('pointerlockchange', this._onLockChange);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
  }
}
