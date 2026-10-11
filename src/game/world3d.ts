import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { chapterById } from "./campaign";
import { COLS, DEFS, ROWS, TILE, WORLD_H, WORLD_W, wingOf, type Kind } from "./content";
import type { Ent, Sim } from "./sim";

export type Glance = "tac" | "eye";

export interface EyeLook {
  yaw: number;
  pitch: number;
  fov: number;
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const SPHERE = new THREE.SphereGeometry(1, 20, 14);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 18);
const CAP = new THREE.CapsuleGeometry(1, 1.15, 6, 10);
const CONE = new THREE.ConeGeometry(1, 1, 10);
const ROCK = new THREE.DodecahedronGeometry(1, 1);
const TORUS = new THREE.TorusGeometry(1, 0.18, 8, 20);
for (const geo of [BOX, SPHERE, CYL, CAP, CONE, ROCK, TORUS]) geo.userData.shared = 1;

function grayCamo(seed: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext("2d");
  if (!g) return new THREE.CanvasTexture(canvas);
  g.fillStyle = "#7a7a7a";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 20; i++) {
    const shade = 48 + ((seed * 17 + i * 41) % 110);
    g.fillStyle = `rgba(${shade},${shade},${shade},0.7)`;
    g.beginPath();
    g.ellipse((seed * 53 + i * 67) % 290 - 16, (seed * 31 + i * 47) % 290 - 16, 30 + (i % 4) * 18, 14 + (i % 5) * 8, (seed + i) * 0.45, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = "rgba(20,20,20,0.35)";
  g.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.moveTo(0, (seed * 18 + i * 40) % 256);
    g.lineTo(256, (seed * 12 + i * 40 + 24) % 256);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function panelTex(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext("2d");
  if (!g) return new THREE.CanvasTexture(canvas);
  g.fillStyle = "#b0b7bb";
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#667077";
  g.lineWidth = 5;
  for (let i = 8; i < 256; i += 64) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 256);
    g.stroke();
    g.beginPath();
    g.moveTo(0, i);
    g.lineTo(256, i);
    g.stroke();
  }
  g.fillStyle = "#879198";
  for (let y = 16; y < 240; y += 64) for (let x = 16; x < 240; x += 64) g.fillRect(x, y, 28, 14);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function paintMat(color: THREE.ColorRepresentation, pattern: THREE.CanvasTexture, tier: number): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    map: pattern,
    roughness: tier >= 4 ? 0.28 : tier >= 3 ? 0.4 : 0.56,
    metalness: tier >= 3 ? 0.58 : 0.32,
    clearcoat: tier >= 3 ? 0.5 : 0.16,
    clearcoatRoughness: 0.34,
    envMapIntensity: 1.1,
  });
}

function hullShape(len: number, wid: number, h: number, nose = 0.48): THREE.BufferGeometry {
  const hl = len / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hl, h * 0.05);
  shape.lineTo(hl * 0.18, h * 0.05);
  shape.lineTo(hl * 0.58, h * 0.2);
  shape.lineTo(hl, h * nose);
  shape.lineTo(hl * 0.16, h);
  shape.lineTo(-hl * 0.48, h * 0.97);
  shape.lineTo(-hl * 0.8, h * 0.68);
  shape.lineTo(-hl, h * 0.4);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: wid,
    bevelEnabled: true,
    bevelThickness: Math.min(0.32, h * 0.045),
    bevelSize: Math.min(0.26, wid * 0.02),
    bevelSegments: 1,
  });
  geo.translate(0, 0, -wid / 2);
  geo.computeVertexNormals();
  return geo;
}

function roofPrism(span: number, rise: number, depth: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-span / 2, 0);
  shape.lineTo(span / 2, 0);
  shape.lineTo(0, rise);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

function mat(
  color: THREE.ColorRepresentation,
  rough = 0.62,
  metal = 0.18,
  emissive: THREE.ColorRepresentation = "#000",
  ei = 0,
  opacity = 1,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: rough,
    metalness: metal,
    emissive,
    emissiveIntensity: ei,
    transparent: opacity < 1,
    opacity,
  });
}

function piece(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  cast = true,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function lookTier(sim: Sim, kind: Kind, team: 0 | 1): number {
  if (kind === "spire" || kind === "barracks" || kind === "bay" || kind === "strip") return sim.tech[team][kind] ?? 1;
  const wing = wingOf(kind);
  const own = DEFS[kind].tier ?? 1;
  if (!wing || wing === "spire") return own;
  return Math.max(own, sim.tech[team][wing] ?? 1);
}

interface Actor {
  id: number;
  key: string;
  group: THREE.Group;
  legs: THREE.Object3D[];
  turret: THREE.Object3D | null;
}

export class World3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 0.4, 12000);
  private ray = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private hit = new THREE.Vector3();
  private sun: THREE.DirectionalLight;
  private sunTarget = new THREE.Object3D();
  private actors = new Map<number, Actor>();
  private ghosts = new Map<string, THREE.Group>();
  private shots: THREE.Mesh[] = [];
  private sparks: THREE.Mesh[] = [];
  private rings: THREE.Mesh[] = [];
  private boxMesh: THREE.Mesh;
  private placeMesh: THREE.Group | null = null;
  private placeKind: Kind | null = null;
  private fogAlpha: THREE.BufferAttribute;
  private fogMesh: THREE.Mesh;
  private heights: Float32Array;
  private viewGun: THREE.Group;
  private eyeId = 0;
  private builtFor = "";
  private composer: EffectComposer;
  private waterTime: { value: number } | null = null;
  private patterns: THREE.CanvasTexture[];
  private panels: THREE.CanvasTexture;
  private grit: THREE.CanvasTexture;

  constructor(canvas: HTMLCanvasElement) {
    const small = Math.min(window.innerWidth || 1280, window.innerHeight || 800) < 760;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(small ? 1.25 : 1.7, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.patterns = [grayCamo(1), grayCamo(2), grayCamo(3), grayCamo(4)];
    this.panels = panelTex();
    this.grit = grayCamo(11);
    this.grit.colorSpace = THREE.NoColorSpace;
    this.grit.wrapS = THREE.RepeatWrapping;
    this.grit.wrapT = THREE.RepeatWrapping;
    this.grit.repeat.set(16, 11);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.add(this.sunTarget);
    this.sun = new THREE.DirectionalLight("#fff1d2", 2.55);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 20;
    this.sun.shadow.camera.far = 2800;
    this.sun.shadow.bias = -0.00022;
    this.sun.shadow.normalBias = 0.045;
    this.sun.target = this.sunTarget;
    this.scene.add(this.sun);
    this.scene.add(new THREE.HemisphereLight("#d7e6f4", "#3a2a1e", 0.72));
    const fill = new THREE.DirectionalLight("#8eb4d0", 0.5);
    fill.position.set(480, 220, -620);
    this.scene.add(fill);
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(9000, 24, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          top: { value: new THREE.Color("#16304a") },
          horizon: { value: new THREE.Color("#d7c4a4") },
        },
        vertexShader: "varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
        fragmentShader:
          "varying vec3 vP; uniform vec3 top; uniform vec3 horizon; void main(){ float h=clamp(normalize(vP).y*0.5+0.5,0.0,1.0); gl_FragColor=vec4(mix(horizon,top,smoothstep(0.05,0.85,h)),1.0); }",
      }),
    );
    this.scene.add(sky);
    this.heights = new Float32Array((COLS + 1) * (ROWS + 1));
    this.fogAlpha = new THREE.BufferAttribute(new Float32Array((COLS + 1) * (ROWS + 1)), 1);
    this.fogMesh = new THREE.Mesh();
    this.boxMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: "#3ee0c5", transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.boxMesh.rotation.x = -Math.PI / 2;
    this.boxMesh.visible = false;
    this.scene.add(this.boxMesh);
    this.viewGun = new THREE.Group();
    this.camera.add(this.viewGun);
    this.scene.add(this.camera);
    this.scene.fog = new THREE.Fog("#8aa0b0", 280, 2400);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1024, 1024), 0.16, 0.4, 0.84));
    this.composer.addPass(new OutputPass());
  }

  dispose(): void {
    this.composer.dispose();
    this.renderer.dispose();
    this.release(this.scene);
    this.patterns.forEach((tex) => tex.dispose());
    this.panels.dispose();
    this.grit.dispose();
  }

  private release(root: THREE.Object3D): void {
    const mats = new Set<THREE.Material>();
    const geos = new Set<THREE.BufferGeometry>();
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh.geometry && !mesh.geometry.userData.shared) geos.add(mesh.geometry);
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((m) => mats.add(m));
      else if (material) mats.add(material);
    });
    geos.forEach((geo) => geo.dispose());
    mats.forEach((m) => m.dispose());
  }

  private soften(group: THREE.Object3D, opacity: number): void {
    const originals = new Set<THREE.Material>();
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      originals.add(mesh.material);
      const clone = mesh.material.clone();
      clone.transparent = true;
      clone.opacity = opacity;
      clone.depthWrite = false;
      mesh.material = clone;
    });
    originals.forEach((m) => m.dispose());
  }

  groundAt(sx: number, sy: number, w: number, h: number): { x: number; y: number } {
    this.ray.setFromCamera(new THREE.Vector2((sx / w) * 2 - 1, -(sy / h) * 2 + 1), this.camera);
    if (this.ray.ray.intersectPlane(this.ground, this.hit)) {
      return { x: clamp(this.hit.x, 0, WORLD_W), y: clamp(this.hit.z, 0, WORLD_H) };
    }
    return { x: WORLD_W / 2, y: WORLD_H / 2 };
  }

  frame(
    sim: Sim,
    cam: { x: number; y: number; z: number },
    viewW: number,
    viewH: number,
    glance: Glance,
    look: EyeLook,
    ghost: { kind: Kind; x: number; y: number; ok: boolean } | null,
    box: { x0: number; y0: number; x1: number; y1: number } | null,
    cinematic: boolean,
    shake: number,
  ): void {
    if (this.builtFor !== sim.chapterId) this.buildTerrain(sim);
    this.renderer.setSize(viewW, viewH, false);
    this.camera.aspect = Math.max(0.2, viewW / Math.max(1, viewH));
    const eye = glance === "eye" ? this.eyeUnit(sim) : null;
    this.eyeId = eye ? eye.id : 0;
    this.camera.fov = glance === "eye" ? look.fov : 48;
    this.camera.updateProjectionMatrix();
    this.syncActors(sim, cinematic);
    this.syncGhosts(sim, cinematic);
    this.syncShots(sim);
    this.syncSparks(sim);
    this.syncRings(sim);
    this.syncBox(box);
    this.syncPlace(ghost);
    this.syncFog(sim, cinematic);
    this.aimCamera(sim, cam, glance, look, eye, shake);
    const focus = eye ? eye.x : cam.x;
    const focusZ = eye ? eye.y : cam.y;
    this.sun.position.set(focus - 520, 780, focusZ + 260);
    this.sunTarget.position.set(focus, 0, focusZ);
    const shadow = this.sun.shadow.camera as THREE.OrthographicCamera;
    shadow.left = -640;
    shadow.right = 640;
    shadow.top = 640;
    shadow.bottom = -640;
    shadow.updateProjectionMatrix();
    const fog = this.scene.fog as THREE.Fog;
    if (glance === "eye") {
      fog.near = 18;
      fog.far = 680;
    } else {
      fog.near = 360;
      fog.far = 2600 / Math.max(0.55, cam.z);
    }
    this.viewGun.visible = glance === "eye" && !!eye;
    if (eye) this.dressViewGun(eye, sim);
    if (this.waterTime) this.waterTime.value = sim.time;
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(viewW, viewH);
    this.composer.render();
  }

  private eyeUnit(sim: Sim): Ent | null {
    for (const id of sim.selected) {
      const unit = sim.byId(id);
      if (unit && unit.alive && unit.team === 0 && !DEFS[unit.kind].building) return unit;
    }
    return null;
  }

  private aimCamera(sim: Sim, cam: { x: number; y: number; z: number }, glance: Glance, look: EyeLook, eye: Ent | null, shake: number): void {
    if (glance === "eye" && eye) {
      const h = this.elevation(eye.x, eye.y);
      const air = !!DEFS[eye.kind].air;
      const tier = lookTier(sim, eye.kind, eye.team);
      const heavy = DEFS[eye.kind].armor === "heavy" || eye.kind === "harvester";
      const body = 1.12 + (tier - 1) * 0.16;
      const vehicle = 1 + (tier - 1) * 0.13;
      const eyeY = air ? 45 : h + (heavy ? 8.6 * vehicle + 3.4 : 16.2 * body);
      const yaw = eye.facing + look.yaw;
      const pitch = look.pitch;
      const moving = eye.order === "move" || eye.order === "amove";
      const bob = air ? Math.sin(sim.time * 1.6 + eye.id) * 0.25 : Math.sin(sim.time * (moving ? 12 : 1.6) + eye.id) * (moving ? 0.16 : 0.035);
      this.camera.position.set(eye.x + (Math.random() - 0.5) * shake * 3, eyeY + bob, eye.y);
      const dist = 140;
      this.camera.lookAt(
        eye.x + Math.cos(yaw) * Math.cos(pitch) * dist,
        eyeY + Math.sin(pitch) * dist,
        eye.y + Math.sin(yaw) * Math.cos(pitch) * dist,
      );
      return;
    }
    const dist = 860 / Math.max(0.4, cam.z);
    const pitch = 0.96;
    this.camera.position.set(cam.x + (Math.random() - 0.5) * shake * 10, Math.sin(pitch) * dist, cam.y + Math.cos(pitch) * dist);
    this.camera.lookAt(cam.x, 8, cam.y);
  }

  private dressViewGun(eye: Ent, sim: Sim): void {
    const tier = lookTier(sim, eye.kind, eye.team);
    const sig = `${eye.kind}:${tier}`;
    if (this.viewGun.userData.sig === sig) return;
    this.release(this.viewGun);
    this.viewGun.clear();
    this.viewGun.userData.sig = sig;
    const steel = mat("#c5ced4", 0.28, 0.78);
    const dark = mat("#14181c", 0.48, 0.5);
    const skin = mat("#e6c6a6", 0.58, 0.02);
    const glow = mat("#071014", 0.12, 0.2, "#9ad7ff", tier >= 3 ? 0.9 : 0.15);
    if (DEFS[eye.kind].air) {
      piece(this.viewGun, BOX, mat("#c5e8ff", 0.05, 0.08, "#d7f2ff", 0.28), 0, -0.12, -1.55, 1.55, 0.42, 0.06, false);
      piece(this.viewGun, BOX, dark, -0.78, -0.46, -0.85, 0.07, 0.42, 0.85, false);
      piece(this.viewGun, BOX, dark, 0.78, -0.46, -0.85, 0.07, 0.42, 0.85, false);
      piece(this.viewGun, BOX, glow, 0, -0.28, -1.2, 0.36, 0.08, 0.16, false);
      return;
    }
    if (DEFS[eye.kind].armor === "heavy" || eye.kind === "harvester") {
      piece(this.viewGun, BOX, dark, 0, -0.62, -1.15, 1.8, 0.42, 1.1, false);
      const barrel = piece(this.viewGun, CYL, steel, 0, -0.28, -2.6, eye.kind === "bastion" ? 0.16 : 0.1, 3.1, eye.kind === "bastion" ? 0.16 : 0.1, false);
      barrel.rotation.x = Math.PI / 2;
      const brake = piece(this.viewGun, CYL, dark, 0, -0.28, -4.05, 0.16, 0.32, 0.16, false);
      brake.rotation.x = Math.PI / 2;
      piece(this.viewGun, BOX, glow, 0.35, -0.08, -1.2, 0.28, 0.12, 0.2, false);
      if (tier >= 3) piece(this.viewGun, BOX, mat("#e8c56b", 0.3, 0.6, "#e8c56b", 0.25), 0, -0.38, -1.35, 0.9, 0.06, 0.2, false);
      return;
    }
    const rocket = eye.kind === "rocket";
    const nade = eye.kind === "grenadier";
    piece(this.viewGun, CAP, skin, 0.48, -0.5, -0.48, 0.1, 0.28, 0.1, false);
    piece(this.viewGun, CAP, skin, 0.16, -0.44, -0.78, 0.08, 0.2, 0.08, false);
    piece(this.viewGun, BOX, mat("#2a241c", 0.6, 0.25), 0.34, -0.4, -0.72, 0.18, 0.16, 0.62, false);
    const len = rocket ? 1.85 : nade ? 1.2 : 1.05 + tier * 0.1;
    const barrel = piece(this.viewGun, CYL, steel, 0.34, -0.34, -1.2, rocket ? 0.1 : 0.038, len, rocket ? 0.1 : 0.038, false);
    barrel.rotation.x = Math.PI / 2;
    piece(this.viewGun, BOX, dark, 0.34, -0.52, -0.86, 0.1, 0.2, 0.16, false);
    if (tier >= 2) piece(this.viewGun, BOX, steel, 0.34, -0.22, -0.95, 0.045, 0.04, 0.46, false);
    if (tier >= 3) piece(this.viewGun, BOX, glow, 0.34, -0.16, -0.78, 0.09, 0.06, 0.12, false);
    if (tier >= 4) piece(this.viewGun, CYL, mat("#d8fff6", 0.2, 0.4, "#3ee0c5", 1), 0.34, -0.34, -1.55, 0.02, 0.35, 0.02, false).rotation.x = Math.PI / 2;
    if (rocket) piece(this.viewGun, CONE, mat("#d25a32", 0.4, 0.3, "#ff6a3a", 0.4), 0.34, -0.34, -2.05, 0.08, 0.28, 0.08, false);
    if (nade) piece(this.viewGun, SPHERE, mat("#2f6a38", 0.45, 0.25), 0.34, -0.2, -1.05, 0.11, 0.11, 0.11, false);
  }

  private elevation(x: number, y: number): number {
    const c = clamp(Math.floor(x / TILE), 0, COLS - 1);
    const r = clamp(Math.floor(y / TILE), 0, ROWS - 1);
    return this.heights[r * (COLS + 1) + c] ?? 0;
  }

  private buildTerrain(sim: Sim): void {
    this.builtFor = sim.chapterId;
    const old = this.scene.getObjectByName("land");
    if (old) {
      this.fogMesh.removeFromParent();
      const prev = this.fogMesh.material;
      if (!Array.isArray(prev)) prev.dispose();
      if (this.fogMesh.geometry && !this.fogMesh.geometry.userData.shared) this.fogMesh.geometry.dispose();
      this.scene.remove(old);
      this.release(old);
    }
    const chapter = chapterById(sim.chapterId);
    const skyMat = this.scene.children.find((o) => o instanceof THREE.Mesh && (o as THREE.Mesh).geometry instanceof THREE.SphereGeometry) as THREE.Mesh | undefined;
    const shader = skyMat?.material as THREE.ShaderMaterial | undefined;
    if (shader?.uniforms) {
      (shader.uniforms.top.value as THREE.Color).set(chapter.sky[0]);
      (shader.uniforms.horizon.value as THREE.Color).set(chapter.sky[1]);
    }
    (this.scene.fog as THREE.Fog).color.set(chapter.snow ? "#d5dde4" : chapter.sky[1]);
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const fogPos: number[] = [];
    const sampleH = (c: number, r: number) => {
      const cc = clamp(c, 0, COLS - 1);
      const rr = clamp(r, 0, ROWS - 1);
      const tile = sim.tiles[rr * COLS + cc];
      const n = sim.style[rr * COLS + cc] ?? 0;
      if (tile === 3) return -4.2;
      if (tile === 1) return 10 + n * 42 * (0.35 + chapter.peaks * 0.75);
      if (tile === 2) return 1.6 + n * 2.4;
      return n * 5.4 * (chapter.snow ? 0.4 : 1);
    };
    const sampleC = (c: number, r: number, target: THREE.Color) => {
      const cc = clamp(c, 0, COLS - 1);
      const rr = clamp(r, 0, ROWS - 1);
      const tile = sim.tiles[rr * COLS + cc];
      const n = sim.style[rr * COLS + cc] ?? 0;
      if (tile === 3) target.set("#1a4e62").lerp(new THREE.Color("#0e2a36"), n * 0.4);
      else if (tile === 1) target.set(chapter.snow ? "#e4ebf0" : "#6a727a").lerp(new THREE.Color("#2a3038"), 0.4 - n * 0.15);
      else if (tile === 2) target.set("#1e6a62").lerp(new THREE.Color("#b8fff2"), 0.25 + n * 0.25);
      else {
        target.setRGB(chapter.ground[0] / 255, chapter.ground[1] / 255, chapter.ground[2] / 255);
        target.lerp(new THREE.Color(chapter.snow ? "#f7fbfc" : "#1a2214"), chapter.snow ? 0.28 + n * 0.45 : n * 0.22);
      }
    };
    const tint = new THREE.Color();
    for (let r = 0; r <= ROWS; r++) {
      for (let c = 0; c <= COLS; c++) {
        const h = (sampleH(c, r) + sampleH(c - 1, r) + sampleH(c, r - 1) + sampleH(c - 1, r - 1)) / 4;
        this.heights[r * (COLS + 1) + c] = h;
        positions.push(c * TILE, h, r * TILE);
        fogPos.push(c * TILE, h + 0.7, r * TILE);
        sampleC(c, r, tint);
        colors.push(tint.r, tint.g, tint.b);
      }
    }
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const a = r * (COLS + 1) + c;
        const b = a + 1;
        const d = a + COLS + 1;
        const e = d + 1;
        indices.push(a, d, b, b, d, e);
      }
    }
    const land = new THREE.Group();
    land.name = "land";
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const groundMesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0.02, roughnessMap: this.grit }),
    );
    groundMesh.receiveShadow = true;
    land.add(groundMesh);
    this.waterTime = { value: 0 };
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_W, WORLD_H, 64, 40),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          time: this.waterTime,
          color: { value: new THREE.Color(chapter.waterFill) },
          deep: { value: new THREE.Color(chapter.snow ? "#6e8ea0" : "#041820") },
        },
        vertexShader:
          "uniform float time; varying float vH; varying vec3 vW; void main(){ vec3 p=position; float w=sin(p.x*0.03+time*1.15)*0.55+cos(p.y*0.026+time*0.8)*0.38; p.z+=w; vH=w; vec4 wp=modelMatrix*vec4(p,1.0); vW=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }",
        fragmentShader:
          "uniform vec3 color; uniform vec3 deep; uniform float time; varying float vH; varying vec3 vW; void main(){ float spark=pow(max(0.0,sin(vW.x*0.08+time*1.5)*cos(vW.z*0.07-time)),12.0); vec3 c=mix(deep,color,0.55+vH*0.4)+vec3(0.5,0.7,0.75)*spark; gl_FragColor=vec4(c,0.84); }",
      }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(WORLD_W / 2, -0.35, WORLD_H / 2);
    land.add(water);
    const fogGeo = new THREE.BufferGeometry();
    fogGeo.setAttribute("position", new THREE.Float32BufferAttribute(fogPos, 3));
    fogGeo.setAttribute("alpha", this.fogAlpha);
    fogGeo.setIndex(indices);
    this.fogMesh.geometry = fogGeo;
    this.fogMesh.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: "attribute float alpha; varying float vA; void main(){ vA=alpha; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: "varying float vA; void main(){ gl_FragColor=vec4(0.01,0.014,0.02,vA); }",
    });
    land.add(this.fogMesh);
    this.plant(sim, land, chapter.canopy, chapter.trunk, chapter.snow);
    this.scene.add(land);
  }

  private plant(sim: Sim, land: THREE.Group, canopy: string, trunk: string, snow: boolean): void {
    let trees = 0;
    let rocks = 0;
    let crystals = 0;
    let grass = 0;
    for (let i = 0; i < COLS * ROWS; i++) {
      if (sim.flora[i]) trees++;
      if (sim.tiles[i] === 1 && i % 2 === 0) rocks++;
      if (sim.ion[i] > 0) crystals++;
      if (sim.tiles[i] === 0 && !sim.flora[i] && i % 5 === 0) grass++;
    }
    const trunkMesh = new THREE.InstancedMesh(CYL, mat(trunk, 0.86, 0.04), Math.max(1, trees));
    const leafMat = mat(snow ? "#e4eee8" : canopy, 0.78, 0.02);
    const leafHi = mat(snow ? "#f7fbf8" : new THREE.Color(canopy).lerp(new THREE.Color("#e4f2c8"), 0.4), 0.7, 0.02);
    const leafMesh = new THREE.InstancedMesh(CONE, leafMat, Math.max(1, trees));
    const crownMesh = new THREE.InstancedMesh(CONE, leafHi, Math.max(1, trees));
    const rockMesh = new THREE.InstancedMesh(ROCK, mat(snow ? "#d5dee6" : "#5c656e", 0.92, 0.08), Math.max(1, rocks));
    const gemMesh = new THREE.InstancedMesh(CYL, mat("#eafff8", 0.15, 0.15, "#3ee0c5", 1.1), Math.max(1, crystals));
    const grassColor = snow ? "#eef3ea" : new THREE.Color(canopy).lerp(new THREE.Color("#d7e6a4"), 0.55);
    const grassMesh = new THREE.InstancedMesh(CONE, mat(grassColor, 0.95, 0.02), Math.max(1, grass));
    trunkMesh.castShadow = true;
    leafMesh.castShadow = true;
    crownMesh.castShadow = true;
    const dummy = new THREE.Object3D();
    let ti = 0;
    let ri = 0;
    let gi = 0;
    let bi = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        const x = (c + 0.5) * TILE;
        const z = (r + 0.55) * TILE;
        const h = this.heights[r * (COLS + 1) + c] ?? 0;
        const flora = sim.flora[i];
        if (flora) {
          const tall = flora === 2;
          dummy.position.set(x, h + (tall ? 10 : 6.5), z);
          dummy.scale.set(tall ? 1.15 : 0.8, tall ? 20 : 13, tall ? 1.15 : 0.8);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          trunkMesh.setMatrixAt(ti, dummy.matrix);
          dummy.position.set(x, h + (tall ? 18 : 12), z);
          dummy.scale.set(tall ? 7.2 : 5, tall ? 16 : 11, tall ? 7.2 : 5);
          dummy.rotation.set(0, c * 0.2, 0);
          dummy.updateMatrix();
          leafMesh.setMatrixAt(ti, dummy.matrix);
          dummy.position.set(x, h + (tall ? 28 : 19), z);
          dummy.scale.set(tall ? 4.6 : 3.2, tall ? 10 : 7, tall ? 4.6 : 3.2);
          dummy.updateMatrix();
          crownMesh.setMatrixAt(ti, dummy.matrix);
          ti++;
        } else if (sim.tiles[i] === 0 && i % 5 === 0) {
          dummy.position.set(x + ((c * 3) % 7) - 3, h + 1.3, z);
          dummy.rotation.set(0, c + r, 0);
          dummy.scale.set(0.7 + (c % 3) * 0.25, 2.2 + (r % 4) * 0.45, 0.7 + (r % 3) * 0.2);
          dummy.updateMatrix();
          grassMesh.setMatrixAt(bi, dummy.matrix);
          bi++;
        }
        if (sim.tiles[i] === 1 && i % 2 === 0) {
          dummy.position.set(x, h + 2.4, z);
          dummy.rotation.set(0.2, (c * 0.7) % 3, 0.15);
          dummy.scale.set(6 + (c % 5), 4 + (r % 4), 5.5 + (c % 3));
          dummy.updateMatrix();
          rockMesh.setMatrixAt(ri, dummy.matrix);
          ri++;
        }
        if (sim.ion[i] > 0) {
          const rise = 5 + (sim.ion[i] / 2800) * 12;
          dummy.position.set(x, h + rise * 0.55, z);
          dummy.rotation.set(0.15, c, 0.1);
          dummy.scale.set(1.5, rise, 1.5);
          dummy.updateMatrix();
          gemMesh.setMatrixAt(gi, dummy.matrix);
          gi++;
        }
      }
    }
    trunkMesh.count = ti;
    leafMesh.count = ti;
    crownMesh.count = ti;
    rockMesh.count = ri;
    gemMesh.count = gi;
    grassMesh.count = bi;
    if (ti) land.add(trunkMesh, leafMesh, crownMesh);
    if (ri) land.add(rockMesh);
    if (gi) land.add(gemMesh);
    if (bi) land.add(grassMesh);
  }

  private syncFog(sim: Sim, cinematic: boolean): void {
    const data = this.fogAlpha.array as Float32Array;
    for (let r = 0; r <= ROWS; r++) {
      for (let c = 0; c <= COLS; c++) {
        const seen = sim.explored[clamp(r, 0, ROWS - 1) * COLS + clamp(c, 0, COLS - 1)];
        const live = sim.visible[clamp(r, 0, ROWS - 1) * COLS + clamp(c, 0, COLS - 1)];
        data[r * (COLS + 1) + c] = cinematic ? 0 : live ? 0 : seen ? 0.42 : 0.9;
      }
    }
    this.fogAlpha.needsUpdate = true;
  }

  private syncActors(sim: Sim, cinematic: boolean): void {
    const live = new Set<number>();
    for (const e of sim.ents) {
      if (!e.alive) continue;
      if (!cinematic && e.team === 1 && !DEFS[e.kind].building && !sim.isVisible(e)) continue;
      if (!cinematic && e.team === 1 && DEFS[e.kind].building && !sim.isVisible(e) && !sim.explored[this.tileIndex(e.x, e.y)]) continue;
      live.add(e.id);
      const tier = lookTier(sim, e.kind, e.team);
      const key = `${e.kind}:${e.team}:${tier}`;
      let actor = this.actors.get(e.id);
      if (!actor || actor.key !== key) {
        if (actor) {
          this.scene.remove(actor.group);
          this.release(actor.group);
        }
        actor = this.makeActor(e, tier, key);
        this.actors.set(e.id, actor);
        this.scene.add(actor.group);
      }
      const def = DEFS[e.kind];
      const h = def.air ? 0 : this.elevation(e.x, e.y);
      const moving = e.order === "move" || e.order === "amove" || e.order === "attack" || e.order === "harvest";
      const step = moving ? Math.sin(sim.time * 11 + e.id) : 0;
      const alt = def.air ? 42 + Math.sin(sim.time * 1.4 + e.id) * 2.4 : h + (moving && !def.building ? Math.abs(step) * 0.45 : 0);
      actor.group.position.set(e.x, alt, e.y);
      actor.group.rotation.y = -e.facing;
      if (def.building) {
        const progress = e.buildTotal > 0 && e.buildLeft > 0 ? Math.max(0.08, 1 - e.buildLeft / e.buildTotal) : 1;
        actor.group.scale.set(1, progress, 1);
      } else actor.group.scale.set(1, 1, 1);
      actor.legs.forEach((leg, i) => {
        leg.rotation.x = (i % 2 === 0 ? step : -step) * 0.65;
      });
      if (actor.turret) actor.turret.rotation.y = -(e.aim - e.facing);
      if (def.air) {
        actor.group.traverse((obj) => {
          if (obj.userData.spin) obj.rotation.x = sim.time * 28;
        });
      }
      actor.group.visible = this.eyeId !== e.id;
    }
    for (const [id, actor] of this.actors) {
      if (live.has(id)) continue;
      this.scene.remove(actor.group);
      this.release(actor.group);
      this.actors.delete(id);
    }
  }

  private tileIndex(x: number, y: number): number {
    return clamp(Math.floor(y / TILE), 0, ROWS - 1) * COLS + clamp(Math.floor(x / TILE), 0, COLS - 1);
  }

  private makeActor(e: Ent, tier: number, key: string): Actor {
    const group = new THREE.Group();
    const legs: THREE.Object3D[] = [];
    let turret: THREE.Object3D | null = null;
    if (DEFS[e.kind].building) turret = this.buildStructure(group, e.kind, e.team, tier);
    else if (DEFS[e.kind].air) this.buildAir(group, e.kind, e.team, tier);
    else if (e.kind === "rifle" || e.kind === "rocket" || e.kind === "watch" || e.kind === "patrol" || e.kind === "grenadier" || e.kind === "sergeant" || e.kind === "specops") {
      this.buildSoldier(group, legs, e.kind, e.team, tier);
    } else turret = this.buildVehicle(group, e.kind, e.team, tier);
    return { id: e.id, key, group, legs, turret };
  }

  private buildSoldier(group: THREE.Group, legs: THREE.Object3D[], kind: Kind, team: 0 | 1, tier: number): void {
    const rig = new THREE.Group();
    rig.scale.setScalar(1.12 + (tier - 1) * 0.16);
    group.add(rig);
    const pattern = this.patterns[Math.max(0, Math.min(3, tier - 1))];
    const clothColor = new THREE.Color(["#6a784c", "#314038", "#8d968f", "#e7eeea"][tier - 1] ?? "#6a784c");
    if (team === 1) clothColor.lerp(new THREE.Color("#8d4d42"), 0.58);
    if (kind === "specops") clothColor.lerp(new THREE.Color("#141a20"), 0.78);
    if (kind === "watch") clothColor.lerp(new THREE.Color("#d2c091"), 0.62);
    if (kind === "sergeant") clothColor.lerp(new THREE.Color("#3e4a38"), 0.25);
    const cloth = paintMat(clothColor, pattern, tier);
    const boot = mat("#121416", 0.55, 0.28);
    const skin = mat(team === 1 ? "#c08868" : "#e8c6a4", 0.55, 0.02);
    const steel = mat("#2e363c", 0.26, 0.8);
    const accent = mat(team === 0 ? "#3ee0c5" : "#ff4d2e", 0.28, 0.4, team === 0 ? "#3ee0c5" : "#ff4d2e", 0.75);
    const glass = mat("#070d10", 0.08, 0.2, tier >= 3 ? "#8fd4ff" : "#000", tier >= 3 ? 0.7 : 0);
    const addLeg = (z: number) => {
      const hip = new THREE.Group();
      hip.position.set(0.1, 9.1, z);
      piece(hip, CAP, cloth, 0, -1.55, 0, 0.92, 1.55, 0.92);
      piece(hip, CAP, boot, 0.25, -3.85, 0.1, 0.72, 0.85, 1.05);
      piece(hip, BOX, steel, 0.45, -4.45, 0.05, 1.45, 0.32, 0.82, false);
      if (tier >= 2) piece(hip, BOX, steel, 0.15, -2.4, 0, 1.15, 0.7, 0.95, false);
      if (tier >= 4) piece(hip, BOX, accent, 0.2, -1.4, z > 0 ? 0.55 : -0.55, 0.2, 1.1, 0.35, false);
      rig.add(hip);
      legs.push(hip);
    };
    addLeg(-1.28);
    addLeg(1.28);
    piece(rig, CAP, cloth, 0, 12.2, 0, 1.95, 2.15, 1.15);
    piece(rig, BOX, steel, 0.45, 12.8, 0, 2.15, 2.35, 0.38);
    piece(rig, BOX, accent, 1.15, 13.5, 1.05, 0.18, 0.7, 0.55);
    if (tier >= 2) piece(rig, BOX, mat("#161c18", 0.48, 0.35), -1.25, 13.1, 0, 1.05, 2.5, 1.75);
    if (tier >= 3) {
      piece(rig, BOX, steel, 0.1, 14.15, 1.55, 1.35, 0.55, 0.55);
      piece(rig, BOX, steel, 0.1, 14.15, -1.55, 1.35, 0.55, 0.55);
    }
    if (tier >= 4) piece(rig, CYL, mat("#e7eef2", 0.3, 0.55, "#9ad7ff", 0.45), -0.3, 16.4, -1.35, 0.12, 2.4, 0.12, false);
    const addArm = (z: number, reach: number) => {
      const limb = new THREE.Group();
      limb.position.set(0.35, 14.15, z);
      piece(limb, CAP, cloth, reach * 0.35, -1.05, 0, 0.46, 1.05, 0.46);
      piece(limb, SPHERE, steel, reach, -1.85, 0, 0.38, 0.38, 0.38, false);
      rig.add(limb);
      legs.push(limb);
    };
    addArm(2.05, 0.85);
    addArm(-2.05, 0.2);
    piece(rig, SPHERE, skin, 0.55, 16.35, 0, 1.05, 1.15, 1.05, false);
    piece(rig, SPHERE, cloth, 0.2, 17.15, 0, 1.38, 0.95, 1.38);
    piece(rig, BOX, glass, 1.2, 16.7, 0, 0.18, 0.38, 1.25, false);
    if (kind === "sergeant") {
      piece(rig, CYL, mat("#e8c56b", 0.28, 0.7), -0.15, 19.1, 0, 0.07, 2.6, 0.07, false);
      piece(rig, BOX, accent, -0.15, 20.35, 0.4, 0.08, 0.7, 1.15, false);
    }
    if (kind === "specops") piece(rig, BOX, mat("#070b0e", 0.3, 0.45), 1.28, 16.75, 0, 0.16, 0.32, 1.55, false);
    if (kind === "watch") piece(rig, CYL, steel, 1.85, 16.75, 0, 0.32, 0.42, 0.85, false).rotation.z = Math.PI / 2;
    const gun = new THREE.Group();
    gun.position.set(1.15, 12.45, 1.05);
    const rocket = kind === "rocket";
    const nade = kind === "grenadier";
    const length = rocket ? 10 : nade ? 6.4 : 6.2 + tier * 0.9;
    const thick = rocket ? 0.58 : nade ? 0.42 : 0.18 + tier * 0.03;
    piece(gun, CYL, steel, length * 0.46, 0.12, 0, thick, length, thick).rotation.z = -Math.PI / 2;
    piece(gun, BOX, mat("#2c261e", 0.62, 0.22), -0.15, -0.2, 0, 2.3, 0.8, 0.5, false);
    piece(gun, BOX, mat("#141814", 0.5, 0.3), 0.35, -0.85, 0, 0.45, 1.05, 0.38, false);
    if (tier >= 2) piece(gun, BOX, steel, length * 0.22, 0.5, 0, 1.5, 0.22, 0.24, false);
    if (tier >= 3) piece(gun, BOX, mat("#101418", 0.25, 0.35, "#9ad7ff", 0.8), length * 0.28, 0.78, 0, 0.7, 0.32, 0.38, false);
    if (tier >= 4) piece(gun, CYL, mat("#dffffa", 0.2, 0.4, "#3ee0c5", 0.9), length * 0.72, 0.12, 0, thick * 0.35, 1.4, thick * 0.35).rotation.z = -Math.PI / 2;
    if (nade) piece(gun, SPHERE, mat("#2a6a38", 0.45, 0.2), 2.2, 0.65, 0, 0.65, 0.65, 0.65, false);
    rig.add(gun);
    if (rocket) {
      piece(rig, CYL, mat("#343a34", 0.45, 0.4), -1.55, 13.5, -0.15, 0.5, 4.8, 0.65);
      piece(rig, CONE, mat("#d25a32", 0.4, 0.3, "#ff6a3a", 0.35), length * 0.55 + 1.2, 12.55, 1.05, 0.4, 1.2, 0.4, false);
    }
    if (kind === "patrol") {
      const dog = new THREE.Group();
      dog.position.set(2.4, 0, 5.2);
      piece(dog, CAP, mat("#6b513a", 0.78, 0.04), 0, 2.5, 0, 1.05, 1.25, 0.72, false);
      piece(dog, SPHERE, mat("#241c14", 0.7, 0.04), 1.7, 3.35, 0, 0.78, 0.7, 0.7, false);
      piece(dog, CAP, mat("#6b513a", 0.78, 0.04), 0.2, 1.15, 0.55, 0.22, 0.7, 0.22, false);
      piece(dog, CAP, mat("#6b513a", 0.78, 0.04), -0.5, 1.7, 0, 0.18, 0.85, 0.18, false);
      rig.add(dog);
    }
  }

  private addTracks(group: THREE.Group, len: number, wid: number, rubber: THREE.Material, steel: THREE.Material, skirt: THREE.Material | null): void {
    for (const side of [-1, 1]) {
      const z = side * wid * 0.5;
      piece(group, BOX, rubber, 0, 1.05, z, len, 0.72, 2.2, false);
      piece(group, BOX, rubber, 0, 3.35, z, len * 0.8, 0.46, 1.85, false);
      const front = piece(group, CYL, steel, len * 0.44, 2.15, z, 1.7, 1.2, 1.7, false);
      front.rotation.x = Math.PI / 2;
      const rear = piece(group, CYL, steel, -len * 0.44, 2.25, z, 1.9, 1.35, 1.9, false);
      rear.rotation.x = Math.PI / 2;
      for (let i = 0; i < 6; i++) {
        const wheel = piece(group, CYL, steel, -len * 0.3 + i * len * 0.12, 1.5, z, 1.12, 0.9, 1.12, false);
        wheel.rotation.x = Math.PI / 2;
      }
      if (skirt) piece(group, BOX, skirt, 0.02 * len, 2.45, z + side * 0.35, len * 0.64, 1.85, 0.28);
    }
  }

  private addWheels(group: THREE.Group, len: number, wid: number, rubber: THREE.Material, steel: THREE.Material): void {
    for (const x of [-0.32, 0.34]) {
      for (const side of [-1, 1]) {
        const wheel = piece(group, CYL, rubber, x * len, 1.85, side * wid * 0.48, 2.15, 1.25, 2.15, false);
        wheel.rotation.x = Math.PI / 2;
        const hub = piece(group, CYL, steel, x * len, 1.85, side * wid * 0.48, 0.7, 1.4, 0.7, false);
        hub.rotation.x = Math.PI / 2;
      }
    }
  }

  private buildVehicle(group: THREE.Group, kind: Kind, team: 0 | 1, tier: number): THREE.Object3D {
    const spec = vehicleSpec(kind);
    const bulk = 1 + (tier - 1) * 0.13;
    const pattern = this.patterns[Math.max(0, Math.min(3, tier - 1))];
    const paint = new THREE.Color(spec.paint).lerp(new THREE.Color(["#4e5842", "#24342c", "#727c78", "#e8efeb"][tier - 1] ?? spec.paint), 0.8);
    if (team === 1) paint.lerp(new THREE.Color("#9a5348"), 0.5);
    const hullMat = paintMat(paint, pattern, tier);
    const dark = mat("#12161a", 0.46, 0.5);
    const rubber = mat("#101214", 0.82, 0.06);
    const steel = mat("#d0d8de", 0.2, 0.86);
    const accent = mat(team === 0 ? "#3ee0c5" : "#ff4d2e", 0.3, 0.35, team === 0 ? "#3ee0c5" : "#ff4d2e", 0.6);
    const len = spec.len * bulk;
    const wid = spec.wid * bulk;
    const hullH = (kind === "bastion" ? 6.6 : kind === "viper" ? 4.1 : 5.5) + tier * 0.28;
    const hull = new THREE.Mesh(hullShape(len, wid * 0.58, hullH, kind === "viper" ? 0.36 : kind === "bastion" ? 0.62 : 0.5), hullMat);
    hull.castShadow = true;
    hull.receiveShadow = true;
    hull.position.y = kind === "viper" ? 2.55 : 2.15;
    group.add(hull);
    if (kind === "viper") this.addWheels(group, len, wid, rubber, steel);
    else this.addTracks(group, len, wid, rubber, steel, tier >= 2 ? dark : null);
    piece(group, BOX, dark, 0, 4.15, wid * 0.34, len * 0.72, 0.32, 1.15, false);
    piece(group, BOX, dark, 0, 4.15, -wid * 0.34, len * 0.72, 0.32, 1.15, false);
    piece(group, SPHERE, mat("#f7f6ea", 0.18, 0.1, "#fff4c8", 0.9), len * 0.46, 3.15, wid * 0.14, 0.5, 0.45, 0.5, false);
    piece(group, SPHERE, mat("#f7f6ea", 0.18, 0.1, "#fff4c8", 0.9), len * 0.46, 3.15, -wid * 0.14, 0.5, 0.45, 0.5, false);
    piece(group, CYL, dark, -len * 0.4, 4.4, wid * 0.1, 0.32, 1.5, 0.32, false).rotation.z = Math.PI / 2;
    piece(group, BOX, accent, -len * 0.02, hullH + 1.05, 0, len * 0.16, 0.16, 1.4, false);
    if (tier >= 3) {
      piece(group, BOX, mat("#6a5840", 0.4, 0.5), -len * 0.02, hullH + 1.65, wid * 0.12, 3.1, 0.4, wid * 0.18, false);
      piece(group, BOX, mat("#6a5840", 0.4, 0.5), len * 0.12, hullH + 1.65, -wid * 0.08, 2.6, 0.4, wid * 0.16, false);
    }
    if (tier >= 4) piece(group, BOX, mat("#e8c56b", 0.26, 0.65, "#e8c56b", 0.22), 0, hullH + 1.45, 0, len * 0.36, 0.16, 0.4, false);
    if (kind === "harvester") {
      piece(group, BOX, dark, -len * 0.04, 7.4, 0, len * 0.48, 2.8, wid * 0.4);
      piece(group, BOX, mat("#143832", 0.35, 0.25, "#3ee0c5", 0.55), -len * 0.04, 9, 0, len * 0.3, 0.45, wid * 0.22, false);
      const arm = piece(group, BOX, steel, len * 0.36, 5.5, 0, len * 0.26, 0.7, 0.75);
      arm.rotation.z = -0.55;
      piece(group, BOX, dark, len * 0.52, 3.2, 0, 2.4, 1.8, wid * 0.28);
      return new THREE.Group();
    }
    if (kind === "bastion" && tier >= 2) piece(group, BOX, dark, len * 0.5, 2.4, 0, 1.4, 2.6, wid * 0.72);
    const turret = new THREE.Group();
    turret.position.set(-len * 0.02, hullH + 1.2, 0);
    if (kind === "howl") {
      const rack = piece(turret, BOX, hullMat, 0.6, 1.5, 0, 8, 2.3, 6.4);
      rack.rotation.z = -0.28;
      for (const y of [0.8, 2.15]) {
        for (const z of [-1.7, 0, 1.7]) {
          piece(turret, CYL, steel, 3.4, y, z, 0.4, 6.8, 0.4).rotation.z = -1.2;
        }
      }
      piece(turret, CYL, dark, -2.4, 2.6, 0, 0.1, 2.4 + tier, 0.1, false);
      group.add(turret);
      return turret;
    }
    if (kind === "aegis") {
      piece(turret, CYL, hullMat, 0, 1.05, 0, 3.3, 1.5, 3.3);
      for (const z of [-1.45, 1.45]) piece(turret, CYL, steel, spec.barrel * 0.32, 2.5, z, 0.36, spec.barrel * 0.9, 0.36).rotation.z = -Math.PI / 2;
      piece(turret, CYL, dark, -1.5, 3.2, 0, 0.22, 3.4, 0.22, false);
      const dish = piece(turret, CYL, steel, -1.5, 5.1 + tier * 0.45, 0, 2.5 + tier * 0.25, 0.22, 2.5 + tier * 0.25);
      dish.rotation.x = 1.05;
      group.add(turret);
      return turret;
    }
    const cheeks = spec.turret * (0.4 + tier * 0.035);
    piece(turret, CYL, hullMat, -0.4, 1.45, 0, cheeks * 0.48, 2.3 + tier * 0.12, cheeks * 0.4);
    piece(turret, BOX, hullMat, -cheeks * 0.05, 1.65, 0, cheeks * 0.72, 1.45, cheeks * 0.58);
    piece(turret, BOX, dark, cheeks * 0.32, 1.7, 0, cheeks * 0.26, 1.05, cheeks * 0.36);
    const barrels = kind === "bastion" ? 2 : 1;
    for (let i = 0; i < barrels; i++) {
      const z = barrels === 1 ? 0 : i === 0 ? -0.75 : 0.75;
      piece(turret, CYL, steel, spec.barrel * 0.5, 1.85, z, spec.thick * 0.48, spec.barrel, spec.thick * 0.48).rotation.z = -Math.PI / 2;
      piece(turret, CYL, dark, spec.barrel * 0.96, 1.85, z, spec.thick * 0.75, 0.85, spec.thick * 0.75, false).rotation.z = -Math.PI / 2;
    }
    piece(turret, CYL, steel, spec.barrel * 0.28, 1.15, cheeks * 0.22, 0.1, spec.barrel * 0.42, 0.1, false).rotation.z = -Math.PI / 2;
    piece(turret, SPHERE, dark, -cheeks * 0.15, 2.95, 0.2, 0.65, 0.32, 0.65, false);
    if (tier >= 2) {
      piece(turret, CYL, dark, cheeks * 0.05, 2.55, cheeks * 0.28, 0.26, 0.6, 0.26, false);
      piece(turret, CYL, dark, cheeks * 0.05, 2.55, -cheeks * 0.28, 0.26, 0.6, 0.26, false);
    }
    if (kind === "t3x" || tier >= 4) piece(turret, BOX, mat("#e8c56b", 0.24, 0.7, "#e8c56b", 0.3), 0, 3.15, 0, cheeks, 0.18, cheeks * 0.4, false);
    if (kind === "t3x") piece(turret, CYL, accent, -1.3, 4.8, 0, 0.12, 3.6, 0.12, false);
    if (tier >= 4) piece(turret, CYL, mat("#eef3f6", 0.3, 0.55), -1.5, 4.3, -1.3, 0.07, 3.3, 0.07, false);
    group.add(turret);
    return turret;
  }

  private buildAir(group: THREE.Group, kind: Kind, team: 0 | 1, tier: number): void {
    const bulk = 1 + (tier - 1) * 0.1;
    const pattern = this.patterns[Math.max(0, Math.min(3, tier - 1))];
    const color = new THREE.Color(kind === "ionwing" ? "#d9fff6" : kind === "spectre" ? "#98a2a8" : kind === "condor" ? "#d2bea4" : "#d5dee6");
    color.lerp(new THREE.Color(["#cfd6dc", "#8e99a0", "#e7eef2", "#f6f1e4"][tier - 1] ?? "#d5dee6"), 0.45);
    if (team === 1) color.lerp(new THREE.Color("#a86858"), 0.38);
    const body = paintMat(color, pattern, Math.max(2, tier));
    const wingMat = mat(kind === "ionwing" ? "#123832" : kind === "spectre" ? "#1a222a" : "#c5d0d6", 0.32, 0.48, kind === "ionwing" ? "#3ee0c5" : "#000", kind === "ionwing" ? 0.28 : 0);
    const dark = mat("#14181c", 0.4, 0.55);
    const glass = mat("#b7e6ff", 0.05, 0.08, "#d2f2ff", 0.4);
    const hot = mat(kind === "ionwing" ? "#bffff4" : "#ffc2a4", 0.18, 0.15, kind === "ionwing" ? "#3ee0c5" : "#ff7a3c", 1.4);
    const accent = mat(team === 0 ? "#3ee0c5" : "#ff4d2e", 0.3, 0.35, team === 0 ? "#3ee0c5" : "#ff4d2e", 0.45);
    const span = (kind === "spectre" ? 42 : kind === "condor" ? 36 : kind === "ionwing" ? 30 : 26) * bulk;
    const fuseLen = (kind === "condor" ? 32 : kind === "spectre" ? 30 : 24) * bulk;
    const fuseR = (kind === "condor" ? 2.9 : kind === "spectre" ? 2.15 : 1.65) * bulk;
    piece(group, CYL, body, 0, 0, 0, fuseR, fuseLen, kind === "spectre" ? fuseR * 0.62 : fuseR).rotation.z = Math.PI / 2;
    piece(group, CONE, body, fuseLen * 0.5 + 3, 0, 0, fuseR * 0.9, 7.4 * bulk, fuseR * 0.9).rotation.z = -Math.PI / 2;
    piece(group, SPHERE, glass, fuseLen * 0.16, fuseR * 0.72, 0, 2.3 * bulk, 0.85 * bulk, 1.25 * bulk, false);
    if (kind === "spectre") {
      piece(group, BOX, wingMat, -1, -0.15, 0, 18 * bulk, 0.7, span);
      piece(group, BOX, dark, 1, -2.6, 7, 8, 1.8, 3.4);
      piece(group, BOX, dark, 1, -2.6, -7, 8, 1.8, 3.4);
      piece(group, CYL, mat("#d5dee4", 0.2, 0.82), 6, -2.3, 0, 0.55, 9, 0.55).rotation.z = -Math.PI / 2;
    } else if (kind === "ionwing") {
      for (const s of [-1, 1]) {
        const wing = piece(group, BOX, wingMat, -1, 0, s * span * 0.22, 18 * bulk, 0.28, span * 0.42);
        wing.rotation.y = s * -0.62;
      }
      piece(group, BOX, hot, -fuseLen * 0.2, -0.2, 0, 6, 0.2, 2.2, false);
    } else if (kind === "condor") {
      piece(group, BOX, wingMat, -2, 2.6, 0, 14 * bulk, 0.42, span);
      piece(group, BOX, wingMat, -fuseLen * 0.42, 1.4, 4.4, 6, 3.4 * bulk, 0.4);
      piece(group, BOX, wingMat, -fuseLen * 0.42, 1.4, -4.4, 6, 3.4 * bulk, 0.4);
      for (const s of [-1, 1]) {
        const prop = piece(group, BOX, dark, 3.5, 2.6, s * span * 0.28, 0.28, 0.4, 8.5, false);
        prop.userData.spin = 1;
        piece(group, CYL, dark, 2.6, 2.6, s * span * 0.28, 0.75, 1.5, 0.75, false).rotation.z = Math.PI / 2;
      }
    } else {
      for (const s of [-1, 1]) {
        const wing = piece(group, BOX, wingMat, -2, 0.05, s * span * 0.24, 13 * bulk, 0.26, span * 0.4);
        wing.rotation.y = s * -0.48;
        if (tier >= 2) piece(group, CYL, dark, 1, -0.7, s * span * 0.2, 0.32, 3.4, 0.32, false);
      }
      piece(group, BOX, wingMat, -fuseLen * 0.42, 1.6, 0, 5.5, 2.8 * bulk, 0.32);
      piece(group, BOX, dark, 2, -0.9, 0, 3.2, 0.7, 1.6, false);
    }
    piece(group, SPHERE, hot, -fuseLen * 0.46, 0, fuseR * 0.45, 0.85, 0.85, 1.1, false);
    piece(group, SPHERE, hot, -fuseLen * 0.46, 0, -fuseR * 0.45, 0.85, 0.85, 1.1, false);
    piece(group, BOX, accent, -1, fuseR + 0.15, 0, 6.5, 0.14, 0.5, false);
    if (tier >= 4) piece(group, BOX, mat("#e8c56b", 0.28, 0.62, "#e8c56b", 0.2), 1, 0.15, 0, 9, 0.1, span * 0.18, false);
  }

  private buildStructure(group: THREE.Group, kind: Kind, team: 0 | 1, tier: number): THREE.Object3D | null {
    const def = DEFS[kind];
    const span = Math.max(kind === "wall" ? 18 : 20, def.fw * TILE * (kind === "wall" ? 0.62 : 0.72));
    const deep = Math.max(kind === "wall" ? 7 : 16, def.fh * TILE * 0.68);
    const t = clamp(tier, 1, 4);
    const grow = 0.78 + t * 0.18;
    const tint = new THREE.Color(["#c9d0d4", "#46545c", "#d5deda", "#f6f1e6"][t - 1]);
    if (team === 1) tint.lerp(new THREE.Color("#c49080"), 0.42);
    const wall = paintMat(tint, this.panels, t);
    const roof = mat(t >= 4 ? "#e8c56b" : t >= 3 ? "#9aabb4" : "#2a3238", 0.38, t >= 4 ? 0.66 : 0.42, t >= 4 ? "#e8c56b" : "#000", t >= 4 ? 0.16 : 0);
    const dark = mat("#171d22", 0.5, 0.42);
    const glass = mat(team === 0 ? "#c5e8ff" : "#ffc8b8", 0.05, 0.08, team === 0 ? "#8fd4ff" : "#ff8d70", 0.6);
    const accent = mat(team === 0 ? "#3ee0c5" : "#ff4d2e", 0.28, 0.4, team === 0 ? "#3ee0c5" : "#ff4d2e", 0.9);
    const steel = mat("#d5dee6", 0.2, 0.82);
    const windows = (y: number, z: number, w: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const x = count === 1 ? 0 : -w * 0.36 + (i * w * 0.72) / (count - 1);
        piece(group, BOX, glass, x, y, z, Math.min(4.2, w / count), 2.2 + t * 0.35, 0.35, false);
      }
    };
    piece(group, BOX, dark, 0, 0.45, 0, span * 1.08, 0.9, (kind === "wall" ? 8 : deep) * 1.05);
    if (kind === "wall") {
      const h = 7.5 * grow;
      piece(group, BOX, wall, 0, h * 0.5 + 0.6, 0, span * 0.96, h, 3.4 + t * 0.4);
      piece(group, BOX, accent, 0, h * 0.75, 1.9, span * 0.82, 0.32, 0.25, false);
      for (let i = 0; i < 5; i++) piece(group, BOX, roof, -span * 0.38 + i * span * 0.19, h + 1.4, 0, 2.6, 2.4, 3.2);
      if (t >= 3) piece(group, BOX, steel, 0, h * 0.45, 2.1, span * 0.7, 0.3, 0.2, false);
      return null;
    }
    if (kind === "spire") {
      const h = 34 * grow;
      piece(group, CYL, wall, 0, h * 0.22, 0, span * 0.32, h * 0.4, span * 0.32);
      piece(group, CYL, wall, 0, h * 0.5, 0, span * 0.22, h * 0.28, span * 0.22);
      piece(group, CYL, dark, 0, h * 0.7, 0, span * 0.12, h * 0.18, span * 0.12);
      piece(group, CYL, accent, 0, h * 0.42, 0, span * 0.07, h * 0.16, span * 0.07, false);
      piece(group, SPHERE, accent, 0, h * 0.62, 0, 2.4 + t, 2.4 + t, 2.4 + t, false);
      piece(group, CYL, steel, 0, h * 0.82 + t * 4, 0, 0.45, 18 + t * 7, 0.45, false);
      if (t >= 2) {
        for (const s of [-1, 1]) {
          piece(group, BOX, dark, s * span * 0.24, h * 0.16, 0, span * 0.1, h * 0.28, span * 0.1);
          piece(group, BOX, dark, 0, h * 0.16, s * span * 0.24, span * 0.1, h * 0.28, span * 0.1);
        }
      }
      if (t >= 3) piece(group, TORUS, steel, 0, h * 0.78, 0, span * 0.14, span * 0.14, 0.8).rotation.x = Math.PI / 2;
      if (t >= 4) piece(group, CYL, roof, 0, h * 0.9, 0, span * 0.16, 1.4, span * 0.16);
      windows(h * 0.24, span * 0.32, span * 0.4, 3);
      return null;
    }
    if (kind === "relay") {
      const h = 14 * grow;
      piece(group, BOX, wall, 0, h * 0.42, 0, span * 0.78, h * 0.75, deep * 0.62);
      piece(group, BOX, roof, 0, h * 0.84, 0, span * 0.88, 1.05, deep * 0.72);
      windows(h * 0.42, deep * 0.32, span * 0.5, 3);
      for (let i = 0; i < t; i++) {
        const x = (i - (t - 1) / 2) * span * 0.2;
        piece(group, CYL, dark, x, h + 3.2, -deep * 0.05, 0.32, 5.5, 0.32, false);
        piece(group, CYL, steel, x, h + 6.2, 0.6, 2.8 + t * 0.25, 0.28, 2.8 + t * 0.25).rotation.x = 0.85;
      }
      piece(group, BOX, accent, 0, 2.3, deep * 0.33, span * 0.36, 0.4, 0.28, false);
      return null;
    }
    if (kind === "refinery") {
      const h = 16 * grow;
      piece(group, BOX, wall, 0, h * 0.38, 0, span * 0.82, h * 0.68, deep * 0.7);
      piece(group, BOX, roof, 0, h * 0.76, 0, span * 0.92, 1.15, deep * 0.8);
      const stacks = t >= 3 ? 2 : 1;
      for (let i = 0; i < stacks; i++) {
        const x = -span * 0.22 + i * 7;
        piece(group, CYL, dark, x, h * 0.85, -deep * 0.08, 2.1, h * 0.75, 2.1);
        piece(group, CYL, accent, x, h * 1.2, -deep * 0.08, 2.5, 0.55, 2.5, false);
      }
      piece(group, CONE, mat("#123832", 0.4, 0.3, "#3ee0c5", 0.4), span * 0.24, h * 0.5, deep * 0.02, 4.2, h * 0.5, 4.2);
      piece(group, BOX, dark, 0, 2.2, deep * 0.28, span * 0.5, 1.1, 2.4);
      windows(h * 0.4, deep * 0.36, span * 0.4, 3);
      return null;
    }
    if (kind === "barracks") {
      const h = 12 * grow;
      piece(group, BOX, wall, 0, h * 0.4, 0, span, h * 0.7, deep * 0.55);
      const roofMesh = new THREE.Mesh(roofPrism(deep * 0.62, 5.5 + t * 1.4, span * 1.02), roof);
      roofMesh.rotation.y = Math.PI / 2;
      roofMesh.position.y = h * 0.74;
      roofMesh.castShadow = true;
      roofMesh.receiveShadow = true;
      group.add(roofMesh);
      windows(h * 0.42, deep * 0.29, span * 0.72, 4 + (t > 2 ? 1 : 0));
      piece(group, BOX, accent, 0, 2.15, deep * 0.3, span * 0.28, 0.45, 0.3, false);
      if (t >= 2) {
        piece(group, BOX, dark, span * 0.4, h * 0.7, -deep * 0.12, 5.2, h * 1.2, 5.2);
        piece(group, BOX, roof, span * 0.4, h * 1.35, -deep * 0.12, 6.6, 1, 6.6);
      }
      if (t >= 3) piece(group, CYL, accent, span * 0.4, h * 1.75, -deep * 0.12, 0.1, 4.2, 0.1, false);
      if (t >= 4) piece(group, BOX, roof, 0, h * 0.95, deep * 0.3, span * 0.46, 0.35, 0.35, false);
      return null;
    }
    if (kind === "bay") {
      const h = 15 * grow;
      piece(group, BOX, wall, 0, h * 0.46, 0, span, h * 0.82, deep * 0.78);
      piece(group, BOX, roof, 0, h * 0.92, -deep * 0.04, span * 1.04, 1.25, deep * 0.9);
      piece(group, BOX, dark, 0, h * 0.28, deep * 0.32, span * 0.42, h * 0.42, 0.7);
      piece(group, BOX, steel, 0, h + 1.6, 0, 0.9, 3.2, deep * 0.62, false);
      piece(group, BOX, steel, span * 0.12, h + 3.3, 0, span * 0.28, 0.45, 0.55, false);
      if (t >= 3) piece(group, BOX, dark, -span * 0.38, h * 0.35, 0, span * 0.18, h * 0.6, deep * 0.45);
      if (t >= 4) piece(group, BOX, accent, 0, 2.4, deep * 0.42, span * 0.5, 0.35, 0.28, false);
      windows(h * 0.62, deep * 0.4, span * 0.5, 3);
      return null;
    }
    if (kind === "strip") {
      piece(group, BOX, dark, 0, 0.85, 0, span * 1.45, 0.55, deep * 1.25);
      piece(group, BOX, accent, 0, 1.25, 0, span * 1.2, 0.12, 1.5, false);
      for (let i = -2; i <= 2; i++) piece(group, BOX, mat("#f4f7f8", 0.5, 0.1), i * span * 0.22, 1.22, 0, span * 0.06, 0.08, deep * 0.2, false);
      const towerH = 12 * grow;
      piece(group, BOX, wall, span * 0.48, towerH * 0.45, -deep * 0.32, 9, towerH, 9);
      piece(group, BOX, glass, span * 0.48, towerH * 0.72, -deep * 0.32 + 4.6, 6.2, 2.6, 0.35, false);
      piece(group, CYL, steel, span * 0.48, towerH + t * 2, -deep * 0.32, 0.35, 7 + t * 2.5, 0.35, false);
      if (t >= 2) piece(group, CYL, steel, span * 0.48, towerH + 2, -deep * 0.32, 3.2 + t * 0.3, 0.22, 3.2 + t * 0.3).rotation.x = 0.7;
      if (t >= 4) piece(group, BOX, roof, span * 0.48, towerH + 0.4, -deep * 0.32, 11, 0.5, 11);
      return null;
    }
    if (kind === "silo") {
      const h = 18 * grow;
      const n = 2 + (t >= 3 ? 1 : 0) + (t >= 4 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * 8.5;
        piece(group, CYL, wall, x, h * 0.45, 0, 3.4, h, 3.4);
        piece(group, CYL, t >= 3 ? accent : roof, x, h + 0.4, 0, 3.8, 1.1, 3.8, false);
      }
      if (t >= 2) piece(group, BOX, dark, 0, 3, deep * 0.22, n * 8, 2.2, 3);
      return null;
    }
    if (kind === "turret" || kind === "cannon" || kind === "sam") {
      const h = (kind === "cannon" ? 7 : 5.5) * grow;
      piece(group, CYL, wall, 0, h * 0.45, 0, span * 0.28, h, span * 0.28);
      piece(group, CYL, dark, 0, h + 0.3, 0, span * 0.34, 1.2, span * 0.34);
      const gun = new THREE.Group();
      gun.position.set(0, h + 1.5, 0);
      if (kind === "sam") {
        piece(gun, BOX, dark, 0, 0.8, 0, 3.6, 1.3, 5.4);
        for (const z of [-1.6, 1.6]) piece(gun, CYL, steel, 2.2, 1.6, z, 0.48, 7.5 + t * 1.4, 0.48).rotation.z = -1.15;
        if (t >= 3) piece(gun, CYL, steel, 2.2, 2.8, 0, 0.4, 6 + t, 0.4).rotation.z = -1.15;
      } else {
        const len = (kind === "cannon" ? 18 : 10) + t * 2.2;
        const thick = kind === "cannon" ? 0.72 : 0.48;
        piece(gun, BOX, dark, -0.5, 0.9, 0, 4.8, 2.1, 4.4);
        piece(gun, CYL, steel, len * 0.42, 1.15, 0, thick, len, thick).rotation.z = -Math.PI / 2;
        if (t >= 3 && kind === "cannon") piece(gun, CYL, steel, len * 0.32, 2.3, 0, 0.38, len * 0.65, 0.38).rotation.z = -Math.PI / 2;
        if (t >= 4) piece(gun, BOX, mat("#e8c56b", 0.3, 0.6, "#e8c56b", 0.2), 0, 2.3, 0, 3.2, 0.2, 2.4, false);
      }
      group.add(gun);
      return gun;
    }
    const h = 14 * grow;
    piece(group, BOX, wall, 0, h * 0.42, 0, span * 0.8, h * 0.75, deep * 0.75);
    piece(group, BOX, roof, 0, h * 0.84, 0, span * 0.9, 1.2, deep * 0.85);
    windows(h * 0.45, deep * 0.39, span * 0.45, 3);
    piece(group, BOX, accent, 0, 2.2, deep * 0.4, span * 0.36, 0.4, 0.25, false);
    return null;
  }

  private syncGhosts(sim: Sim, cinematic: boolean): void {
    const keep = new Set<string>();
    if (!cinematic) {
      for (const m of sim.memory.values()) {
        const key = `${m.kind}:${m.x | 0}:${m.y | 0}`;
        keep.add(key);
        if (this.ghosts.has(key)) continue;
        const fake = { id: 0, kind: m.kind, team: m.team, facing: 0, aim: 0 } as Ent;
        const actor = this.makeActor(fake, 1, key);
        this.soften(actor.group, 0.32);
        actor.group.position.set(m.x, DEFS[m.kind].air ? 42 : this.elevation(m.x, m.y), m.y);
        this.scene.add(actor.group);
        this.ghosts.set(key, actor.group);
      }
    }
    for (const [key, group] of this.ghosts) {
      if (keep.has(key)) continue;
      this.scene.remove(group);
      this.release(group);
      this.ghosts.delete(key);
    }
  }

  private syncShots(sim: Sim): void {
    while (this.shots.length < sim.shots.length) {
      const mesh = new THREE.Mesh(SPHERE, mat("#fff6d0", 0.2, 0.1, "#fff1c2", 1.6));
      this.scene.add(mesh);
      this.shots.push(mesh);
    }
    this.shots.forEach((mesh, i) => {
      const shot = sim.shots[i];
      mesh.visible = !!shot;
      if (!shot) return;
      const color = shot.kind === "rocket" ? "#ff5a36" : shot.kind === "shell" ? "#ffe08a" : "#d8fff8";
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.color.set(color);
      material.emissive.set(color);
      const len = Math.hypot(shot.x - shot.px, shot.y - shot.py);
      mesh.position.set((shot.x + shot.px) / 2, this.elevation(shot.x, shot.y) + (shot.kind === "rocket" ? 9 : 6), (shot.y + shot.py) / 2);
      mesh.scale.set(shot.kind === "bolt" ? 1.2 : 1.8, 1.2, Math.max(6, len));
      mesh.lookAt(shot.x, mesh.position.y, shot.y);
    });
  }

  private syncSparks(sim: Sim): void {
    const list = sim.particles;
    while (this.sparks.length < list.length && this.sparks.length < 140) {
      const mesh = new THREE.Mesh(SPHERE, mat("#fff", 1, 0));
      this.scene.add(mesh);
      this.sparks.push(mesh);
    }
    this.sparks.forEach((mesh, i) => {
      const p = list[i];
      mesh.visible = !!p && i < 140;
      if (!p || i >= 140) return;
      const a = Math.max(0, p.life / p.max);
      mesh.position.set(p.x, this.elevation(p.x, p.y) + (1 - a) * (p.kind === "smoke" ? 22 : 8), p.y);
      mesh.scale.setScalar(p.size * (p.kind === "smoke" ? 1.6 : a) * 0.85);
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.color.set(p.color);
      material.emissive.set(p.kind === "smoke" ? "#000" : p.color);
      material.opacity = p.kind === "smoke" ? a * 0.4 : a;
      material.transparent = true;
    });
  }

  private syncRings(sim: Sim): void {
    const ids = sim.selected;
    while (this.rings.length < ids.length) {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(10, 12.4, 32),
        new THREE.MeshBasicMaterial({ color: "#3ee0c5", side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
      );
      mesh.rotation.x = -Math.PI / 2;
      this.scene.add(mesh);
      this.rings.push(mesh);
    }
    this.rings.forEach((mesh, i) => {
      const unit = ids[i] ? sim.byId(ids[i]) : undefined;
      mesh.visible = !!unit;
      if (!unit) return;
      (mesh.material as THREE.MeshBasicMaterial).color.set(unit.team === 0 ? "#3ee0c5" : "#ff5a36");
      const reach = DEFS[unit.kind].radius * 1.2;
      mesh.scale.set(reach / 11, reach / 11, 1);
      mesh.position.set(unit.x, (DEFS[unit.kind].air ? 40 : this.elevation(unit.x, unit.y)) + 0.55, unit.y);
    });
  }

  private syncBox(box: { x0: number; y0: number; x1: number; y1: number } | null): void {
    if (!box) {
      this.boxMesh.visible = false;
      return;
    }
    const x = (box.x0 + box.x1) / 2;
    const z = (box.y0 + box.y1) / 2;
    this.boxMesh.visible = true;
    this.boxMesh.position.set(x, this.elevation(x, z) + 0.8, z);
    this.boxMesh.scale.set(Math.max(4, Math.abs(box.x1 - box.x0)), Math.max(4, Math.abs(box.y1 - box.y0)), 1);
  }

  private syncPlace(ghost: { kind: Kind; x: number; y: number; ok: boolean } | null): void {
    if (!ghost) {
      if (this.placeMesh) this.placeMesh.visible = false;
      return;
    }
    if (!this.placeMesh || this.placeKind !== ghost.kind) {
      if (this.placeMesh) {
        this.scene.remove(this.placeMesh);
        this.release(this.placeMesh);
      }
      const fake = { id: 0, kind: ghost.kind, team: 0, facing: 0, aim: 0 } as Ent;
      this.placeMesh = this.makeActor(fake, 1, "place").group;
      this.soften(this.placeMesh, 0.45);
      this.placeKind = ghost.kind;
      this.scene.add(this.placeMesh);
    }
    this.placeMesh.visible = true;
    this.placeMesh.position.set(ghost.x, this.elevation(ghost.x, ghost.y), ghost.y);
    this.placeMesh.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (!material.color) return;
      material.color.set(ghost.ok ? "#d7fff4" : "#ffb0a4");
    });
  }

  setEye(id: number): void {
    this.eyeId = id;
  }
}

function vehicleSpec(kind: Kind): { len: number; wid: number; turret: number; barrel: number; thick: number; paint: string } {
  if (kind === "viper") return { len: 28, wid: 15, turret: 7.5, barrel: 11, thick: 0.55, paint: "#3a4650" };
  if (kind === "lancer") return { len: 40, wid: 20, turret: 11, barrel: 20, thick: 0.85, paint: "#3c4a40" };
  if (kind === "reaver") return { len: 42, wid: 22, turret: 12, barrel: 15, thick: 1.15, paint: "#2a3830" };
  if (kind === "howl") return { len: 40, wid: 22, turret: 12, barrel: 14, thick: 0.9, paint: "#3d4a32" };
  if (kind === "aegis") return { len: 40, wid: 22, turret: 11, barrel: 16, thick: 0.6, paint: "#1e4048" };
  if (kind === "bastion") return { len: 54, wid: 26, turret: 14, barrel: 24, thick: 1.35, paint: "#4a3428" };
  if (kind === "t3x") return { len: 50, wid: 24, turret: 13, barrel: 22, thick: 1.05, paint: "#6a5a32" };
  return { len: 36, wid: 18, turret: 9, barrel: 10, thick: 0.7, paint: "#3a4650" };
}
