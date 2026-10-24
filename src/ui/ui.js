import * as THREE from 'three';
import { STROKE_LABEL } from '../engine/spec.js';

const $ = (sel) => document.querySelector(sel);

const STROKE_CLASS = {
  intake: 'intake',
  compression: 'comp',
  power: 'power',
  exhaust: 'exh',
};

export class UI {
  constructor(engine, rig, stand) {
    this.engine = engine;
    this.rig = rig;
    this.stand = stand;
    this.state = {
      running: false,
      targetRPM: 850,
      slowmo: false,
    };
    this.cutaway = false;
    this.exploded = false;
    this.selectedPart = null;
    this._lastStroke = new Array(8).fill('');
    this._screenAcc = 0;
    this._toastTimer = 0;

    this.el = {
      power: $('#power-btn'),
      powerText: $('#power-btn .power-text b'),
      powerSub: $('#power-btn .power-text small'),
      rpmSlider: $('#rpm-slider'),
      rpmOutput: $('#rpm-output'),
      rpmValue: $('#rpm-value'),
      tachFill: $('#tach-fill'),
      crank: $('#crank-angle'),
      cam: $('#cam-angle'),
      cycle: $('#cycle-state'),
      pill: $('#state-pill'),
      pillText: $('#state-text'),
      strokes: $('#stroke-indicators'),
      cutaway: $('#cutaway-btn'),
      explode: $('#explode-btn'),
      explodeLabel: $('#explode-label'),
      slowmo: $('#slowmo-btn'),
      inspector: $('#inspector'),
      inspTag: $('#insp-tag'),
      inspTitle: $('#insp-title'),
      inspBody: $('#insp-body'),
      inspMeta: $('#insp-meta'),
      inspClear: $('#insp-clear'),
      hint: $('#hint-text'),
      hintWrap: $('#mode-hint'),
      toast: $('#toast'),
      modes: document.querySelectorAll('[data-mode]'),
    };

    this._buildStrokes();
    this._bind();
    this._drawScreen(0, 0, 0, 0);
  }

  /* ------------------------------------------------------------ */
  _buildStrokes() {
    const host = this.el.strokes;
    host.innerHTML = '';
    for (let i = 1; i <= 8; i++) {
      const col = document.createElement('div');
      col.className = 'stroke-col';
      col.dataset.cyl = String(i);
      col.title = `Cylinder ${i}`;
      const label = document.createElement('em');
      label.textContent = String(i);
      const bar = document.createElement('div');
      bar.className = 'stroke-bar';
      col.append(label, bar);
      host.append(col);
    }
    this._strokeEls = [...host.children];
  }

  _bind() {
    this.el.power.addEventListener('click', () => this.togglePower());
    this.el.rpmSlider.addEventListener('input', (e) => {
      this.state.targetRPM = Number(e.target.value);
      this.el.rpmOutput.textContent = String(this.state.targetRPM);
    });

    this.el.cutaway.addEventListener('click', () => this.toggleCutaway());
    this.el.explode.addEventListener('click', () => this.toggleExplode());
    this.el.slowmo.addEventListener('click', () => this.toggleSlowmo());

    this.el.modes.forEach((b) => {
      b.addEventListener('click', () => this.setMode(b.dataset.mode));
    });

    document.querySelector('[data-action="reset"]').addEventListener('click', () => {
      this.rig.reset();
      this.toast('CAMERA RESET');
    });

    this.el.inspClear.addEventListener('click', () => this.clearSelection());

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          this.togglePower();
          break;
        case 'KeyC':
          this.toggleCutaway();
          break;
        case 'KeyX':
          this.toggleExplode();
          break;
        case 'KeyM':
          this.toggleSlowmo();
          break;
        case 'KeyR':
          this.rig.reset();
          this.toast('CAMERA RESET');
          break;
        case 'KeyV':
          this.setMode(this.rig.mode === 'walk' ? 'orbit' : 'walk');
          break;
        case 'Digit1':
        case 'Digit2':
        case 'Digit3':
          this.rig.setView(Number(e.code.slice(-1)));
          this.setModeButtons('orbit');
          this.toast(`VIEW ${e.code.slice(-1)}`);
          break;
        case 'Escape':
          if (!this.rig.pointerLocked) this.clearSelection();
          break;
        default:
          break;
      }
    });
  }

  /* ------------------------------------------------------------ */
  togglePower() {
    this.state.running = !this.state.running;
    if (this.state.running && this.state.targetRPM < 250) {
      this.state.targetRPM = 850;
      this.el.rpmSlider.value = '850';
      this.el.rpmOutput.textContent = '850';
    }
    this.el.power.classList.toggle('running', this.state.running);
    this.el.powerText.textContent = this.state.running ? 'STOP' : 'START';
    this.el.powerSub.textContent = this.state.running ? 'RUNNING' : 'ENGINE';
    this.toast(this.state.running ? `ENGINE STARTING · ${this.state.targetRPM} RPM` : 'ENGINE STOPPED');
  }

  toggleCutaway() {
    this.cutaway = !this.cutaway;
    this.engine.setCutaway(this.cutaway);
    this.el.cutaway.classList.toggle('active', this.cutaway);
    this.toast(this.cutaway ? 'CUTAWAY ENGAGED' : 'CUTAWAY CLOSED');
  }

  toggleExplode() {
    this.exploded = !this.exploded;
    this.engine.setExploded(this.exploded);
    this.el.explode.classList.toggle('active', this.exploded);
    this.el.explodeLabel.textContent = this.exploded ? 'ASSEMBLE' : 'EXPLODED';
    this.toast(this.exploded ? 'EXPLODED VIEW' : 'ASSEMBLING');
  }

  toggleSlowmo() {
    this.state.slowmo = !this.state.slowmo;
    this.el.slowmo.classList.toggle('active', this.state.slowmo);
    this.toast(this.state.slowmo ? 'SLOW MOTION ×0.22' : 'REAL-TIME SPEED');
  }

  setMode(mode) {
    this.rig.setMode(mode);
    this.setModeButtons(mode);
    if (mode === 'walk') {
      this.el.hintWrap.classList.add('walk');
      this.el.hint.textContent = 'WASD MOVE · MOUSE LOOK · CLICK TO CAPTURE · ESC TO RELEASE';
      this.toast('WALK MODE · CLICK TO CAPTURE MOUSE');
    } else {
      this.el.hintWrap.classList.remove('walk');
      this.el.hint.textContent = 'DRAG TO ORBIT · SCROLL TO ZOOM · RIGHT-DRAG TO PAN';
      this.toast('ORBIT MODE');
    }
  }

  setModeButtons(mode) {
    this.el.modes.forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  }

  /* ------------------------------------------------------------ */
  selectPart(part) {
    if (!part) return this.clearSelection();
    this.selectedPart = part;
    this.engine.select(part.id);
    this.el.inspector.classList.add('active');
    this.el.inspTag.textContent = part.id
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([a-zA-Z])(\d)/g, '$1 $2')
      .toUpperCase();
    this.el.inspTitle.textContent = part.name;
    this.el.inspBody.textContent = part.description;
    this.el.inspMeta.innerHTML = '';
    for (const m of part.meta) {
      const s = document.createElement('span');
      s.textContent = m;
      this.el.inspMeta.append(s);
    }
    this.el.inspClear.hidden = false;
  }

  clearSelection() {
    this.engine.clearSelection();
    this.selectedPart = null;
    this.el.inspector.classList.remove('active');
    this.el.inspTag.textContent = 'SELECT A COMPONENT';
    this.el.inspTitle.textContent = 'Engine Assembly';
    this.el.inspBody.textContent =
      'Click any component of the engine or test stand to identify it. Drag to orbit, scroll to zoom, or switch to walk mode for a first-person view.';
    this.el.inspMeta.innerHTML = '';
    this.el.inspClear.hidden = true;
  }

  toast(message) {
    const t = this.el.toast;
    t.textContent = message;
    t.hidden = false;
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => {
        if (!t.classList.contains('show')) t.hidden = true;
      }, 320);
    }, 1900);
  }

  /* ------------------------------------------------------------ */
  update(tel, dt) {
    const rpm = Math.round(tel.rpm);
    this.el.rpmValue.textContent = String(rpm).padStart(4, '0');
    this.el.tachFill.style.width = `${Math.min(100, (tel.rpm / 4200) * 100)}%`;

    this.el.crank.textContent = `${tel.crankAngle.toFixed(1).padStart(5, '0')}°`;
    this.el.cam.textContent = `${tel.camAngle.toFixed(1).padStart(5, '0')}°`;

    const c1 = tel.cycles.find((c) => c.id === 1);
    if (c1) {
      this.el.cycle.textContent = `${STROKE_LABEL[c1.stroke].toUpperCase()} ${Math.round(c1.phase % 180)}°`;
    }

    // stroke indicators
    for (let i = 0; i < tel.cycles.length; i++) {
      const cyc = tel.cycles[i];
      const cls = STROKE_CLASS[cyc.stroke];
      const key = cyc.stroke;
      if (this._lastStroke[i] !== key) {
        this._lastStroke[i] = key;
        const el = this._strokeEls[i];
        if (el) {
          el.className = `stroke-col ${cls}`;
          el.title = `Cylinder ${cyc.id} — ${STROKE_LABEL[cyc.stroke]}`;
        }
      }
    }

    // state pill
    const pill = this.el.pill;
    const running = this.state.running;
    pill.classList.toggle('on', running && !this.state.slowmo);
    pill.classList.toggle('slow', running && this.state.slowmo);
    this.el.pillText.textContent = running ? (this.state.slowmo ? 'SLOW-MO' : 'RUNNING') : 'STANDBY';

    // cabinet beacon
    if (this.stand?.beacon) {
      const b = this.stand.beacon;
      this._beaconColor = this._beaconColor || new THREE.Color();
      this._beaconColor.setHex(running ? 0x2ec46f : 0x6b1a10);
      b.emissive.lerp(this._beaconColor, Math.min(1, dt * 3));
      b.emissiveIntensity = running ? 1.5 : 0.45;
    }

    // instrument screen at ~12 Hz
    this._screenAcc += dt;
    if (this._screenAcc > 0.08) {
      this._screenAcc = 0;
      this._drawScreen(tel.rpm, tel.load, tel.crankAngle, running);
    }
  }

  _drawScreen(rpm, load, crank, running) {
    const s = this.stand?.screen;
    if (!s) return;
    const g = s.ctx;
    const W = 512;
    const H = 320;
    g.clearRect(0, 0, W, H);

    g.fillStyle = '#07100d';
    g.fillRect(0, 0, W, H);

    // header
    g.fillStyle = '#0d1a16';
    g.fillRect(0, 0, W, 44);
    g.fillStyle = '#7fe0b0';
    g.font = '600 17px "SF Mono", monospace';
    g.fillText('DYNO CELL 03', 18, 28);
    g.fillStyle = running ? '#7be9a2' : '#6b7a74';
    g.font = '500 14px "SF Mono", monospace';
    g.textAlign = 'right';
    g.fillText(running ? '● RUN' : '● IDLE', W - 18, 28);
    g.textAlign = 'left';

    // rpm
    g.fillStyle = '#d9f7e8';
    g.font = '300 96px "Helvetica Neue", Arial, sans-serif';
    g.fillText(String(Math.round(rpm)).padStart(4, '0'), 18, 152);
    g.fillStyle = '#5f8a7a';
    g.font = '600 18px "SF Mono", monospace';
    g.fillText('RPM', 22, 178);

    // tach bar
    const bx = 18;
    const by = 198;
    const bw = W - 36;
    const bh = 16;
    g.fillStyle = '#0f221c';
    g.fillRect(bx, by, bw, bh);
    const frac = Math.min(1, rpm / 4200);
    const grad = g.createLinearGradient(bx, 0, bx + bw, 0);
    grad.addColorStop(0, '#3e8f6d');
    grad.addColorStop(0.66, '#c8b24a');
    grad.addColorStop(0.88, '#e07a2f');
    grad.addColorStop(1, '#d6442a');
    g.fillStyle = grad;
    g.fillRect(bx, by, bw * frac, bh);
    // scale ticks
    g.fillStyle = '#2a4740';
    for (let i = 0; i <= 8; i++) {
      g.fillRect(bx + (bw / 8) * i, by + bh + 3, 1, 5);
    }
    g.fillStyle = '#5f8a7a';
    g.font = '400 11px "SF Mono", monospace';
    for (let i = 0; i <= 8; i += 2) {
      g.fillText(String(i * 500), bx + (bw / 8) * i - 8, by + bh + 22);
    }

    // torque / power / load
    const torque = running ? 300 + 130 * Math.sin((rpm / 4000) * 2.4) : 0;
    const power = (torque * rpm) / 9549;
    g.fillStyle = '#8fd9b9';
    g.font = '500 15px "SF Mono", monospace';
    g.fillText('TORQUE', 18, 262);
    g.fillText('POWER', 152, 262);
    g.fillText('CRANK', 274, 262);
    g.fillText('LOAD', 388, 262);
    g.fillStyle = '#e6fbf1';
    g.font = '600 22px "SF Mono", monospace';
    g.fillText(`${torque.toFixed(0)}`, 18, 290);
    g.fillText(`${power.toFixed(0)}`, 152, 290);
    g.fillText(`${crank.toFixed(0)}°`, 274, 290);
    g.fillText(`${(load * 100).toFixed(0)}%`, 388, 290);
    g.fillStyle = '#5f8a7a';
    g.font = '400 10px "SF Mono", monospace';
    g.fillText('Nm', 74, 290);
    g.fillText('kW', 206, 290);

    // divider
    g.strokeStyle = '#173029';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, 244);
    g.lineTo(W, 244);
    g.stroke();

    s.texture.needsUpdate = true;
  }
}
