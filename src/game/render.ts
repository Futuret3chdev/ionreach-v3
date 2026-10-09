import { chapterById } from "./campaign";
import { COLS, DEFS, ROWS, TILE, WORLD_H, WORLD_W, type Kind } from "./content";
import { drawStructure } from "./structures";
import type { Ent, Sim } from "./sim";

export interface Cam {
  x: number;
  y: number;
  z: number;
}

export interface Ghost {
  kind: Kind;
  x: number;
  y: number;
  ok: boolean;
}

const ION = "#3ee0c5";
const EMBER = "#ff5a36";

export class Renderer {
  private terrain: HTMLCanvasElement | null = null;
  private fog: HTMLCanvasElement | null = null;
  private tctx: CanvasRenderingContext2D | null = null;
  private fctx: CanvasRenderingContext2D | null = null;
  private crest: CanvasImageSource | null = null;
  private crestStarted = false;

  ensure(sim: Sim): void {
    this.loadCrest();
    if (this.terrain) return;
    this.terrain = document.createElement("canvas");
    this.terrain.width = WORLD_W;
    this.terrain.height = WORLD_H;
    this.tctx = this.terrain.getContext("2d");
    this.fog = document.createElement("canvas");
    this.fog.width = COLS;
    this.fog.height = ROWS;
    this.fctx = this.fog.getContext("2d");
    if (!this.tctx) return;
    this.paintAll(sim);
  }

  consume(sim: Sim): void {
    if (!this.tctx || !sim.ionDirty.length) return;
    for (const d of sim.ionDirty) this.paintTile(this.tctx, sim, d.c, d.r);
    sim.ionDirty.length = 0;
  }

  private paintAll(sim: Sim): void {
    if (!this.tctx || !this.terrain) return;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) this.paintTile(this.tctx, sim, c, r);
    }
    const g = this.tctx.createLinearGradient(0, 0, WORLD_W, WORLD_H);
    g.addColorStop(0, "rgba(90,140,160,0.08)");
    g.addColorStop(0.45, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(30,8,16,0.32)");
    this.tctx.fillStyle = g;
    this.tctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }

  private paintTile(ctx: CanvasRenderingContext2D, sim: Sim, c: number, r: number): void {
    const i = r * COLS + c;
    const tile = sim.tiles[i];
    const n = sim.style[i];
    const x = c * TILE;
    const y = r * TILE;
    const chapter = chapterById(sim.chapterId);
    if (tile === 1) {
      const b = 28 + n * 24;
      ctx.fillStyle = `rgb(${b + 8},${b},${b + 12})`;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = chapter.snow ? "rgba(236,242,246,0.55)" : "rgba(255,214,170,0.16)";
      ctx.beginPath();
      ctx.moveTo(x + 4, y + TILE - 4);
      ctx.lineTo(x + TILE / 2, y + 3);
      ctx.lineTo(x + TILE - 4, y + TILE - 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(x, y + TILE - 5, TILE, 5);
    } else if (tile === 3) {
      ctx.fillStyle = chapter.waterFill;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(x, y + 8 + (c % 3) * 4, TILE, 2);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(x, y + TILE - 6, TILE, 6);
    } else if (tile === 2) {
      ctx.fillStyle = `rgb(${64 + n * 24},${78 + n * 20},${70 + n * 10})`;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = "rgba(62,224,197,0.18)";
      ctx.beginPath();
      ctx.arc(x + TILE / 2, y + TILE / 2, TILE * 0.38, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const [gr, gg, gb] = chapter.ground;
      const R = gr + n * 36;
      const G = gg + n * 24;
      const B = gb + n * 16;
      ctx.fillStyle = `rgb(${R},${G},${B})`;
      ctx.fillRect(x, y, TILE, TILE);
      if (n > 0.78) {
        ctx.fillStyle = "rgba(50,32,28,0.4)";
        ctx.beginPath();
        ctx.ellipse(x + TILE * 0.62, y + TILE * 0.58, 4.5, 2.8, 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    sim: Sim,
    cam: Cam,
    viewW: number,
    viewH: number,
    ghost: Ghost | null,
    box: { x0: number; y0: number; x1: number; y1: number } | null,
    cinematic: boolean,
  ): void {
    this.ensure(sim);
    this.consume(sim);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const canvas = ctx.canvas;
    const bw = Math.round(viewW * dpr);
    const bh = Math.round(viewH * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    const shx = (Math.random() - 0.5) * sim.shake * 16;
    const shy = (Math.random() - 0.5) * sim.shake * 12;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#07090e";
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.setTransform(
      dpr * cam.z,
      0,
      0,
      dpr * cam.z,
      dpr * (viewW / 2 - cam.x * cam.z + shx),
      dpr * (viewH / 2 - cam.y * cam.z + shy),
    );
    ctx.imageSmoothingEnabled = true;
    if (this.terrain) ctx.drawImage(this.terrain, 0, 0);
    this.drawLand(ctx, sim);
    this.drawCrystals(ctx, sim);
    this.drawTracks(ctx, sim);
    const drawList = sim.ents.filter((e) => e.alive);
    drawList.sort((a, b) => {
      const aa = DEFS[a.kind].air ? 1 : 0;
      const ba = DEFS[b.kind].air ? 1 : 0;
      if (aa !== ba) return aa - ba;
      const da = a.y + (DEFS[a.kind].building ? (DEFS[a.kind].fh * TILE) / 2 : 0);
      const db = b.y + (DEFS[b.kind].building ? (DEFS[b.kind].fh * TILE) / 2 : 0);
      return da - db;
    });
    for (const e of drawList) {
      if (!cinematic && e.team === 1 && !DEFS[e.kind].building && !sim.isVisible(e)) continue;
      if (!cinematic && e.team === 1 && DEFS[e.kind].building && !sim.isVisible(e) && !sim.explored[this.ti(e)]) continue;
      this.drawEnt(ctx, e, sim.time, sim.selected.includes(e.id), this.wingTier(sim, e.kind, e.team));
    }
    if (!cinematic) {
      for (const m of sim.memory.values()) {
        if (sim.ents.some((e) => e.alive && e.kind === m.kind && Math.abs(e.x - m.x) < 2 && Math.abs(e.y - m.y) < 2)) continue;
        const ghostEnt = {
          kind: m.kind,
          team: m.team,
          x: m.x,
          y: m.y,
          hp: 1,
          maxHp: 1,
          facing: 0,
          aim: 0,
          flash: 0,
          buildLeft: 0,
          buildTotal: 1,
          cargo: 0,
          alive: true,
        } as Ent;
        ctx.globalAlpha = 0.45;
        this.drawEnt(ctx, ghostEnt, sim.time, false);
        ctx.globalAlpha = 1;
      }
    }
    for (const s of sim.shots) this.drawShot(ctx, s);
    for (const p of sim.particles) this.drawParticle(ctx, p);
    for (const f of sim.floaters) {
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = f.color;
      ctx.font = "700 14px Rajdhani, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }
    if (!cinematic && this.fog && this.fctx) {
      const img = this.fctx;
      const data = img.getImageData(0, 0, COLS, ROWS);
      const px = data.data;
      for (let i = 0; i < COLS * ROWS; i++) {
        const o = i * 4;
        if (sim.visible[i]) {
          px[o + 3] = 0;
        } else if (sim.explored[i]) {
          px[o] = 6;
          px[o + 1] = 8;
          px[o + 2] = 12;
          px[o + 3] = 120;
        } else {
          px[o] = 4;
          px[o + 1] = 5;
          px[o + 2] = 8;
          px[o + 3] = 235;
        }
      }
      img.putImageData(data, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.fog, 0, 0, WORLD_W, WORLD_H);
    }
    this.drawFlags(ctx, sim.time);
    if (ghost) this.drawGhost(ctx, sim, ghost);
    if (box) {
      ctx.save();
      ctx.strokeStyle = ION;
      ctx.fillStyle = "rgba(62,224,197,0.12)";
      ctx.lineWidth = 1 / cam.z;
      const x = Math.min(box.x0, box.x1);
      const y = Math.min(box.y0, box.y1);
      const w = Math.abs(box.x1 - box.x0);
      const h = Math.abs(box.y1 - box.y0);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.stampCallsigns(ctx, sim, cam, viewW, viewH);
  }

  drawMinimap(ctx: CanvasRenderingContext2D, sim: Sim, cam: Cam, viewW: number, viewH: number, cinematic: boolean): void {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#0c1016";
    ctx.fillRect(0, 0, w, h);
    const sx = w / COLS;
    const sy = h / ROWS;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        if (!cinematic && !sim.explored[i]) continue;
        if (sim.tiles[i] === 1) ctx.fillStyle = "#2a313c";
        else if (sim.tiles[i] === 3) ctx.fillStyle = "#1a5870";
        else if (sim.ion[i] > 0) ctx.fillStyle = "#1f8f86";
        else if (sim.flora[i]) ctx.fillStyle = "#2d5a34";
        else ctx.fillStyle = "#6a5344";
        ctx.fillRect(c * sx, r * sy, Math.ceil(sx), Math.ceil(sy));
      }
    }
    for (const e of sim.ents) {
      if (!e.alive) continue;
      if (!cinematic && e.team === 1 && !sim.isVisible(e) && !(DEFS[e.kind].building && sim.explored[this.ti(e)])) continue;
      ctx.fillStyle = e.team === 0 ? ION : EMBER;
      const px = (e.x / WORLD_W) * w;
      const py = (e.y / WORLD_H) * h;
      const s = DEFS[e.kind].building ? 3 : 2;
      ctx.fillRect(px - s / 2, py - s / 2, s, s);
    }
    const hw = viewW / 2 / cam.z;
    const hh = viewH / 2 / cam.z;
    ctx.strokeStyle = "rgba(231,238,242,0.85)";
    ctx.lineWidth = 1;
    ctx.strokeRect(((cam.x - hw) / WORLD_W) * w, ((cam.y - hh) / WORLD_H) * h, ((hw * 2) / WORLD_W) * w, ((hh * 2) / WORLD_H) * h);
  }

  private ti(e: Ent): number {
    const c = Math.max(0, Math.min(COLS - 1, Math.floor(e.x / TILE)));
    const r = Math.max(0, Math.min(ROWS - 1, Math.floor(e.y / TILE)));
    return r * COLS + c;
  }

  private drawLand(ctx: CanvasRenderingContext2D, sim: Sim): void {
    const chapter = chapterById(sim.chapterId);
    const flora = sim.flora;
    if (!flora) return;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const kind = flora[r * COLS + c];
        if (!kind) continue;
        const x = (c + 0.5) * TILE;
        const y = (r + 0.62) * TILE;
        const tall = kind === 2;
        ctx.fillStyle = "rgba(0,0,0,0.28)";
        ctx.beginPath();
        ctx.ellipse(x + 2, y + 3, tall ? 8 : 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = chapter.trunk;
        ctx.fillRect(x - 1.4, y - (tall ? 14 : 10), 2.8, tall ? 14 : 10);
        ctx.fillStyle = chapter.canopy;
        ctx.beginPath();
        ctx.arc(x, y - (tall ? 16 : 12), tall ? 9 : 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.14)";
        ctx.beginPath();
        ctx.arc(x - 2, y - (tall ? 18 : 14), tall ? 3 : 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawCrystals(ctx: CanvasRenderingContext2D, sim: Sim): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const amt = sim.ion[r * COLS + c];
        if (amt <= 0) continue;
        const x = (c + 0.5) * TILE;
        const y = (r + 0.5) * TILE;
        const h = 7 + (amt / 2800) * 16;
        const pulse = 0.55 + 0.45 * Math.sin(sim.time * 2.2 + c * 1.3 + r);
        ctx.save();
        ctx.translate(x, y);
        ctx.globalCompositeOperation = "lighter";
        const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 20);
        glow.addColorStop(0, `rgba(190,255,244,${0.28 * pulse})`);
        glow.addColorStop(1, "rgba(62,224,197,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        for (let k = 0; k < 3; k++) {
          ctx.save();
          ctx.rotate(k * 2.05 + c * 0.4);
          ctx.beginPath();
          ctx.moveTo(0, -h);
          ctx.lineTo(3.5, 0);
          ctx.lineTo(0, 3);
          ctx.lineTo(-3, -1);
          ctx.closePath();
          ctx.fillStyle = k === 0 ? "#f4fffc" : ION;
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      }
    }
  }

  private drawTracks(ctx: CanvasRenderingContext2D, sim: Sim): void {
    ctx.save();
    ctx.strokeStyle = "rgba(40,28,22,0.35)";
    ctx.lineWidth = 3;
    for (const t of sim.tracks) {
      ctx.globalAlpha = Math.max(0, t.life / 2.4) * 0.7;
      ctx.beginPath();
      ctx.moveTo(t.x - Math.cos(t.a) * 6, t.y - Math.sin(t.a) * 6);
      ctx.lineTo(t.x + Math.cos(t.a) * 6, t.y + Math.sin(t.a) * 6);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawShot(ctx: CanvasRenderingContext2D, s: { x: number; y: number; px: number; py: number; kind: string }): void {
    ctx.save();
    ctx.strokeStyle = s.kind === "bolt" ? "#d7fff8" : s.kind === "rocket" ? "#ffb089" : "#ffe1a8";
    ctx.lineWidth = s.kind === "rocket" ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(s.px, s.py);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.kind === "rocket" ? 3 : 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawParticle(ctx: CanvasRenderingContext2D, p: { x: number; y: number; life: number; max: number; size: number; color: string; kind: string }): void {
    const a = Math.max(0, p.life / p.max);
    ctx.save();
    ctx.globalAlpha = a;
    if (p.kind === "ring") {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1.4 - a), 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.kind === "smoke" ? 1.4 - a * 0.3 : a), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawGhost(ctx: CanvasRenderingContext2D, sim: Sim, ghost: Ghost): void {
    const def = DEFS[ghost.kind];
    const w = def.fw * TILE;
    const h = def.fh * TILE;
    ctx.save();
    ctx.translate(ghost.x, ghost.y);
    ctx.fillStyle = ghost.ok ? "rgba(62,224,197,0.25)" : "rgba(255,90,54,0.25)";
    ctx.strokeStyle = ghost.ok ? ION : EMBER;
    ctx.lineWidth = 2;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.75;
    const fake = {
      kind: ghost.kind,
      team: 0 as const,
      x: ghost.x,
      y: ghost.y,
      hp: 1,
      maxHp: 1,
      facing: -Math.PI / 2,
      aim: -Math.PI / 2,
      flash: 0,
      buildLeft: 0,
      buildTotal: 1,
      cargo: 0,
      alive: true,
    } as Ent;
    this.drawEnt(ctx, fake, sim.time, false);
    ctx.restore();
  }

  private wingTier(sim: Sim, kind: Kind, team: 0 | 1): number {
    if (kind !== "spire" && kind !== "barracks" && kind !== "bay" && kind !== "strip") return 1;
    return sim.tech[team][kind] ?? 1;
  }

  private drawEnt(ctx: CanvasRenderingContext2D, e: Ent, time: number, selected: boolean, tier = 1): void {
    const def = DEFS[e.kind];
    const team = e.team === 0 ? ION : EMBER;
    ctx.save();
    ctx.translate(e.x, e.y);
    let crown = -def.radius;
    if (def.building) {
      crown = this.drawBuilding(ctx, e, time, team, tier);
    } else {
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath();
      ctx.ellipse(def.air ? 12 : 3, def.air ? 18 : 6, def.air ? def.radius * 0.7 : def.radius, def.radius * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      this.drawUnit(ctx, e, time, team);
    }
    if (e.flash > 0 && !def.building) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.arc(0, 0, def.radius + 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (selected) {
      ctx.strokeStyle = team;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (def.building) ctx.ellipse(0, def.fh * TILE * 0.22, def.fw * TILE * 0.46, def.fh * TILE * 0.22, 0, 0, Math.PI * 2);
      else ctx.ellipse(0, 4, def.radius * 0.96, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (e.hp < e.maxHp && e.buildLeft <= 0) {
      const w = def.building ? def.fw * TILE * 0.7 : 22;
      const ratio = Math.max(0, e.hp / e.maxHp);
      const y = def.building ? crown - 8 : -def.radius - 14;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(-w / 2, y, w, 4);
      ctx.fillStyle = ratio > 0.4 ? team : EMBER;
      ctx.fillRect(-w / 2, y, w * ratio, 4);
    }
    ctx.restore();
  }

  private drawBuilding(ctx: CanvasRenderingContext2D, e: Ent, time: number, team: string, tier = 1): number {
    const def = DEFS[e.kind];
    const progress = e.buildTotal > 0 && e.buildLeft > 0 ? Math.max(0, 1 - e.buildLeft / e.buildTotal) : 1;
    return drawStructure(ctx, e.kind, time, team, e.team, {
      w: def.fw * TILE - 6,
      d: def.fh * TILE - 6,
      tier,
      progress,
      hpRatio: e.maxHp > 0 ? Math.max(0, e.hp / e.maxHp) : 1,
      aim: e.aim,
      flash: e.flash,
    });
  }

  private drawUnit(ctx: CanvasRenderingContext2D, e: Ent, time: number, team: string): void {
    if (DEFS[e.kind].air) {
      ctx.rotate(e.facing);
      const bomb = e.kind === "condor" || e.kind === "spectre";
      const span = bomb ? 22 : 16;
      ctx.fillStyle = "#0c141c";
      ctx.beginPath();
      ctx.ellipse(0, 0, bomb ? 16 : 13, bomb ? 3.2 : 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1c2832";
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(-2, span);
      ctx.lineTo(-8, span * 0.45);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-8, -span * 0.45);
      ctx.lineTo(-2, -span);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#243240";
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(-16, 5);
      ctx.lineTo(-16, -5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = team;
      ctx.fillRect(2, -1.3, 6, 2.6);
      ctx.fillStyle = "rgba(186,230,240,0.9)";
      ctx.beginPath();
      ctx.ellipse(6, 0, 2.2, 1.3, 0, 0, Math.PI * 2);
      ctx.fill();
      if (e.flash > 0) {
        ctx.fillStyle = "#fff6d2";
        ctx.beginPath();
        ctx.arc(14, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    if (e.kind === "rifle" || e.kind === "rocket" || e.kind === "watch" || e.kind === "patrol" || e.kind === "grenadier" || e.kind === "sergeant" || e.kind === "specops") {
      ctx.rotate(e.facing);
      const step = Math.sin(time * 11 + e.id) * (e.order === "idle" || e.order === "hold" ? 0.4 : 2.4);
      const cloth = e.kind === "specops" ? "#1a2228" : e.kind === "sergeant" ? "#243028" : "#3a342c";
      ctx.strokeStyle = cloth;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-1, 1);
      ctx.lineTo(-3, 6 + step);
      ctx.moveTo(1, 1);
      ctx.lineTo(3, 6 - step);
      ctx.stroke();
      ctx.fillStyle = cloth;
      ctx.fillRect(-3.2, -3, 6.4, 7);
      ctx.fillStyle = e.kind === "specops" ? "#8ea0aa" : "#e4cbb8";
      ctx.beginPath();
      ctx.arc(2.2, -1, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = team;
      ctx.fillRect(-3.4, -4.2, 4.2, 2.2);
      ctx.strokeStyle = e.kind === "rocket" || e.kind === "grenadier" ? "#c9a27a" : "#b7c2cc";
      ctx.lineWidth = e.kind === "rocket" ? 2.6 : 1.5;
      ctx.beginPath();
      ctx.moveTo(1, 0);
      ctx.lineTo(e.kind === "rocket" ? 13 : 11, -1);
      ctx.stroke();
      if (e.kind === "watch") {
        ctx.fillStyle = "#d5dee6";
        ctx.fillRect(3.2, -2.4, 3.5, 1.2);
      }
      if (e.kind === "sergeant") {
        ctx.fillStyle = "#e8c56b";
        ctx.fillRect(-2.2, -1, 2, 2);
      }
      if (e.kind === "patrol") {
        ctx.fillStyle = "#c4a574";
        ctx.beginPath();
        ctx.ellipse(-7, 3, 3.6, 2, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#1a120c";
        ctx.beginPath();
        ctx.arc(-9, 2.4, 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
      if (e.flash > 0) {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(12, -1, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    ctx.rotate(e.facing);
    const ace = e.kind === "t3x";
    const heavy = e.kind === "bastion" || ace || e.kind === "howl";
    const hv = e.kind === "harvester";
    const len = hv ? 26 : ace ? 52 : e.kind === "reaver" ? 40 : heavy ? 44 : e.kind === "viper" ? 36 : 40;
    const wid = hv ? 16 : ace ? 26 : heavy ? 24 : e.kind === "viper" ? 20 : 22;
    ctx.fillStyle = "#0e1218";
    ctx.fillRect(-len / 2, -wid / 2 - 1.5, len, 4);
    ctx.fillRect(-len / 2, wid / 2 - 2.5, len, 4);
    ctx.fillStyle = "#2a3138";
    for (let i = -len / 2 + 2; i < len / 2; i += 5) {
      ctx.fillRect(i, -wid / 2 - 1, 2, 3);
      ctx.fillRect(i, wid / 2 - 2, 2, 3);
    }
    ctx.fillStyle = "#1a212a";
    ctx.beginPath();
    ctx.moveTo(-len / 2 + 4, -wid / 2 + 2);
    ctx.lineTo(len / 2 - 8, -wid / 2 + 3);
    ctx.lineTo(len / 2, 0);
    ctx.lineTo(len / 2 - 8, wid / 2 - 3);
    ctx.lineTo(-len / 2 + 4, wid / 2 - 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = team;
    ctx.fillRect(-4, -wid / 2 + 3, len * 0.35, 2);
    if (hv) {
      const fill = DEFS.harvester.cargo ? e.cargo / DEFS.harvester.cargo : 0;
      ctx.fillStyle = "rgba(62,224,197,0.85)";
      ctx.fillRect(-6, -5, 12 * fill, 10);
      ctx.strokeStyle = "#9fb0be";
      ctx.strokeRect(-6, -5, 12, 10);
    } else {
      ctx.save();
      ctx.rotate(e.aim - e.facing);
      ctx.fillStyle = "#12181e";
      ctx.beginPath();
      ctx.arc(0, 0, heavy ? 7.5 : 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c5d0da";
      ctx.fillRect(1, heavy ? -2.1 : -1.5, heavy ? 18 : 14, heavy ? 4.2 : 3);
      if (e.kind === "aegis") {
        ctx.fillStyle = team;
        ctx.fillRect(2, -7, 9, 2);
        ctx.fillRect(2, 5, 9, 2);
      }
      if (e.flash > 0) {
        ctx.fillStyle = "#fff4d2";
        ctx.beginPath();
        ctx.arc(heavy ? 20 : 15, 0, 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      if (ace) {
        ctx.fillStyle = "#e8c56b";
        ctx.fillRect(-len / 2 + 6, -1.2, len - 16, 2.4);
      }
      this.paintCallsign(ctx, e);
    }
  }

  private loadCrest(): void {
    if (this.crestStarted) return;
    this.crestStarted = true;
    const img = new Image();
    img.src = "/brand/futuret3ch.png?v=2";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth || img.width;
      c.height = img.naturalHeight || img.height;
      const g = c.getContext("2d");
      if (!g) return;
      g.drawImage(img, 0, 0);
      const data = g.getImageData(0, 0, c.width, c.height);
      const px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        const max = Math.max(px[i], px[i + 1], px[i + 2]);
        if (max < 26) px[i + 3] = 0;
        else if (max < 58) px[i + 3] = Math.round(((max - 26) / 32) * 255);
      }
      g.putImageData(data, 0, 0);
      this.crest = c;
    };
  }

  private paintCallsign(ctx: CanvasRenderingContext2D, e: Ent): void {
    if (e.team !== 0 || !this.isMarkedTank(e.kind)) return;
    ctx.fillStyle = "#1a1408";
    ctx.fillRect(-16, -6, 32, 12);
    ctx.strokeStyle = "#e8c56b";
    ctx.lineWidth = 1;
    ctx.strokeRect(-16, -6, 32, 12);
    ctx.fillStyle = "#ffe7a3";
    ctx.font = "700 10px Rajdhani, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("T3X", 0, 0);
  }

  private isMarkedTank(kind: Kind): boolean {
    return kind === "viper" || kind === "lancer" || kind === "bastion" || kind === "t3x" || kind === "aegis";
  }

  private stampCallsigns(ctx: CanvasRenderingContext2D, sim: Sim, cam: Cam, viewW: number, viewH: number): void {
    ctx.save();
    ctx.font = "700 15px Rajdhani, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const e of sim.ents) {
      if (!e.alive || e.team !== 0 || !this.isMarkedTank(e.kind)) continue;
      const sx = viewW / 2 + (e.x - cam.x) * cam.z;
      const sy = viewH / 2 + (e.y - cam.y) * cam.z - 26;
      if (sx < -40 || sy < -20 || sx > viewW + 40 || sy > viewH + 20) continue;
      ctx.fillStyle = "rgba(6,8,12,0.92)";
      ctx.fillRect(sx - 26, sy - 10, 52, 20);
      ctx.strokeStyle = "#e8c56b";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sx - 26, sy - 10, 52, 20);
      ctx.fillStyle = "#ffe7a3";
      ctx.fillText("T3X", sx, sy);
    }
    ctx.restore();
  }

  private drawFlags(ctx: CanvasRenderingContext2D, time: number): void {
    this.drawFlag(ctx, 160, 1188, time, 0.2);
    this.drawFlag(ctx, 760, 1168, time, 1.8);
  }

  private drawFlag(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, phase: number): void {
    const wave = Math.sin(time * 2.1 + phase);
    const flutter = Math.sin(time * 3.4 + phase * 1.3);
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = "#d5dee6";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(0, -196);
    ctx.stroke();
    ctx.fillStyle = "#e8c56b";
    ctx.beginPath();
    ctx.arc(0, -196, 4.5, 0, Math.PI * 2);
    ctx.fill();
    const top = -192 + wave * 3;
    const bot = -118 + wave * 2;
    ctx.beginPath();
    ctx.moveTo(4, top);
    ctx.bezierCurveTo(70, top + flutter * 7, 150, top - flutter * 5, 228, top + wave * 5);
    ctx.lineTo(228, bot + wave * 4);
    ctx.bezierCurveTo(150, bot - flutter * 4, 70, bot + flutter * 6, 4, bot);
    ctx.closePath();
    const cloth = ctx.createLinearGradient(0, top, 228, bot);
    cloth.addColorStop(0, "#071018");
    cloth.addColorStop(1, "#102028");
    ctx.fillStyle = cloth;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = ION;
    ctx.stroke();
    if (this.crest) ctx.drawImage(this.crest, 12, top + 8, 52, 52);
    ctx.font = "700 22px Rajdhani, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.strokeText("FUTURET3CH", 70, (top + bot) / 2 + flutter);
    ctx.fillStyle = "#f4fbff";
    ctx.fillText("FUTURET3CH", 70, (top + bot) / 2 + flutter);
    ctx.restore();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
