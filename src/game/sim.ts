import {
  BUILD_MENU,
  COLS,
  DEFS,
  ROWS,
  TILE,
  UNIT_MENU,
  WORLD_H,
  WORLD_W,
  onlineLine,
  scaledDamage,
  engages,
  wingOf,
  nextUpgradeCost,
  structureTitle,
  type Kind,
  type Team,
  type TechWing,
} from "./content";
import { chapterById } from "./campaign";
import type { SkirmishMap } from "./skirmish";
import { buildMap, type BuiltMap } from "./map";

export interface Ent {
  id: number;
  kind: Kind;
  team: Team;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  facing: number;
  aim: number;
  order: "idle" | "move" | "amove" | "attack" | "harvest" | "hold";
  destX: number;
  destY: number;
  targetId: number;
  path: { x: number; y: number }[] | null;
  pathI: number;
  cooldown: number;
  cargo: number;
  gather: number;
  dock: number;
  ionC: number;
  ionR: number;
  queue: { kind: Kind; left: number; total: number }[];
  buildLeft: number;
  buildTotal: number;
  repairOn: boolean;
  rallyX: number;
  rallyY: number;
  alive: boolean;
  flash: number;
  repath: number;
  shield: number;
}

export interface Shot {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  dmg: number;
  team: Team;
  splash: number;
  life: number;
  kind: "bolt" | "shell" | "rocket";
  targetId: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: "spark" | "smoke" | "ring" | "dust";
}

export interface Track {
  x: number;
  y: number;
  a: number;
  life: number;
}

export interface Floater {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
}

export interface GameEvent {
  t: "shot" | "boom" | "build" | "ui" | "bad" | "win" | "lose" | "half";
  kind?: string;
  big?: boolean;
}

export interface MemoryB {
  kind: Kind;
  team: Team;
  x: number;
  y: number;
}

export interface HudSnap {
  credits: number;
  cap: number;
  prod: number;
  use: number;
  low: boolean;
  time: number;
  message: string;
  place: Kind | null;
  attackArm: boolean;
  paused: boolean;
  winner: Team | null;
  ionLeft: number;
  selected: {
    id: number;
    kind: Kind;
    team: Team;
    hp: number;
    maxHp: number;
    cargo: number;
    building: boolean;
    repairOn: boolean;
    buildLeft: number;
    buildTotal: number;
    queue: { kind: Kind; left: number; total: number }[];
    shield: number;
  }[];
  unlocked: Record<Kind, boolean>;
  afford: Record<Kind, boolean>;
  making: Partial<Record<Kind, number>>;
  tech: Record<TechWing, number>;
  ability: { strike: number; dome: number; nuke: number };
  abilityArm: "strike" | "nuke" | null;
  objective: string;
  objectivePct: number;
}

interface HeapN {
  f: number;
  i: number;
}

class Heap {
  a: HeapN[] = [];
  push(f: number, i: number): void {
    const n = { f, i };
    this.a.push(n);
    let k = this.a.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (this.a[p].f <= this.a[k].f) break;
      const tmp = this.a[p];
      this.a[p] = this.a[k];
      this.a[k] = tmp;
      k = p;
    }
  }
  pop(): HeapN | undefined {
    if (!this.a.length) return undefined;
    const top = this.a[0];
    const last = this.a.pop();
    if (this.a.length && last) {
      this.a[0] = last;
      let k = 0;
      for (;;) {
        const l = k * 2 + 1;
        const r = l + 1;
        let s = k;
        if (l < this.a.length && this.a[l].f < this.a[s].f) s = l;
        if (r < this.a.length && this.a[r].f < this.a[s].f) s = r;
        if (s === k) break;
        const tmp = this.a[s];
        this.a[s] = this.a[k];
        this.a[k] = tmp;
        k = s;
      }
    }
    return top;
  }
  get size(): number {
    return this.a.length;
  }
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

export class Sim {
  ents: Ent[] = [];
  tiles: Uint8Array;
  ion: Uint16Array;
  style: Float32Array;
  flora: Uint8Array;
  chapterId: string;
  downed = { men: 0, tanks: 0, planes: 0, structures: 0 };
  lost = { men: 0, tanks: 0, planes: 0, structures: 0 };
  built = 0;
  block: Uint8Array;
  occ: Int32Array;
  credits: [number, number] = [2100, 1700];
  time = 0;
  winner: Team | null = null;
  relief = false;
  events: GameEvent[] = [];
  messages: { text: string; life: number }[] = [];
  floaters: Floater[] = [];
  shots: Shot[] = [];
  particles: Particle[] = [];
  tracks: Track[] = [];
  shake = 0;
  selected: number[] = [];
  placeKind: Kind | null = null;
  attackArm = false;
  paused = false;
  pois: BuiltMap;
  explored: Uint8Array;
  visible: Uint8Array;
  memory = new Map<number, MemoryB>();
  ionDirty: { c: number; r: number }[] = [];
  uiDirty = true;
  nextId = 1;
  pathQueue: number[] = [];
  aiAcc = 0;
  aiCool = 48;
  contact = false;
  wasLow = false;
  tech: [Record<TechWing, number>, Record<TechWing, number>] = [
    { barracks: 1, bay: 1, strip: 1, spire: 1 },
    { barracks: 1, bay: 1, strip: 1, spire: 1 },
  ];
  ability = { strike: 0, dome: 0, nuke: 0 };
  abilityArm: "strike" | "nuke" | null = null;
  mission: SkirmishMap | null = null;
  missionMined = 0;
  missionStolen = false;
  missionHome = false;
  cargoId = -1;
  siloId = -1;
  sides = 1;
  private by = new Map<number, Ent>();

  constructor(chapterId = "usa-01", mission: SkirmishMap | null = null, sides = 1) {
    const chapter = chapterById(chapterId);
    this.chapterId = chapter.id;
    this.pois = buildMap(chapter);
    this.tiles = this.pois.tiles;
    this.ion = this.pois.ion;
    this.style = this.pois.style;
    this.flora = this.pois.flora;
    this.block = new Uint8Array(COLS * ROWS);
    this.occ = new Int32Array(COLS * ROWS);
    this.explored = new Uint8Array(COLS * ROWS);
    this.visible = new Uint8Array(COLS * ROWS);
    this.mission = mission;
    this.sides = Math.min(4, Math.max(1, sides));
    this.seed();
    this.armMission();
    this.recomputeBlocks();
    this.updateFog();
  }

  private armMission(): void {
    const mission = this.mission;
    if (!mission) return;
    this.say(mission.brief);
    if (mission.kind === "cargo") {
      const truck = this.addUnit("viper", 0, 640, 1100);
      truck.order = "move";
      truck.destX = this.pois.enemy.x - 80;
      truck.destY = this.pois.enemy.y + 40;
      this.cargoId = truck.id;
    }
    if (mission.kind === "nuke" || mission.kind === "steal") {
      const silo = this.addBuilding("silo", 1, 60 * TILE, 8 * TILE, true);
      this.siloId = silo.id;
    }
    if (mission.kind === "rare") {
      let left = 18;
      for (let i = 0; i < this.ion.length && left > 0; i++) {
        if (this.ion[i] > 40) {
          this.ion[i] = 220;
          left -= 1;
        }
      }
    }
  }

  private tickMission(): void {
    const mission = this.mission;
    if (!mission || this.winner !== null) return;
    if (mission.kind === "minerals" || mission.kind === "rare") {
      this.missionMined = Math.max(this.missionMined, Math.max(0, this.credits[0] - 2100));
      if (this.missionMined >= mission.goal) this.declare(0, "Veins secured.");
    }
    if (mission.kind === "cargo") {
      const truck = this.by.get(this.cargoId);
      if (!truck || !truck.alive) this.declare(1, "The cargo is gone.");
      else {
        truck.order = "move";
        truck.destX = this.pois.enemy.x - 80;
        truck.destY = this.pois.enemy.y + 40;
        if (Math.hypot(truck.x - truck.destX, truck.y - truck.destY) < 90) this.declare(0, "Cargo cleared the ridge.");
      }
    }
    if (mission.kind === "steal") {
      const crate = this.by.get(this.siloId);
      const thief = this.ents.find((e) => e.alive && e.team === 0 && !DEFS[e.kind].building);
      if (!this.missionStolen && crate && thief && Math.hypot(thief.x - crate.x, thief.y - crate.y) < 90) {
        this.missionStolen = true;
        this.say("Crate lifted. Bring it home.");
      }
      const home = this.ents.find((e) => e.alive && e.team === 0 && e.kind === "spire");
      if (this.missionStolen && home && thief && Math.hypot(thief.x - home.x, thief.y - home.y) < 120) this.declare(0, "Archive crate is home.");
    }
    if (mission.kind === "build") {
      const built = this.ents.some((e) => e.alive && e.team === 0 && e.kind === "relay" && e.buildLeft <= 0 && e.x > 500);
      if (built) this.declare(0, "Relay spire is up.");
    }
    if (mission.kind === "relays") {
      const relays = this.ents.filter((e) => e.alive && e.team === 0 && e.kind === "relay" && e.buildLeft <= 0).length;
      if (relays >= mission.goal) this.declare(0, "Relays held.");
    }
    if (mission.kind === "nuke") {
      const silo = this.by.get(this.siloId);
      if (mission.clock !== null && this.time >= mission.clock && silo?.alive) this.declare(1, "The warhead clock hit zero.");
      else if (silo && !silo.alive) this.declare(0, "Warhead building destroyed.");
    }
    if (mission.kind === "destroy") {
      const army = this.ents.some((e) => e.alive && e.team === 1 && !DEFS[e.kind].building);
      const spire = this.ents.some((e) => e.alive && e.team === 1 && e.kind === "spire");
      if (!army && !spire) this.declare(0, "Enemy force is gone.");
    }
  }

  surrender(): void {
    this.declare(1, "The field was surrendered.");
  }

  private declare(team: 0 | 1, line: string): void {
    if (this.winner !== null) return;
    this.winner = team;
    this.say(line);
    this.events.push({ t: team === 0 ? "win" : "lose" });
  }

  objectiveLine(): { text: string; pct: number } {
    const mission = this.mission;
    if (!mission) return { text: "Destroy the enemy spire.", pct: this.winner === 0 ? 100 : 0 };
    if (mission.kind === "minerals" || mission.kind === "rare") return { text: mission.brief, pct: Math.min(100, (this.missionMined / mission.goal) * 100) };
    if (mission.kind === "nuke" && mission.clock) return { text: `${mission.brief} ${Math.max(0, Math.ceil(mission.clock - this.time))}s.`, pct: Math.min(100, (this.time / mission.clock) * 100) };
    if (mission.kind === "relays") {
      const relays = this.ents.filter((e) => e.alive && e.team === 0 && e.kind === "relay" && e.buildLeft <= 0).length;
      return { text: mission.brief, pct: Math.min(100, (relays / mission.goal) * 100) };
    }
    return { text: mission.brief, pct: this.winner === 0 ? 100 : 12 };
  }

  private seed(): void {
    const p = this.addBuilding("spire", 0, 10.5 * TILE, 38.5 * TILE, true);
    this.addBuilding("relay", 0, 14 * TILE, 38 * TILE, true);
    this.addBuilding("refinery", 0, 10.5 * TILE, 42.5 * TILE, true);
    this.recomputeBlocks();
    this.addUnit("harvester", 0, 700, 1180);
    const column = (kind: Kind, team: Team, x0: number, y0: number, cols: number, rows: number, sx: number, sy: number) => {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) this.addUnit(kind, team, x0 + c * sx, y0 + r * sy);
      }
    };
    // Massed Helion column, framed on the opening camera.
    column("viper", 0, 140, 1100, 6, 1, 110, 0);
    column("lancer", 0, 180, 1170, 4, 1, 120, 0);
    column("bastion", 0, 720, 1140, 3, 1, 130, 0);
    column("rifle", 0, 80, 1230, 10, 2, 44, 38);
    column("rifle", 0, 540, 1230, 6, 2, 44, 38);
    column("rocket", 0, 100, 1315, 8, 1, 78, 0);
    this.addUnit("kestrel", 0, 220, 1040);
    this.addUnit("kestrel", 0, 420, 1020);
    this.addUnit("kestrel", 0, 640, 1040);
    this.addUnit("condor", 0, 860, 1080);
    const ace = this.addUnit("t3x", 0, 480, 1165);
    this.addBuilding("spire", 1, 63.5 * TILE, 9.5 * TILE, true);
    this.addBuilding("relay", 1, 67 * TILE, 9 * TILE, true);
    this.addBuilding("refinery", 1, 63.5 * TILE, 13.5 * TILE, true);
    this.addBuilding("barracks", 1, 59.5 * TILE, 9 * TILE, true);
    this.recomputeBlocks();
    this.addUnit("harvester", 1, 1900, 760);
    // Vesper answers with a matching field army south of their spire.
    column("rifle", 1, 1760, 520, 8, 3, 46, 36);
    column("rifle", 1, 2160, 520, 6, 3, 46, 36);
    column("rocket", 1, 1780, 650, 8, 1, 72, 0);
    column("viper", 1, 1800, 720, 6, 1, 108, 0);
    column("lancer", 1, 2140, 780, 4, 1, 96, 0);
    column("bastion", 1, 1880, 820, 3, 1, 130, 0);
    this.addUnit("kestrel", 1, 2000, 460);
    this.addUnit("kestrel", 1, 2240, 440);
    this.addUnit("kestrel", 1, 2460, 470);
    this.addUnit("condor", 1, 2360, 560);
    for (let i = 1; i < this.sides; i++) {
      const shift = i * 260;
      this.addBuilding("spire", 0, 10.5 * TILE + shift, 46 * TILE, true);
      this.addBuilding("refinery", 0, 12 * TILE + shift, 48 * TILE, true);
      this.addUnit("viper", 0, 520 + shift, 1360);
      this.addUnit("lancer", 0, 620 + shift, 1400);
      this.addUnit("rifle", 0, 480 + shift, 1440);
      this.addUnit("rifle", 0, 540 + shift, 1440);
      this.addBuilding("spire", 1, 63.5 * TILE - shift, 16 * TILE, true);
      this.addBuilding("refinery", 1, 61 * TILE - shift, 18 * TILE, true);
      this.addUnit("viper", 1, 1680 - shift, 900);
      this.addUnit("lancer", 1, 1760 - shift, 940);
      this.addUnit("rifle", 1, 1640 - shift, 980);
      this.addUnit("rifle", 1, 1700 - shift, 980);
    }
    this.selected = [p.id, ace.id];
    this.say(this.sides === 1 ? "Callsign T3X is on the glass. The spire is yours — the glow is not." : `${this.sides}v${this.sides}. ${this.sides} commanders on your side, ${this.sides} on theirs.`);
  }

  private make(kind: Kind, team: Team, x: number, y: number): Ent {
    const def = DEFS[kind];
    const e: Ent = {
      id: this.nextId++,
      kind,
      team,
      x,
      y,
      hp: def.hp,
      maxHp: def.hp,
      facing: team === 0 ? -Math.PI / 2 : Math.PI / 2,
      aim: team === 0 ? -Math.PI / 2 : Math.PI / 2,
      order: "idle",
      destX: x,
      destY: y,
      targetId: -1,
      path: null,
      pathI: 0,
      cooldown: 0.2,
      cargo: 0,
      gather: 0,
      dock: 0,
      ionC: -1,
      ionR: -1,
      queue: [],
      buildLeft: 0,
      buildTotal: 0,
      repairOn: false,
      rallyX: x,
      rallyY: y + (def.fh * TILE) / 2 + 24,
      alive: true,
      flash: 0,
      repath: 0,
      shield: 0,
    };
    this.by.set(e.id, e);
    return e;
  }

  addBuilding(kind: Kind, team: Team, x: number, y: number, instant: boolean): Ent {
    const def = DEFS[kind];
    const e = this.make(kind, team, x, y);
    e.buildTotal = instant ? 0 : def.time;
    e.buildLeft = instant ? 0 : def.time;
    e.hp = instant ? def.hp : Math.round(def.hp * 0.35);
    this.ents.push(e);
    return e;
  }

  addUnit(kind: Kind, team: Team, x: number, y: number): Ent {
    const spot = this.findOpen(x, y, 8);
    const e = this.make(kind, team, spot.x, spot.y);
    e.order = kind === "harvester" ? "harvest" : "idle";
    this.ents.push(e);
    return e;
  }

  byId(id: number): Ent | undefined {
    const e = this.by.get(id);
    return e && e.alive ? e : undefined;
  }

  tick(dt: number): void {
    if (this.winner !== null) return;
    this.time += dt;
    if (!this.relief && this.time >= 40) {
      this.relief = true;
      this.addUnit("viper", 1, 2000, 500);
      this.addUnit("rifle", 1, 1960, 540);
      this.addUnit("rifle", 1, 2020, 540);
      this.addUnit("lancer", 1, 2080, 580);
      this.messages.unshift({ text: "Vesper relief column. Halfway push.", life: 7 });
      this.events.push({ t: "half" });
      this.uiDirty = true;
    }
    this.aiAcc += dt;
    this.aiCool -= dt;
    for (const m of this.messages) m.life -= dt;
    this.messages = this.messages.filter((m) => m.life > 0);
    for (const f of this.floaters) f.life -= dt;
    this.floaters = this.floaters.filter((f) => f.life > 0);
    for (const t of this.tracks) t.life -= dt;
    if (this.tracks.length > 500) this.tracks.splice(0, this.tracks.length - 400);
    this.tracks = this.tracks.filter((t) => t.life > 0);
    this.shake = Math.max(0, this.shake - dt * 1.4);
    this.ability.strike = Math.max(0, this.ability.strike - dt);
    this.ability.dome = Math.max(0, this.ability.dome - dt);
    this.ability.nuke = Math.max(0, this.ability.nuke - dt);

    this.processPaths();
    for (const e of this.ents) {
      if (!e.alive) continue;
      e.flash = Math.max(0, e.flash - dt);
      if (DEFS[e.kind].building) this.tickBuilding(e, dt);
      else if (e.kind === "harvester") this.tickHarvester(e, dt);
      else this.tickSoldier(e, dt);
    }
    this.separate();
    this.tickShots(dt);
    this.tickParticles(dt);
    this.updateFog();
    this.noteContact();
    this.tickMission();
    if (this.aiAcc >= 1) {
      this.aiAcc = 0;
      this.thinkAI();
    }
    if (this.ents.length > 240) {
      this.ents = this.ents.filter((e) => e.alive);
    } else if (this.ents.some((e) => !e.alive)) {
      this.ents = this.ents.filter((e) => e.alive);
    }
  }

  private noteContact(): void {
    if (this.contact) return;
    for (const e of this.ents) {
      if (!e.alive || e.team !== 1 || DEFS[e.kind].building) continue;
      const c = clamp(Math.floor(e.x / TILE), 0, COLS - 1);
      const r = clamp(Math.floor(e.y / TILE), 0, ROWS - 1);
      if (this.visible[r * COLS + c]) {
        this.contact = true;
        this.say("Contact. Vesper on the glass.");
        return;
      }
    }
  }

  private tickBuilding(e: Ent, dt: number): void {
    const low = this.powerOf(e.team).low;
    if (e.buildLeft > 0) {
      const rate = low && e.kind !== "relay" ? 0.4 : 1;
      e.buildLeft -= dt * rate;
      if (e.buildLeft <= 0) {
        e.buildLeft = 0;
        e.hp = e.maxHp;
        if (e.team === 0) {
          this.built += 1;
          this.say(onlineLine(e.kind));
          this.events.push({ t: "build" });
        }
        this.uiDirty = true;
      }
      return;
    }
    if (e.repairOn && e.hp < e.maxHp && this.credits[e.team] > 0) {
      const heal = 18 * dt;
      const cost = heal * 0.35;
      if (this.credits[e.team] >= cost) {
        this.credits[e.team] -= cost;
        e.hp = Math.min(e.maxHp, e.hp + heal);
      }
    }
    if (e.queue.length) {
      const rate = low ? 0.32 : 1;
      e.queue[0].left -= dt * rate;
      if (e.queue[0].left <= 0) {
        const job = e.queue.shift()!;
        this.addUnit(job.kind, e.team, e.rallyX, e.rallyY);
        if (e.team === 0) {
          this.say(onlineLine(job.kind));
          this.events.push({ t: "build" });
          this.uiDirty = true;
        }
      }
    }
    if (e.kind === "turret" || e.kind === "sam" || e.kind === "cannon") this.tickSoldier(e, dt);
    if (e.hp < e.maxHp * 0.42 && Math.random() < dt * 1.5) {
      this.particles.push({
        x: e.x + (Math.random() - 0.5) * 20,
        y: e.y,
        vx: (Math.random() - 0.5) * 8,
        vy: -18 - Math.random() * 10,
        life: 0.8,
        max: 0.8,
        size: 6,
        color: "rgba(80,80,80,0.5)",
        kind: "smoke",
      });
    }
  }

  private tickSoldier(e: Ent, dt: number): void {
    const def = DEFS[e.kind];
    if (def.building && (e.buildLeft > 0 || (def.range > 0 && this.powerOf(e.team).low))) {
      return;
    }
    const engage = this.pickEngage(e);
    const los = engage ? DEFS[e.kind].air || DEFS[engage.kind].air || this.hasLos(e.x, e.y, engage, e.id) : false;
    const inRange = engage ? this.dist(e, engage) <= def.range + 1 && los : false;
    if (engage && inRange) {
      e.aim += this.angDiff(e.aim, Math.atan2(engage.y - e.y, engage.x - e.x)) * Math.min(1, dt * 8);
      e.cooldown -= dt;
      if (e.cooldown <= 0) {
        this.fire(e, engage);
        e.cooldown = def.rof;
      }
      if (!def.building) e.facing += this.angDiff(e.facing, e.aim) * Math.min(1, dt * 4);
      return;
    }
    e.cooldown = Math.max(0, e.cooldown - dt);
    if (def.building) return;
    if (engage && (e.order === "attack" || e.order === "amove")) {
      e.repath -= dt;
      if (e.repath <= 0) {
        this.requestPath(e, engage.x, engage.y);
        e.repath = 0.55;
      }
    }
    this.follow(e, dt);
  }

  private pickEngage(e: Ent): Ent | null {
    const def = DEFS[e.kind];
    if (def.range <= 0) return null;
    if (e.order === "attack") {
      const t = this.byId(e.targetId);
      if (t && t.team !== e.team) return t;
      e.order = "idle";
      e.targetId = -1;
    }
    const extra = e.order === "amove" ? 52 : 0;
    if (e.order === "hold") return this.nearestEnemy(e, def.range);
    if (e.order === "idle" || e.order === "move" || e.order === "amove" || def.building) {
      return this.nearestEnemy(e, def.range + extra);
    }
    return null;
  }

  private follow(e: Ent, dt: number): void {
    if (!e.path || e.pathI >= e.path.length) {
      if ((e.order === "move" || e.order === "amove") && Math.hypot(e.destX - e.x, e.destY - e.y) < 14) {
        e.order = "idle";
        e.path = null;
      }
      return;
    }
    const wp = e.path[e.pathI];
    const dx = wp.x - e.x;
    const dy = wp.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 8) {
      e.pathI++;
      return;
    }
    const speed = DEFS[e.kind].speed;
    const air = !!DEFS[e.kind].air;
    const step = Math.min(d, speed * dt);
    const nx = e.x + (dx / d) * step;
    const ny = e.y + (dy / d) * step;
    if (air || !this.circleBlocked(nx, ny, 6, e.id)) {
      if (air && Math.random() < dt * 10) {
        this.particles.push({
          x: e.x - Math.cos(e.facing) * 10,
          y: e.y - Math.sin(e.facing) * 10,
          vx: 0,
          vy: 0,
          life: 0.45,
          max: 0.45,
          size: 4,
          color: "rgba(180,220,230,0.35)",
          kind: "smoke",
        });
      } else if (!air && e.kind !== "rifle" && e.kind !== "rocket" && Math.random() < dt * 8) {
        this.tracks.push({ x: e.x, y: e.y, a: e.facing, life: 2.4 });
      } else if ((e.kind === "rifle" || e.kind === "rocket") && Math.random() < dt * 6) {
        this.particles.push({
          x: e.x,
          y: e.y,
          vx: 0,
          vy: 0,
          life: 0.4,
          max: 0.4,
          size: 3,
          color: "rgba(80,60,40,0.35)",
          kind: "dust",
        });
      }
      e.x = nx;
      e.y = ny;
      e.facing = Math.atan2(dy, dx);
      e.aim = e.facing;
    } else {
      const side = Math.random() < 0.5 ? 1 : -1;
      const sx = e.x + (-dy / d) * side * speed * dt;
      const sy = e.y + (dx / d) * side * speed * dt;
      if (!this.circleBlocked(sx, sy, 6, e.id)) {
        e.x = sx;
        e.y = sy;
      }
    }
  }

  private tickHarvester(e: Ent, dt: number): void {
    if (e.order === "hold") return;
    const ordered = e.order === "move" || e.order === "amove" || e.order === "attack";
    if (ordered) {
      this.follow(e, dt);
      if (e.order === "idle") e.order = "harvest";
      return;
    }
    e.order = "harvest";
    const cap = DEFS.harvester.cargo;
    if (e.cargo >= cap) {
      const dock = this.nearestBuilding(e.team, "refinery", e.x, e.y);
      if (!dock) return;
      const reach = (DEFS.refinery.fh * TILE) / 2 + 28;
      const goalY = dock.y + reach;
      if (Math.hypot(e.destX - dock.x, e.destY - goalY) > 48) this.requestPath(e, dock.x, goalY);
      const d = Math.hypot(dock.x - e.x, dock.y - e.y);
      if (d < reach + 18) {
        e.facing = Math.atan2(dock.y - e.y, dock.x - e.x);
        e.dock += dt;
        if (e.dock >= 1.05) {
          const room = this.capOf(e.team) - this.credits[e.team];
          if (room <= 0) {
            if (e.team === 0) this.say("Stores are full.");
            e.dock = 0.4;
            return;
          }
          const gain = Math.min(room, e.cargo);
          this.credits[e.team] += gain;
          e.cargo -= gain;
          e.dock = 0;
          e.path = null;
          e.ionC = -1;
          if (e.team === 0) {
            this.floaters.push({ x: dock.x, y: dock.y - 30, text: "+" + Math.round(gain), life: 1.3, color: "#e8c56b" });
            this.uiDirty = true;
          }
        }
      } else {
        e.dock = 0;
        if (!e.path || e.pathI >= (e.path?.length ?? 0)) this.requestPath(e, dock.x, dock.y + reach);
        this.follow(e, dt);
      }
      return;
    }
    if (e.ionC < 0 || this.ionAt(e.ionC, e.ionR) <= 0) {
      const spot = this.nearestIon(e.x, e.y);
      if (!spot) return;
      e.ionC = spot.c;
      e.ionR = spot.r;
      this.requestPath(e, (spot.c + 0.5) * TILE, (spot.r + 0.5) * TILE);
    }
    const tx = (e.ionC + 0.5) * TILE;
    const ty = (e.ionR + 0.5) * TILE;
    if (Math.hypot(tx - e.x, ty - e.y) < 26) {
      e.gather += dt;
      e.facing += dt * 2;
      if (e.gather >= 2) {
        const i = e.ionR * COLS + e.ionC;
        const take = Math.min(cap - e.cargo, this.ion[i], cap);
        this.ion[i] -= take;
        e.cargo += take;
        e.gather = 0;
        if (this.ion[i] <= 0) {
          this.tiles[i] = 0;
          this.ionDirty.push({ c: e.ionC, r: e.ionR });
          e.ionC = -1;
        }
      }
    } else {
      if (!e.path || e.pathI >= e.path.length) this.requestPath(e, tx, ty);
      this.follow(e, dt);
    }
  }

  private fire(e: Ent, target: Ent): void {
    const def = DEFS[e.kind];
    if (def.projectile === "none") return;
    const ang = Math.atan2(target.y - e.y, target.x - e.x);
    const speed = def.projectile === "rocket" ? 190 : def.projectile === "shell" ? 360 : 540;
    const muzzle = def.building ? 16 : def.radius;
    const x = e.x + Math.cos(ang) * muzzle;
    const y = e.y + Math.sin(ang) * muzzle;
    this.shots.push({
      x,
      y,
      px: x,
      py: y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      dmg: scaledDamage(e.kind, target.kind === e.kind ? DEFS[target.kind].armor : DEFS[target.kind].armor),
      team: e.team,
      splash: def.projectile === "rocket" ? 28 : e.kind === "grenadier" || e.kind === "howl" ? 26 : e.kind === "spectre" ? 36 : e.kind === "bastion" || e.kind === "condor" ? 22 : e.kind === "cannon" ? 14 : 0,
      life: 1.8,
      kind: def.projectile,
      targetId: target.id,
    });
    e.flash = 0.07;
    this.events.push({ t: "shot", kind: def.projectile });
  }

  private tickShots(dt: number): void {
    for (const s of this.shots) {
      s.life -= dt;
      s.px = s.x;
      s.py = s.y;
      if (s.kind === "rocket") {
        const tgt = this.byId(s.targetId);
        if (tgt) {
          const desired = Math.atan2(tgt.y - s.y, tgt.x - s.x);
          const cur = Math.atan2(s.vy, s.vx);
          const next = cur + clamp(this.angDiff(cur, desired), -2.4 * dt, 2.4 * dt);
          const sp = Math.hypot(s.vx, s.vy);
          s.vx = Math.cos(next) * sp;
          s.vy = Math.sin(next) * sp;
        }
        if (Math.random() < 0.6) {
          this.particles.push({
            x: s.x,
            y: s.y,
            vx: 0,
            vy: 0,
            life: 0.25,
            max: 0.25,
            size: 3,
            color: "rgba(255,160,80,0.7)",
            kind: "smoke",
          });
        }
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      let hit: Ent | null = null;
      for (const e of this.ents) {
        if (!e.alive || e.team === s.team) continue;
        const rad = DEFS[e.kind].building ? Math.max(DEFS[e.kind].fw, DEFS[e.kind].fh) * TILE * 0.42 : DEFS[e.kind].radius;
        if (Math.hypot(e.x - s.x, e.y - s.y) < rad) {
          hit = e;
          break;
        }
      }
      if (hit || s.life <= 0) {
        s.life = 0;
        if (s.splash > 0) {
          for (const e of this.ents) {
            if (!e.alive || e.team === s.team) continue;
            const d = Math.hypot(e.x - s.x, e.y - s.y);
            if (d < s.splash + 10) this.hurt(e, s.dmg * (1 - d / (s.splash + 18)));
          }
          this.burst(s.x, s.y, 0.7);
        } else if (hit) {
          this.hurt(hit, s.dmg);
          this.burst(s.x, s.y, 0.28);
        }
      }
    }
    this.shots = this.shots.filter((s) => s.life > 0);
  }

  private tickParticles(dt: number): void {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === "smoke") p.vy -= 8 * dt;
      if (p.kind === "spark") p.vy += 30 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.particles.length > 180) this.particles.splice(0, this.particles.length - 180);
  }

  private hurt(e: Ent, dmg: number): void {
    if (!e.alive || dmg <= 0 || this.winner !== null) return;
    if (e.shield > 0) {
      const soak = Math.min(e.shield, dmg);
      e.shield -= soak;
      dmg -= soak;
    }
    if (dmg <= 0) {
      e.flash = 0.08;
      return;
    }
    e.hp -= dmg;
    e.flash = 0.1;
    if (e.hp <= 0) this.kill(e, true);
  }

  private kill(e: Ent, boom: boolean): void {
    if (!e.alive) return;
    e.alive = false;
    e.hp = 0;
    this.by.delete(e.id);
    if (DEFS[e.kind].building) this.recomputeBlocks();
    if (boom) {
      const big = DEFS[e.kind].building;
      this.burst(e.x, e.y, big ? 1 : 0.45);
      this.shake = Math.min(1.2, this.shake + (big ? 0.7 : 0.22));
      this.events.push({ t: "boom", big });
    }
    this.selected = this.selected.filter((id) => id !== e.id);
    this.uiDirty = true;
    const bag = e.team === 1 ? this.downed : this.lost;
    if (DEFS[e.kind].air) bag.planes += 1;
    else if (DEFS[e.kind].building) bag.structures += 1;
    else if (
      e.kind === "rifle" ||
      e.kind === "rocket" ||
      e.kind === "watch" ||
      e.kind === "patrol" ||
      e.kind === "grenadier" ||
      e.kind === "sergeant" ||
      e.kind === "specops"
    ) bag.men += 1;
    else bag.tanks += 1;
    if (e.kind === "spire") {
      const still = this.ents.some((o) => o.alive && o.team === e.team && o.kind === "spire");
      if (!still && this.winner === null) {
        this.winner = e.team === 0 ? 1 : 0;
        this.say(e.team === 0 ? "The spire is gone." : "Vesper spire is dust. Hold the horizon.");
        this.events.push({ t: e.team === 0 ? "lose" : "win" });
      }
    }
  }

  private burst(x: number, y: number, scale: number): void {
    const n = Math.round(10 + scale * 14);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 120 * scale;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.35 + Math.random() * 0.4,
        max: 0.7,
        size: 2 + scale * 3,
        color: Math.random() < 0.5 ? "#ffb15a" : "#ffe7c2",
        kind: "spark",
      });
    }
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.35,
      max: 0.35,
      size: 18 * scale,
      color: "rgba(255,220,180,0.8)",
      kind: "ring",
    });
    for (let i = 0; i < 4; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 16,
        vy: -20 - Math.random() * 20,
        life: 0.8,
        max: 0.8,
        size: 8 + scale * 6,
        color: "rgba(60,60,60,0.45)",
        kind: "smoke",
      });
    }
  }

  private separate(): void {
    const units = this.ents.filter((e) => e.alive && !DEFS[e.kind].building);
    for (let i = 0; i < units.length; i++) {
      for (let j = i + 1; j < units.length; j++) {
        const a = units[i];
        const b = units[j];
        const aAir = !!DEFS[a.kind].air;
        const bAir = !!DEFS[b.kind].air;
        if (aAir !== bAir) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.001;
        const need = (DEFS[a.kind].radius + DEFS[b.kind].radius) * (aAir ? 1.35 : 0.72);
        if (d < need) {
          const push = ((need - d) / need) * 0.5;
          const ox = (dx / d) * push * 8;
          const oy = (dy / d) * push * 8;
          if (aAir || !this.circleBlocked(a.x - ox, a.y - oy, 4, a.id)) {
            a.x -= ox;
            a.y -= oy;
          }
          if (bAir || !this.circleBlocked(b.x + ox, b.y + oy, 4, b.id)) {
            b.x += ox;
            b.y += oy;
          }
        }
      }
    }
  }

  private thinkAI(): void {
    if (this.winner !== null) return;
    const team: Team = 1;
    const has = (k: Kind) => this.ents.some((e) => e.alive && e.team === team && e.kind === k);
    const done = (k: Kind) => this.ents.some((e) => e.alive && e.team === team && e.kind === k && e.buildLeft <= 0);
    const count = (k: Kind) => this.ents.filter((e) => e.alive && e.team === team && e.kind === k).length;
    const pow = this.powerOf(team);
    if (count("harvester") < 2 && done("refinery")) this.enqueue(team, "harvester");
    if ((pow.low || pow.prod < pow.use + 6) && count("relay") < 3) this.tryPlace(team, "relay");
    if (!has("barracks")) this.tryPlace(team, "barracks");
    if (done("barracks") && !has("bay") && this.credits[team] > 1700) this.tryPlace(team, "bay");
    if (done("barracks") && count("turret") < 2) this.tryPlace(team, "turret");
    if (done("barracks") && count("sam") < 1) this.tryPlace(team, "sam");
    if (done("turret") && count("cannon") < 1 && this.credits[team] > 1100) this.tryPlace(team, "cannon");
    if (done("barracks") && count("wall") < 3) this.tryPlace(team, "wall");
    if (done("bay") && !has("strip") && this.credits[team] > 2200) this.tryPlace(team, "strip");
    if (done("barracks") && this.tech[team].barracks < 4 && this.credits[team] > 1600 && this.time > 70 + this.tech[team].barracks * 40) {
      this.upgradeWing(team, "barracks");
    }
    if (done("bay") && this.tech[team].bay < 4 && this.credits[team] > 1800 && this.time > 110 + this.tech[team].bay * 45) {
      this.upgradeWing(team, "bay");
    }
    if (done("strip") && this.tech[team].strip < 4 && this.credits[team] > 2000 && this.time > 150 + this.tech[team].strip * 50) {
      this.upgradeWing(team, "strip");
    }
    if (done("barracks") && this.credits[team] > 520) {
      const boots = ["rifle", "watch", "patrol", "grenadier", "rocket", "sergeant", "specops"] as const;
      const have = boots.reduce((n, k) => n + count(k), 0);
      if (have < 12) {
        const pick = (["specops", "sergeant", "grenadier", "patrol", "rocket", "watch", "rifle"] as const).find((k) => this.unlocked(team, k));
        if (pick) this.enqueue(team, pick);
      }
    }
    const hulls = count("viper") + count("lancer") + count("reaver") + count("howl") + count("aegis") + count("bastion") + count("t3x");
    if (done("bay") && this.credits[team] > 700 && hulls < 7) {
      const pick = (["t3x", "bastion", "howl", "aegis", "reaver", "lancer", "viper"] as const).find((k) => this.unlocked(team, k));
      if (pick) this.enqueue(team, pick);
    }
    const wings = count("kestrel") + count("condor") + count("ionwing") + count("spectre");
    if (done("strip") && this.credits[team] > 1000 && wings < 3) {
      const pick = (["spectre", "ionwing", "condor", "kestrel"] as const).find((k) => this.unlocked(team, k));
      if (pick) this.enqueue(team, pick);
    }
    if (this.time > 75 && this.aiCool <= 0) {
      const army = this.ents.filter(
        (e) => e.alive && e.team === team && !DEFS[e.kind].building && e.kind !== "harvester" && (e.order === "idle" || e.order === "hold"),
      );
      if (army.length >= 7) {
        const spire = this.ents.find((e) => e.alive && e.team === 0 && e.kind === "spire");
        if (spire) {
          const wave = army.slice(0, 9);
          wave.forEach((u, i) => {
            u.order = "amove";
            u.targetId = -1;
            const ox = ((i % 3) - 1) * 36;
            const oy = (Math.floor(i / 3) - 1) * 36;
            this.requestPath(u, spire.x + ox, spire.y + 80 + oy);
          });
          this.aiCool = 42;
        }
      }
    }
  }

  private tryPlace(team: Team, kind: Kind): boolean {
    const def = DEFS[kind];
    if (!this.unlocked(team, kind) || this.credits[team] < def.cost) return false;
    const spire = this.ents.find((e) => e.alive && e.team === team && e.kind === "spire");
    if (!spire) return false;
    const player = this.ents.find((e) => e.alive && e.team === 0 && e.kind === "spire");
    const prefX = player ? spire.x + (player.x - spire.x) * (kind === "turret" ? 0.38 : 0.05) : spire.x;
    const prefY = player ? spire.y + (player.y - spire.y) * (kind === "turret" ? 0.38 : 0.05) : spire.y;
    let bestX = 0;
    let bestY = 0;
    let bestS = 1e12;
    let found = false;
    const sc = Math.floor(spire.x / TILE);
    const sr = Math.floor(spire.y / TILE);
    for (let rad = 2; rad <= 14; rad++) {
      for (let r = sr - rad; r <= sr + rad; r++) {
        for (let c = sc - rad; c <= sc + rad; c++) {
          if (Math.max(Math.abs(c - sc), Math.abs(r - sr)) !== rad) continue;
          const spot = this.snap(kind, (c + 0.5) * TILE, (r + 0.5) * TILE);
          if (!this.canPlace(team, kind, spot.x, spot.y)) continue;
          const score = Math.hypot(spot.x - prefX, spot.y - prefY) + Math.hypot(spot.x - spire.x, spot.y - spire.y) * 0.25;
          if (score < bestS) {
            bestS = score;
            bestX = spot.x;
            bestY = spot.y;
            found = true;
          }
        }
      }
      if (found && rad > 5) break;
    }
    if (!found) return false;
    this.credits[team] -= def.cost;
    this.addBuilding(kind, team, bestX, bestY, false);
    this.recomputeBlocks();
    return true;
  }

  enqueue(team: Team, kind: Kind): boolean {
    const def = DEFS[kind];
    if (!def.builtBy) return false;
    if (!this.unlocked(team, kind)) {
      if (team === 0) {
        const wing = wingOf(kind);
        const need = def.tier ?? 1;
        const hasWing = !!def.builtBy && this.ents.some((e) => e.alive && e.team === team && e.kind === def.builtBy && e.buildLeft <= 0);
        this.say(hasWing && wing && this.tech[team][wing] < need ? "Upgrade that structure's tier first." : "That wing is dark.");
      }
      this.events.push({ t: "bad" });
      return false;
    }
    if (this.credits[team] < def.cost) {
      if (team === 0) {
        this.say("Not enough ionite.");
        this.events.push({ t: "bad" });
      }
      return false;
    }
    const buildings = this.ents.filter((e) => e.alive && e.team === team && e.kind === def.builtBy && e.buildLeft <= 0);
    if (!buildings.length) return false;
    const picked =
      buildings.find((e) => team === 0 && this.selected.includes(e.id) && e.queue.length < 6) ??
      buildings.slice().sort((a, b) => a.queue.length - b.queue.length)[0];
    if (picked.queue.length >= 6) {
      if (team === 0) this.say("Queue is full.");
      return false;
    }
    this.credits[team] -= def.cost;
    picked.queue.push({ kind, left: def.time, total: def.time });
    if (team === 0) this.events.push({ t: "ui" });
    this.uiDirty = true;
    return true;
  }

  unlocked(team: Team, kind: Kind): boolean {
    const def = DEFS[kind];
    const has = (k: Kind) => this.ents.some((e) => e.alive && e.team === team && e.kind === k && e.buildLeft <= 0);
    if (kind === "spire") return false;
    if (!has("spire")) return false;
    if (def.prereq && !has(def.prereq)) return false;
    if (def.builtBy && !has(def.builtBy)) return false;
    const wing = wingOf(kind);
    const need = def.tier ?? 1;
    if (wing && kind !== wing && this.tech[team][wing] < need) return false;
    return true;
  }

  upgradeWing(team: Team, wing: TechWing): boolean {
    const ready = this.ents.some((e) => e.alive && e.team === team && e.kind === wing && e.buildLeft <= 0);
    if (!ready) {
      if (team === 0) this.say("Raise that structure first.");
      return false;
    }
    const cur = this.tech[team][wing];
    const cost = nextUpgradeCost(cur);
    if (cost === null) {
      if (team === 0) this.say("That wing is already at the last tier.");
      return false;
    }
    if (this.credits[team] < cost) {
      if (team === 0) {
        this.say("Not enough ionite.");
        this.events.push({ t: "bad" });
      }
      return false;
    }
    this.credits[team] -= cost;
    this.tech[team] = { ...this.tech[team], [wing]: cur + 1 };
    if (team === 0) this.say(structureTitle(wing, cur + 1) + " is online.");
    this.uiDirty = true;
    this.events.push({ t: "build" });
    return true;
  }

  armAbility(which: "strike" | "nuke" | "dome"): void {
    const tech = this.tech[0].spire;
    if (which === "strike" && tech < 2) {
      this.say("Upgrade the spire to tier 2.");
      this.events.push({ t: "bad" });
      return;
    }
    if (which === "dome" && tech < 3) {
      this.say("Upgrade the spire to tier 3.");
      this.events.push({ t: "bad" });
      return;
    }
    if (which === "nuke" && tech < 4) {
      this.say("DEFCON needs spire tier 4.");
      this.events.push({ t: "bad" });
      return;
    }
    if (which === "dome") {
      this.castDome(0);
      return;
    }
    this.abilityArm = this.abilityArm === which ? null : which;
    this.placeKind = null;
    this.attackArm = false;
    this.uiDirty = true;
    if (this.abilityArm) this.say(which === "nuke" ? "DEFCON armed. Choose the ground." : "Ion strike armed. Choose the ground.");
  }

  dropAbility(x: number, y: number): void {
    const which = this.abilityArm;
    this.abilityArm = null;
    if (which === "strike") this.blast(0, x, y, "strike");
    if (which === "nuke") this.blast(0, x, y, "nuke");
    this.uiDirty = true;
  }

  private blast(team: Team, x: number, y: number, which: "strike" | "nuke"): void {
    const cost = which === "nuke" ? 1400 : 400;
    const cd = which === "nuke" ? 110 : 48;
    if (this.ability[which] > 0) {
      if (team === 0) this.say("Still cooling down.");
      return;
    }
    if (this.credits[team] < cost) {
      if (team === 0) this.say("Not enough ionite.");
      return;
    }
    this.credits[team] -= cost;
    this.ability[which] = cd;
    const rad = which === "nuke" ? 170 : 78;
    const dmg = which === "nuke" ? 240 : 72;
    for (const e of this.ents) {
      if (!e.alive || e.team === team) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < rad) this.hurt(e, dmg * (1 - d / (rad + 10)));
    }
    this.burst(x, y, which === "nuke" ? 1.7 : 0.9);
    this.shake = Math.min(1.4, this.shake + (which === "nuke" ? 1.1 : 0.45));
    if (team === 0) this.say(which === "nuke" ? "DEFCON warhead away." : "Ion strike.");
    this.events.push({ t: "boom", big: which === "nuke" });
    this.uiDirty = true;
  }

  private castDome(team: Team): void {
    if (this.ability.dome > 0) {
      if (team === 0) this.say("Dome is cooling down.");
      return;
    }
    if (this.credits[team] < 500) {
      if (team === 0) this.say("Not enough ionite.");
      return;
    }
    const spire = this.ents.find((e) => e.alive && e.team === team && e.kind === "spire");
    if (!spire) return;
    this.credits[team] -= 500;
    this.ability.dome = 55;
    for (const e of this.ents) {
      if (!e.alive || e.team !== team) continue;
      if (Math.hypot(e.x - spire.x, e.y - spire.y) < 250) e.shield += 90;
    }
    if (team === 0) this.say("Shield dome is up.");
    this.uiDirty = true;
  }

  armPlace(kind: Kind): void {
    if (!DEFS[kind].building) {
      this.enqueue(0, kind);
      this.placeKind = null;
      return;
    }
    if (!this.unlocked(0, kind)) {
      this.say("Raise the earlier wing first.");
      this.events.push({ t: "bad" });
      return;
    }
    this.placeKind = this.placeKind === kind ? null : kind;
    this.attackArm = false;
    this.uiDirty = true;
    this.events.push({ t: "ui" });
  }

  placeAt(x: number, y: number): boolean {
    if (!this.placeKind) return false;
    const kind = this.placeKind;
    const spot = this.snap(kind, x, y);
    if (this.credits[0] < DEFS[kind].cost) {
      this.say("Not enough ionite.");
      this.events.push({ t: "bad" });
      return false;
    }
    if (!this.canPlace(0, kind, spot.x, spot.y)) {
      this.say("Can't raise that here.");
      this.events.push({ t: "bad" });
      return false;
    }
    this.credits[0] -= DEFS[kind].cost;
    this.addBuilding(kind, 0, spot.x, spot.y, false);
    this.recomputeBlocks();
    this.placeKind = null;
    this.say(DEFS[kind].name + " is going up.");
    this.events.push({ t: "build" });
    this.uiDirty = true;
    return true;
  }

  canPlace(team: Team, kind: Kind, x: number, y: number): boolean {
    const def = DEFS[kind];
    const oc = Math.round(x / TILE - def.fw / 2);
    const or = Math.round(y / TILE - def.fh / 2);
    for (let r = or; r < or + def.fh; r++) {
      for (let c = oc; c < oc + def.fw; c++) {
        if (c < 1 || r < 1 || c >= COLS - 1 || r >= ROWS - 1) return false;
        const i = r * COLS + c;
        if (this.tiles[i] !== 0 || this.block[i]) return false;
      }
    }
    const near = this.ents.some((e) => {
      if (!e.alive || e.team !== team || !DEFS[e.kind].building || e.buildLeft > 0) return false;
      return Math.hypot(e.x - x, e.y - y) < 340;
    });
    if (!near) return false;
    const hw = (def.fw * TILE) / 2;
    const hh = (def.fh * TILE) / 2;
    for (const u of this.ents) {
      if (!u.alive || DEFS[u.kind].building) continue;
      if (Math.abs(u.x - x) < hw + 8 && Math.abs(u.y - y) < hh + 8) return false;
    }
    return true;
  }

  snap(kind: Kind, x: number, y: number): { x: number; y: number } {
    const def = DEFS[kind];
    const c = clamp(Math.floor(x / TILE), 0, COLS - 1);
    const r = clamp(Math.floor(y / TILE), 0, ROWS - 1);
    const oc = c - Math.floor((def.fw - 1) / 2);
    const or = r - Math.floor((def.fh - 1) / 2);
    return { x: (oc + def.fw / 2) * TILE, y: (or + def.fh / 2) * TILE };
  }

  selectAt(x: number, y: number, add: boolean): void {
    const hit = this.pickAt(x, y);
    if (!hit) {
      if (!add) this.selected = [];
    } else if (add) {
      this.selected = this.selected.includes(hit.id) ? this.selected.filter((id) => id !== hit.id) : [...this.selected, hit.id];
    } else {
      this.selected = [hit.id];
    }
    this.uiDirty = true;
  }

  selectBox(x0: number, y0: number, x1: number, y1: number, add: boolean): void {
    const minx = Math.min(x0, x1);
    const maxx = Math.max(x0, x1);
    const miny = Math.min(y0, y1);
    const maxy = Math.max(y0, y1);
    const ids: number[] = [];
    for (const e of this.ents) {
      if (!e.alive || e.team !== 0 || DEFS[e.kind].building) continue;
      if (!this.isVisible(e)) continue;
      if (e.x >= minx && e.x <= maxx && e.y >= miny && e.y <= maxy) ids.push(e.id);
    }
    this.selected = add ? Array.from(new Set([...this.selected, ...ids])) : ids;
    this.uiDirty = true;
  }

  selectSame(kind: Kind): void {
    this.selected = this.ents.filter((e) => e.alive && e.team === 0 && e.kind === kind).map((e) => e.id);
    this.uiDirty = true;
    this.say(this.selected.length ? `${this.selected.length} ${DEFS[kind].name}` : "None of that kind.");
  }

  command(x: number, y: number, mode: "smart" | "amove"): void {
    const ownUnits = this.selected
      .map((id) => this.byId(id))
      .filter((e): e is Ent => !!e && e.team === 0 && !DEFS[e.kind].building);
    const ownBuildings = this.selected
      .map((id) => this.byId(id))
      .filter((e): e is Ent => !!e && e.team === 0 && DEFS[e.kind].building);
    if (!ownUnits.length) {
      if (ownBuildings.length) {
        for (const b of ownBuildings) {
          b.rallyX = x;
          b.rallyY = y;
        }
        this.say("Rally moved.");
        this.events.push({ t: "ui" });
      }
      return;
    }
    const enemy = this.pickAt(x, y, (e) => e.team === 1);
    const cell = this.cell(x, y);
    const onIon = this.ionAt(cell.c, cell.r) > 0;
    const cols = Math.ceil(Math.sqrt(ownUnits.length));
    ownUnits.forEach((e, i) => {
      const ox = ((i % cols) - (cols - 1) / 2) * 30;
      const oy = (Math.floor(i / cols) - 0.5) * 30;
      if (e.kind === "harvester") {
        if (onIon && mode === "smart") {
          e.order = "harvest";
          e.ionC = cell.c;
          e.ionR = cell.r;
          e.cargo = Math.min(e.cargo, DEFS.harvester.cargo);
          this.requestPath(e, x, y);
        } else {
          e.order = "move";
          e.ionC = -1;
          this.requestPath(e, x + ox, y + oy);
        }
        return;
      }
      if (enemy && mode === "smart") {
        e.order = "attack";
        e.targetId = enemy.id;
        this.requestPath(e, enemy.x, enemy.y);
      } else if (mode === "amove") {
        e.order = "amove";
        e.targetId = -1;
        this.requestPath(e, x + ox, y + oy);
      } else {
        e.order = "move";
        e.targetId = -1;
        this.requestPath(e, x + ox, y + oy);
      }
    });
    this.attackArm = false;
    this.events.push({ t: "ui" });
    this.uiDirty = true;
  }

  stop(): void {
    for (const id of this.selected) {
      const e = this.byId(id);
      if (!e || e.team !== 0 || DEFS[e.kind].building) continue;
      e.order = "hold";
      e.path = null;
      e.targetId = -1;
    }
    this.events.push({ t: "ui" });
  }

  toggleRepair(): void {
    let any = false;
    for (const id of this.selected) {
      const e = this.byId(id);
      if (!e || e.team !== 0 || !DEFS[e.kind].building) continue;
      e.repairOn = !e.repairOn;
      any = true;
    }
    if (any) this.events.push({ t: "ui" });
    this.uiDirty = true;
  }

  sell(): void {
    for (const id of [...this.selected]) {
      const e = this.byId(id);
      if (!e || e.team !== 0 || !DEFS[e.kind].building || e.kind === "spire") continue;
      for (const q of e.queue) this.credits[0] += DEFS[q.kind].cost;
      this.credits[0] += Math.floor(DEFS[e.kind].cost * 0.5);
      this.kill(e, true);
      this.events.push({ t: "ui" });
    }
    this.say("Structure scrapped.");
    this.uiDirty = true;
  }

  focusPoint(): { x: number; y: number } {
    const e = this.selected.map((id) => this.byId(id)).find((x) => !!x);
    if (e) return { x: e.x, y: e.y };
    return this.pois.player;
  }

  snapshot(): HudSnap {
    const pow = this.powerOf(0);
    const unlocked = {} as Record<Kind, boolean>;
    const afford = {} as Record<Kind, boolean>;
    for (const k of [...BUILD_MENU, ...UNIT_MENU]) {
      unlocked[k] = this.unlocked(0, k);
      afford[k] = this.credits[0] >= DEFS[k].cost;
    }
    const making: Partial<Record<Kind, number>> = {};
    for (const e of this.ents) {
      if (!e.alive || e.team !== 0 || !e.queue.length) continue;
      const q = e.queue[0];
      const pct = 1 - q.left / q.total;
      if (making[q.kind] === undefined || pct > (making[q.kind] ?? 0)) making[q.kind] = pct;
    }
    let ionLeft = 0;
    for (let i = 0; i < this.ion.length; i++) ionLeft += this.ion[i];
    const selected = this.selected
      .map((id) => this.byId(id))
      .filter((e): e is Ent => !!e)
      .map((e) => ({
        id: e.id,
        kind: e.kind,
        team: e.team,
        hp: e.hp,
        maxHp: e.maxHp,
        cargo: e.cargo,
        building: DEFS[e.kind].building,
        repairOn: e.repairOn,
        buildLeft: e.buildLeft,
        buildTotal: e.buildTotal,
        queue: e.queue.map((q) => ({ ...q })),
        shield: e.shield,
      }));
    return {
      credits: Math.floor(this.credits[0]),
      cap: this.capOf(0),
      prod: pow.prod,
      use: pow.use,
      low: pow.low,
      time: this.time,
      message: this.messages[0]?.text ?? "",
      place: this.placeKind,
      attackArm: this.attackArm,
      paused: this.paused,
      winner: this.winner,
      ionLeft,
      selected,
      unlocked,
      afford,
      making,
      tech: { ...this.tech[0] },
      ability: { ...this.ability },
      abilityArm: this.abilityArm,
      objective: this.objectiveLine().text,
      objectivePct: this.objectiveLine().pct,
    };
  }

  exportState() {
    return {
      v: 1,
      time: this.time,
      credits: [...this.credits],
      nextId: this.nextId,
      winner: this.winner,
      ion: Array.from(this.ion),
      ents: this.ents.filter((e) => e.alive).map((e) => ({ ...e, path: e.path ? e.path.map((pt) => ({ ...pt })) : null, queue: e.queue.map((q) => ({ ...q })) })),
    };
  }

  importState(blob: { time: number; credits: number[]; nextId: number; winner: Team | null; ion: number[]; ents: Ent[] }): void {
    this.ents = blob.ents.map((e) => ({ ...e, shield: e.shield ?? 0, path: e.path ? e.path.map((pt) => ({ ...pt })) : null, queue: e.queue.map((q) => ({ ...q })) }));
    this.by.clear();
    for (const e of this.ents) this.by.set(e.id, e);
    this.credits = [blob.credits[0] ?? 0, blob.credits[1] ?? 0];
    this.time = blob.time;
    this.nextId = blob.nextId;
    this.winner = blob.winner;
    this.ion.set(blob.ion);
    this.selected = [];
    this.placeKind = null;
    this.messages = [{ text: "Field restored.", life: 2.4 }];
    this.recomputeBlocks();
    this.updateFog();
    this.uiDirty = true;
  }

  powerOf(team: Team): { prod: number; use: number; low: boolean } {
    let prod = 0;
    let use = 0;
    for (const e of this.ents) {
      if (!e.alive || e.team !== team || !DEFS[e.kind].building || e.buildLeft > 0) continue;
      prod += DEFS[e.kind].power;
      use += DEFS[e.kind].drain;
    }
    const low = use > prod;
    if (team === 0 && low !== this.wasLow) {
      this.wasLow = low;
      this.say(low ? "Grid starved. Turrets dark." : "Grid steady.");
    }
    return { prod, use, low };
  }

  capOf(team: Team): number {
    let cap = 8000;
    for (const e of this.ents) {
      if (e.alive && e.team === team && e.kind === "silo" && e.buildLeft <= 0) cap += 4000;
    }
    return cap;
  }

  isVisible(e: Ent): boolean {
    const c = clamp(Math.floor(e.x / TILE), 0, COLS - 1);
    const r = clamp(Math.floor(e.y / TILE), 0, ROWS - 1);
    return this.visible[r * COLS + c] === 1;
  }

  private updateFog(): void {
    this.visible.fill(0);
    for (const e of this.ents) {
      if (!e.alive || e.team !== 0) continue;
      const rad = (DEFS[e.kind].vision * (e.buildLeft > 0 ? 0.55 : 1)) / TILE;
      const cc = Math.floor(e.x / TILE);
      const rr = Math.floor(e.y / TILE);
      const R = Math.ceil(rad);
      for (let r = rr - R; r <= rr + R; r++) {
        for (let c = cc - R; c <= cc + R; c++) {
          if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
          if ((c - cc) * (c - cc) + (r - rr) * (r - rr) <= rad * rad) {
            const i = r * COLS + c;
            this.visible[i] = 1;
            this.explored[i] = 1;
          }
        }
      }
      if (DEFS[e.kind].building) {
        const c = clamp(cc, 0, COLS - 1);
        const r = clamp(rr, 0, ROWS - 1);
        if (this.visible[r * COLS + c]) {
          this.memory.set(e.id, { kind: e.kind, team: e.team, x: e.x, y: e.y });
        }
      }
    }
    for (const e of this.ents) {
      if (e.alive || !DEFS[e.kind].building) continue;
      const c = clamp(Math.floor(e.x / TILE), 0, COLS - 1);
      const r = clamp(Math.floor(e.y / TILE), 0, ROWS - 1);
      if (this.visible[r * COLS + c]) this.memory.delete(e.id);
    }
  }

  private nearestEnemy(e: Ent, range: number): Ent | null {
    let best: Ent | null = null;
    let bestD = range;
    for (const o of this.ents) {
      if (!o.alive || o.team === e.team || !engages(e.kind, o.kind)) continue;
      const d = Math.hypot(o.x - e.x, o.y - e.y);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }

  private nearestBuilding(team: Team, kind: Kind, x: number, y: number): Ent | null {
    let best: Ent | null = null;
    let bestD = 1e12;
    for (const e of this.ents) {
      if (!e.alive || e.team !== team || e.kind !== kind || e.buildLeft > 0) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  private nearestIon(x: number, y: number): { c: number; r: number } | null {
    let best: { c: number; r: number } | null = null;
    let bestD = 1e12;
    for (let r = 1; r < ROWS - 1; r++) {
      for (let c = 1; c < COLS - 1; c++) {
        const amt = this.ion[r * COLS + c];
        if (amt <= 40) continue;
        const dx = (c + 0.5) * TILE - x;
        const dy = (r + 0.5) * TILE - y;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = { c, r };
        }
      }
    }
    return best;
  }

  private ionAt(c: number, r: number): number {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return 0;
    return this.ion[r * COLS + c];
  }

  pickAt(x: number, y: number, pred?: (e: Ent) => boolean): Ent | null {
    let best: Ent | null = null;
    let bestS = 1e9;
    for (let i = this.ents.length - 1; i >= 0; i--) {
      const e = this.ents[i];
      if (!e.alive) continue;
      if (pred && !pred(e)) continue;
      if (e.team === 1 && !this.isVisible(e) && !DEFS[e.kind].building) continue;
      const def = DEFS[e.kind];
      let score = 1e9;
      if (def.building) {
        const hw = (def.fw * TILE) / 2;
        const hh = (def.fh * TILE) / 2;
        if (Math.abs(x - e.x) <= hw && Math.abs(y - e.y) <= hh) score = 1000 + Math.hypot(x - e.x, y - e.y);
      } else {
        const d = Math.hypot(x - e.x, y - e.y);
        if (d <= def.radius + 6) score = d;
      }
      if (score < bestS) {
        bestS = score;
        best = e;
      }
    }
    return best;
  }

  private cell(x: number, y: number): { c: number; r: number } {
    return {
      c: clamp(Math.floor(x / TILE), 0, COLS - 1),
      r: clamp(Math.floor(y / TILE), 0, ROWS - 1),
    };
  }

  private dist(a: Ent, b: Ent): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private angDiff(a: number, b: number): number {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  say(text: string): void {
    this.messages.unshift({ text, life: 4.2 });
    if (this.messages.length > 4) this.messages.pop();
    this.uiDirty = true;
  }

  recomputeBlocks(): void {
    for (let i = 0; i < this.block.length; i++) {
      this.block[i] = this.tiles[i] === 1 || this.tiles[i] === 3 ? 1 : 0;
      this.occ[i] = 0;
    }
    for (const e of this.ents) {
      if (!e.alive || !DEFS[e.kind].building) continue;
      const def = DEFS[e.kind];
      const oc = Math.round(e.x / TILE - def.fw / 2);
      const or = Math.round(e.y / TILE - def.fh / 2);
      for (let r = or; r < or + def.fh; r++) {
        for (let c = oc; c < oc + def.fw; c++) {
          if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
          const i = r * COLS + c;
          this.block[i] = 1;
          this.occ[i] = e.id;
        }
      }
    }
  }

  circleBlocked(x: number, y: number, rad: number, _ignore: number): boolean {
    if (x < 8 || y < 8 || x > WORLD_W - 8 || y > WORLD_H - 8) return true;
    const c0 = Math.floor((x - rad) / TILE);
    const c1 = Math.floor((x + rad) / TILE);
    const r0 = Math.floor((y - rad) / TILE);
    const r1 = Math.floor((y + rad) / TILE);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true;
        if (this.block[r * COLS + c]) return true;
      }
    }
    return false;
  }

  private findOpen(x: number, y: number, rad: number): { x: number; y: number } {
    if (!this.circleBlocked(x, y, rad, -1)) return { x, y };
    for (let ring = 1; ring <= 8; ring++) {
      for (let a = 0; a < 8; a++) {
        const nx = x + Math.cos((a / 8) * Math.PI * 2) * ring * 18;
        const ny = y + Math.sin((a / 8) * Math.PI * 2) * ring * 18;
        if (!this.circleBlocked(nx, ny, rad, -1)) return { x: nx, y: ny };
      }
    }
    return { x, y };
  }

  private requestPath(e: Ent, x: number, y: number): void {
    e.destX = clamp(x, 16, WORLD_W - 16);
    e.destY = clamp(y, 16, WORLD_H - 16);
    e.path = null;
    e.pathI = 0;
    this.pathQueue = this.pathQueue.filter((id) => id !== e.id);
    this.pathQueue.push(e.id);
  }

  private processPaths(): void {
    let n = 0;
    while (this.pathQueue.length && n < 4) {
      const id = this.pathQueue.shift()!;
      const e = this.byId(id);
      if (!e) continue;
      if (DEFS[e.kind].air) {
        e.path = [{ x: e.destX, y: e.destY }];
        e.pathI = 0;
        n++;
        continue;
      }
      e.path = this.astar(e.x, e.y, e.destX, e.destY);
      e.pathI = 0;
      n++;
    }
  }

  private gScore = new Float64Array(COLS * ROWS);
  private prevA = new Int32Array(COLS * ROWS);
  private seen = new Uint32Array(COLS * ROWS);
  private stamp = 1;

  private astar(sx: number, sy: number, tx: number, ty: number): { x: number; y: number }[] {
    if (this.walkableLine({ x: sx, y: sy }, { x: tx, y: ty })) return [{ x: tx, y: ty }];
    const start = this.nearestOpenTile(sx, sy);
    const goal = this.nearestOpenTile(tx, ty);
    const si = start.r * COLS + start.c;
    const gi = goal.r * COLS + goal.c;
    if (si === gi) return [{ x: tx, y: ty }];
    this.stamp++;
    if (this.stamp > 4_000_000_000) {
      this.seen.fill(0);
      this.stamp = 1;
    }
    const stamp = this.stamp;
    const gScore = this.gScore;
    const prev = this.prevA;
    const seen = this.seen;
    gScore[si] = 0;
    seen[si] = stamp;
    prev[si] = -1;
    const open = new Heap();
    open.push(this.octile(start.c, start.r, goal.c, goal.r), si);
    const closed = new Uint8Array(COLS * ROWS);
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    let guard = 0;
    while (open.size && guard++ < 2500) {
      const cur = open.pop();
      if (!cur || closed[cur.i]) continue;
      closed[cur.i] = 1;
      if (cur.i === gi) {
        const pts: { x: number; y: number }[] = [];
        let k = gi;
        const guard2 = new Set<number>();
        while (k >= 0 && !guard2.has(k)) {
          guard2.add(k);
          const c = k % COLS;
          const r = (k - c) / COLS;
          pts.push({ x: (c + 0.5) * TILE, y: (r + 0.5) * TILE });
          if (k === si) break;
          k = prev[k];
        }
        pts.reverse();
        pts[pts.length - 1] = { x: tx, y: ty };
        return this.smooth(pts);
      }
      const c = cur.i % COLS;
      const r = (cur.i - c) / COLS;
      for (const [dc, dr] of dirs) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
        const ni = nr * COLS + nc;
        if (closed[ni]) continue;
        if (this.block[ni] && ni !== gi) continue;
        if (dc !== 0 && dr !== 0) {
          if (this.block[r * COLS + nc] || this.block[nr * COLS + c]) continue;
        }
        const step = dc !== 0 && dr !== 0 ? 1.414 : 1;
        const base = seen[cur.i] === stamp ? gScore[cur.i] : 1e12;
        const ng = base + step;
        const old = seen[ni] === stamp ? gScore[ni] : 1e12;
        if (ng < old) {
          gScore[ni] = ng;
          seen[ni] = stamp;
          prev[ni] = cur.i;
          open.push(ng + this.octile(nc, nr, goal.c, goal.r), ni);
        }
      }
    }
    return [{ x: tx, y: ty }];
  }

  private nearestOpenTile(x: number, y: number): { c: number; r: number } {
    let c = clamp(Math.floor(x / TILE), 0, COLS - 1);
    let r = clamp(Math.floor(y / TILE), 0, ROWS - 1);
    if (!this.block[r * COLS + c]) return { c, r };
    for (let rad = 1; rad < 12; rad++) {
      for (let rr = r - rad; rr <= r + rad; rr++) {
        for (let cc = c - rad; cc <= c + rad; cc++) {
          if (cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS) continue;
          if (!this.block[rr * COLS + cc]) return { c: cc, r: rr };
        }
      }
    }
    return { c, r };
  }

  private octile(c: number, r: number, gc: number, gr: number): number {
    const dx = Math.abs(c - gc);
    const dy = Math.abs(r - gr);
    return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
  }

  private smooth(pts: { x: number; y: number }[]): { x: number; y: number }[] {
    if (pts.length < 3) return pts;
    const out = [pts[0]];
    let anchor = 0;
    for (let i = 2; i < pts.length; i++) {
      if (!this.walkableLine(pts[anchor], pts[i])) {
        out.push(pts[i - 1]);
        anchor = i - 1;
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  private walkableLine(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.ceil(dist / 10);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      if (this.circleBlocked(x, y, 4, -1)) return false;
    }
    return true;
  }

  private hasLos(x: number, y: number, target: Ent, selfId: number): boolean {
    const dist = Math.hypot(target.x - x, target.y - y);
    const steps = Math.max(1, Math.ceil(dist / 10));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const px = x + (target.x - x) * t;
      const py = y + (target.y - y) * t;
      const c = Math.floor(px / TILE);
      const r = Math.floor(py / TILE);
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return false;
      const bi = r * COLS + c;
      const occ = this.occ[bi];
      if (occ === target.id || occ === selfId) continue;
      if (this.block[bi]) return false;
    }
    return true;
  }
}
