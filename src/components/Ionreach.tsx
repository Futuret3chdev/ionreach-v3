import { useEffect, useRef, useState } from "react";
import {
  Box,
  Crosshair,
  Database,
  Factory,
  Hexagon,
  Pause,
  Maximize2,
  Minimize2,
  EyeOff,
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
import { BUILD_MENU, DEFS, TIER_MAP, WORLD_H, WORLD_W, nextUpgradeCost, structureTitle, type Kind, type TechWing } from "@/game/content";
import { Sfx } from "@/game/audio";
import { Renderer, type Cam } from "@/game/render";
import { Sim, type HudSnap } from "@/game/sim";
import { SettingsPanel } from "@/components/SettingsPanel";
import { Briefing } from "@/components/Briefing";
import { SkirmishNet } from "@/components/SkirmishNet";
import { Hudson } from "@/components/Hudson";
import { chapterById, countryOf, isOpen, nextPlayable, type Chapter } from "@/game/campaign";
import { mapById, serverById, type SkirmishSetup } from "@/game/skirmish";
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
  const pickModeRef = useRef(false);
  const lastPick = useRef({ id: 0, at: 0 });
  const [pickMode, setPickMode] = useState(false);
  const [tray, setTray] = useState<Tray>("base");
  const [chrome, setChrome] = useState(true);
  const [menuChrome, setMenuChrome] = useState(true);
  const [menuTool, setMenuTool] = useState<MenuTool | null>(null);
  const [settingsTab, setSettingsTab] = useState<"wallet" | "saves">("wallet");
  const [full, setFull] = useState(false);
  const [tools, setTools] = useState({ command: true, select: true, map: false, powers: false, match: false });
  const [yieldAsk, setYieldAsk] = useState(false);
  const [records, setRecords] = useState(false);
  const [skirmish, setSkirmish] = useState(false);
  const [trailerChoice, setTrailerChoice] = useState(false);
  const [midChoice, setMidChoice] = useState(false);
  const pendingLoad = useRef(false);
  const [earned, setEarned] = useState<Badge[]>([]);
  const [toasts, setToasts] = useState<Badge[]>([]);
  const chapterRef = useRef("usa-01");
  const setupRef = useRef<SkirmishSetup | null>(null);
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
    const doc = document as Document & { webkitFullscreenElement?: Element };
    const onFull = () => setFull(!!(document.fullscreenElement || doc.webkitFullscreenElement || document.documentElement.classList.contains("ios-full")));
    document.addEventListener("fullscreenchange", onFull);
    document.addEventListener("webkitfullscreenchange", onFull);
    const onResize = () => {
      if (document.documentElement.classList.contains("ios-full")) fitScreen();
    };
    window.visualViewport?.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("scroll", onResize);
    return () => {
      document.removeEventListener("fullscreenchange", onFull);
      document.removeEventListener("webkitfullscreenchange", onFull);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("scroll", onResize);
    };
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
        pr.drag && pr.button === 0 && (!pr.touch || pickModeRef.current)
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
      if (pointer.current.drag && (pointer.current.button === 2 || (pointer.current.touch && !pickModeRef.current))) {
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
      if (touch && dragged && !pickModeRef.current) return;
      if (touch && dragged && pickModeRef.current) {
        simNow.selectBox(pointer.current.wx, pointer.current.wy, world.x, world.y, e.shiftKey);
        setHud(simNow.snapshot());
        return;
      }
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
        const now = performance.now();
        if (hit && hit.team === 0 && lastPick.current.id === hit.id && now - lastPick.current.at < 420) {
          simNow.selectSame(hit.kind);
          lastPick.current = { id: 0, at: 0 };
          setHud(simNow.snapshot());
          return;
        }
        lastPick.current = { id: hit?.id ?? 0, at: now };
        if (hit && hit.team === 0) simNow.selectAt(world.x, world.y, pickModeRef.current);
        else if (own) simNow.command(world.x, world.y, "smart");
        else simNow.selectAt(world.x, world.y, false);
        return;
      }
      if (!dragged) {
        const hit = simNow.pickAt(world.x, world.y);
        const now = performance.now();
        if (hit && hit.team === 0 && lastPick.current.id === hit.id && now - lastPick.current.at < 420) {
          simNow.selectSame(hit.kind);
          lastPick.current = { id: 0, at: 0 };
          setHud(simNow.snapshot());
          return;
        }
        lastPick.current = { id: hit?.id ?? 0, at: now };
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

  function exitMatch() {
    pauseRef.current = false;
    modeRef.current = "play";
    setFlyover(false);
    setBrief(null);
    setMid(null);
    simRef.current = null;
    phaseRef.current = "title";
    setPhase("title");
    setMenuChrome(true);
    setMenuTool(null);
    setYieldAsk(false);
  }

  function deploy(id = chapterRef.current, setup: SkirmishSetup | null = null) {
    sfx.current.unlock();
    if (musicOnRef.current) sfx.current.startScore();
    chapterRef.current = setup ? mapById(setup.mapId).chapterId : id;
    setupRef.current = setup;
    midPlayed.current = false;
    setMid(null);
    setMidChoice(false);
    earnedRef.current = [];
    setEarned([]);
    setToasts([]);
    setBrief(null);
    setPicking(false);
    setSkirmish(false);
    setTrailerChoice(false);
    const sides = setup ? Number(setup.format[0]) : 1;
    const sim = new Sim(chapterRef.current, setup ? mapById(setup.mapId) : null, sides);
    if (setup) {
      const server = serverById(setup.serverId);
      sim.credits[0] = setup.startMoney;
      if (!setup.abilities) sim.ability = { strike: 9999, dome: 9999, nuke: 9999 };
      sim.say(`${server.name}. ${setup.format}. Team ${setup.team}. ${setup.startMoney} ionite. ${setup.abilities ? "Abilities on." : "Abilities off."} Room ${setup.room}.`);
    }
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

  function isIphone() {
    return /iPhone|iPod/.test(navigator.userAgent);
  }

  function fitScreen() {
    const view = window.visualViewport;
    const h = Math.round(view?.height ?? window.innerHeight);
    document.documentElement.style.setProperty("--app-h", `${h}px`);
  }

  function enterIphoneFull() {
    const root = document.documentElement;
    root.classList.add("ios-full");
    root.style.minHeight = "100vh";
    document.body.style.minHeight = "100vh";
    setFull(true);
    window.scrollTo(0, 0);
    window.setTimeout(() => {
      window.scrollTo(0, 1);
      window.setTimeout(() => {
        fitScreen();
        window.scrollTo(0, 0);
      }, 80);
    }, 30);
  }

  function leaveIphoneFull() {
    const root = document.documentElement;
    root.classList.remove("ios-full");
    root.style.minHeight = "";
    document.body.style.minHeight = "";
    setFull(!!(document.fullscreenElement || (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement));
  }

  async function toggleFull() {
    const root = document.documentElement;
    const doc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void> };
    if (isIphone()) {
      if (root.classList.contains("ios-full")) leaveIphoneFull();
      else enterIphoneFull();
      return;
    }
    const native = document.fullscreenElement || doc.webkitFullscreenElement;
    if (native) {
      const exit = document.exitFullscreen?.bind(document) ?? doc.webkitExitFullscreen?.bind(document);
      await exit?.().catch(() => undefined);
      leaveIphoneFull();
      return;
    }
    const el = root as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    const req = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
    if (req) {
      try {
        await req();
        setFull(true);
        return;
      } catch {
        enterIphoneFull();
        return;
      }
    }
    enterIphoneFull();
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
    <main className={"relative h-dvh w-full overflow-hidden bg-bg text-fg " + (full ? "h-[var(--app-h,100dvh)]" : "")}>
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
      {!battle && !menuChrome && (
        <div className="open-screen absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-20 flex items-center gap-2">
          <button type="button" onClick={toggleMute} className="inline-flex min-h-11 min-w-11 items-center justify-center border border-line bg-bg/90" aria-label={muted ? "Sound on" : "Mute"}>
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
          <button type="button" onClick={toggleFull} className="inline-flex min-h-11 min-w-11 items-center justify-center border border-line bg-bg/90" aria-label="Full screen">
            {full ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
          <button type="button" onClick={() => setMenuChrome(true)} className="min-h-11 border border-ion bg-bg/90 px-3 font-display text-ion">
            Menu
          </button>
        </div>
      )}
      {!battle && menuChrome && (
        <div className="open-menu absolute inset-0 z-10 flex flex-col bg-[#07101c]/95">
          <header className="flex h-12 shrink-0 items-center gap-2 overflow-x-auto px-3">
            <div className="min-w-0">
              <p className="truncate font-display text-sm leading-tight">IONREACH</p>
              <p className="truncate text-[11px] tracking-[0.16em] text-ion">GLASS HORIZON</p>
            </div>
            <button type="button" onClick={toggleMute} className="ml-auto inline-flex min-h-9 min-w-9 items-center justify-center border border-line" aria-label={muted ? "Sound on" : "Mute"}>
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
            <button type="button" onClick={toggleFull} className="inline-flex min-h-9 min-w-9 items-center justify-center border border-line" aria-label="Full screen">
              {full ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
            <button type="button" onClick={() => setMenuChrome(false)} className="inline-flex min-h-9 min-w-9 items-center justify-center border border-line" aria-label="Hide menu">
              <EyeOff className="size-4" />
            </button>
          </header>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {!menuTool ? (
              <nav className="flex flex-1 flex-col justify-center gap-2 px-4 pb-8">
                {(
                  [
                    ["campaign", "Campaign"],
                    ["multi", "Multiplayer"],
                    ["settings", "Settings"],
                    ["manual", "Manual"],
                    ["records", "Achievements"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      if (id === "settings") setSettingsTab("wallet");
                      setMenuTool(id);
                    }}
                    className="min-h-12 border border-[#9aabba] bg-gradient-to-b from-[#3a4654] to-[#141a22] font-display text-lg tracking-[0.22em] uppercase"
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setSettingsTab("saves");
                    setMenuTool("settings");
                  }}
                  className="min-h-12 border border-[#9aabba] bg-gradient-to-b from-[#3a4654] to-[#141a22] font-display text-lg tracking-[0.22em] uppercase"
                >
                  Load
                </button>
                <p className="pt-2 text-center text-xs text-muted">Hide the menu to watch the trailer behind it.</p>
              </nav>
            ) : (
              <button type="button" onClick={() => setMenuTool(null)} className="m-3 min-h-11 self-start border border-line px-3 font-display">
                Back
              </button>
            )}
            {menuTool === "campaign" && (
              <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
                <div className="flex flex-col gap-2">
                  {COUNTRY_IDS.map((id) => {
                    const chapters = countryOf(id);
                    const on = pickingCountry === id;
                    const fact = ARMY[id];
                    return (
                      <section key={id} className={on ? "border border-ion" : "border border-line"}>
                        <button type="button" onClick={() => setPickingCountry(on ? null : id)} className="flex w-full items-center gap-3 p-2 text-left">
                          <Flag id={id} className="h-12 w-20 shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-display text-lg">{chapters[0]?.country}</span>
                            <span className="block text-xs text-muted">{chapters.length} chapters{on ? "" : " · open"}</span>
                          </span>
                        </button>
                        {on && fact && (
                          <div className="border-t border-line px-3 py-3">
                            <p className="font-display text-xs tracking-[0.16em] text-ion">PUBLIC RECORD</p>
                            <p className="mt-1 text-sm text-muted">{fact.line}</p>
                            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <dt className="text-[11px] text-muted">People</dt>
                                <dd className="font-display">{fact.people}</dd>
                              </div>
                              <div>
                                <dt className="text-[11px] text-muted">Active force</dt>
                                <dd className="font-display">{fact.active}</dd>
                              </div>
                              <div className="col-span-2">
                                <dt className="text-[11px] text-muted">Services</dt>
                                <dd>{fact.services}</dd>
                              </div>
                            </dl>
                            <div className="mt-3 flex flex-col gap-2">
                              {chapters.map((chapter, index, list) => {
                                void storyTick;
                                const open = isOpen(list, index);
                                return (
                                  <article key={chapter.id} className="border border-line bg-[#101820] p-2">
                                    <p className="font-display text-[10px] tracking-[0.14em] text-ion">
                                      CHAPTER {chapter.index}
                                      {!open ? " · SEALED" : ""}
                                    </p>
                                    <p className="font-display text-sm">{chapter.theater}</p>
                                    <p className="mt-1 text-[11px] text-muted">{open ? chapter.line : "Watch the previous film, or win that fight."}</p>
                                    <div className="mt-2 flex gap-1">
                                      <button type="button" disabled={!chapter.video} onClick={() => { if (!chapter.video) return; setMenuTool(null); setBrief(chapter); }} className="min-h-8 border border-line px-2 font-display text-xs disabled:text-muted">Watch</button>
                                      <button type="button" disabled={!open || !chapter.video} onClick={() => { if (!open || !chapter.video) return; setMenuTool(null); setBrief(chapter); }} className="min-h-8 bg-ion px-2 font-display text-xs text-bg disabled:bg-line disabled:text-muted">Play</button>
                                    </div>
                                  </article>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              </div>
            )}
            {menuTool === "multi" && (
              <SkirmishNet dock onClose={() => setMenuTool(null)} onHost={(setup) => deploy(chapterRef.current, setup)} />
            )}
            {menuTool === "settings" && (
              <SettingsPanel
                open
                dock
                initialTab={settingsTab}
                onClose={() => setMenuTool(null)}
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
                  setMenuTool(null);
                  setSettings(false);
                  setBrief(null);
                  pendingLoad.current = false;
                }}
                musicOn={musicOn}
                onMusic={(on) => {
                  musicOnRef.current = on;
                  setMusicOn(on);
                  if (on) sfx.current.startScore();
                  else sfx.current.stopScore();
                }}
              />
            )}
            {menuTool === "manual" && (
              <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3 text-sm text-muted">
                <li>Hide this menu to watch the trailer behind it. Menu brings the list back.</li>
                <li>In a fight, the top bar and the bottom dock hide together. Show panels brings them back.</li>
                <li>Select on the battle bar draws a box. Shift-click adds. Drag pans when Select is off.</li>
                <li>Show or hide Command, Selection, Map, and Powers under the map.</li>
                <li>Q or A-move, then click, is attack-move. H holds. R repairs. X scraps a building.</li>
                <li>Win by destroying the enemy command spire.</li>
              </ul>
            )}
            {menuTool === "records" && (
              <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-3">
                {allBadges().map(({ badge, owned }) => (
                  <li key={badge.id} className={owned ? "border border-gold/50 px-2 py-1" : "border border-line px-2 py-1 opacity-50"}>
                    <p className="font-display text-sm">{badge.name}</p>
                    <p className="text-[11px] text-muted">{owned ? "Earned. " : "Locked. "}{badge.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {cinema && (
        <div className="absolute inset-0 z-30 bg-bg">
          <video ref={cutRef} className="h-full w-full object-contain" src="/media/trailer.mp4?v=9" autoPlay playsInline poster="/media/poster.jpg" onEnded={() => setTrailerChoice(true)} />
          <button type="button" onClick={() => { setTrailerChoice(false); closeCinema(); }} className="absolute top-3 left-3 z-30 min-h-11 border border-line bg-bg px-4 font-display">Back to menu</button>
          <div className="absolute inset-x-0 bottom-0 z-30 flex flex-wrap items-center gap-2 border-t border-line bg-bg px-3 py-3">
            <button type="button" onClick={() => { setTrailerChoice(false); closeCinema(); }} className="min-h-11 border border-line bg-surface px-4 font-display">Back to menu</button>
            <button type="button" onClick={() => { pendingLoad.current = true; setSettings(true); }} className="min-h-11 border border-line px-3 font-display">Load saved game</button>
            <button type="button" disabled={!trailerChoice} onClick={() => { setTrailerChoice(false); closeCinema(); setMenuTool("campaign"); setMenuChrome(true); }} className="min-h-11 bg-ion px-4 font-display text-bg disabled:cursor-not-allowed disabled:bg-line disabled:text-muted">Play now</button>
            {!trailerChoice && <button type="button" onClick={() => setTrailerChoice(true)} className="min-h-11 border border-line px-3 font-display">Skip to choice</button>}
          </div>
        </div>
      )}

      {brief && (
        <Briefing
          chapter={brief}
          locked={!isOpen(countryOf(brief.countryId), countryOf(brief.countryId).findIndex((c) => c.id === brief.id))}
          onBack={() => {
            setBrief(null);
            setMenuTool("campaign"); setMenuChrome(true);
          }}
          onPlay={(watched) => {
            const list = countryOf(brief.countryId);
            if (!isOpen(list, list.findIndex((c) => c.id === brief.id))) return;
            if (watched) {
              markWatched(brief.id);
              setStoryTick((n) => n + 1);
            }
            deploy(brief.id);
          }}
          onLoad={() => {
            pendingLoad.current = true;
            setSettings(true);
          }}
        />
      )}

      {mid && (
        <div className="absolute inset-0 z-30 bg-black">
          <video className="h-full w-full bg-black object-contain" src={`/media/briefings/${mid}.mp4`} autoPlay playsInline onEnded={() => setMidChoice(true)} />
          <button type="button" onClick={() => { setMid(null); setMidChoice(false); setPhase("title"); phaseRef.current = "title"; setMenuTool("campaign"); setMenuChrome(true); }} className="absolute top-3 left-3 z-30 min-h-11 border border-line bg-bg px-4 font-display">Back to menu</button>
          <div className="absolute inset-x-0 bottom-0 z-30 flex flex-wrap items-center gap-2 border-t border-line bg-bg px-3 py-3">
            <button type="button" onClick={() => { setMid(null); setMidChoice(false); setPhase("title"); phaseRef.current = "title"; setMenuTool("campaign"); setMenuChrome(true); }} className="min-h-11 border border-line bg-surface px-4 font-display">Back to menu</button>
            <button type="button" onClick={() => { pendingLoad.current = true; setSettings(true); }} className="min-h-11 border border-line px-3 font-display">Load saved game</button>
            <button type="button" disabled={!midChoice} onClick={() => { pauseRef.current = false; if (simRef.current) simRef.current.paused = false; setMid(null); setMidChoice(false); }} className="min-h-11 bg-ion px-4 font-display text-bg disabled:cursor-not-allowed disabled:bg-line disabled:text-muted">Play now</button>
            {!midChoice && <button type="button" onClick={() => setMidChoice(true)} className="min-h-11 border border-line px-3 font-display">Skip to choice</button>}
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
            setMenuTool("campaign"); setMenuChrome(true);
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
        <div className="absolute inset-0 flex flex-col bg-bg">
          <header className={(chrome ? "flex " : "hidden ") + "h-12 shrink-0 items-center gap-2 overflow-x-auto border-b border-[#1e3a5f] bg-[#07101c] px-2"}>
              <Flag id={chapterById(chapterRef.current).countryId} className="h-6 w-9 shrink-0" />
              <div className="min-w-0">
                <p className="truncate font-display text-xs leading-tight">
                  {chapterById(chapterRef.current).country} · {clock(hud?.time ?? 0)}
                </p>
                <p className="truncate text-[11px] text-ion">{hud?.objective || hud?.message || "Hold the horizon"}</p>
              </div>
              <p className="ml-auto font-display text-sm text-gold">{hud?.credits ?? 0}</p>
              <p className={hud?.low ? "font-display text-xs text-ember" : "font-display text-xs text-ion"}>{hud?.prod ?? 0}/{hud?.use ?? 0}</p>
              <button
                type="button"
                onClick={() => {
                  pickModeRef.current = !pickModeRef.current;
                  setPickMode(pickModeRef.current);
                }}
                aria-pressed={pickMode}
                className={"min-h-9 border px-2 font-display text-xs " + (pickMode ? "border-ion bg-ion text-bg" : "border-line")}
              >
                Select
              </button>
              <button
                type="button"
                onClick={() => {
                  pauseRef.current = !pauseRef.current;
                  if (simRef.current) {
                    simRef.current.paused = pauseRef.current;
                    setHud(simRef.current.snapshot());
                  }
                }}
                className="inline-flex min-h-9 min-w-9 items-center justify-center border border-line"
                aria-label="Pause"
              >
                <Pause className="size-4" />
              </button>
              <button type="button" onClick={() => setSettings(true)} className="min-h-9 border border-line px-2 font-display text-xs">
                Settings
              </button>
              <button type="button" onClick={toggleFull} className="inline-flex min-h-9 min-w-9 items-center justify-center border border-line" aria-label="Full screen">
                {full ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </button>
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
                  className="min-h-9 border border-line px-2 font-display text-xs"
                >
                  Skip
                </button>
              )}
              <button type="button" onClick={() => setChrome(false)} className="inline-flex min-h-9 min-w-9 items-center justify-center border border-line" aria-label="Hide panels">
                <EyeOff className="size-4" />
              </button>
            </header>
          <div className="relative min-h-0 flex-1">
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />
            <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center px-3">
              <div className="flex flex-col items-center gap-1">
                {hud?.low && <p className="bg-ember px-3 py-1 font-display text-bg">Grid starved</p>}
                {hud?.attackArm && <p className="bg-ion px-3 py-1 font-display text-bg">Attack-move — choose ground</p>}
                {hud?.abilityArm === "strike" && <p className="bg-gold px-3 py-1 font-display text-bg">Ion strike — choose the ground</p>}
                {hud?.abilityArm === "nuke" && <p className="bg-ember px-3 py-1 font-display text-bg">DEFCON — choose the ground</p>}
                {hud?.paused && <p className="bg-gold px-3 py-1 font-display text-bg">Paused</p>}
                {flyover && phase === "battle" && <p className="font-display text-xl text-fg">{introLine}</p>}
                {toasts[0] && <p className="border border-gold bg-bg/90 px-3 py-1 font-display text-gold">Achievement · {toasts[0].name}</p>}
              </div>
            </div>
            {!chrome && (
              <button type="button" onClick={() => setChrome(true)} className="absolute top-2 right-2 min-h-11 border border-ion bg-bg/90 px-3 font-display text-ion">
                Show panels
              </button>
            )}
          </div>
          <footer className={(chrome ? "" : "hidden ") + "shrink-0 border-t border-[#1e3a5f] bg-[#07101c]"}>
              <div className="flex gap-1 overflow-x-auto px-2 py-1">
                {(
                  [
                    ["command", "Command"],
                    ["select", "Selection"],
                    ["map", "Map"],
                    ["powers", "Powers"],
                    ["match", "Match"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTools((cur) => ({ ...cur, [key]: !cur[key] }))}
                    className={"min-h-9 shrink-0 border px-2 font-display text-xs " + (tools[key] ? "border-ion bg-[#12343a] text-ion" : "border-line text-muted")}
                  >
                    {tools[key] ? "Hide " : "Show "}
                    {label}
                  </button>
                ))}
              </div>
              {tools.command && <CommandMenu tray={tray} onTray={setTray} hud={hud} onPick={(k) => simRef.current?.armPlace(k)} />}
              {tools.match && (
                <div className="flex flex-wrap gap-2 px-2 pb-2">
                  <button type="button" onClick={exitMatch} className="min-h-9 border border-line px-3 font-display text-xs">Exit</button>
                  <button type="button" onClick={() => { setYieldAsk(false); deploy(chapterRef.current, setupRef.current); }} className="min-h-9 border border-line px-3 font-display text-xs">Reset</button>
                  {!yieldAsk ? (
                    <button type="button" onClick={() => setYieldAsk(true)} className="min-h-9 border border-ember px-3 font-display text-xs text-ember">Surrender</button>
                  ) : (
                    <>
                      <button type="button" onClick={() => { simRef.current?.surrender(); setYieldAsk(false); }} className="min-h-9 bg-ember px-3 font-display text-xs text-bg">Confirm surrender</button>
                      <button type="button" onClick={() => setYieldAsk(false)} className="min-h-9 border border-line px-3 font-display text-xs">Stay</button>
                    </>
                  )}
                </div>
              )}
              <canvas
                ref={miniRef}
                width={180}
                height={120}
                onPointerDown={onMini}
                className={tools.map ? "m-2 h-24 w-32 border border-line bg-bg" : "pointer-events-none absolute h-0 w-0 opacity-0"}
              />
              {(tools.select || tools.powers) && (
                <div className="flex items-stretch gap-2 px-2 pb-2">
                  {tools.select && (
                    <SelectionCard hud={hud} onStop={() => simRef.current?.stop()} onRepair={() => simRef.current?.toggleRepair()} onSell={() => simRef.current?.sell()} onUpgrade={(wing) => simRef.current?.upgradeWing(0, wing)} onAmove={() => {
                      const sim = simRef.current;
                      if (!sim) return;
                      sim.attackArm = !sim.attackArm;
                      sim.uiDirty = true;
                      setHud(sim.snapshot());
                    }} />
                  )}
                  {tools.powers && (
                    <div className="grid shrink-0 content-start gap-1">
                      <button type="button" onClick={() => setTiersOpen(true)} className="min-h-8 border border-line px-2 font-display text-[11px]">Tier map</button>
                      <button type="button" onClick={() => { simRef.current?.armAbility("strike"); setHud(simRef.current?.snapshot() ?? null); }} className="min-h-8 border border-line px-2 font-display text-[11px]">Ion strike {hud && hud.ability.strike > 0 ? `${Math.ceil(hud.ability.strike)}s` : "400"}</button>
                      <button type="button" onClick={() => { simRef.current?.armAbility("dome"); setHud(simRef.current?.snapshot() ?? null); }} className="min-h-8 border border-line px-2 font-display text-[11px]">Shield {hud && hud.ability.dome > 0 ? `${Math.ceil(hud.ability.dome)}s` : "500"}</button>
                      <button type="button" onClick={() => { simRef.current?.armAbility("nuke"); setHud(simRef.current?.snapshot() ?? null); }} className="min-h-8 border border-line px-2 font-display text-[11px] text-ember">DEFCON {hud && hud.ability.nuke > 0 ? `${Math.ceil(hud.ability.nuke)}s` : "1400"}</button>
                    </div>
                  )}
                </div>
              )}
            </footer>
        </div>
      )}

      {(phase === "win" || phase === "lose") && (
        <div className="absolute inset-0 z-20 overflow-y-auto overscroll-contain bg-bg/80">
          <div className="mx-auto w-full max-w-md px-4 pt-6 pb-24">
          <div className="border border-line bg-surface p-6">
            <p className="font-display text-sm tracking-[0.2em] text-ion">{phase === "win" ? "HORIZON HELD" : "HORIZON LOST"}</p>
            <h2 className="font-display text-4xl font-semibold">{phase === "win" ? "Vesper spire is dust." : "The spire fell."}</h2>
            <p className="mt-2 text-muted">{phase === "win" ? `Held in ${clock(hud?.time ?? 0)}. ${hud?.objective ?? chapterById(chapterRef.current).theater}` : "The objective failed. Rebuild and try the map again."}</p>
            {best && phase === "win" && <p className="mt-1 text-sm text-gold">Best {clock(best)}</p>}
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <p className="border border-line px-2 py-2">Enemies killed <span className="block font-display text-lg text-fg">{(simRef.current?.downed.men ?? 0) + (simRef.current?.downed.tanks ?? 0) + (simRef.current?.downed.planes ?? 0)}</span></p>
              <p className="border border-line px-2 py-2">Men lost <span className="block font-display text-lg text-fg">{simRef.current?.lost.men ?? 0}</span></p>
              <p className="border border-line px-2 py-2">Tanks lost <span className="block font-display text-lg text-fg">{simRef.current?.lost.tanks ?? 0}</span></p>
              <p className="border border-line px-2 py-2">Aircraft lost <span className="block font-display text-lg text-fg">{simRef.current?.lost.planes ?? 0}</span></p>
              <p className="border border-line px-2 py-2">Structures built <span className="block font-display text-lg text-fg">{simRef.current?.built ?? 0}</span></p>
              <p className="border border-line px-2 py-2">Structures lost <span className="block font-display text-lg text-fg">{simRef.current?.lost.structures ?? 0}</span></p>
              <p className="border border-line px-2 py-2">Enemy structures down <span className="block font-display text-lg text-fg">{simRef.current?.downed.structures ?? 0}</span></p>
              <p className="border border-line px-2 py-2">Time <span className="block font-display text-lg text-fg">{clock(hud?.time ?? 0)}</span></p>
            </div>
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
        </div>
      )}

      <SettingsPanel
        open={settings && battle}
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
          setBrief(null);
          setMid(null);
          setMidChoice(false);
          setTrailerChoice(false);
          setCinema(false);
          pendingLoad.current = false;
        }}
        musicOn={musicOn}
        onMusic={(on) => {
          musicOnRef.current = on;
          setMusicOn(on);
          if (on) sfx.current.startScore();
          else sfx.current.stopScore();
        }}
      />
      {!battle && <img src="/brand/t3x-coin.png" alt="T3x" className="pointer-events-none absolute right-3 bottom-6 z-40 h-16 w-16 object-contain drop-shadow-[0_6px_16px_rgba(0,0,0,0.65)] md:right-4 md:h-20 md:w-20" />}
    </main>
  );
}

type Tray = "base" | "men" | "armor" | "air";
type MenuTool = "campaign" | "multi" | "settings" | "manual" | "records";

const COUNTRY_IDS = ["usa", "russia", "china", "australia", "korea", "japan", "uk", "india", "france", "brazil"];

const ARMY: Record<string, { line: string; people: string; active: string; services: string }> = {
  usa: {
    line: "The army dates to 1775. From both world wars to today, American forces keep ships and aircraft on every ocean.",
    people: "About 340 million",
    active: "About 1.3 million",
    services: "Army, Navy, Marine Corps, Air Force, Space Force, Coast Guard",
  },
  russia: {
    line: "The Red Army held the eastern front of the Second World War. Today's Ground Forces, Navy, and Aerospace Forces are its successor.",
    people: "About 144 million",
    active: "About 1.1 million",
    services: "Ground Forces, Navy, Aerospace Forces",
  },
  china: {
    line: "The People's Liberation Army was founded in 1927. By headcount it is the largest standing force in the world.",
    people: "About 1.4 billion",
    active: "About 2 million",
    services: "Ground Force, Navy, Air Force, Rocket Force",
  },
  australia: {
    line: "Australians landed at Gallipoli in 1915 and held the Kokoda Track in 1942. The Defence Force is a volunteer service.",
    people: "About 27 million",
    active: "About 60,000",
    services: "Army, Navy, Air Force",
  },
  korea: {
    line: "The Republic of Korea armed forces date to 1948, after the war of 1950–53. Men still serve a term of conscription.",
    people: "About 51 million",
    active: "About 500,000",
    services: "Army, Navy, Air Force, Marine Corps",
  },
  japan: {
    line: "The Self-Defense Forces have stood since 1954. The constitution limits them to the defense of Japan.",
    people: "About 123 million",
    active: "About 250,000",
    services: "Ground, Maritime, and Air Self-Defense Forces",
  },
  uk: {
    line: "Britain fought both world wars as a great power and still keeps a nuclear navy beside a standing army.",
    people: "About 68 million",
    active: "About 150,000 regulars",
    services: "Royal Navy, British Army, Royal Air Force",
  },
  india: {
    line: "Independent armed forces since 1947. India keeps one of the largest standing armies on earth.",
    people: "About 1.4 billion",
    active: "About 1.4 million",
    services: "Army, Navy, Air Force",
  },
  france: {
    line: "French forces fought both world wars and still keep a nuclear deterrent and the Foreign Legion.",
    people: "About 68 million",
    active: "About 200,000",
    services: "Army, Navy, Air and Space Force, Foreign Legion",
  },
  brazil: {
    line: "The Brazilian Expeditionary Force fought in Italy in 1944–45. Today Brazil fields the largest armed forces in Latin America.",
    people: "About 213 million",
    active: "About 360,000",
    services: "Army, Navy, Air Force",
  },
};

function Flag({ id, className }: { id: string; className?: string }) {
  const box = className ?? "block h-16 w-full";
  if (id === "usa") {
    return (
      <span className={box + " relative overflow-hidden"} style={{ background: "repeating-linear-gradient(#bf0a30 0 7.7%, #fff 7.7% 15.4%)" }} aria-hidden>
        <span className="absolute top-0 left-0 h-[54%] w-[40%] bg-[#002868]" />
      </span>
    );
  }
  if (id === "russia") return <span className={box} style={{ background: "linear-gradient(#fff 0 33%, #0039a6 33% 66%, #d52b1e 66%)" }} aria-hidden />;
  if (id === "china") {
    return (
      <span className={box + " relative bg-[#de2910]"} aria-hidden>
        <span className="absolute top-[18%] left-[18%] text-[10px] text-[#ffde00]">★</span>
      </span>
    );
  }
  if (id === "australia") {
    return (
      <span className={box + " relative bg-[#012169]"} aria-hidden>
        <span className="absolute top-0 left-0 h-1/2 w-[42%]" style={{ background: "linear-gradient(90deg,#012169,#c8102e 40%,#fff 40% 60%,#c8102e 60%,#012169)" }} />
        <span className="absolute right-[18%] bottom-[22%] size-1.5 rounded-full bg-white" />
      </span>
    );
  }
  if (id === "korea") {
    return (
      <span className={box + " relative bg-white"} aria-hidden>
        <span className="absolute top-1/2 left-1/2 h-[62%] w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/20" style={{ background: "linear-gradient(90deg,#cd2e3a 50%, #0047a0 50%)" }} />
      </span>
    );
  }
  if (id === "japan") {
    return (
      <span className={box + " relative bg-white"} aria-hidden>
        <span className="absolute top-1/2 left-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#bc002d]" />
      </span>
    );
  }
  if (id === "uk") {
    return (
      <span className={box + " relative overflow-hidden bg-[#012169]"} aria-hidden>
        <span className="absolute inset-x-0 top-1/2 h-[18%] -translate-y-1/2 bg-white" />
        <span className="absolute inset-y-0 left-1/2 w-[18%] -translate-x-1/2 bg-white" />
        <span className="absolute inset-x-0 top-1/2 h-[8%] -translate-y-1/2 bg-[#c8102e]" />
        <span className="absolute inset-y-0 left-1/2 w-[8%] -translate-x-1/2 bg-[#c8102e]" />
      </span>
    );
  }
  if (id === "india") return <span className={box} style={{ background: "linear-gradient(#ff9933 0 33%, #fff 33% 66%, #138808 66%)" }} aria-hidden />;
  if (id === "france") return <span className={box} style={{ background: "linear-gradient(90deg,#0055a4 0 33%, #fff 33% 66%, #ef4135 66%)" }} aria-hidden />;
  return (
    <span className={box + " relative bg-[#009c3b]"} aria-hidden>
      <span className="absolute top-1/2 left-1/2 h-[55%] w-[46%] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-[#ffdf00]" />
      <span className="absolute top-1/2 left-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#002776]" />
    </span>
  );
}

const TRAYS: { id: Tray; label: string; kinds: Kind[] }[] = [
  { id: "base", label: "Base", kinds: BUILD_MENU },
  { id: "men", label: "Men", kinds: ["rifle", "watch", "patrol", "grenadier", "sergeant", "specops", "rocket"] },
  { id: "armor", label: "Armor", kinds: ["harvester", "viper", "lancer", "reaver", "howl", "aegis", "bastion", "t3x"] },
  { id: "air", label: "Air", kinds: ["kestrel", "condor", "ionwing", "spectre"] },
];

function Mark({ kind }: { kind: Kind }) {
  if (kind === "kestrel") {
    return (
      <svg viewBox="0 0 64 32" className="h-8 w-12" aria-hidden>
        <path d="M58 16 L18 10 L8 6 L14 16 L8 26 L18 22 Z" fill="#d5dee6" />
        <path d="M14 16 L4 12 V20 Z" fill="#8ea0ae" />
      </svg>
    );
  }
  if (kind === "condor") {
    return (
      <svg viewBox="0 0 64 32" className="h-8 w-12" aria-hidden>
        <rect x="28" y="4" width="8" height="24" fill="#3a3228" />
        <ellipse cx="32" cy="16" rx="18" ry="5" fill="#6a5438" />
      </svg>
    );
  }
  if (kind === "ionwing") {
    return (
      <svg viewBox="0 0 64 32" className="h-8 w-12" aria-hidden>
        <path d="M54 16 L10 4 L18 16 L10 28 Z" fill="#3ee0c5" />
      </svg>
    );
  }
  if (kind === "spectre") {
    return (
      <svg viewBox="0 0 64 32" className="h-8 w-12" aria-hidden>
        <path d="M8 16 H48 L36 6 H20 Z M8 16 H48 L36 26 H20 Z" fill="#1a1e24" />
        <rect x="18" y="4" width="4" height="24" fill="#2a323c" />
      </svg>
    );
  }
  if (kind === "viper") {
    return (
      <svg viewBox="0 0 64 32" className="h-8 w-12" aria-hidden>
        <rect x="20" y="12" width="24" height="8" fill="#5c6770" />
        <circle cx="36" cy="16" r="3" fill="#1a2228" />
        <rect x="42" y="15" width="8" height="2" fill="#d5dee6" />
      </svg>
    );
  }
  if (kind === "lancer") {
    return (
      <svg viewBox="0 0 64 32" className="h-8 w-12" aria-hidden>
        <path d="M12 12 H40 L52 16 L40 20 H12 Z" fill="#5c6770" />
        <rect x="44" y="15" width="16" height="2" fill="#d5dee6" />
      </svg>
    );
  }
  if (kind === "reaver") {
    return (
      <svg viewBox="0 0 64 32" className="h-8 w-12" aria-hidden>
        <rect x="10" y="8" width="40" height="16" fill="#4a5560" />
        <rect x="10" y="12" width="8" height="8" fill="#1a201c" />
        <rect x="36" y="14" width="10" height="4" fill="#d5dee6" />
      </svg>
    );
  }
  if (kind === "howl") {
    return (
      <svg viewBox="0 0 64 32" className="h-8 w-12" aria-hidden>
        <rect x="12" y="10" width="36" height="12" fill="#6a7048" />
        <rect x="34" y="6" width="4" height="20" fill="#e8c56b" />
        <rect x="40" y="8" width="4" height="16" fill="#d5dee6" />
      </svg>
    );
  }
  if (kind === "aegis") {
    return (
      <svg viewBox="0 0 64 32" className="h-8 w-12" aria-hidden>
        <rect x="14" y="11" width="32" height="10" fill="#3a6a78" />
        <rect x="36" y="8" width="14" height="2" fill="#d5dee6" />
        <rect x="36" y="22" width="14" height="2" fill="#d5dee6" />
      </svg>
    );
  }
  if (kind === "bastion") {
    return (
      <svg viewBox="0 0 64 32" className="h-8 w-12" aria-hidden>
        <rect x="8" y="8" width="40" height="16" fill="#8a5a3a" />
        <rect x="40" y="14" width="18" height="4" fill="#d5dee6" />
      </svg>
    );
  }
  if (kind === "t3x") {
    return (
      <svg viewBox="0 0 64 32" className="h-8 w-12" aria-hidden>
        <rect x="8" y="8" width="40" height="16" fill="#c6a15a" />
        <rect x="40" y="14" width="16" height="3" fill="#d5dee6" />
        <text x="22" y="19" fill="#1a1408" fontSize="7" fontFamily="Rajdhani, sans-serif">T3X</text>
      </svg>
    );
  }
  if (kind === "harvester") {
    return (
      <svg viewBox="0 0 64 32" className="h-8 w-12" aria-hidden>
        <rect x="10" y="10" width="28" height="12" fill="#5c6770" />
        <rect x="30" y="12" width="16" height="8" fill="#3ee0c5" />
      </svg>
    );
  }
  if (kind === "rocket") {
    return (
      <svg viewBox="0 0 64 32" className="h-8 w-12" aria-hidden>
        <ellipse cx="24" cy="18" rx="7" ry="5" fill="#4a3828" />
        <rect x="28" y="14" width="18" height="4" fill="#3a4038" />
        <rect x="16" y="12" width="3" height="10" fill="#2a3036" />
      </svg>
    );
  }
  if (kind === "grenadier") {
    return (
      <svg viewBox="0 0 64 32" className="h-8 w-12" aria-hidden>
        <ellipse cx="24" cy="18" rx="7" ry="5" fill="#5a4030" />
        <circle cx="20" cy="22" r="2" fill="#3a6a38" />
        <rect x="28" y="16" width="12" height="2" fill="#2c3238" />
      </svg>
    );
  }
  if (kind === "sergeant") {
    return (
      <svg viewBox="0 0 64 32" className="h-8 w-12" aria-hidden>
        <ellipse cx="24" cy="18" rx="7" ry="5" fill="#2e4634" />
        <rect x="18" y="12" width="6" height="1.2" fill="#e8c56b" />
        <rect x="18" y="14.2" width="6" height="1.2" fill="#e8c56b" />
        <rect x="28" y="16" width="14" height="2" fill="#2a3036" />
      </svg>
    );
  }
  if (kind === "specops") {
    return (
      <svg viewBox="0 0 64 32" className="h-8 w-12" aria-hidden>
        <ellipse cx="24" cy="18" rx="7" ry="5" fill="#1a2228" />
        <rect x="22" y="14" width="4" height="2" fill="#7dffb2" />
        <rect x="28" y="16" width="10" height="2" fill="#14181c" />
      </svg>
    );
  }
  if (kind === "watch") {
    return (
      <svg viewBox="0 0 64 32" className="h-8 w-12" aria-hidden>
        <ellipse cx="24" cy="18" rx="7" ry="5" fill="#6a6238" />
        <circle cx="22" cy="12" r="2" fill="none" stroke="#d5dee6" />
        <circle cx="27" cy="12" r="2" fill="none" stroke="#d5dee6" />
      </svg>
    );
  }
  if (kind === "patrol") {
    return (
      <svg viewBox="0 0 64 32" className="h-8 w-12" aria-hidden>
        <ellipse cx="28" cy="16" rx="7" ry="5" fill="#3f6a40" />
        <ellipse cx="14" cy="22" rx="5" ry="3" fill="#6a5038" />
        <rect x="32" y="15" width="12" height="2" fill="#2a3036" />
      </svg>
    );
  }
  if (DEFS[kind].building) {
    return (
      <svg viewBox="0 0 64 32" className="h-8 w-12" aria-hidden>
        {kind === "wall" ? <rect x="6" y="14" width="52" height="8" fill="#8a7358" /> : null}
        {kind === "relay" ? <path d="M32 4 L36 28 H28 Z M20 28 H44" stroke="#d5dee6" fill="#3ee0c5" /> : null}
        {kind === "refinery" ? <path d="M8 26 V14 H22 V8 H28 V14 H56 V26 Z" fill="#8a7a58" /> : null}
        {kind === "barracks" ? <path d="M10 26 V12 H28 V8 H36 V12 H54 V26 Z" fill="#5a6a48" /> : null}
        {kind === "bay" ? <path d="M8 26 V10 H56 V26 H40 V16 H24 V26 Z" fill="#4a4038" /> : null}
        {kind === "strip" ? <path d="M4 18 H60 M18 12 H46 L40 22 H24 Z" stroke="#d5dee6" fill="#6a8aaa" /> : null}
        {kind === "turret" ? <path d="M20 24 H44 L40 16 H36 L48 8 H52 L34 16 H24 Z" fill="#6a6458" /> : null}
        {kind === "sam" ? <path d="M16 26 H48 L40 16 H36 L46 6 H50 L34 16 H24 Z" fill="#3a6a48" /> : null}
        {kind === "cannon" ? <path d="M14 22 H50 L46 14 H40 L58 10 H62 L38 14 H22 Z" fill="#5a4030" /> : null}
        {kind === "silo" ? <ellipse cx="32" cy="20" rx="12" ry="8" fill="#3a5a40" /> : null}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 32" className="h-8 w-12" aria-hidden>
      <ellipse cx="26" cy="18" rx="8" ry="5" fill="#3f6a40" />
      <circle cx="22" cy="12" r="5" fill="#2f5a34" />
      <rect x="20" y="14" width="14" height="3" fill="#2a3036" />
      <rect x="28" y="16" width="2" height="3" fill="#1a1e22" />
      <circle cx="24" cy="16" r="1.4" fill="#e4c2a2" />
    </svg>
  );
}

function MenuPlate({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-12 border border-[#9aabba] bg-gradient-to-b from-[#3a4654] to-[#141a22] px-4 font-display text-lg tracking-[0.22em] text-fg uppercase shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_2px_0_#07090c] hover:border-ion hover:text-ion"
    >
      {children}
    </button>
  );
}

function CommandMenu({
  tray,
  onTray,
  hud,
  onPick,
}: {
  tray: Tray;
  onTray: (tray: Tray) => void;
  hud: HudSnap | null;
  onPick: (kind: Kind) => void;
}) {
  const kinds = TRAYS.find((row) => row.id === tray)?.kinds ?? [];
  return (
    <div className="border border-[#8b98a6] bg-[#12161c]/95 p-1.5 shadow-[inset_0_0_0_1px_#2a313a,0_8px_24px_rgba(0,0,0,0.45)]">
      <div className="mb-1.5 grid grid-cols-4 gap-1">
        {TRAYS.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onTray(row.id)}
            className={
              "min-h-9 border font-display text-[10px] tracking-[0.14em] uppercase " +
              (tray === row.id
                ? "border-ion bg-[#1e3a34] text-ion shadow-[inset_0_0_12px_rgba(62,224,197,0.25)]"
                : "border-[#5c6874] bg-gradient-to-b from-[#2c3540] to-[#161b22] text-fg")
            }
          >
            {row.label}
          </button>
        ))}
      </div>
      <div className="flex gap-1 overflow-x-auto">
        {kinds.map((kind) => (
          <Cameo key={kind} kind={kind} hud={hud} onClick={() => onPick(kind)} />
        ))}
      </div>
    </div>
  );
}

function Cameo({ kind, hud, onClick }: { kind: Kind; hud: HudSnap | null; onClick: () => void }) {
  const def = DEFS[kind];
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
        "relative flex w-[76px] shrink-0 flex-col border bg-[#121820] text-left " +
        (active ? "animate-pulse border-ion " : "border-[#3a4654] ") +
        (on && afford ? "" : "opacity-40 ")
      }
    >
      <span className="flex h-12 items-center justify-center bg-[#1a2430]">
        <Mark kind={kind} />
      </span>
      <span className="truncate px-1 pt-0.5 font-display text-[10px] leading-tight">{def.name}</span>
      <span className="px-1 pb-0.5 font-display text-[10px] text-gold">{def.cost}</span>
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
