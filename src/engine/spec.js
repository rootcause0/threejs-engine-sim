export const DEG = Math.PI / 180;
export const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ *
 *  V8 geometry — all dimensions in "engine units" (roughly 10 cm).
 *  Crank axis is the engine-local origin, +Y up, +X towards the dyno.
 * ------------------------------------------------------------------ */
export const SPEC = {
  // Crank train.  Bore spacing 1.62, bore 1.20 -> a compact, real-looking V8.
  journalX: [-2.43, -0.81, 0.81, 2.43],
  throwAngleDeg: [0, 90, 270, 180],
  mainsX: [-3.24, -1.62, 0, 1.62, 3.24],

  crankRadius: 0.72,
  rodLength: 2.02,
  pinToCrown: 0.44,

  bankAngle: 45 * DEG,
  bankOffset: 0.28,

  // Bank-local heights.  Deck is set so the crown stops just under it.
  deckY: 3.2,
  bankWidth: 1.62,
  bankBaseY: 0.38,
  headTopY: 3.86,
  coverBottomY: 3.86,
  coverTopY: 4.84,
  coverWidth: 1.74,
  camY: 4.34,
  camZ: 0.34,
  camBaseR: 0.19,
  valveLift: 0.125,
  valveHalfDuration: 62.5 * DEG,

  boreR: 0.6,
  sleeveOuterR: 0.665,
  pistonR: 0.585,
  valveZ: 0.34,
  valveDX: 0.15,
  valveHeadR: 0.135,
  valveStemLen: 0.86,

  // Faces of the head casting, bank-local z.
  portFaceZ: 0.81,
  portFaceY: 3.5,

  intakePeakCycle: 450,
  exhaustPeakCycle: 270,

  blockHalfLength: 3.45,
  panBottomY: -1.6,

  engineY: 3.55,
};

/** Cam peak locations derived from the compression-TDC firing schedule. */
export function buildCylinders() {
  const cylinders = [];
  const firingOrder = [
    { id: 2, fire: 45, journal: 0, bank: 'R' },
    { id: 6, fire: 135, journal: 2, bank: 'R' },
    { id: 3, fire: 225, journal: 1, bank: 'L' },
    { id: 1, fire: 315, journal: 0, bank: 'L' },
    { id: 5, fire: 405, journal: 2, bank: 'L' },
    { id: 7, fire: 495, journal: 3, bank: 'L' },
    { id: 8, fire: 585, journal: 3, bank: 'R' },
    { id: 4, fire: 675, journal: 1, bank: 'R' },
  ];
  const bankFor = (bank) => (bank === 'L' ? -1 : 1);
  for (const row of firingOrder) {
    const sign = bankFor(row.bank);
    const a = sign * SPEC.bankAngle;
    const x = SPEC.journalX[row.journal];
    const pin = SPEC.throwAngleDeg[row.journal] * DEG;
    const fire = row.fire;
    const intakePeak = ((fire + SPEC.intakePeakCycle) % 720) * DEG;
    const exhaustPeak = ((fire + SPEC.exhaustPeakCycle) % 720) * DEG;
    cylinders.push({
      id: row.id,
      bank: row.bank,
      a,
      sign,
      journal: row.journal,
      x,
      pin,
      fire,
      intakePeak,
      exhaustPeak,
      index: row.journal,
      inboard: -Math.sign(a),
    });
  }
  cylinders.sort((p, q) => p.id - q.id);
  return cylinders;
}

export const CYLINDERS = buildCylinders();

export function wrapPi(a) {
  let x = a;
  while (x > Math.PI) x -= TAU;
  while (x < -Math.PI) x += TAU;
  return x;
}

/** Slider-crank solution: wrist-pin height above the crank axis (bank plane). */
export function pistonState(cyl, theta) {
  const R = SPEC.crankRadius;
  const L = SPEC.rodLength;
  const delta = theta + cyl.pin - cyl.a;
  const sinD = Math.sin(delta);
  const cosD = Math.cos(delta);
  const pinY = R * cosD + Math.sqrt(L * L - R * R * sinD * sinD);
  const crankY = R * cosD;
  const crankZ = R * sinD;
  const rodAngle = Math.atan2(-crankZ, pinY - crankY);
  return { pinY, crankY, crankZ, rodAngle, delta };
}

/** Cycle phase in degrees, 0 = compression TDC / beginning of power stroke. */
export function cyclePhaseDeg(cyl, theta) {
  const deg = (theta * 180) / Math.PI;
  return ((deg - cyl.fire) % 720 + 720) % 720;
}

export function strokeForPhase(phase) {
  if (phase < 180) return 'power';
  if (phase < 360) return 'exhaust';
  if (phase < 540) return 'intake';
  return 'compression';
}

export const STROKE_LABEL = {
  intake: 'Intake',
  compression: 'Compression',
  power: 'Power',
  exhaust: 'Exhaust',
};

/** Cam-driven valve lift; matches the actual lobe geometry exactly. */
export function valveLift(theta, peakAngle, maxLift = SPEC.valveLift) {
  const da = wrapPi((theta - peakAngle) * 0.5);
  if (Math.abs(da) >= SPEC.valveHalfDuration) return 0;
  const u = da / SPEC.valveHalfDuration;
  const t = 0.5 + 0.5 * Math.cos(Math.PI * u);
  return maxLift * Math.pow(t, 1.15);
}

/** Convert bank-local point to engine-local point. */
export function bankToEngine(a, x, y, z) {
  const off = a < 0 ? -SPEC.bankOffset : SPEC.bankOffset;
  return {
    x: x + off,
    y: y * Math.cos(a) - z * Math.sin(a),
    z: y * Math.sin(a) + z * Math.cos(a),
  };
}

export const PARTS_COPY = {
  block: {
    name: 'Cylinder Block',
    description:
      'Deep-skirt aluminium block with pressed-in iron liners. The 90° vee carries both banks on a common crankcase; coolant jackets and main bearing bulkheads are visible through the cutaway.',
    meta: ['CAST ALUMINIUM', '8 × LINER', '90° VEE'],
  },
  headL: {
    name: 'Cylinder Head — Left Bank',
    description:
      'Cross-flow DOHC head with four valves per cylinder. Twin belt-driven camshafts act directly on bucket tappets; the ports and combustion chambers are exposed in cutaway mode.',
    meta: ['DOHC 16V', 'ALUMINIUM', 'BANK 1·3·5·7'],
  },
  headR: {
    name: 'Cylinder Head — Right Bank',
    description:
      'Mirror-image cross-flow head for cylinders 2·4·6·8. Each camshaft turns at exactly half crankshaft speed, driven from the front of the block.',
    meta: ['DOHC 16V', 'ALUMINIUM', 'BANK 2·4·6·8'],
  },
  coverL: {
    name: 'Cam Cover — Left Bank',
    description:
      'Cast magnesium cam cover with machined ribs and an oil filler. Twelve fasteners seal it against the head; coil-on-plug units sit beneath the cover.',
    meta: ['MAGNESIUM', 'COIL-ON-PLUG', '12 FASTENERS'],
  },
  coverR: {
    name: 'Cam Cover — Right Bank',
    description:
      'Right-bank cam cover, sealing the exhaust and intake camshaft bearings. The badge is machined from billet before anodising.',
    meta: ['MAGNESIUM', 'COIL-ON-PLUG', '12 FASTENERS'],
  },
  intake: {
    name: 'Intake Manifold',
    description:
      'Cast-aluminium plenum feeding eight tuned runners, one per cylinder. Twin fuel rails carry direct-port injectors; a single 82 mm throttle body controls airflow.',
    meta: ['CAST ALUMINIUM', '8 RUNNERS', '82 mm TB'],
  },
  exhaustL: {
    name: 'Exhaust Header — Left Bank',
    description:
      'Four-into-one stainless header. Equal-length primaries are TIG welded into a merged collector to scavenge the left bank; heat tint shows the weld zones.',
    meta: ['304 STAINLESS', '4-1 MERGE', 'TIG WELDED'],
  },
  exhaustR: {
    name: 'Exhaust Header — Right Bank',
    description:
      'Right-bank four-into-one header, tucked tight against the block. The collector points rearward toward the cell extraction system.',
    meta: ['304 STAINLESS', '4-1 MERGE', 'TIG WELDED'],
  },
  pan: {
    name: 'Oil Pan',
    description:
      'Structural aluminium sump with windage tray and a rear drain plug. The deep front bowl keeps the pickup submerged under sustained load.',
    meta: ['ALUMINIUM', 'WINDAGE TRAY', '6.5 L'],
  },
  timing: {
    name: 'Timing Cover',
    description:
      'Front cover enclosing the timing drive and coolant pump. A machined seal groove and sixteen fasteners keep the front of the engine oil-tight.',
    meta: ['DIE-CAST', 'TIMING DRIVE', '16 FASTENERS'],
  },
  crank: {
    name: 'Crankshaft',
    description:
      'Forged 4340 steel crankshaft, four throws at 90°. Counterweights balance the rotating assembly; it spins at up to 4,000 rpm in this cell.',
    meta: ['FORGED 4340', '90° THROWS', '5 MAIN BEARINGS'],
  },
  piston: {
    name: 'Piston & Connecting Rod',
    description:
      'Forged piston on an I-beam connecting rod. The slider-crank linkage is solved every frame so the wrist pin, rod and crank journal stay exactly connected.',
    meta: ['FORGED', 'SLIPPER SKIRT', '3 RINGS'],
  },
  valveTrain: {
    name: 'Valve Train',
    description:
      'Thirty-two valves driven by four overhead camshafts at half crank speed. Springs and bucket tappets track the real cam lobe profile.',
    meta: ['32 VALVES', '4 CAMSHAFTS', 'BUCKET TAPPETS'],
  },
  flywheel: {
    name: 'Flywheel & Coupling',
    description:
      'Billet steel flywheel with a 56-tooth ring gear, bolted to the crank flange and coupled to the eddy-current absorber on the test stand.',
    meta: ['BILLET STEEL', '56-TOOTH', 'DYNO COUPLED'],
  },
  damper: {
    name: 'Crank Damper',
    description:
      'Torsional vibration damper and serpentine pulley at the nose of the crankshaft. The elastomer ring isolates crank harmonics from the accessory drive.',
    meta: ['ELASTOMER', 'SERPENTINE', '8 RIBS'],
  },
  stand: {
    name: 'Engine Test Stand',
    description:
      'Fabricated steel dyno skid with four-point isolation mounts. The rails carry the engine, absorber pedestal and control cabinet.',
    meta: ['FABRICATED STEEL', '4-POINT MOUNT', 'ANCHORED'],
  },
  dyno: {
    name: 'Eddy-Current Absorber',
    description:
      'Water-cooled eddy-current dynamometer rated for 600 kW. It loads the engine through the flywheel coupling and reports speed to the cell controller.',
    meta: ['600 kW', 'WATER COOLED', 'DYNO'],
  },
  cabinet: {
    name: 'Cell Control Cabinet',
    description:
      'Dynamometer controller with live speed display, load setpoint and emergency stop. All cell interlocks route through this panel.',
    meta: ['CONTROL', 'E-STOP', 'LIVE TELEMETRY'],
  },
  injector: {
    name: 'Fuel Rail & Injectors',
    description:
      'High-pressure fuel rail feeding eight port injectors. Each injector sprays toward the intake port just upstream of the valve.',
    meta: ['STAINLESS RAIL', '8 INJECTORS', '4.5 BAR'],
  },
  throttle: {
    name: 'Throttle Body',
    description:
      'Cable-less 82 mm throttle body with an integrated position sensor. The single blade feeds the shared plenum.',
    meta: ['82 mm', 'DRIVE-BY-WIRE', 'ALUMINIUM'],
  },
  plug: {
    name: 'Spark Plug',
    description:
      'Iridium spark plug with a ceramic insulator, indexed into the combustion chamber between the valves.',
    meta: ['IRIDIUM', 'M14 THREAD', 'CERAMIC'],
  },
  mount: {
    name: 'Engine Mount',
    description:
      'Rubber-isolated mounting bracket tying the block to the dyno skid. The isolator absorbs the engine’s firing-frequency vibration.',
    meta: ['RUBBER ISOLATOR', 'STEEL BRACKET'],
  },
};
