import { useEffect, useRef, useState } from "react";
import {
  Box,
  Crosshair,
  Database,
  Factory,
  Hexagon,
  Pause,
  Play,
  Rocket,
  Shield,
  Square,
  Star,
  Sword,
  Truck,
  User,
  Users,
  Volume2,
  VolumeX,
  Warehouse,
  Wrench,
  Zap,
  Plane,
} from "lucide-react";
import { BUILD_MENU, DEFS, TIER_MAP, UNIT_MENU, WORLD_H, WORLD_W, nextUpgradeCost, structureTitle, type Kind, type TechWing } from "@/game/content";
import { Sfx } from "@/game/audio";
import { Renderer, type Cam } from "@/game/render";
import { Sim, type HudSnap } from "@/game/sim";
import { SettingsPanel } from "@/components/SettingsPanel";
import { Briefing } from "@/components/Briefing";
import { Hudson } from "@/components/Hudson";
import { chapterById, countryOf, isOpen, nextPlayable, type Chapter } from "@/game/campaign";
import { markCleared, markWatched } from "@/game/progress";
import { allBadges, noteCombat, type Badge } from "@/game/achievements";
import { grantMarks, readProfile, writeSave, type SaveSlot } from "@/lib/meta/profile";

type Phase = "title" | "battle" | "win" | "lose";

const ICONS: Record<Kind, typeof Hexagon> = {
  spire: Hexagon,
  relay: Zap,
  refinery: Factory,
  barracks: Users,
  bay: Warehouse,
  turret: Crosshair,
  silo: Database,
  rifle: User,
  rocket: Rocket,
  harvester: Truck,
  lancer: Shield,
  bastion: Box,
  wall: Square,
  sam: Rocket,
  cannon: Crosshair,
  strip: Plane,
  viper: Shield,
  aegis: Rocket,
  t3x: Star,
  kestrel: Plane,
  condor: Plane,
  watch: Crosshair,
  patrol: Users,
  grenadier: Rocket,
  sergeant: Shield,
  specops: Star,
  reaver: Box,
  howl: Rocket,
  ionwing: Plane,
  spectre: Plane,
};

function clock(t: number): string {
  const s = Math.max(0, Math.floor(t));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function screenToWorld(sx: number, sy: number, cam: Cam, w: number, h: number): { x: number; y: number } {
  return { x: (sx - w / 2) / cam.z + cam.x, y: (sy - h / 2) / cam.z + cam.y };
}

function clampCam(cam: Cam, w: number, h: number): void {
  const hw = w / 2 / cam.z;
  const hh = h / 2 / cam.z;
  cam.x = WORLD_W <= hw * 2 ? WORLD_W / 2 : Math.max(hw, Math.min(WORLD_W - hw, cam.x));
  cam.y = WORLD_H <= hh * 2 ? WORLD_H / 2 : Math.max(hh, Math.min(WORLD_H - hh, cam.y));
}

function catmull(pts: { x: number; y: number }[], u: number): { x: number; y: number } {
  const n = pts.length - 1;
  const x = Math.min(0.999, u) * n;
  const i = Math.min(n - 1, Math.floor(x));
  const t = x - i;
  const p = (k: number) => pts[Math.max(0, Math.min(pts.length - 1, k))];
  const a = p(i - 1);
  const b = p(i);
  const c = p(i + 1);
  const d = p(i + 2);
  const t2 = t * t;
  const t3 = t2 * t;
  const calc = (k0: number, k1: number, k2: number, k3: number) => 0.5 * (2 * k1 + (-k0 + k2) * t + (2 * k0 - 5 * k1 + 4 * k2 - k3) * t2 + (-k0 + 3 * k1 - 3 * k2 + k3) * t3);
  return { x: calc(a.x, b.x, c.x, d.x), y: calc(a.y, b.y, c.y, d.y) };
}

export function Ionreach() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const vidRef = useRef<HTMLVideoElement>(null);
  const cutRef = useRef<HTMLVideoElement>(null);
  const simRef = useRef<Sim | null>(null);
  const camRef = useRef<Cam>({ x: 420, y: 1400, z: 1 });
  const keys = useRef(new Set<string>());
  const sfx = useRef(new Sfx());
  const modeRef = useRef<"intro" | "play">("intro");
  const introRef = useRef(0);
  const pauseRef = useRef(false);
  const pointer = useRef({ x: 0, y: 0, down: false, sx: 0, sy: 0, wx: 0, wy: 0, drag: false, button: 0, touch: false });
  const groups = useRef<(number[] | null)[]>([null, null, null, null]);
  const [phase, setPhase] = useState<Phase>("title");
  const [battleKey, setBattleKey] = useState(0);
  const [hud, setHud] = useState<HudSnap | null>(null);
  const [manual, setManual] = useState(false);
  const [cinema, setCinema] = useState(false);
  const [muted, setMuted] = useState(true);
  const [flyover, setFlyover] = useState(false);
  const [introLine, setIntroLine] = useState("Helion forward base.");
  const lineRef = useRef("");
  const [best, setBest] = useState<number | null>(null);
  const [settings, setSettings] = useState(false);
  const [picking, setPicking] = useState(false);
  const [brief, setBrief] = useState<Chapter | null>(null);
  const [pickingCountry, setPickingCountry] = useState<string | null>(null);
  const [storyTick, setStoryTick] = useState(0);
  const [mid, setMid] = useState<string | null>(null);
  const [hudson, setHudson] = useState<Chapter | null>(null);
  const midPlayed = useRef(false);
  const [records, setRecords] = useState(false);
  const [earned, setEarned] = useState<Badge[]>([]);
  const [toasts, setToasts] = useState<Badge[]>([]);
  const chapterRef = useRef("usa-01");
  const earnedRef = useRef<Badge[]>([]);
  const [tiersOpen, setTiersOpen] = useState(false);
  const [abilitiesOpen, setAbilitiesOpen] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const musicOnRef = useRef(false);
  const phaseRef = useRef<Phase>("title");

  useEffect(() => {
    try {
      const v = localStorage.getItem("ionreach-best");
      if (v) setBest(Number(v));
    } catch {
      /* ignore */
    }
    const v = vidRef.current;
    if (!v) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) {
      v.muted = true;
      void v.play().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!brief) return;
    vidRef.current?.pause();
  }, [brief]);

  useEffect(() => {
    phaseRef.current = phase;
    if (phase === "title" && vidRef.current) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduce) void vidRef.current.play().catch(() => undefined);
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== "battle" && phase !== "win" && phase !== "lose") return;
    const canvas = canvasRef.current;
    const mini = miniRef.current;
    const sim = simRef.current;
    if (!canvas || !mini || !sim) return;
    const ctx = canvas.getContext("2d");
    const mctx = mini.getContext("2d");
    if (!ctx || !mctx) return;
    const renderer = new Renderer();
    let raf = 0;
    let last = performance.now();
    let hudAt = 0;
    let alive = true;
    const loop = (now: number) => {
      if (!alive) return;
      const sim = simRef.current;
      if (!sim) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const rect = canvas.getBoundingClientRect();
      const cam = camRef.current;
      if (modeRef.current === "intro") {
        introRef.current += dt;
        const u = Math.min(1, introRef.current / 9);
        const p = sim.pois;
        const pos = catmull([p.player, p.mid, p.enemy, { x: p.player.x + 80, y: p.player.y - 40 }], u);
        cam.x = pos.x;
        cam.y = pos.y;
        cam.z = 0.78 + Math.sin(u * Math.PI) * 0.28;
        const ch = chapterById(chapterRef.current);
        const line = u < 0.28 ? `${ch.country}. ${ch.theater}.` : u < 0.62 ? ch.beats[1] : ch.beats[2];
        if (line !== lineRef.current) {
          lineRef.current = line;
          setIntroLine(line);
        }
        if (introRef.current > 9) {
          modeRef.current = "play";
          cam.x = p.player.x + 160;
          cam.y = p.player.y - 160;
          cam.z = 0.92;
          setFlyover(false);
        }
      } else if (!pauseRef.current && sim.winner === null) {
        let vx = 0;
        let vy = 0;
        if (keys.current.has("KeyA") || keys.current.has("ArrowLeft")) vx -= 1;
        if (keys.current.has("KeyD") || keys.current.has("ArrowRight")) vx += 1;
        if (keys.current.has("KeyW") || keys.current.has("ArrowUp")) vy -= 1;
        if (keys.current.has("KeyS") || keys.current.has("ArrowDown")) vy += 1;
        const sp = 680 / cam.z;
        cam.x += vx * sp * dt;
        cam.y += vy * sp * dt;
        sim.tick(dt);
      }
      clampCam(cam, rect.width, rect.height);
      const pr = pointer.current;
      const world = screenToWorld(pr.x, pr.y, cam, rect.width, rect.height);
      let ghost = null;
      if (sim.placeKind && modeRef.current === "play") {
        const spot = sim.snap(sim.placeKind, world.x, world.y);
        ghost = { kind: sim.placeKind, x: spot.x, y: spot.y, ok: sim.canPlace(0, sim.placeKind, spot.x, spot.y) && sim.credits[0] >= DEFS[sim.placeKind].cost };
      }
      const box =
        pr.drag && pr.button === 0 && !pr.touch
          ? {
              x0: pr.wx,
              y0: pr.wy,
              x1: world.x,
              y1: world.y,
            }
          : null;
      renderer.draw(ctx, sim, cam, rect.width, rect.height, ghost, box, modeRef.current === "intro");
      if (mini.width > 0) renderer.drawMinimap(mctx, sim, cam, rect.width, rect.height, modeRef.current === "intro");
      if (sim.uiDirty || now - hudAt > 140) {
        sim.uiDirty = false;
        hudAt = now;
        setHud(sim.snapshot());
      }
      const evs = sim.events.splice(0, sim.events.length);
      for (const ev of evs) {
        if (ev.t === "shot") sfx.current.shot(ev.kind ?? "bolt");
        else if (ev.t === "boom" || ev.t === "win" || ev.t === "lose") {
          if (ev.t === "boom") sfx.current.boom(!!ev.big);
          else if (ev.t === "win") sfx.current.win();
          else sfx.current.lose();
          const fresh = noteCombat(chapterRef.current, sim.downed, ev.t === "boom" ? null : ev.t);
          if (ev.t === "win") {
            markCleared(chapterRef.current);
            setStoryTick((n) => n + 1);
          }
          if (fresh.length) {
            earnedRef.current = [...earnedRef.current, ...fresh];
            setToasts(fresh);
            setEarned(earnedRef.current);
          }
        } else if (ev.t === "half") {
          const ch = chapterById(chapterRef.current);
          if (ch.mid && !midPlayed.current) {
            midPlayed.current = true;
            pauseRef.current = true;
            sim.paused = true;
            setMid(ch.mid);
          }
        }
        else if (ev.t === "build") sfx.current.build();
        else if (ev.t === "bad") sfx.current.bad();
        else if (ev.t === "ui") sfx.current.click();
      }
      if (sim.winner !== null && phaseRef.current === "battle") {
        const next = sim.winner === 0 ? "win" : "lose";
        phaseRef.current = next;
        try {
          grantMarks(next === "win" ? 25 : 8);
        } catch {
          /* ignore */
        }
        if (next === "win") {
          try {
            const prev = Number(localStorage.getItem("ionreach-best") || "0");
            if (!prev || sim.time < prev) {
              localStorage.setItem("ionreach-best", String(sim.time));
              setBest(sim.time);
            }
          } catch {
            /* ignore */
          }
        }
        setPhase(next);
        setHud(sim.snapshot());
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const local = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
    };

    const onDown = (e: PointerEvent) => {
      if (modeRef.current !== "play" || !simRef.current) return;
      if (e.button === 1) return;
      const p = local(e);
      const world = screenToWorld(p.x, p.y, camRef.current, p.w, p.h);
      pointer.current = { x: p.x, y: p.y, down: true, sx: p.x, sy: p.y, wx: world.x, wy: world.y, drag: false, button: e.button, touch: e.pointerType === "touch" };
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const p = local(e);
      pointer.current.x = p.x;
      pointer.current.y = p.y;
      if (!pointer.current.down) return;
      const dx = p.x - pointer.current.sx;
      const dy = p.y - pointer.current.sy;
      if (Math.hypot(dx, dy) > 8) pointer.current.drag = true;
      if (pointer.current.drag && (pointer.current.touch || pointer.current.button === 2)) {
        camRef.current.x -= (p.x - pointer.current.sx) / camRef.current.z;
        camRef.current.y -= (p.y - pointer.current.sy) / camRef.current.z;
        pointer.current.sx = p.x;
        pointer.current.sy = p.y;
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!pointer.current.down || !simRef.current) return;
      const simNow = simRef.current;
      const p = local(e);
      const world = screenToWorld(p.x, p.y, camRef.current, p.w, p.h);
      const dragged = pointer.current.drag;
      const button = pointer.current.button;
      const touch = pointer.current.touch;
      pointer.current.down = false;
      pointer.current.drag = false;
      if (modeRef.current !== "play") return;
      if (button === 2) {
        if (dragged) return;
        if (simNow.placeKind) {
          simNow.placeKind = null;
          simNow.uiDirty = true;
        } else simNow.command(world.x, world.y, "smart");
        return;
      }
      if (button !== 0) return;
      if (touch && dragged) return;
      if (simNow.placeKind && !dragged) {
        simNow.placeAt(world.x, world.y);
        return;
      }
      if (simNow.abilityArm && !dragged) {
        simNow.dropAbility(world.x, world.y);
        setHud(simNow.snapshot());
        return;
      }
      if (simNow.attackArm && !dragged) {
        simNow.command(world.x, world.y, "amove");
        return;
      }
      if (touch && !dragged) {
        const hit = simNow.pickAt(world.x, world.y);
        const own = simNow.selected.some((id) => {
          const u = simNow.byId(id);
          return !!u && u.team === 0 && !DEFS[u.kind].building;
        });
        if (hit && hit.team === 0) simNow.selectAt(world.x, world.y, false);
        else if (own) simNow.command(world.x, world.y, "smart");
        else simNow.selectAt(world.x, world.y, false);
        return;
      }
      if (dragged) simNow.selectBox(pointer.current.wx, pointer.current.wy, world.x, world.y, e.shiftKey);
      else simNow.selectAt(world.x, world.y, e.shiftKey);
    };
    const onContext = (e: Event) => e.preventDefault();
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = local(e as unknown as PointerEvent);
      const cam = camRef.current;
      const before = screenToWorld(p.x, p.y, cam, p.w, p.h);
      cam.z = Math.max(0.55, Math.min(1.85, cam.z * (e.deltaY > 0 ? 0.9 : 1.11)));
      const after = screenToWorld(p.x, p.y, cam, p.w, p.h);
      cam.x += before.x - after.x;
      cam.y += before.y - after.y;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      keys.current.add(e.code);
      const simNow = simRef.current;
      if (!simNow || modeRef.current !== "play") return;
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
      if (e.code === "Escape") {
        simNow.placeKind = null;
        simNow.attackArm = false;
        simNow.selected = [];
        simNow.uiDirty = true;
      } else if (e.code === "KeyH") simNow.stop();
      else if (e.code === "KeyQ") {
        simNow.attackArm = !simNow.attackArm;
        simNow.placeKind = null;
        simNow.uiDirty = true;
      } else if (e.code === "KeyR") simNow.toggleRepair();
      else if (e.code === "KeyX") simNow.sell();
      else if (e.code === "KeyP") {
        pauseRef.current = !pauseRef.current;
        simNow.paused = pauseRef.current;
        simNow.uiDirty = true;
        setHud(simNow.snapshot());
      } else if (e.code === "Space") {
        const f = simNow.focusPoint();
        camRef.current.x = f.x;
        camRef.current.y = f.y;
      } else if (e.code === "Digit1" || e.code === "Digit2" || e.code === "Digit3") {
        const slot = Number(e.code.slice(5)) - 1;
        if (e.ctrlKey || e.metaKey) groups.current[slot] = [...simNow.selected];
        else if (groups.current[slot]?.length) {
          simNow.selected = groups.current[slot]!.filter((id) => simNow.byId(id));
          simNow.uiDirty = true;
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.code);
    const onBlur = () => keys.current.clear();

    let pinch: { d: number; z: number } | null = null;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const a = e.touches[0];
        const b = e.touches[1];
        pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: camRef.current.z };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinch) {
        e.preventDefault();
        const a = e.touches[0];
        const b = e.touches[1];
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        camRef.current.z = Math.max(0.55, Math.min(1.85, pinch.z * (d / pinch.d)));
      }
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("contextmenu", onContext);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("contextmenu", onContext);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [phase === "title" ? 0 : battleKey]);

  function applyLoadout(sim: Sim) {
    const gear = readProfile().equipped;
    if (gear.includes("crate")) sim.credits[0] += 600;
    if (gear.includes("plate")) {
      const spire = sim.ents.find((e) => e.alive && e.team === 0 && e.kind === "spire");
      if (spire) {
        spire.maxHp += 500;
        spire.hp += 500;
      }
    }
    if (gear.includes("rig")) sim.addUnit("harvester", 0, 820, 1180);
    if (gear.includes("wing")) sim.addUnit("kestrel", 0, 300, 980);
    if (gear.includes("vault")) sim.credits[0] += 1000;
    if (gear.includes("squad")) {
      for (let i = 0; i < 6; i++) sim.addUnit("rifle", 0, 80 + i * 42, 1380);
    }
    if (gear.includes("eyes")) {
      for (let i = 0; i < 4; i++) sim.addUnit("watch", 0, 220 + i * 40, 960);
    }
    if (gear.includes("kennel")) {
      for (let i = 0; i < 3; i++) sim.addUnit("patrol", 0, 420 + i * 44, 960);
    }
    if (gear.includes("cadre")) {
      for (let i = 0; i < 3; i++) sim.addUnit("sergeant", 0, 80 + i * 48, 1430);
    }
    if (gear.includes("cell")) {
      sim.addUnit("specops", 0, 280, 1430);
      sim.addUnit("specops", 0, 340, 1430);
    }
    if (gear.includes("escort")) {
      sim.addUnit("lancer", 0, 980, 1170);
      sim.addUnit("lancer", 0, 1100, 1170);
    }
    if (gear.includes("scouts")) {
      sim.addUnit("viper", 0, 900, 1060);
      sim.addUnit("viper", 0, 1020, 1060);
    }
    if (gear.includes("machine")) sim.addUnit("reaver", 0, 1140, 1100);
    if (gear.includes("siege")) sim.addUnit("howl", 0, 1260, 1140);
    if (gear.includes("bomber")) sim.addUnit("condor", 0, 1040, 980);
    if (gear.includes("grid")) sim.addBuilding("relay", 0, 18 * 36, 38 * 36, true);
    if (gear.includes("drum")) sim.addBuilding("silo", 0, 18 * 36, 42.5 * 36, true);
    if (gear.includes("hall")) sim.addBuilding("barracks", 0, 6.5 * 36, 35.5 * 36, true);
    if (gear.includes("veil")) {
      for (const e of sim.ents) {
        if (e.alive && e.team === 0) e.shield += 160;
      }
    }
    sim.recomputeBlocks();
  }

  function deploy(id = chapterRef.current) {
    sfx.current.unlock();
    if (musicOnRef.current) sfx.current.startScore();
    chapterRef.current = id;
    midPlayed.current = false;
    setMid(null);
    earnedRef.current = [];
    setEarned([]);
    setToasts([]);
    setBrief(null);
    setPicking(false);
    const sim = new Sim(id);
    applyLoadout(sim);
    simRef.current = sim;
    camRef.current = { x: sim.pois.player.x + 160, y: sim.pois.player.y - 160, z: 0.92 };
    modeRef.current = "intro";
    introRef.current = 0;
    pauseRef.current = false;
    phaseRef.current = "battle";
    setHud(sim.snapshot());
    setCinema(false);
    setFlyover(true);
    setAbilitiesOpen(false);
    setBattleKey((k) => k + 1);
    setPhase("battle");
    if (vidRef.current) vidRef.current.pause();
  }

  function openCinema(at = 0) {
    sfx.current.unlock();
    sfx.current.stopScore();
    setCinema(true);
    setMuted(false);
    if (vidRef.current) vidRef.current.pause();
    window.setTimeout(() => {
      const v = cutRef.current;
      if (!v) return;
      v.currentTime = at;
      v.muted = false;
      void v.play().catch(() => undefined);
    }, 40);
  }

  function closeCinema() {
    if (musicOnRef.current) sfx.current.startScore();
    setCinema(false);
    if (cutRef.current) {
      cutRef.current.pause();
      cutRef.current.muted = true;
    }
    const v = vidRef.current;
    if (!v) return;
    v.muted = true;
    setMuted(true);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce && phaseRef.current === "title") void v.play().catch(() => undefined);
  }

  function toggleMute() {
    const v = vidRef.current;
    if (!v) return;
    sfx.current.unlock();
    v.muted = !v.muted;
    setMuted(v.muted);
    if (v.muted) sfx.current.stopScore();
    else if (musicOnRef.current) sfx.current.startScore();
    if (!v.muted) void v.play().catch(() => undefined);
  }

  function onMini(e: React.PointerEvent<HTMLCanvasElement>) {
    const sim = simRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!sim) return;
    const x = ((e.clientX - rect.left) / rect.width) * WORLD_W;
    const y = ((e.clientY - rect.top) / rect.height) * WORLD_H;
    camRef.current.x = x;
    camRef.current.y = y;
  }

  const battle = phase !== "title";

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
      <video
        ref={vidRef}
        className={battle ? "hidden" : "absolute inset-0 h-full w-full object-cover"}
        src="/media/trailer.mp4?v=7"
        poster="/media/poster.jpg"
        playsInline
        muted
        loop
        preload="auto"
      />
      {!battle && <div className="absolute inset-0 bg-bg/45" />}
      {!battle && (
        <div className="relative z-10 flex h-full flex-col justify-end px-5 py-6 md:px-12 md:py-10">
          <p className="font-display text-sm tracking-[0.28em] text-ion">VERSION 3 · HELION DIRECTORATE · T3X</p>
          <h1 className="font-display text-6xl leading-none font-bold text-fg md:text-8xl">IONREACH</h1>
          <p className="mt-2 max-w-xl text-base text-muted md:text-lg">
            Ten countries. Each one is its own chapter chain. Watch the brief to the end, or win the fight, before the next one opens.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={() => setPicking(true)} className="min-h-11 bg-ion px-5 font-display text-lg font-semibold text-bg">
              Choose a chapter
            </button>
            <button type="button" onClick={() => setSettings(true)} className="min-h-11 border border-line bg-surface/80 px-5 font-display text-lg text-fg">Settings</button>
            <button type="button" onClick={() => openCinema(0)} className="inline-flex min-h-11 items-center gap-2 border border-line bg-surface/80 px-5 font-display text-lg text-fg">
              <Play className="size-4" />
              Play trailer
            </button>
            <button type="button" onClick={() => setManual(true)} className="min-h-11 px-4 font-display text-lg text-muted">
              Field manual
            </button>
            <button type="button" onClick={() => setRecords(true)} className="min-h-11 px-4 font-display text-lg text-muted">
              Achievements
            </button>
          </div>
          <p className="mt-6 max-w-lg text-xs text-muted">
            Supported by Futuret3ch. Original battle sim. Not affiliated with any classic strategy publisher.
            {best ? ` Fastest hold: ${clock(best)}.` : ""}
          </p>
        </div>
      )}

      {cinema && (
        <div className="absolute inset-0 z-30 flex flex-col bg-bg">
          <video ref={cutRef} className="min-h-0 flex-1 object-contain" src="/media/trailer.mp4?v=7" autoPlay controls playsInline poster="/media/poster.jpg" />
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <p className="font-display text-lg tracking-widest text-ion">T3X · GLASS HORIZON</p>
            <button type="button" onClick={closeCinema} className="min-h-11 bg-ion px-4 font-display text-bg">
              Close
            </button>
          </div>
        </div>
      )}

      {picking && (
        <div className="absolute inset-0 z-40 overflow-y-auto bg-bg/92 p-4 md:p-8">
          <div className="mx-auto max-w-5xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-display text-xs tracking-[0.22em] text-ion">VERSION 3</p>
                <h2 className="font-display text-4xl">{pickingCountry ? countryOf(pickingCountry)[0]?.country : "Choose a country"}</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (pickingCountry) setPickingCountry(null);
                  else setPicking(false);
                }}
                className="min-h-11 border border-line px-3 font-display"
              >
                {pickingCountry ? "Countries" : "Close"}
              </button>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              A chapter stays sealed until you watch the previous film to the end, or you win that fight. Skipping the film does not open the next one. Major Hudson checks in between fights. Some battles cut to a transmission when the relief column arrives.
            </p>
            {!pickingCountry && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {["usa", "russia", "china", "australia", "korea", "japan", "uk", "india", "france", "brazil"].map((id) => {
                  const chapters = countryOf(id);
                  const filmed = chapters.filter((c) => c.video).length;
                  return (
                    <button key={id} type="button" onClick={() => setPickingCountry(id)} className="border border-line bg-surface p-4 text-left">
                      <p className="font-display text-2xl">{chapters[0]?.country}</p>
                      <p className="mt-1 text-sm text-muted">
                        {chapters.length} chapters · {filmed} filmed
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
            {pickingCountry && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {countryOf(pickingCountry).map((chapter, index, list) => {
                  void storyTick;
                  const open = isOpen(list, index);
                  return (
                    <button
                      key={chapter.id}
                      type="button"
                      disabled={!open}
                      onClick={() => {
                        if (!open) return;
                        setPicking(false);
                        setBrief(chapter);
                      }}
                      className="border border-line bg-surface p-4 text-left disabled:opacity-50"
                    >
                      <p className="font-display text-xs tracking-[0.16em] text-ion">
                        CHAPTER {chapter.index}
                        {!open && !chapter.video ? " · CUTTING ROOM" : ""}
                        {!open && chapter.video ? " · SEALED" : ""}
                      </p>
                      <p className="font-display text-2xl">{chapter.theater}</p>
                      <p className="mt-1 text-sm text-muted">{open ? chapter.line : chapter.video ? "Watch the previous film to the end, or win that fight." : "This brief is still being cut."}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {brief && (
        <Briefing
          chapter={brief}
          onBack={() => {
            setBrief(null);
            setPicking(true);
          }}
          onDone={(watched) => {
            if (watched) {
              markWatched(brief.id);
              setStoryTick((n) => n + 1);
            }
            deploy(brief.id);
          }}
        />
      )}

      {mid && (
        <div className="absolute inset-0 z-30 flex flex-col bg-black">
          <video className="min-h-0 w-full flex-1 bg-black object-contain" src={`/media/briefings/${mid}.mp4`} autoPlay playsInline onEnded={() => { pauseRef.current = false; if (simRef.current) simRef.current.paused = false; setMid(null); }} />
          <div className="flex items-center justify-between gap-3 border-t border-line bg-bg px-4 py-3">
            <p className="font-display text-sm tracking-[0.16em] text-gold">TRANSMISSION · HALFWAY</p>
            <button
              type="button"
              onClick={() => {
                pauseRef.current = false;
                if (simRef.current) simRef.current.paused = false;
                setMid(null);
              }}
              className="min-h-11 bg-ion px-4 font-display text-bg"
            >
              Back to the fight
            </button>
          </div>
        </div>
      )}

      {hudson && (
        <Hudson
          theater={hudson.theater}
          line={hudson.hudson}
          onClose={() => {
            setHudson(null);
            setPickingCountry(hudson.countryId);
            setPicking(true);
            setPhase("title");
            phaseRef.current = "title";
          }}
          onNext={
            nextPlayable(hudson.id)
              ? () => {
                  const next = nextPlayable(hudson.id);
                  setHudson(null);
                  if (next) setBrief(next);
                }
              : null
          }
        />
      )}

      {records && (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-bg/75 p-4 md:items-center">
          <div className="max-h-[90%] w-full max-w-lg overflow-y-auto border border-line bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-3xl">Achievements</h2>
              <button type="button" onClick={() => setRecords(false)} className="min-h-11 border border-line px-3 font-display">
                Close
              </button>
            </div>
            <ul className="mt-3 space-y-2">
              {allBadges().map(({ badge, owned }) => (
                <li key={badge.id} className={owned ? "border border-gold/50 px-3 py-2" : "border border-line px-3 py-2 opacity-50"}>
                  <p className="font-display">{badge.name}</p>
                  <p className="text-xs text-muted">{owned ? "Earned. " : "Locked. "}{badge.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {manual && (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-bg/70 p-4 md:items-center">
          <div className="w-full max-w-lg border border-line bg-surface p-5">
            <h2 className="font-display text-2xl font-semibold">Field manual</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>Drag a box or tap to select. Right-click to move or attack. On a phone, tap a unit, then tap the ground. Drag to pan.</li>
              <li>Q, or A-move, then click is attack-move. H holds position. R repairs a building for ionite. X scraps it for half cost.</li>
              <li>WASD or arrows pan. Scroll or pinch to zoom. Right-drag pans. Space snaps to the selection. P pauses. Ctrl+1/2/3 stores a group.</li>
              <li>T3X is your callsign hull. It starts beside the spire and can be rebuilt at the vehicle bay. It can fire on aircraft.</li>
              <li>Vipers and Lancers are the tank line. Bastions crack buildings. Aegis and Sky Lances swat aircraft. Ridge guns and shard walls hold a lane.</li>
              <li>A launch spine, after the vehicle bay, builds Kestrel fighters and Condor bombers. They ignore the ridge.</li>
              <li>Win by destroying the Vesper command spire. Lose yours and the horizon falls.</li>
            </ul>
            <button type="button" onClick={() => setManual(false)} className="mt-4 min-h-11 bg-ion px-4 font-display text-bg">
              Understood
            </button>
          </div>
        </div>
      )}

      {tiersOpen && hud && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg/75 p-4">
          <div className="max-h-[90%] w-full max-w-3xl overflow-y-auto border border-line bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-3xl">Tier map</h2>
              <button type="button" onClick={() => setTiersOpen(false)} className="min-h-11 border border-line px-3 font-display">
                Close
              </button>
            </div>
            <p className="mt-1 text-sm text-muted">Select a structure and upgrade it. The building changes, and the next units unlock. Nothing above tier 1 is free.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {TIER_MAP.map((col) => (
                <section key={col.wing} className="border border-line p-3">
                  <p className="font-display text-xs tracking-[0.18em] text-muted">{col.title}</p>
                  <p className="font-display text-lg">{structureTitle(col.wing, hud.tech[col.wing])}</p>
                  <ol className="mt-2 space-y-2">
                    {col.rows.map((row) => {
                      const open = hud.tech[col.wing] >= row.tier;
                      return (
                        <li key={row.tier} className={open ? "border border-ion/40 px-2 py-1" : "border border-line px-2 py-1 opacity-50"}>
                          <p className="font-display text-sm">Tier {row.tier} · {row.name}</p>
                          <p className="text-xs text-muted">{open ? "Unlocked. " : "Locked. "}{row.note}</p>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}

      {battle && (
        <>
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />
          <div className="pointer-events-none absolute inset-0 flex flex-col">
            <header className="flex items-start justify-between gap-2 p-3">
              <div className="pointer-events-auto flex items-center gap-2 bg-bg/40 px-2 py-1.5 backdrop-blur-sm">
                <img src="/brand/futuret3ch.png?v=2" alt="" className="h-10 w-10 object-contain" />
                <div>
                  <p className="font-display text-[10px] leading-none tracking-[0.2em] text-muted">SUPPORTED BY</p>
                  <p className="mt-1 font-display text-sm leading-none font-bold tracking-[0.14em] text-fg">FUTURET3CH</p>
                  <p className="mt-1 font-display text-xs tracking-[0.14em] text-ion">{chapterById(chapterRef.current).country}</p>
                  <p className="mt-1 font-display text-xl leading-none">{clock(hud?.time ?? 0)}</p>
                </div>
              </div>
              <div className="pointer-events-none max-w-sm text-center">
                {hud?.message && <p className="border border-line bg-bg/80 px-3 py-2 font-display text-lg text-fg">{hud.message}</p>}
                {hud?.low && <p className="mt-2 bg-ember px-3 py-1 font-display text-bg">Grid starved</p>}
                {hud?.attackArm && <p className="mt-2 bg-ion px-3 py-1 font-display text-bg">Attack-move — choose ground</p>}
                {hud?.abilityArm === "strike" && <p className="mt-2 bg-gold px-3 py-1 font-display text-bg">Ion strike — choose the ground</p>}
                {hud?.abilityArm === "nuke" && <p className="mt-2 bg-ember px-3 py-1 font-display text-bg">DEFCON — choose the ground</p>}
                {hud?.paused && <p className="mt-2 bg-gold px-3 py-1 font-display text-bg">Paused</p>}
                {toasts[0] && <p className="mt-2 border border-gold bg-bg/90 px-3 py-1 font-display text-gold">Achievement · {toasts[0].name}</p>}
              </div>
              <div className="pointer-events-auto flex flex-col items-end gap-2">
                <button type="button" onClick={() => setSettings(true)} className="min-h-11 border border-line bg-surface/90 px-3 font-display text-sm">Settings</button>
              <div className="border border-line bg-surface/90 px-3 py-2 text-right">
                <p className="font-display text-2xl leading-none text-gold">{hud?.credits ?? 0}</p>
                <p className="text-xs text-muted">cap {hud?.cap ?? 0}</p>
                <p className={hud?.low ? "font-display text-ember" : "font-display text-ion"}>
                  <Zap className="mr-1 inline size-3" />
                  {hud?.prod ?? 0}/{hud?.use ?? 0}
                </p>
                <button type="button" onClick={() => setTiersOpen(true)} className="mt-2 min-h-9 w-full border border-line px-2 font-display text-xs">
                  Tier map
                </button>
                <button type="button" onClick={() => setAbilitiesOpen((open) => !open)} className="mt-1 min-h-9 w-full border border-line px-2 font-display text-xs">
                  {abilitiesOpen ? "Close abilities" : "Abilities"}
                </button>
                {abilitiesOpen && (
                  <div className="mt-2 grid gap-1 text-left">
                    <button type="button" onClick={() => { simRef.current?.armAbility("strike"); setHud(simRef.current?.snapshot() ?? null); }} className="min-h-8 border border-line px-2 font-display text-[11px]">
                      Ion strike {hud && hud.ability.strike > 0 ? `${Math.ceil(hud.ability.strike)}s` : "400"}
                    </button>
                    <button type="button" onClick={() => { simRef.current?.armAbility("dome"); setHud(simRef.current?.snapshot() ?? null); }} className="min-h-8 border border-line px-2 font-display text-[11px]">
                      Shield dome {hud && hud.ability.dome > 0 ? `${Math.ceil(hud.ability.dome)}s` : "500"}
                    </button>
                    <button type="button" onClick={() => { simRef.current?.armAbility("nuke"); setHud(simRef.current?.snapshot() ?? null); }} className="min-h-8 border border-line px-2 font-display text-[11px] text-ember">
                      DEFCON {hud && hud.ability.nuke > 0 ? `${Math.ceil(hud.ability.nuke)}s` : "1400"}
                    </button>
                  </div>
                )}
              </div>
              </div>
            </header>

            <div className="flex min-h-0 flex-1">
              <div className="flex-1" />
              <aside className="pointer-events-auto m-3 hidden w-56 flex-col gap-2 overflow-y-auto border border-line bg-surface/90 p-2 md:flex">
                <p className="px-1 font-display text-xs tracking-[0.18em] text-muted">RAISE</p>
                {BUILD_MENU.map((k) => (
                  <BuildButton key={k} kind={k} hud={hud} onClick={() => simRef.current?.armPlace(k)} />
                ))}
                <p className="px-1 pt-2 font-display text-xs tracking-[0.18em] text-muted">TRAIN</p>
                {UNIT_MENU.map((k) => (
                  <BuildButton key={k} kind={k} hud={hud} onClick={() => simRef.current?.armPlace(k)} />
                ))}
              </aside>
            </div>

            {flyover && phase === "battle" && (
              <div className="pointer-events-none px-4 pb-2 text-center">
                <p className="font-display text-2xl text-fg md:text-3xl">{introLine}</p>
              </div>
            )}

            <footer className="flex items-end gap-2 p-3">
              <canvas
                ref={miniRef}
                width={180}
                height={120}
                onPointerDown={onMini}
                className="pointer-events-auto h-24 w-32 border border-line bg-bg md:h-32 md:w-44"
              />
              <SelectionCard hud={hud} onStop={() => simRef.current?.stop()} onRepair={() => simRef.current?.toggleRepair()} onSell={() => simRef.current?.sell()} onUpgrade={(wing) => simRef.current?.upgradeWing(0, wing)} onAmove={() => {
                const sim = simRef.current;
                if (!sim) return;
                sim.attackArm = !sim.attackArm;
                sim.uiDirty = true;
                setHud(sim.snapshot());
              }} />
              <div className="pointer-events-auto ml-auto flex gap-2">
                {phase === "battle" && flyover && (
                  <button
                    type="button"
                    onClick={() => {
                      modeRef.current = "play";
                      const p = simRef.current?.pois;
                      if (p) {
                        camRef.current.x = p.player.x + 160;
                        camRef.current.y = p.player.y - 160;
                        camRef.current.z = 0.92;
                      }
                      setFlyover(false);
                    }}
                    className="min-h-11 border border-line bg-surface px-3 font-display"
                  >
                    Skip
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    pauseRef.current = !pauseRef.current;
                    if (simRef.current) {
                      simRef.current.paused = pauseRef.current;
                      setHud(simRef.current.snapshot());
                    }
                  }}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center border border-line bg-surface"
                  aria-label="Pause"
                >
                  <Pause className="size-4" />
                </button>
              </div>
            </footer>
            <div className="pointer-events-auto flex gap-2 overflow-x-auto px-3 pb-3 md:hidden">
              {[...BUILD_MENU, ...UNIT_MENU].map((k) => (
                <BuildButton key={k} kind={k} hud={hud} compact onClick={() => simRef.current?.armPlace(k)} />
              ))}
            </div>
          </div>
        </>
      )}

      {(phase === "win" || phase === "lose") && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg/70 p-4">
          <div className="w-full max-w-md border border-line bg-surface p-6">
            <p className="font-display text-sm tracking-[0.2em] text-ion">{phase === "win" ? "HORIZON HELD" : "HORIZON LOST"}</p>
            <h2 className="font-display text-4xl font-semibold">{phase === "win" ? "Vesper spire is dust." : "The spire fell."}</h2>
            <p className="mt-2 text-muted">{phase === "win" ? `Held in ${clock(hud?.time ?? 0)}. ${chapterById(chapterRef.current).theater} is yours.` : "Rebuild the grid and try the ridge again."}</p>
            {best && phase === "win" && <p className="mt-1 text-sm text-gold">Best {clock(best)}</p>}
            {earned.length > 0 && (
              <ul className="mt-3 space-y-1">
                {earned.map((badge) => (
                  <li key={badge.id} className="border border-gold/50 px-2 py-1">
                    <p className="font-display text-gold">{badge.name}</p>
                    <p className="text-xs text-muted">{badge.detail}</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              {phase === "win" && (
                <button type="button" onClick={() => setHudson(chapterById(chapterRef.current))} className="min-h-11 bg-gold px-4 font-display text-bg">
                  Hudson
                </button>
              )}
              <button type="button" onClick={() => deploy()} className="min-h-11 bg-ion px-4 font-display text-bg">
                Redeploy
              </button>
              <button
                type="button"
                onClick={() => {
                  setPhase("title");
                  phaseRef.current = "title";
                }}
                className="min-h-11 border border-line px-4 font-display"
              >
                Title
              </button>
            </div>
          </div>
        </div>
      )}

      {!battle && (
        <button type="button" onClick={toggleMute} className="absolute top-4 right-4 z-10 inline-flex min-h-11 min-w-11 items-center justify-center border border-line bg-surface/80" aria-label={muted ? "Sound on" : "Mute"}>
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
      )}
      <SettingsPanel
        open={settings}
        onClose={() => setSettings(false)}
        onSave={(index) => {
          const sim = simRef.current;
          if (!sim) return null;
          const slot: SaveSlot = { name: `Slot ${index + 1}`, savedAt: Date.now(), time: sim.time, blob: sim.exportState() };
          writeSave(index, slot);
          return slot;
        }}
        onLoad={(slot) => {
          const blob = slot.blob as { time: number; credits: number[]; nextId: number; winner: 0 | 1 | null; ion: number[]; ents: [] };
          if (!simRef.current) {
            const sim = new Sim(chapterRef.current);
            simRef.current = sim;
            phaseRef.current = "battle";
            setPhase("battle");
            setBattleKey((k) => k + 1);
          }
          simRef.current?.importState(blob);
          setHud(simRef.current?.snapshot() ?? null);
          setSettings(false);
        }}
        musicOn={musicOn}
        onMusic={(on) => {
          musicOnRef.current = on;
          setMusicOn(on);
          if (on) sfx.current.startScore();
          else sfx.current.stopScore();
        }}
      />
      <img src="/brand/t3x-coin.png" alt="T3x" className="pointer-events-none absolute right-3 bottom-36 z-40 h-16 w-16 object-contain drop-shadow-[0_6px_16px_rgba(0,0,0,0.65)] md:right-4 md:bottom-40 md:h-20 md:w-20" />
    </main>
  );
}

function BuildButton({ kind, hud, onClick, compact }: { kind: Kind; hud: HudSnap | null; onClick: () => void; compact?: boolean }) {
  const def = DEFS[kind];
  const Icon = ICONS[kind];
  const on = hud?.unlocked[kind] ?? false;
  const afford = hud?.afford[kind] ?? false;
  const active = hud?.place === kind;
  const pct = hud?.making[kind];
  return (
    <button
      type="button"
      disabled={!on}
      onClick={onClick}
      title={`${def.name} — ${def.cost} ionite. ${def.blurb}`}
      className={
        "relative flex min-h-11 items-center gap-2 border px-2 text-left " +
        (active ? "border-ion bg-surface-2 text-fg " : "border-line bg-bg/40 text-fg ") +
        (on && afford ? "" : "opacity-50 ") +
        (compact ? "min-w-11 shrink-0 justify-center" : "w-full")
      }
    >
      <Icon className="size-4 shrink-0 text-ion" />
      {!compact && (
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-base leading-tight">{def.name}</span>
          <span className="block text-xs text-gold">
            T{def.tier ?? 1} · {def.cost}
          </span>
        </span>
      )}
      {pct !== undefined && <span className="absolute bottom-0 left-0 h-0.5 bg-ion" style={{ width: `${Math.round(pct * 100)}%` }} />}
    </button>
  );
}

function SelectionCard({
  hud,
  onStop,
  onRepair,
  onSell,
  onAmove,
  onUpgrade,
}: {
  hud: HudSnap | null;
  onStop: () => void;
  onRepair: () => void;
  onSell: () => void;
  onAmove: () => void;
  onUpgrade: (wing: TechWing) => void;
}) {
  const sel = hud?.selected ?? [];
  const first = sel[0];
  const wing = first && (first.kind === "barracks" || first.kind === "bay" || first.kind === "strip" || first.kind === "spire") ? first.kind : null;
  const tier = wing && hud ? hud.tech[wing] : 1;
  const up = wing ? nextUpgradeCost(tier) : null;
  const title = first && sel.length === 1 ? (wing ? structureTitle(first.kind, tier) : DEFS[first.kind].name) : "";
  return (
    <div className="pointer-events-auto flex min-w-0 flex-1 items-center gap-3 border border-line bg-surface/90 px-3 py-2">
      {first ? (
        <>
          <div className="min-w-0">
            <p className="truncate font-display text-lg leading-tight">{sel.length > 1 ? `${sel.length} selected` : title}</p>
            <p className="truncate text-xs text-muted">{sel.length > 1 ? "Move them as a line." : wing ? `Tier ${tier} of 4. ${DEFS[first.kind].blurb}` : DEFS[first.kind].blurb}</p>
            {sel.length === 1 && (
              <div className="mt-1 h-1.5 w-28 bg-bg">
                <div className="h-full bg-ion" style={{ width: `${Math.max(0, (first.hp / first.maxHp) * 100)}%` }} />
              </div>
            )}
            {first.shield > 0 && <p className="text-xs text-ion">Shield {Math.floor(first.shield)}</p>}
            {first.building && first.queue.length > 0 && (
              <p className="text-xs text-gold">
                {DEFS[first.queue[0].kind].name} {Math.max(0, Math.ceil(first.queue[0].left))}s
                {first.queue.length > 1 ? ` +${first.queue.length - 1}` : ""}
              </p>
            )}
          </div>
          <div className="ml-auto flex gap-2">
            {wing && up !== null && first.team === 0 && (
              <button type="button" onClick={() => onUpgrade(wing)} className="min-h-11 border border-gold px-2 font-display text-gold">
                Upgrade {up}
              </button>
            )}
            {!first.building && (
              <button type="button" onClick={onStop} className="inline-flex min-h-11 min-w-11 items-center justify-center border border-line" aria-label="Stop">
                <Square className="size-4" />
              </button>
            )}
            <button type="button" onClick={onAmove} className="inline-flex min-h-11 items-center gap-1 border border-line px-2 font-display" aria-label="Attack move">
              <Sword className="size-4" />
              <span className="hidden sm:inline">A-move</span>
            </button>
            {first.building && first.team === 0 && (
              <>
                <button type="button" onClick={onRepair} className="inline-flex min-h-11 min-w-11 items-center justify-center border border-line" aria-label="Repair">
                  <Wrench className={"size-4 " + (first.repairOn ? "text-ion" : "")} />
                </button>
                {first.kind !== "spire" && (
                  <button type="button" onClick={onSell} className="min-h-11 border border-line px-2 font-display text-ember">
                    Sell
                  </button>
                )}
              </>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">Select a unit or structure. Right-click ground to move, a foundry rally, or an enemy to fire.</p>
      )}
    </div>
  );
}
