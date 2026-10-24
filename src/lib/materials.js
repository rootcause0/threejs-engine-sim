import * as THREE from 'three';
import {
  makeNoiseTexture,
  makeBrushedTexture,
  makeConcreteTextures,
  makeWallTextures,
  makeDoorTexture,
} from './textures.js';

/* ------------------------------------------------------------------ *
 *  Shared PBR material library.  Each part clones the materials it
 *  needs so that selection highlighting and cutaway can be applied
 *  per component without bleeding into its neighbours.
 * ------------------------------------------------------------------ */

export function createMaterialLibrary() {
  const castBump = makeNoiseTexture({ seed: 3, scale: 26, octaves: 5, contrast: 0.75 });
  castBump.repeat.set(2, 2);
  const fineBump = makeNoiseTexture({ seed: 11, scale: 64, octaves: 3, contrast: 0.6 });
  fineBump.repeat.set(3, 3);
  const brushed = makeBrushedTexture();
  brushed.repeat.set(1.5, 1.5);

  const std = (opts) => new THREE.MeshStandardMaterial(opts);
  const phys = (opts) => new THREE.MeshPhysicalMaterial(opts);

  const lib = {
    castAluminum: std({
      color: 0x84898c,
      metalness: 0.58,
      roughness: 0.58,
      bumpMap: castBump,
      bumpScale: 0.013,
      envMapIntensity: 0.85,
    }),
    castAluminumDark: std({
      color: 0x5e6467,
      metalness: 0.55,
      roughness: 0.62,
      bumpMap: castBump,
      bumpScale: 0.016,
      envMapIntensity: 0.9,
    }),
    machinedAluminum: std({
      color: 0xb6bbbe,
      metalness: 0.86,
      roughness: 0.3,
      roughnessMap: brushed,
      envMapIntensity: 0.95,
    }),
    machinedAluminumWarm: std({
      color: 0xb9b0a2,
      metalness: 0.95,
      roughness: 0.26,
      roughnessMap: brushed,
      envMapIntensity: 1.1,
    }),
    steel: std({
      color: 0x8b9094,
      metalness: 1.0,
      roughness: 0.3,
      roughnessMap: brushed,
      envMapIntensity: 1.1,
    }),
    polishedSteel: std({
      color: 0xd3d6d7,
      metalness: 1.0,
      roughness: 0.14,
      envMapIntensity: 1.3,
    }),
    darkSteel: std({
      color: 0x43474a,
      metalness: 0.94,
      roughness: 0.38,
      envMapIntensity: 0.9,
    }),
    blackOxide: std({
      color: 0x1c1e20,
      metalness: 0.85,
      roughness: 0.36,
      envMapIntensity: 0.8,
    }),
    forgedSteel: std({
      color: 0x5f6468,
      metalness: 0.95,
      roughness: 0.42,
      bumpMap: fineBump,
      bumpScale: 0.008,
      envMapIntensity: 0.95,
    }),
    castIron: std({
      color: 0x4e5254,
      metalness: 0.55,
      roughness: 0.68,
      bumpMap: castBump,
      bumpScale: 0.02,
      envMapIntensity: 0.75,
    }),
    headerSteel: std({
      color: 0x8b8479,
      metalness: 0.96,
      roughness: 0.44,
      roughnessMap: brushed,
      envMapIntensity: 0.9,
    }),
    headerTint: std({
      color: 0x6f685d,
      metalness: 0.95,
      roughness: 0.48,
      envMapIntensity: 0.8,
    }),
    crinkleBlack: std({
      color: 0x25292c,
      metalness: 0.32,
      roughness: 0.62,
      bumpMap: castBump,
      bumpScale: 0.012,
      envMapIntensity: 0.7,
    }),
    satinBlack: std({
      color: 0x202326,
      metalness: 0.55,
      roughness: 0.46,
      envMapIntensity: 0.8,
    }),
    rubber: std({
      color: 0x101214,
      metalness: 0.0,
      roughness: 0.94,
      bumpMap: fineBump,
      bumpScale: 0.006,
      envMapIntensity: 0.25,
    }),
    rubberRed: std({
      color: 0x5a1616,
      metalness: 0.0,
      roughness: 0.9,
      envMapIntensity: 0.25,
    }),
    ceramic: std({
      color: 0xe9e5da,
      metalness: 0.0,
      roughness: 0.34,
      envMapIntensity: 0.6,
    }),
    copper: std({
      color: 0xb87346,
      metalness: 1.0,
      roughness: 0.34,
      envMapIntensity: 1.1,
    }),
    brass: std({
      color: 0xc0a05a,
      metalness: 1.0,
      roughness: 0.3,
      envMapIntensity: 1.15,
    }),
    plasticBlack: std({
      color: 0x191b1d,
      metalness: 0.0,
      roughness: 0.56,
      envMapIntensity: 0.4,
    }),
    anodizedOrange: phys({
      color: 0xd8531f,
      metalness: 0.75,
      roughness: 0.3,
      clearcoat: 0.6,
      clearcoatRoughness: 0.3,
    }),
    anodizedBlue: phys({
      color: 0x2f5f86,
      metalness: 0.78,
      roughness: 0.28,
      clearcoat: 0.7,
      clearcoatRoughness: 0.25,
    }),
    standPaint: std({
      color: 0x2c3a3c,
      metalness: 0.62,
      roughness: 0.54,
      bumpMap: fineBump,
      bumpScale: 0.005,
      envMapIntensity: 0.8,
    }),
    safetyYellow: std({
      color: 0xc28b16,
      metalness: 0.35,
      roughness: 0.6,
      envMapIntensity: 0.5,
    }),
    cabinetRed: std({
      color: 0x7c1f18,
      metalness: 0.55,
      roughness: 0.45,
      envMapIntensity: 0.7,
    }),
    zinc: std({
      color: 0xa7aaa9,
      metalness: 0.9,
      roughness: 0.42,
      envMapIntensity: 0.95,
    }),
    glass: phys({
      color: 0x9fb6bd,
      metalness: 0.0,
      roughness: 0.08,
      transmission: 0.0,
      transparent: true,
      opacity: 0.25,
      envMapIntensity: 1.4,
      side: THREE.DoubleSide,
    }),
    screen: std({
      color: 0x0a0d0e,
      metalness: 0.1,
      roughness: 0.22,
      emissive: 0x223c33,
      emissiveIntensity: 0.5,
    }),
    ignition: new THREE.MeshBasicMaterial({
      color: 0xff7a2a,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    gasket: std({
      color: 0x2a2c2c,
      metalness: 0.25,
      roughness: 0.8,
      envMapIntensity: 0.4,
    }),
    belt: std({
      color: 0x141517,
      metalness: 0.05,
      roughness: 0.88,
      envMapIntensity: 0.3,
    }),
  };
  return lib;
}

/**
 * Clone a material, optionally applying overrides.  Geometry assembly code
 * uses this to give each selectable part its own material instances.
 */
export function own(mat, overrides = {}) {
  const m = mat.clone();
  const { color, ...rest } = overrides;
  Object.assign(m, rest);
  // `material.color` must stay a THREE.Color instance: assigning a raw hex
  // number through Object.assign poisons it with NaN channels, which renders
  // as blown-out white and breaks any later tone/exposure tuning.
  if (color !== undefined && m.color && m.color.isColor) m.color.set(color);
  return m;
}

/** Environment / room building materials (not per-component). */
export function createWorldMaterials() {
  const concrete = makeConcreteTextures();
  concrete.map.repeat.set(5, 4);
  concrete.roughness.repeat.set(5, 4);
  const wallMap = makeWallTextures();
  wallMap.repeat.set(5, 2);
  const wallMapDark = makeWallTextures({ base: '#2c2f30', seed: 44 });
  wallMapDark.repeat.set(4, 2);
  const doorMap = makeDoorTexture();
  doorMap.repeat.set(5, 4);

  return {
    floor: new THREE.MeshStandardMaterial({
      color: 0x9b9993,
      map: concrete.map,
      roughnessMap: concrete.roughness,
      roughness: 0.86,
      metalness: 0.06,
      envMapIntensity: 0.55,
    }),
    wall: new THREE.MeshStandardMaterial({
      color: 0x6e7272,
      map: wallMap,
      roughness: 0.92,
      metalness: 0.05,
      envMapIntensity: 0.35,
    }),
    wallDark: new THREE.MeshStandardMaterial({
      color: 0x585c5c,
      map: wallMapDark,
      roughness: 0.9,
      metalness: 0.08,
      envMapIntensity: 0.3,
    }),
    ceiling: new THREE.MeshStandardMaterial({
      color: 0x2b2e2f,
      roughness: 0.95,
      metalness: 0.05,
      envMapIntensity: 0.2,
    }),
    door: new THREE.MeshStandardMaterial({
      color: 0x9aa0a0,
      map: doorMap,
      metalness: 0.55,
      roughness: 0.52,
      envMapIntensity: 0.6,
    }),
    beam: new THREE.MeshStandardMaterial({
      color: 0x3a3e40,
      metalness: 0.75,
      roughness: 0.52,
      envMapIntensity: 0.55,
    }),
    floorLine: new THREE.MeshStandardMaterial({
      color: 0xc79a22,
      metalness: 0.15,
      roughness: 0.72,
      envMapIntensity: 0.3,
    }),
    windowGlow: new THREE.MeshBasicMaterial({ color: 0xbfd8e8 }),
    ledStrip: new THREE.MeshBasicMaterial({ color: 0xfff4e2 }),
    ledStripCool: new THREE.MeshBasicMaterial({ color: 0xd8e9ff }),
  };
}
