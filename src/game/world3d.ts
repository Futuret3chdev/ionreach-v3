import * as THREE from "three";
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
const SPHERE = new THREE.SphereGeometry(1, 14, 10);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 12);

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

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.add(this.sunTarget);
    this.sun = new THREE.DirectionalLight("#fff0d2", 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 20;
    this.sun.shadow.camera.far = 2800;
    this.sun.shadow.bias = -0.0004;
    this.sun.target = this.sunTarget;
    this.scene.add(this.sun);
    const amb = new THREE.HemisphereLight("#c5d7e6", "#3a2a22", 0.72);
    this.scene.add(amb);
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(9000, 18, 12),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          top: { value: new THREE.Color("#16304a") },
          horizon: { value: new THREE.Color("#d7c4a4") },
        },
        vertexShader: "varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
        fragmentShader:
          "varying vec3 vP; uniform vec3 top; uniform vec3 horizon; void main(){ float h=clamp(vP.y/9000.0+0.35,0.0,1.0); gl_FragColor=vec4(mix(horizon,top,smoothstep(0.0,1.0,h)),1.0); }",
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
  }

  dispose(): void {
    this.renderer.dispose();
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry?.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    });
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
      fog.near = 40;
      fog.far = 720;
    } else {
      fog.near = 360;
      fog.far = 2600 / Math.max(0.55, cam.z);
    }
    this.viewGun.visible = glance === "eye" && !!eye;
    if (eye) this.dressViewGun(eye, sim);
    this.renderer.render(this.scene, this.camera);
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
      const tall = air ? 46 : DEFS[eye.kind].armor === "heavy" || eye.kind === "harvester" ? 18 : 15.5;
      const yaw = eye.facing + look.yaw;
      const pitch = look.pitch;
      const bob = air ? 0 : Math.sin(sim.time * (eye.order === "move" || eye.order === "amove" ? 12 : 1.5) + eye.id) * (eye.order === "idle" ? 0.04 : 0.18);
      this.camera.position.set(eye.x + (Math.random() - 0.5) * shake * 4, h + tall + bob, eye.y);
      const dist = 120;
      this.camera.lookAt(
        eye.x + Math.cos(yaw) * Math.cos(pitch) * dist,
        h + tall + Math.sin(pitch) * dist,
        eye.y + Math.sin(yaw) * Math.cos(pitch) * dist,
      );
      return;
    }
    const dist = 860 / Math.max(0.4, cam.z);
    const pitch = 0.96;
    this.camera.position.set(cam.x + (Math.random() - 0.5) * shake * 10, Math.sin(pitch) * dist, cam.y + Math.cos(pitch) * dist);
    this.camera.lookAt(cam.x, 6, cam.y);
  }

  private dressViewGun(eye: Ent, sim: Sim): void {
    const tier = lookTier(sim, eye.kind, eye.team);
    const sig = `${eye.kind}:${tier}`;
    if (this.viewGun.userData.sig === sig) return;
    this.viewGun.userData.sig = sig;
    this.viewGun.clear();
    const steel = mat("#2a3138", 0.4, 0.62);
    const dark = mat("#14181c", 0.5, 0.4);
    if (DEFS[eye.kind].air) {
      piece(this.viewGun, BOX, steel, 0, -0.35, -1.4, 0.9, 0.08, 0.35, false);
      return;
    }
    if (DEFS[eye.kind].armor === "heavy" || eye.kind === "harvester") {
      piece(this.viewGun, BOX, steel, 0, -0.42, -2.2, 0.16, 0.16, 2.4, false);
      piece(this.viewGun, BOX, dark, 0, -0.42, -3.3, 0.22, 0.22, 0.28, false);
      return;
    }
    const len = eye.kind === "rocket" ? 1.5 : 1.15 + tier * 0.08;
    piece(this.viewGun, BOX, dark, 0.34, -0.38, -0.55, 0.08, 0.1, 0.7, false);
    piece(this.viewGun, BOX, steel, 0.34, -0.36, -1.15, 0.045, 0.05, len, false);
    if (tier >= 3) piece(this.viewGun, BOX, mat("#9ad7ff", 0.3, 0.2, "#7ec8ff", 0.4), 0.34, -0.28, -0.9, 0.05, 0.04, 0.16, false);
    if (eye.kind === "rocket") piece(this.viewGun, CYL, mat("#6a5a3a", 0.5, 0.3), 0.34, -0.36, -1.7, 0.07, 0.5, 0.07, false);
  }

  private elevation(x: number, y: number): number {
    const c = clamp(Math.floor(x / TILE), 0, COLS - 1);
    const r = clamp(Math.floor(y / TILE), 0, ROWS - 1);
    const i = r * (COLS + 1) + c;
    return this.heights[i] ?? 0;
  }

  private buildTerrain(sim: Sim): void {
    this.builtFor = sim.chapterId;
    const old = this.scene.getObjectByName("land");
    if (old) this.scene.remove(old);
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
      if (tile === 3) return -3.2;
      if (tile === 1) return 8 + n * 36 * (0.35 + chapter.peaks * 0.7);
      if (tile === 2) return 1.4 + n * 2.2;
      return n * 4.2 * (chapter.snow ? 0.45 : 1);
    };
    const sampleC = (c: number, r: number, target: THREE.Color) => {
      const cc = clamp(c, 0, COLS - 1);
      const rr = clamp(r, 0, ROWS - 1);
      const tile = sim.tiles[rr * COLS + cc];
      const n = sim.style[rr * COLS + cc] ?? 0;
      if (tile === 3) target.set("#1a4e62").lerp(new THREE.Color("#0e2a36"), n * 0.4);
      else if (tile === 1) target.set(chapter.snow ? "#c5ced6" : "#5c646e").lerp(new THREE.Color("#2a3038"), 0.35 - n * 0.2);
      else if (tile === 2) target.set("#1e6a62").lerp(new THREE.Color("#b8fff2"), 0.25 + n * 0.2);
      else {
        target.setRGB(chapter.ground[0] / 255, chapter.ground[1] / 255, chapter.ground[2] / 255);
        target.lerp(new THREE.Color(chapter.snow ? "#f4f7f8" : "#1c2418"), chapter.snow ? 0.35 + n * 0.4 : n * 0.18);
      }
    };
    const tint = new THREE.Color();
    for (let r = 0; r <= ROWS; r++) {
      for (let c = 0; c <= COLS; c++) {
        const h = (sampleH(c, r) + sampleH(c - 1, r) + sampleH(c, r - 1) + sampleH(c - 1, r - 1)) / 4;
        const idx = r * (COLS + 1) + c;
        this.heights[idx] = h;
        positions.push(c * TILE, h, r * TILE);
        fogPos.push(c * TILE, h + 0.55, r * TILE);
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
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.02 }),
    );
    groundMesh.receiveShadow = true;
    land.add(groundMesh);
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_W, WORLD_H),
      mat(chapter.waterFill, 0.18, 0.55, chapter.waterFill, 0.08, 0.78),
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
      fragmentShader: "varying float vA; void main(){ gl_FragColor=vec4(0.012,0.016,0.024,vA); }",
    });
    land.add(this.fogMesh);
    this.plant(sim, land, chapter.canopy, chapter.trunk, chapter.snow);
    this.scene.add(land);
  }

  private plant(sim: Sim, land: THREE.Group, canopy: string, trunk: string, snow: boolean): void {
    let trees = 0;
    let rocks = 0;
    let crystals = 0;
    for (let i = 0; i < COLS * ROWS; i++) {
      if (sim.flora[i]) trees++;
      if (sim.tiles[i] === 1 && i % 2 === 0) rocks++;
      if (sim.ion[i] > 0) crystals++;
    }
    const trunkMesh = new THREE.InstancedMesh(CYL, mat(trunk, 0.9, 0.05), Math.max(1, trees));
    const leafMat = mat(snow ? "#d5e0dc" : canopy, 0.8, 0.02);
    const leafMesh = new THREE.InstancedMesh(SPHERE, leafMat, Math.max(1, trees));
    const rockMesh = new THREE.InstancedMesh(BOX, mat(snow ? "#b7c0c8" : "#4e565f", 0.88, 0.08), Math.max(1, rocks));
    const gemMesh = new THREE.InstancedMesh(CYL, mat("#d9fff6", 0.2, 0.1, "#3ee0c5", 0.8), Math.max(1, crystals));
    trunkMesh.castShadow = false;
    leafMesh.castShadow = false;
    const dummy = new THREE.Object3D();
    let ti = 0;
    let ri = 0;
    let gi = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        const x = (c + 0.5) * TILE;
        const z = (r + 0.55) * TILE;
        const h = this.heights[r * (COLS + 1) + c] ?? 0;
        const flora = sim.flora[i];
        if (flora) {
          const tall = flora === 2;
          dummy.position.set(x, h + (tall ? 9 : 6), z);
          dummy.scale.set(tall ? 1.3 : 0.9, tall ? 18 : 12, tall ? 1.3 : 0.9);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          trunkMesh.setMatrixAt(ti, dummy.matrix);
          dummy.position.set(x, h + (tall ? 20 : 14), z);
          dummy.scale.set(tall ? 7.5 : 5.2, tall ? 6.2 : 4.4, tall ? 7.5 : 5.2);
          dummy.updateMatrix();
          leafMesh.setMatrixAt(ti, dummy.matrix);
          ti++;
        }
        if (sim.tiles[i] === 1 && i % 2 === 0) {
          dummy.position.set(x, h + 3, z);
          dummy.rotation.set(0, (c * 0.7) % 1.2, 0.08);
          dummy.scale.set(7 + (c % 4), 5 + (r % 3), 6 + (c % 3));
          dummy.updateMatrix();
          rockMesh.setMatrixAt(ri, dummy.matrix);
          ri++;
        }
        if (sim.ion[i] > 0) {
          const rise = 4 + (sim.ion[i] / 2800) * 10;
          dummy.position.set(x, h + rise * 0.5, z);
          dummy.rotation.set(0, c, 0);
          dummy.scale.set(1.4, rise, 1.4);
          dummy.updateMatrix();
          gemMesh.setMatrixAt(gi, dummy.matrix);
          gi++;
        }
      }
    }
    trunkMesh.count = ti;
    leafMesh.count = ti;
    rockMesh.count = ri;
    gemMesh.count = gi;
    if (ti) land.add(trunkMesh, leafMesh);
    if (ri) land.add(rockMesh);
    if (gi) land.add(gemMesh);
  }

  private syncFog(sim: Sim, cinematic: boolean): void {
    const data = this.fogAlpha.array as Float32Array;
    for (let r = 0; r <= ROWS; r++) {
      for (let c = 0; c <= COLS; c++) {
        const cc = clamp(c, 0, COLS - 1);
        const rr = clamp(r, 0, ROWS - 1);
        const seen = sim.explored[rr * COLS + cc];
        const live = sim.visible[rr * COLS + cc];
        data[r * (COLS + 1) + c] = cinematic ? 0 : live ? 0 : seen ? 0.42 : 0.88;
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
        if (actor) this.scene.remove(actor.group);
        actor = this.makeActor(e, tier, key);
        this.actors.set(e.id, actor);
        this.scene.add(actor.group);
      }
      const def = DEFS[e.kind];
      const h = def.air ? 0 : this.elevation(e.x, e.y);
      const alt = def.air ? 42 + Math.sin(sim.time * 1.4 + e.id) * 3 : h;
      actor.group.position.set(e.x, alt, e.y);
      actor.group.rotation.y = -e.facing;
      if (def.building) {
        const progress = e.buildTotal > 0 && e.buildLeft > 0 ? Math.max(0.08, 1 - e.buildLeft / e.buildTotal) : 1;
        actor.group.scale.set(1, progress, 1);
      } else actor.group.scale.set(1, 1, 1);
      const moving = e.order === "move" || e.order === "amove" || e.order === "attack" || e.order === "harvest";
      const step = moving ? Math.sin(sim.time * 11 + e.id) : 0;
      actor.legs.forEach((leg, i) => {
        leg.rotation.x = (i % 2 === 0 ? step : -step) * 0.7;
      });
      if (actor.turret) actor.turret.rotation.y = -(e.aim - e.facing);
      actor.group.visible = this.eyeId !== e.id;
    }
    for (const [id, actor] of this.actors) {
      if (live.has(id)) continue;
      this.scene.remove(actor.group);
      this.actors.delete(id);
    }
  }

  private tileIndex(x: number, y: number): number {
    const c = clamp(Math.floor(x / TILE), 0, COLS - 1);
    const r = clamp(Math.floor(y / TILE), 0, ROWS - 1);
    return r * COLS + c;
  }

  private makeActor(e: Ent, tier: number, key: string): Actor {
    const group = new THREE.Group();
    const legs: THREE.Object3D[] = [];
    let turret: THREE.Object3D | null = null;
    if (DEFS[e.kind].building) this.buildStructure(group, e.kind, e.team, tier);
    else if (DEFS[e.kind].air) this.buildAir(group, e.kind, e.team, tier);
    else if (e.kind === "rifle" || e.kind === "rocket" || e.kind === "watch" || e.kind === "patrol" || e.kind === "grenadier" || e.kind === "sergeant" || e.kind === "specops") {
      this.buildSoldier(group, legs, e.kind, e.team, tier);
    } else turret = this.buildVehicle(group, e.kind, e.team, tier);
    return { id: e.id, key, group, legs, turret };
  }

  private buildSoldier(group: THREE.Group, legs: THREE.Object3D[], kind: Kind, team: 0 | 1, tier: number): void {
    const bulk = 1 + (tier - 1) * 0.1;
    const cloth = new THREE.Color(team === 0 ? "#3c5a3e" : "#704038");
    if (kind === "specops") cloth.set("#161a1e");
    else if (kind === "sergeant") cloth.set(team === 0 ? "#2f4634" : "#5a342c");
    else if (kind === "watch") cloth.set("#6a6238");
    if (tier >= 3) cloth.lerp(new THREE.Color("#8d7b58"), 0.28);
    if (tier >= 4) cloth.lerp(new THREE.Color(team === 0 ? "#d5e2dc" : "#d27a58"), 0.4);
    const fat = mat(cloth, 0.84, 0.06);
    const boot = mat("#1a1c1e", 0.7, 0.2);
    const skin = mat("#e4c2a2", 0.7, 0.02);
    const steel = mat("#23282e", 0.38, 0.55);
    const teamMat = mat(team === 0 ? "#3ee0c5" : "#ff5a36", 0.4, 0.2, team === 0 ? "#3ee0c5" : "#ff5a36", 0.35);
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(-0.4, 8.2, side * 1.7);
      piece(hip, BOX, fat, 0, -3.1, 0, 2.3 * bulk, 6.2, 2.2);
      piece(hip, BOX, boot, 0.4, -6.6, 0, 2.6, 1.5, 2.4);
      group.add(hip);
      legs.push(hip);
    }
    piece(group, BOX, fat, 0, 12.2, 0, 6.4 * bulk, 7.2, 4.2 * bulk);
    if (tier >= 2) piece(group, BOX, mat("#1c2420", 0.6, 0.3), -2.4, 12.4, 0, 1.4, 5.2, 3.2);
    if (tier >= 3) {
      piece(group, BOX, steel, 0, 14.6, 2.5, 3.2, 1.1, 1.4);
      piece(group, BOX, steel, 0, 14.6, -2.5, 3.2, 1.1, 1.4);
    }
    if (tier >= 4) piece(group, BOX, teamMat, 0.2, 13.4, 0, 3.4, 2.2, 0.35);
    piece(group, SPHERE, skin, 0.4, 17.6, 0, 2.1, 2.2, 2.1);
    piece(group, SPHERE, fat, -0.2, 18.4, 0, 2.5, 1.7, 2.6);
    piece(group, BOX, teamMat, 1.2, 15.2, 2.3, 0.4, 1.4, 1.6);
    if (kind === "sergeant") {
      piece(group, BOX, mat("#e8c56b", 0.4, 0.4), -0.2, 16.2, 2.2, 0.3, 0.5, 1.8);
      piece(group, CYL, steel, -1.2, 20.5, 0, 0.12, 4.2, 0.12);
    }
    if (kind === "specops") piece(group, BOX, mat("#101418"), 1.6, 17.8, 0, 0.4, 0.7, 2.4);
    if (kind === "watch") piece(group, BOX, steel, 2.2, 17.6, 0, 0.6, 0.7, 2.6);
    const gun = new THREE.Group();
    gun.position.set(1.2, 12.4, 1.6);
    const barrel = kind === "rocket" ? 16 : kind === "grenadier" ? 9 : kind === "specops" ? 11 : 12 + tier;
    piece(gun, BOX, steel, barrel * 0.45, 0, 0, barrel, kind === "rocket" ? 2.4 : 1.15, kind === "rocket" ? 2.4 : 1.15);
    piece(gun, BOX, mat("#4a3428", 0.7, 0.1), -1.2, -0.6, 0, 3.2, 2.2, 1.4);
    if (tier >= 3) piece(gun, BOX, mat("#b9e6ff", 0.2, 0.1, "#9ad7ff", 0.5), barrel * 0.4, 1.1, 0, 2.2, 0.7, 0.7);
    if (kind === "grenadier") piece(gun, SPHERE, mat("#2f6a38"), 4, 1.6, 0, 1.5, 1.5, 1.5);
    group.add(gun);
    if (kind === "rocket") piece(group, BOX, mat("#3a4038"), -3.2, 13, 0, 2.2, 6.4, 2.4);
    if (kind === "patrol") {
      const dog = new THREE.Group();
      dog.position.set(2, 0, 6.5);
      piece(dog, BOX, mat("#6a5038", 0.8, 0.05), 0, 3.2, 0, 6.2, 3.2, 2.6);
      piece(dog, SPHERE, mat("#2a2018"), 3.2, 4.4, 0, 1.8, 1.6, 1.6);
      group.add(dog);
    }
  }

  private buildVehicle(group: THREE.Group, kind: Kind, team: 0 | 1, tier: number): THREE.Object3D {
    const spec = vehicleSpec(kind);
    const bulk = 1 + (tier - 1) * 0.07;
    const paint = new THREE.Color(spec.paint);
    if (team === 1) paint.lerp(new THREE.Color("#6a382e"), 0.45);
    if (tier >= 2) paint.lerp(new THREE.Color("#243038"), 0.25);
    if (tier >= 3) paint.lerp(new THREE.Color("#8a7344"), 0.18);
    if (tier >= 4) paint.lerp(new THREE.Color(team === 0 ? "#dfe8e4" : "#c46848"), 0.28);
    const hullMat = mat(paint, 0.48, 0.42);
    const dark = mat("#15191c", 0.55, 0.35);
    const len = spec.len * bulk;
    const wid = spec.wid * bulk;
    piece(group, BOX, dark, 0, 2.4, wid * 0.42, len, 2.6, 2.8);
    piece(group, BOX, dark, 0, 2.4, -wid * 0.42, len, 2.6, 2.8);
    for (const side of [-1, 1]) {
      for (let w = 0; w < 4; w++) {
        piece(group, CYL, mat("#0e1114", 0.4, 0.5), -len * 0.32 + w * len * 0.2, 2.2, side * wid * 0.56, 1.5, 1.5, 1.7);
      }
    }
    piece(group, BOX, hullMat, -len * 0.02, 5.4, 0, len * 0.92, 4.4, wid * 0.78);
    const slope = piece(group, BOX, hullMat, len * 0.28, 6.6, 0, len * 0.34, 2.2, wid * 0.7);
    slope.rotation.z = -0.45;
    if (tier >= 2) {
      piece(group, BOX, dark, 0, 4.2, wid * 0.48, len * 0.7, 1.3, 0.6);
      piece(group, BOX, dark, 0, 4.2, -wid * 0.48, len * 0.7, 1.3, 0.6);
    }
    if (tier >= 3) {
      for (const x of [-len * 0.18, len * 0.02]) piece(group, BOX, mat("#3a3428", 0.5, 0.4), x, 8.1, 0, 4.2, 0.8, wid * 0.5);
    }
    piece(group, BOX, mat(team === 0 ? "#3ee0c5" : "#ff5a36", 0.4, 0.3, team === 0 ? "#3ee0c5" : "#ff5a36", 0.25), -len * 0.05, 8.05, 0, len * 0.28, 0.28, 1.2);
    if (kind === "t3x") piece(group, BOX, mat("#e8c56b", 0.35, 0.55, "#e8c56b", 0.2), 0, 8.2, 0, 10, 0.35, 6);
    if (kind === "harvester") {
      piece(group, BOX, dark, -2, 8.2, 0, len * 0.46, 3.2, wid * 0.62);
      return new THREE.Group();
    }
    const turret = new THREE.Group();
    turret.position.set(-len * 0.04, 9.2, 0);
    piece(turret, BOX, hullMat, 0, 1.8, 0, spec.turret, 3.4, spec.turret * 0.86);
    piece(turret, BOX, dark, -spec.turret * 0.32, 2.2, 0, spec.turret * 0.4, 2.4, spec.turret * 0.7);
    if (kind === "howl") {
      for (const z of [-3.2, 0, 3.2]) piece(turret, CYL, mat("#d5dee6", 0.3, 0.7), spec.turret * 0.55, 2.4, z, 1.1, spec.barrel, 1.1).rotateZ(Math.PI / 2);
    } else if (kind === "aegis") {
      piece(turret, CYL, mat("#d5dee6", 0.3, 0.7), spec.turret * 0.2, 4.2, -2.2, 0.7, spec.barrel * 0.7, 0.7).rotateZ(Math.PI / 2);
      piece(turret, CYL, mat("#d5dee6", 0.3, 0.7), spec.turret * 0.2, 4.2, 2.2, 0.7, spec.barrel * 0.7, 0.7).rotateZ(Math.PI / 2);
    } else {
      const barrel = piece(turret, CYL, mat("#d7e0e6", 0.28, 0.72), spec.barrel * 0.55, 2.2, 0, spec.thick, spec.barrel, spec.thick);
      barrel.rotation.z = Math.PI / 2;
      piece(turret, CYL, dark, spec.barrel * 0.95, 2.2, 0, spec.thick * 1.4, 1.4, spec.thick * 1.4).rotateZ(Math.PI / 2);
    }
    if (tier >= 4) piece(turret, CYL, mat("#cfd8de", 0.4, 0.5), -2, 5.2, 0, 0.18, 4.5, 0.18);
    group.add(turret);
    return turret;
  }

  private buildAir(group: THREE.Group, kind: Kind, team: 0 | 1, tier: number): void {
    const body = mat(kind === "ionwing" ? "#163a36" : kind === "spectre" ? "#14181c" : kind === "condor" ? "#5a4632" : "#8ea0ae", 0.4, 0.45);
    const wing = mat(kind === "ionwing" ? "#3ee0c5" : kind === "spectre" ? "#2c343c" : "#c5d0d8", 0.45, 0.3, kind === "ionwing" ? "#3ee0c5" : "#000", kind === "ionwing" ? 0.25 : 0);
    piece(group, BOX, body, 0, 0, 0, kind === "condor" ? 28 : 26, 3.2, kind === "spectre" ? 6 : 4.2);
    piece(group, BOX, wing, -2, 0.2, 0, 10, 0.6, kind === "spectre" ? 36 : kind === "condor" ? 34 : 28);
    piece(group, BOX, wing, -10, 0.4, 0, 6, 0.5, 8);
    piece(group, BOX, mat("#9ad7ff", 0.2, 0.1, "#bfe9ff", 0.4), 8, 1.2, 0, 3.2, 1.2, 2.2);
    piece(group, BOX, mat(team === 0 ? "#3ee0c5" : "#ff5a36"), 0, 1.7, 0, 6, 0.25, 0.8);
    if (tier >= 3) piece(group, BOX, mat("#e8c56b", 0.4, 0.4), -4, 1.8, 0, 2, 0.2, 3);
  }

  private buildStructure(group: THREE.Group, kind: Kind, team: 0 | 1, tier: number): void {
    const def = DEFS[kind];
    const w = Math.max(16, def.fw * TILE * 0.78);
    const d = Math.max(16, def.fh * TILE * 0.78);
    const base = ({ spire: 64, relay: 28, refinery: 30, barracks: 22, bay: 24, turret: 14, silo: 36, wall: 11, strip: 6, sam: 16, cannon: 14 } as Record<string, number>)[kind] ?? 18;
    const h = base * (0.78 + tier * 0.12);
    const wall = mat(team === 0 ? "#6d838c" : "#8a5a4c", 0.72, 0.22);
    const roof = mat(tier >= 4 ? "#e8c56b" : tier >= 3 ? "#c6b48a" : "#d5dee4", 0.5, 0.28);
    const dark = mat("#1a2228", 0.6, 0.3);
    piece(group, BOX, wall, 0, h * 0.5, 0, w, h, d);
    piece(group, BOX, roof, 0, h + 1.2, 0, w * 1.04, 2.4, d * 1.04);
    piece(group, BOX, mat(team === 0 ? "#3ee0c5" : "#ff5a36", 0.4, 0.2, team === 0 ? "#3ee0c5" : "#ff5a36", 0.45), 0, h * 0.55, d * 0.5 + 0.4, w * 0.55, 2.2, 0.6);
    if (kind === "spire") piece(group, CYL, dark, 0, h + 10 + tier * 4, 0, 1.1, 16 + tier * 6, 1.1);
    if (kind === "relay" || kind === "strip") piece(group, CYL, dark, w * 0.28, h + 6, 0, 4 + tier, 1.2, 4 + tier);
    if (kind === "refinery") piece(group, CYL, dark, -w * 0.22, h * 0.7, 0, 4, h * 0.9, 4);
    if (kind === "bay") piece(group, BOX, dark, 0, h * 0.35, d * 0.2, w * 0.7, h * 0.4, 1.2);
    if (kind === "turret" || kind === "cannon" || kind === "sam") {
      const gun = piece(group, CYL, mat("#d5dee6", 0.3, 0.7), w * 0.2, h + 2, 0, 1.3, w * 0.55, 1.3);
      gun.rotation.z = Math.PI / 2;
    }
    if (tier >= 2 && kind !== "wall") piece(group, BOX, dark, 0, h + 3.2, 0, w * 0.2, 2.2, d * 0.2);
    if (tier >= 4 && kind !== "wall") piece(group, BOX, mat("#e8c56b", 0.35, 0.5, "#e8c56b", 0.15), 0, 2.2, d * 0.5 + 0.5, w * 0.8, 1.2, 0.4);
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
        actor.group.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          const source = mesh.material as THREE.MeshStandardMaterial;
          mesh.material = source.clone();
          (mesh.material as THREE.MeshStandardMaterial).transparent = true;
          (mesh.material as THREE.MeshStandardMaterial).opacity = 0.35;
        });
        actor.group.position.set(m.x, DEFS[m.kind].air ? 42 : this.elevation(m.x, m.y), m.y);
        this.scene.add(actor.group);
        this.ghosts.set(key, actor.group);
      }
    }
    for (const [key, group] of this.ghosts) {
      if (keep.has(key)) continue;
      this.scene.remove(group);
      this.ghosts.delete(key);
    }
  }

  private syncShots(sim: Sim): void {
    while (this.shots.length < sim.shots.length) {
      const mesh = new THREE.Mesh(SPHERE, mat("#fff6d0", 0.2, 0.1, "#fff1c2", 1.4));
      this.scene.add(mesh);
      this.shots.push(mesh);
    }
    this.shots.forEach((mesh, i) => {
      const shot = sim.shots[i];
      mesh.visible = !!shot;
      if (!shot) return;
      const color = shot.kind === "rocket" ? "#ff5a36" : shot.kind === "shell" ? "#ffe08a" : "#bffaf0";
      (mesh.material as THREE.MeshStandardMaterial).color.set(color);
      (mesh.material as THREE.MeshStandardMaterial).emissive.set(color);
      const len = Math.hypot(shot.x - shot.px, shot.y - shot.py);
      mesh.position.set((shot.x + shot.px) / 2, this.elevation(shot.x, shot.y) + (shot.kind === "rocket" ? 8 : 6), (shot.y + shot.py) / 2);
      mesh.scale.set(shot.kind === "bolt" ? 1.4 : 2.2, 1.4, Math.max(4, len));
      mesh.lookAt(shot.x, mesh.position.y, shot.y);
    });
  }

  private syncSparks(sim: Sim): void {
    const list = sim.particles;
    while (this.sparks.length < list.length && this.sparks.length < 120) {
      const mesh = new THREE.Mesh(SPHERE, mat("#fff", 1, 0));
      this.scene.add(mesh);
      this.sparks.push(mesh);
    }
    this.sparks.forEach((mesh, i) => {
      const p = list[i];
      mesh.visible = !!p && i < 120;
      if (!p || i >= 120) return;
      const a = Math.max(0, p.life / p.max);
      mesh.position.set(p.x, this.elevation(p.x, p.y) + (1 - a) * (p.kind === "smoke" ? 18 : 8), p.y);
      mesh.scale.setScalar(p.size * (p.kind === "smoke" ? 1.4 : a) * 0.8);
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.color.set(p.color);
      material.opacity = p.kind === "smoke" ? a * 0.45 : a;
      material.transparent = true;
    });
  }

  private syncRings(sim: Sim): void {
    const ids = sim.selected;
    while (this.rings.length < ids.length) {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(10, 12, 28),
        new THREE.MeshBasicMaterial({ color: "#3ee0c5", side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
      );
      mesh.rotation.x = -Math.PI / 2;
      this.scene.add(mesh);
      this.rings.push(mesh);
    }
    this.rings.forEach((mesh, i) => {
      const id = ids[i];
      const unit = id ? sim.byId(id) : undefined;
      mesh.visible = !!unit;
      if (!unit) return;
      (mesh.material as THREE.MeshBasicMaterial).color.set(unit.team === 0 ? "#3ee0c5" : "#ff5a36");
      const reach = DEFS[unit.kind].radius * 1.15;
      mesh.scale.set(reach / 11, reach / 11, 1);
      mesh.position.set(unit.x, (DEFS[unit.kind].air ? 40 : this.elevation(unit.x, unit.y)) + 0.4, unit.y);
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
    this.boxMesh.position.set(x, this.elevation(x, z) + 0.7, z);
    this.boxMesh.scale.set(Math.max(4, Math.abs(box.x1 - box.x0)), Math.max(4, Math.abs(box.y1 - box.y0)), 1);
  }

  private syncPlace(ghost: { kind: Kind; x: number; y: number; ok: boolean } | null): void {
    if (!ghost) {
      if (this.placeMesh) this.placeMesh.visible = false;
      return;
    }
    if (!this.placeMesh || this.placeKind !== ghost.kind) {
      if (this.placeMesh) this.scene.remove(this.placeMesh);
      const fake = { id: 0, kind: ghost.kind, team: 0, facing: 0, aim: 0 } as Ent;
      this.placeMesh = this.makeActor(fake, 1, "place").group;
      this.placeMesh.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        const source = mesh.material as THREE.MeshStandardMaterial;
        mesh.material = source.clone();
        (mesh.material as THREE.MeshStandardMaterial).transparent = true;
        (mesh.material as THREE.MeshStandardMaterial).opacity = 0.45;
      });
      this.placeKind = ghost.kind;
      this.scene.add(this.placeMesh);
    }
    this.placeMesh.visible = true;
    this.placeMesh.position.set(ghost.x, this.elevation(ghost.x, ghost.y), ghost.y);
  }

  setEye(id: number): void {
    this.eyeId = id;
  }
}

function vehicleSpec(kind: Kind): { len: number; wid: number; turret: number; barrel: number; thick: number; paint: string } {
  if (kind === "viper") return { len: 30, wid: 16, turret: 8, barrel: 12, thick: 0.7, paint: "#31404a" };
  if (kind === "lancer") return { len: 40, wid: 20, turret: 11, barrel: 20, thick: 0.9, paint: "#3a4650" };
  if (kind === "reaver") return { len: 42, wid: 22, turret: 12, barrel: 14, thick: 1.3, paint: "#24342c" };
  if (kind === "howl") return { len: 40, wid: 22, turret: 12, barrel: 14, thick: 1, paint: "#3d4a32" };
  if (kind === "aegis") return { len: 40, wid: 22, turret: 11, barrel: 16, thick: 0.7, paint: "#1e4048" };
  if (kind === "bastion") return { len: 52, wid: 26, turret: 14, barrel: 22, thick: 1.6, paint: "#4a3428" };
  if (kind === "t3x") return { len: 48, wid: 24, turret: 13, barrel: 22, thick: 1.15, paint: "#6a5a32" };
  return { len: 34, wid: 18, turret: 8, barrel: 8, thick: 0.8, paint: "#3a4650" };
}
