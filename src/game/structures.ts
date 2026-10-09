import type { Kind } from "./content";

type RGB = [number, number, number];
type Pt = [number, number];

export interface StructureSpec {
  w: number;
  d: number;
  tier: number;
  progress: number;
  hpRatio: number;
  aim: number;
  flash: number;
}

const SKEW = 0.42;

const FULL_H: Record<string, number> = {
  spire: 98,
  relay: 62,
  refinery: 74,
  barracks: 42,
  bay: 52,
  turret: 30,
  sam: 38,
  cannon: 36,
  wall: 22,
  strip: 68,
  silo: 56,
};

function rgb(c: RGB): string {
  return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
}

function rgba(c: RGB, a: number): string {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
}

function hex(h: string): RGB {
  const s = h.replace("#", "");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function project(x: number, y: number, z: number): Pt {
  return [x - z * SKEW, y - z];
}

function poly(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, shade?: { from: Pt; to: Pt; c0: string; c1: string }): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (!shade) return;
  ctx.save();
  ctx.clip();
  const g = ctx.createLinearGradient(shade.from[0], shade.from[1], shade.to[0], shade.to[1]);
  g.addColorStop(0, shade.c0);
  g.addColorStop(1, shade.c1);
  ctx.fillStyle = g;
  ctx.fillRect(shade.from[0] - 200, shade.from[1] - 200, 400, 400);
  ctx.restore();
}

interface Pal {
  roof: string;
  south: string;
  east: string;
  accent: string;
  accentRgb: RGB;
  metal: RGB;
}

function makePal(team: 0 | 1, teamColor: string, hp: number): Pal {
  let metal: RGB = team === 0 ? [58, 74, 84] : [86, 52, 44];
  if (hp < 0.55) metal = mix(metal, [28, 22, 20], 0.45);
  const roof = mix(metal, [236, 240, 244], team === 0 ? 0.38 : 0.28);
  const south = mix(metal, [255, 255, 255], 0.05);
  const east = mix(metal, [8, 6, 8], 0.42);
  const accentRgb = hex(teamColor);
  return { roof: rgb(roof), south: rgb(south), east: rgb(east), accent: teamColor, accentRgb, metal };
}

const GOLD: RGB = [232, 197, 107];

function promote(base: Pal, tier: number, team: 0 | 1): Pal {
  const step = Math.max(0, Math.min(3, tier - 1));
  if (step === 0) return base;
  const bright: RGB = team === 0 ? [186, 214, 216] : [196, 132, 96];
  let metal = mix(base.metal, bright, 0.18 + step * 0.12);
  if (tier >= 4) metal = mix(metal, team === 0 ? [226, 236, 232] : [92, 36, 30], 0.4);
  const roof = mix(metal, tier >= 3 ? GOLD : [240, 244, 246], tier >= 4 ? 0.46 : 0.32);
  const south = mix(metal, [255, 255, 255], 0.06 + step * 0.03);
  const east = mix(metal, [6, 4, 6], 0.34);
  let accent = base.accentRgb;
  if (tier >= 3) accent = mix(accent, GOLD, team === 0 ? 0.28 : 0.18);
  if (tier >= 4) accent = mix(accent, [255, 248, 220], 0.22);
  return { roof: rgb(roof), south: rgb(south), east: rgb(east), accent: rgb(accent), accentRgb: accent, metal };
}

interface Draw {
  ctx: CanvasRenderingContext2D;
  pal: Pal;
  crown: number;
  note: (y: number) => void;
}

function box(d: Draw, cx: number, cy: number, w: number, dep: number, z0: number, z1: number): void {
  if (w < 1 || dep < 1 || z1 - z0 < 0.6) return;
  const hw = w / 2;
  const hd = dep / 2;
  const p = (x: number, y: number, z: number) => project(cx + x, cy + y, z);
  const nw0 = p(-hw, -hd, z0);
  const ne0 = p(hw, -hd, z0);
  const se0 = p(hw, hd, z0);
  const sw0 = p(-hw, hd, z0);
  const nw1 = p(-hw, -hd, z1);
  const ne1 = p(hw, -hd, z1);
  const se1 = p(hw, hd, z1);
  const sw1 = p(-hw, hd, z1);
  d.note(nw1[1]);
  d.note(ne1[1]);
  poly(d.ctx, [ne0, se0, se1, ne1], d.pal.east, {
    from: ne1,
    to: se0,
    c0: "rgba(255,255,255,0.05)",
    c1: "rgba(0,0,0,0.38)",
  });
  poly(d.ctx, [sw0, se0, se1, sw1], d.pal.south, {
    from: sw1,
    to: sw0,
    c0: "rgba(255,255,255,0.2)",
    c1: "rgba(0,0,0,0.38)",
  });
  poly(d.ctx, [nw1, ne1, se1, sw1], d.pal.roof, {
    from: nw1,
    to: se1,
    c0: "rgba(255,255,255,0.28)",
    c1: "rgba(0,0,0,0.32)",
  });
  d.ctx.beginPath();
  d.ctx.moveTo(nw1[0], nw1[1]);
  d.ctx.lineTo(ne1[0], ne1[1]);
  d.ctx.lineTo(se1[0], se1[1]);
  d.ctx.lineTo(sw1[0], sw1[1]);
  d.ctx.closePath();
  d.ctx.strokeStyle = "rgba(0,0,0,0.45)";
  d.ctx.lineWidth = 1;
  d.ctx.stroke();
  d.ctx.beginPath();
  d.ctx.moveTo(nw1[0], nw1[1]);
  d.ctx.lineTo(ne1[0], ne1[1]);
  d.ctx.strokeStyle = "rgba(255,255,255,0.35)";
  d.ctx.stroke();
}

function roofGrid(d: Draw, cx: number, cy: number, w: number, dep: number, z: number): void {
  const ctx = d.ctx;
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = 1;
  const cols = Math.max(2, Math.round(w / 22));
  const rows = Math.max(2, Math.round(dep / 22));
  for (let i = 1; i < cols; i++) {
    const x = -w / 2 + (w * i) / cols;
    const a = project(cx + x, cy - dep / 2, z + 0.6);
    const b = project(cx + x, cy + dep / 2, z + 0.6);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  for (let i = 1; i < rows; i++) {
    const y = -dep / 2 + (dep * i) / rows;
    const a = project(cx - w / 2, cy + y, z + 0.6);
    const b = project(cx + w / 2, cy + y, z + 0.6);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  ctx.restore();
}

function band(d: Draw, cx: number, cy: number, w: number, y0: number, y1: number, z: number, color: string): void {
  poly(d.ctx, [
    project(cx - w / 2, cy + y0, z),
    project(cx + w / 2, cy + y0, z),
    project(cx + w / 2, cy + y1, z),
    project(cx - w / 2, cy + y1, z),
  ], color);
}

function windows(d: Draw, cx: number, cy: number, dep: number, z0: number, z1: number, xs: number[], lit: number): void {
  const y = cy + dep / 2;
  for (const x of xs) {
    poly(d.ctx, [
      project(cx + x - 2.4, y, z1),
      project(cx + x + 2.4, y, z1),
      project(cx + x + 2.4, y, z0),
      project(cx + x - 2.4, y, z0),
    ], lit > 0.2 ? d.pal.accent : "#14181e");
    if (lit > 0.25) {
      const m = project(cx + x, y, (z0 + z1) / 2);
      d.ctx.save();
      d.ctx.globalCompositeOperation = "lighter";
      d.ctx.globalAlpha = 0.28 * lit;
      d.ctx.fillStyle = d.pal.accent;
      d.ctx.beginPath();
      d.ctx.arc(m[0], m[1], 6, 0, Math.PI * 2);
      d.ctx.fill();
      d.ctx.restore();
    }
  }
}

function door(d: Draw, cx: number, cy: number, dep: number, z0: number, z1: number, half: number): void {
  const y = cy + dep / 2;
  poly(d.ctx, [
    project(cx - half, y, z1),
    project(cx + half, y, z1),
    project(cx + half, y, z0),
    project(cx - half, y, z0),
  ], "#0c1016");
  poly(d.ctx, [
    project(cx - half, y, z1),
    project(cx - half + 1.5, y, z1),
    project(cx - half + 1.5, y, z0),
    project(cx - half, y, z0),
  ], rgba(d.pal.accentRgb, 0.85));
}

function silo(d: Draw, cx: number, cy: number, r: number, z0: number, z1: number): void {
  if (z1 - z0 < 1) return;
  const top = project(cx, cy, z1);
  const bot = project(cx, cy, z0);
  d.note(top[1] - r * 0.42);
  const ctx = d.ctx;
  ctx.beginPath();
  ctx.moveTo(bot[0] - r, bot[1]);
  ctx.lineTo(top[0] - r, top[1]);
  ctx.lineTo(top[0] + r, top[1]);
  ctx.lineTo(bot[0] + r, bot[1]);
  ctx.closePath();
  ctx.fillStyle = d.pal.south;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(bot[0] - r, bot[1]);
  ctx.lineTo(top[0] - r, top[1]);
  ctx.lineTo(top[0] - r * 0.15, top[1]);
  ctx.lineTo(bot[0] - r * 0.15, bot[1]);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(bot[0] + r * 0.2, bot[1]);
  ctx.lineTo(top[0] + r * 0.2, top[1]);
  ctx.lineTo(top[0] + r, top[1]);
  ctx.lineTo(bot[0] + r, bot[1]);
  ctx.closePath();
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(top[0], top[1], r, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fillStyle = d.pal.roof;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(top[0] - r * 0.22, top[1] - r * 0.1, r * 0.42, r * 0.16, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.fill();
}

function glow(d: Draw, x: number, y: number, z: number, rad: number, alpha: number): void {
  const [sx, sy] = project(x, y, z);
  d.note(sy - rad);
  const ctx = d.ctx;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
  g.addColorStop(0, rgba(d.pal.accentRgb, 0.95));
  g.addColorStop(1, rgba(d.pal.accentRgb, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(sx, sy, rad, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function beacon(d: Draw, x: number, y: number, z: number, time: number): void {
  silo(d, x, y, 2.2, z, z + 8);
  const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(time * 5));
  glow(d, x, y, z + 8, 10, 0.55 * pulse);
  const [sx, sy] = project(x, y, z + 9);
  d.ctx.fillStyle = "#f7fffd";
  d.ctx.beginPath();
  d.ctx.arc(sx, sy, 2.2, 0, Math.PI * 2);
  d.ctx.fill();
}

function dish(d: Draw, x: number, y: number, z: number, time: number): void {
  const [sx, sy] = project(x, y, z);
  d.note(sy - 6);
  const ctx = d.ctx;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(time * 1.3);
  ctx.strokeStyle = d.pal.accent;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 4.2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(10, 0);
  ctx.moveTo(0, -4.2);
  ctx.lineTo(0, 4.2);
  ctx.stroke();
  ctx.restore();
  box(d, x, y, 3, 3, z - 6, z);
}

function barrel(d: Draw, x: number, y: number, z: number, aim: number, len: number, thick: number, flash: number): void {
  const [sx, sy] = project(x, y, z);
  const ctx = d.ctx;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(aim);
  ctx.fillStyle = "#121820";
  ctx.fillRect(-8, -thick * 0.9, 12, thick * 1.8);
  const g = ctx.createLinearGradient(0, -thick / 2, 0, thick / 2);
  g.addColorStop(0, "#e7eef2");
  g.addColorStop(0.45, "#8d9aa6");
  g.addColorStop(1, "#1c242c");
  ctx.fillStyle = g;
  ctx.fillRect(2, -thick / 2, len, thick);
  ctx.fillStyle = "#0c1014";
  ctx.fillRect(len - 2, -thick / 2 - 1.2, 5, thick + 2.4);
  if (flash > 0) {
    ctx.fillStyle = "#fff6d2";
    ctx.beginPath();
    ctx.arc(len + 6, 0, thick + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = "#ffe08a";
    ctx.beginPath();
    ctx.arc(len + 8, 0, thick + 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function shadow(ctx: CanvasRenderingContext2D, w: number, dep: number, h: number): void {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(h * 0.08 + 4, dep * 0.18, w * 0.5, dep * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(2, dep * 0.08, w * 0.42, dep * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function scaffold(ctx: CanvasRenderingContext2D, w: number, dep: number, h: number, accent: RGB): void {
  const posts: Pt[] = [
    [-w / 2, -dep / 2],
    [w / 2, -dep / 2],
    [w / 2, dep / 2],
    [-w / 2, dep / 2],
  ];
  ctx.save();
  ctx.strokeStyle = "rgba(232,197,107,0.9)";
  ctx.lineWidth = 1.6;
  for (const [x, y] of posts) {
    const a = project(x, y, 0);
    const b = project(x, y, h);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  for (const level of [h * 0.45, h * 0.82]) {
    ctx.beginPath();
    const ring = posts.map(([x, y]) => project(x, y, level));
    ctx.moveTo(ring[0][0], ring[0][1]);
    for (let i = 1; i < ring.length; i++) ctx.lineTo(ring[i][0], ring[i][1]);
    ctx.closePath();
    ctx.stroke();
  }
  const mast = project(-w / 2 - 6, -dep / 2 - 4, h + 8);
  const foot = project(-w / 2 - 6, -dep / 2 - 4, 0);
  const tip = project(w * 0.15, -dep / 2 - 4, h + 8);
  ctx.strokeStyle = rgba(accent, 0.8);
  ctx.beginPath();
  ctx.moveTo(foot[0], foot[1]);
  ctx.lineTo(mast[0], mast[1]);
  ctx.lineTo(tip[0], tip[1]);
  ctx.stroke();
  ctx.restore();
}

function scorch(d: Draw, w: number, dep: number, z: number, hp: number): void {
  if (hp > 0.72) return;
  const ctx = d.ctx;
  ctx.save();
  ctx.globalAlpha = Math.min(0.85, (0.72 - hp) * 1.4);
  ctx.strokeStyle = "#140c0a";
  ctx.lineWidth = 1.5;
  const cracks = [
    [-w * 0.2, -dep * 0.1, w * 0.15, dep * 0.2],
    [w * 0.05, -dep * 0.2, -w * 0.1, dep * 0.05],
  ];
  for (const [x0, y0, x1, y1] of cracks) {
    const a = project(x0, y0, z + 1);
    const b = project(x1, y1, z + 1);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  if (hp < 0.4) {
    const c = project(w * 0.1, dep * 0.05, z + 1.2);
    ctx.fillStyle = "rgba(20,10,8,0.65)";
    ctx.beginPath();
    ctx.ellipse(c[0], c[1], w * 0.18, dep * 0.1, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function plume(d: Draw, x: number, y: number, z: number, time: number): void {
  const ctx = d.ctx;
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const t = (time * 0.28 + i / 3) % 1;
    const p = project(x + Math.sin(time * 1.4 + i) * 2, y, z + t * 26);
    ctx.globalAlpha = (1 - t) * 0.35;
    ctx.fillStyle = i === 0 ? "#d5e4ea" : "#8ea0aa";
    ctx.beginPath();
    ctx.arc(p[0], p[1], 2.5 + t * 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function pad(d: Draw, w: number, dep: number): void {
  box(d, 0, dep * 0.06, w + 12, dep + 16, 0, 5);
  band(d, 0, dep * 0.06, w + 12, dep / 2 + 6, dep / 2 + 9, 5.2, d.pal.accent);
}

function rankMarks(d: Draw, cx: number, cy: number, dep: number, z: number, tier: number): void {
  const y = cy + dep / 2;
  for (let i = 0; i < tier; i++) {
    const x = cx - (tier - 1) * 3.2 + i * 6.4;
    poly(
      d.ctx,
      [project(x - 2, y, z + 4), project(x + 2, y, z + 4), project(x + 2, y, z), project(x - 2, y, z)],
      tier >= 3 ? rgb(GOLD) : d.pal.accent,
    );
  }
}

function spire(d: Draw, w: number, dep: number, R: number, time: number, tier: number): number {
  const t = Math.max(1, Math.min(4, tier));
  const base = 5 + (t >= 3 ? 26 : 20) * R;
  box(d, 0, 4, w - (t >= 3 ? 4 : 10), dep - (t >= 3 ? 4 : 12), 5, base);
  roofGrid(d, 0, 4, w - 14, dep - 16, base);
  windows(d, 0, 4, dep - 12, 5 + 6 * R, base - 3, [-w * 0.28, -w * 0.12, w * 0.12, w * 0.28], 1);
  const pylon = (t === 1 ? 30 : t === 2 ? 40 : t === 3 ? 34 : 48) * R;
  const corners: Pt[] = [
    [-w * 0.36, -dep * 0.28],
    [w * 0.36, -dep * 0.28],
    [-w * 0.36, dep * 0.2],
    [w * 0.36, dep * 0.2],
  ];
  for (const [x, y] of corners) box(d, x, y, t >= 3 ? 14 : 11, t >= 3 ? 14 : 11, 5, 5 + pylon);
  const towerW = t === 4 ? 26 : t === 3 ? 46 : t === 2 ? 30 : 36;
  const tower = base + (t === 1 ? 46 : t === 2 ? 64 : t === 3 ? 50 : 88) * R;
  box(d, 0, t === 4 ? -6 : -2, towerW, towerW, base, tower);
  roofGrid(d, 0, t === 4 ? -6 : -2, towerW - 6, towerW - 6, tower);
  windows(d, 0, t === 4 ? -6 : -2, towerW, base + 10 * R, tower - 8, t >= 2 ? [-10, 0, 10] : [-8, 8], 1);
  if (t >= 2) silo(d, 0, -2, t === 4 ? 9 : 15, base + (tower - base) * 0.25, base + (tower - base) * 0.62);
  if (t === 3) {
    silo(d, 0, 2, Math.min(w, dep) * 0.38, base - 4, base + 10 * R);
    glow(d, 0, 2, base + 8 * R, 22, 0.4 + 0.12 * Math.sin(time * 2));
    band(d, 0, 4, w - 16, -dep * 0.08, dep * 0.02, base + 1, rgb(GOLD));
  }
  if (t === 4) {
    silo(d, w * 0.3, dep * 0.08, 9, 5, base + 22 * R);
    band(d, 0, -6, towerW - 2, -4, 2, tower - 6, rgb(GOLD));
    band(d, 0, -6, towerW - 2, -4, 2, base + 8, d.pal.accent);
    glow(d, w * 0.3, dep * 0.08, base + 20 * R, 12, 0.55);
  }
  silo(d, 0, t === 4 ? -6 : -2, t === 4 ? 8 : 14, tower, tower + (t >= 2 ? 12 : 8) * R);
  const mast = tower + (t === 1 ? 32 : t === 2 ? 40 : t === 3 ? 28 : 52) * R;
  box(d, 0, t === 4 ? -6 : -2, t === 4 ? 4 : 3, t === 4 ? 4 : 3, tower + 6 * R, mast);
  glow(d, 0, -2, (base + tower) / 2, t >= 3 ? 20 : 16, 0.32 + 0.16 * Math.sin(time * 3));
  beacon(d, 0, t === 4 ? -6 : -2, mast, time);
  if (t >= 2) dish(d, towerW * 0.35, 6, tower, time + t);
  rankMarks(d, 0, 4, dep - 12, 8, t);
  return mast;
}

function barracks(d: Draw, w: number, dep: number, R: number, time: number, tier: number): void {
  const t = Math.max(1, Math.min(4, tier));
  if (t === 1) {
    const body = 5 + 24 * R;
    box(d, 0, 1, w - 8, dep - 6, 5, body);
    roofGrid(d, 0, 1, w - 12, dep - 10, body);
    band(d, 0, 1, w - 12, -dep * 0.28, -dep * 0.18, body + 0.8, d.pal.accent);
    door(d, -w * 0.12, 1, dep - 6, 5, 5 + 14 * R, 7);
    windows(d, 0, 1, dep - 6, 5 + 12 * R, body - 4, [-w * 0.32, -w * 0.18, w * 0.08, w * 0.24, w * 0.38], 1);
    box(d, w * 0.36, -dep * 0.22, 8, 8, body, body + 16 * R);
    flag(d, w * 0.36, -dep * 0.22, body + 16 * R, time);
    return;
  }
  if (t === 2) {
    const low = 5 + 18 * R;
    const up = low + 16 * R;
    box(d, 0, 2, w - 6, dep - 4, 5, low);
    box(d, -w * 0.06, -2, w * 0.62, dep * 0.62, low, up);
    box(d, w * 0.32, dep * 0.16, 22, 16, 5, 5 + 12 * R);
    roofGrid(d, -w * 0.06, -2, w * 0.56, dep * 0.55, up);
    windows(d, 0, 2, dep - 4, 8, low - 3, [-w * 0.28, -w * 0.1, w * 0.08], 1);
    windows(d, -w * 0.06, -2, dep * 0.62, low + 4, up - 3, [-10, 0, 10], 1);
    door(d, -w * 0.16, 2, dep - 4, 5, 5 + 12 * R, 6);
    band(d, -w * 0.06, -2, w * 0.58, -4, 2, up + 0.6, rgb(GOLD));
    box(d, w * 0.28, -dep * 0.22, 6, 6, up, up + 20 * R);
    flag(d, w * 0.28, -dep * 0.22, up + 20 * R, time);
    rankMarks(d, 0, 2, dep - 4, 8, t);
    return;
  }
  if (t === 3) {
    const wall = 5 + 30 * R;
    box(d, 0, 0, w - 4, dep - 2, 5, wall);
    roofGrid(d, 0, 0, w - 10, dep - 8, wall);
    const keeps: Pt[] = [
      [-w * 0.38, -dep * 0.28],
      [w * 0.38, -dep * 0.28],
      [-w * 0.38, dep * 0.22],
      [w * 0.38, dep * 0.22],
    ];
    for (const [x, y] of keeps) {
      box(d, x, y, 16, 16, 5, wall + 20 * R);
      box(d, x, y, 10, 10, wall + 20 * R, wall + 28 * R);
    }
    for (const x of [-w * 0.16, 0, w * 0.16]) box(d, x, -dep * 0.18, 8, 8, wall, wall + 7 * R);
    door(d, 0, 0, dep - 2, 5, 5 + 16 * R, 8);
    band(d, 0, 0, w - 8, -3, 3, wall + 0.8, rgb(GOLD));
    windows(d, 0, 0, dep - 2, wall - 12, wall - 4, [-w * 0.2, w * 0.2], 0.7);
    beacon(d, -w * 0.38, -dep * 0.28, wall + 28 * R, time);
    rankMarks(d, 0, 0, dep - 2, 10, t);
    return;
  }
  const saved = d.pal;
  d.pal = {
    ...saved,
    roof: rgb(mix(saved.metal, [16, 20, 24], 0.55)),
    south: rgb(mix(saved.metal, [12, 14, 18], 0.5)),
    east: rgb(mix(saved.metal, [4, 4, 6], 0.7)),
  };
  const plinth = 5 + 12 * R;
  const spine = plinth + 34 * R;
  box(d, 0, 2, w - 4, dep - 2, 5, plinth);
  box(d, 0, -2, w * 0.42, dep * 0.7, plinth, spine);
  roofGrid(d, 0, -2, w * 0.36, dep * 0.6, spine);
  d.pal = saved;
  windows(d, 0, -2, dep * 0.7, plinth + 6, spine - 6, [-8, 0, 8], 1);
  for (const x of [-8, 0, 8]) {
    box(d, x, -dep * 0.08, 2.4, 2.4, spine, spine + 26 * R);
    beacon(d, x, -dep * 0.08, spine + 26 * R, time + x);
  }
  band(d, 0, 2, w - 8, dep * 0.2, dep * 0.32, plinth + 0.8, rgb(GOLD));
  glow(d, 0, -2, (plinth + spine) / 2, 14, 0.4);
  rankMarks(d, 0, 2, dep - 2, 8, t);
}

function flag(d: Draw, x: number, y: number, z: number, time: number): void {
  const tip = project(x, y, z);
  const fly = Math.sin(time * 3) * 4;
  d.ctx.fillStyle = d.pal.accent;
  d.ctx.beginPath();
  d.ctx.moveTo(tip[0], tip[1]);
  d.ctx.lineTo(tip[0] + 14, tip[1] + 3 + fly);
  d.ctx.lineTo(tip[0], tip[1] + 8);
  d.ctx.closePath();
  d.ctx.fill();
}

function bay(d: Draw, w: number, dep: number, R: number, time: number, tier: number): void {
  const t = Math.max(1, Math.min(4, tier));
  const body = 5 + (t === 1 ? 26 : t === 2 ? 24 : t === 3 ? 32 : 22) * R;
  box(d, 0, t >= 3 ? 0 : -2, w - (t >= 3 ? 4 : 8), dep - (t >= 3 ? 4 : 8), 5, body);
  roofGrid(d, 0, t >= 3 ? 0 : -2, w - 12, dep - 12, body);
  door(d, 0, t >= 3 ? 0 : -2, dep - (t >= 3 ? 4 : 8), 5, 5 + (t >= 3 ? 22 : 18) * R, w * (t >= 3 ? 0.34 : 0.28));
  if (t === 1) {
    box(d, -w * 0.3, -dep * 0.22, 22, 18, body, body + 14 * R);
    windows(d, -w * 0.3, -dep * 0.22, 18, body + 3, body + 11 * R, [-4, 4], 1);
  }
  if (t === 2) {
    box(d, -w * 0.28, -dep * 0.16, w * 0.34, dep * 0.55, body, body + 18 * R);
    silo(d, w * 0.28, -dep * 0.12, 8, body, body + 24 * R);
    windows(d, -w * 0.28, -dep * 0.16, dep * 0.55, body + 4, body + 14 * R, [-6, 6], 1);
    if (R > 0.6) plume(d, w * 0.28, -dep * 0.12, body + 24 * R, time);
    band(d, 0, -2, w - 16, -3, 3, body + 0.7, rgb(GOLD));
  }
  if (t === 3) {
    box(d, 0, -dep * 0.12, w - 10, dep * 0.42, body, body + 10 * R);
    box(d, -w * 0.34, -dep * 0.2, 8, dep * 0.7, body, body + 28 * R);
    box(d, w * 0.16, -dep * 0.28, 20, 8, body + 10 * R, body + 14 * R);
    band(d, 0, 0, w - 8, -4, 2, body + 0.8, rgb(GOLD));
    windows(d, 0, 0, dep - 4, body - 12, body - 4, [-w * 0.2, 0, w * 0.2], 0.6);
    glow(d, -w * 0.34, -dep * 0.05, body + 26 * R, 8, 0.35);
  }
  if (t === 4) {
    const forge = body + 40 * R;
    box(d, 0, -4, 34, 34, body, forge);
    silo(d, -w * 0.28, 2, 10, 5, body + 16 * R);
    silo(d, w * 0.28, 2, 10, 5, body + 16 * R);
    band(d, 0, -4, 30, -4, 4, forge - 4, rgb(GOLD));
    windows(d, 0, -4, 34, body + 8, forge - 10, [-8, 8], 1);
    glow(d, 0, -4, (body + forge) / 2, 18, 0.5 + 0.15 * Math.sin(time * 4));
    beacon(d, 0, -4, forge, time);
    if (R > 0.7) plume(d, -w * 0.28, 2, body + 16 * R, time);
  }
  box(d, -w * 0.18, -dep * 0.05, 4, dep * 0.62, body, body + (t >= 3 ? 8 : 6));
  box(d, w * 0.18, -dep * 0.05, 4, dep * 0.62, body, body + (t >= 3 ? 8 : 6));
  const slide = ((time * (8 + t * 2)) % (w * 0.5)) - w * 0.25;
  glow(d, slide, 0, body + 7, 7, 0.3);
  if (t > 1) rankMarks(d, 0, 0, dep - 6, 9, t);
}

function strip(d: Draw, w: number, dep: number, R: number, time: number, tier: number): void {
  const t = Math.max(1, Math.min(4, tier));
  const deck = 5 + (t >= 3 ? 12 : 8) * R;
  box(d, 0, 2, w - (t >= 4 ? 2 : 4), dep - 2, 5, deck);
  band(d, 0, 2, w - 10, -3, 3, deck + 0.7, t >= 3 ? rgb(GOLD) : "#d7e2ea");
  const lights = Math.max(3, Math.round(w / (t >= 2 ? 14 : 18)));
  for (let i = 0; i < lights; i++) {
    const x = -w / 2 + 10 + ((w - 20) * i) / Math.max(1, lights - 1);
    const on = Math.floor(time * (4 + t) + i) % 2 === 0;
    if (on) glow(d, x, 2, deck + 2, t >= 3 ? 5 : 4, 0.4);
  }
  const towerH = deck + (t === 1 ? 36 : t === 2 ? 48 : t === 3 ? 58 : 46) * R;
  box(d, -w * 0.34, -dep * 0.08, t >= 2 ? 22 : 18, t >= 2 ? 26 : 22, deck, towerH);
  windows(d, -w * 0.34, -dep * 0.08, t >= 2 ? 26 : 22, towerH - 16 * R, towerH - 4, [-4, 4], 1);
  beacon(d, -w * 0.34, -dep * 0.08, towerH, time);
  if (t === 2) {
    box(d, w * 0.22, -dep * 0.05, 20, 18, deck, deck + 22 * R);
    windows(d, w * 0.22, -dep * 0.05, 18, deck + 6, deck + 16 * R, [-4, 4], 1);
    dish(d, w * 0.22, -dep * 0.05, deck + 22 * R, time);
  }
  if (t === 3) {
    box(d, w * 0.18, 2, w * 0.28, dep * 0.55, deck, deck + 16 * R);
    dish(d, -w * 0.34, -dep * 0.2, towerH + 4, time);
    box(d, 0, -dep * 0.22, 10, 10, deck, deck + 20 * R);
    glow(d, 0, -dep * 0.22, deck + 18 * R, 8, 0.4);
  }
  if (t === 4) {
    const twin = deck + 62 * R;
    box(d, w * 0.3, -dep * 0.05, 20, 24, deck, twin);
    windows(d, w * 0.3, -dep * 0.05, 24, twin - 18, twin - 5, [-4, 4], 1);
    beacon(d, w * 0.3, -dep * 0.05, twin, time + 1.4);
    box(d, 0, -2, 5, 5, deck, twin + 18 * R);
    beacon(d, 0, -2, twin + 18 * R, time + 0.6);
    band(d, 0, 2, w - 8, dep * 0.15, dep * 0.28, deck + 1, d.pal.accent);
    glow(d, 0, -2, twin, 14, 0.45);
  }
  if (t > 1) rankMarks(d, w * 0.05, 2, dep - 2, deck + 2, t);
}

function relay(d: Draw, w: number, dep: number, R: number, time: number): void {
  const hall = 5 + 16 * R;
  box(d, 0, 2, w - 8, dep - 8, 5, hall);
  roofGrid(d, 0, 2, w - 12, dep - 12, hall);
  silo(d, -w * 0.22, 0, 9, hall, hall + 28 * R);
  silo(d, w * 0.22, 0, 9, hall, hall + 28 * R);
  const top = hall + 28 * R;
  const a = project(-w * 0.22, 0, top);
  const b = project(w * 0.22, 0, top);
  const c = project(0, 0, top + 14 * R);
  d.ctx.save();
  d.ctx.strokeStyle = rgba(d.pal.accentRgb, 0.45 + 0.45 * Math.sin(time * 8));
  d.ctx.lineWidth = 2;
  d.ctx.beginPath();
  d.ctx.moveTo(a[0], a[1]);
  d.ctx.quadraticCurveTo(c[0], c[1], b[0], b[1]);
  d.ctx.stroke();
  d.ctx.restore();
  glow(d, 0, 0, top + 8 * R, 12, 0.4 + 0.25 * Math.sin(time * 8));
  windows(d, 0, 2, dep - 8, 8, hall - 3, [-8, 8], 0.8);
}

function refinery(d: Draw, w: number, dep: number, R: number, time: number): void {
  const body = 5 + 28 * R;
  box(d, -4, 0, w - 16, dep - 10, 5, body);
  roofGrid(d, -4, 0, w - 20, dep - 14, body);
  door(d, -6, 0, dep - 10, 5, 5 + 16 * R, 14);
  box(d, w * 0.28, dep * 0.12, 16, dep * 0.55, 5, 5 + 12 * R);
  silo(d, w * 0.22, -dep * 0.16, 8, body, body + 26 * R);
  box(d, -w * 0.22, -dep * 0.2, 18, 14, body, body + 8 * R);
  windows(d, -4, 0, dep - 10, body - 10 * R, body - 4, [-w * 0.22, -w * 0.08, w * 0.06], 1);
  if (R > 0.7) plume(d, w * 0.22, -dep * 0.16, body + 26 * R, time);
}

function turret(d: Draw, spec: StructureSpec, R: number): void {
  const body = 5 + 12 * R;
  silo(d, 0, 2, Math.min(spec.w, spec.d) * 0.34, 5, body);
  box(d, 0, 2, 14, 14, body - 2, body + 6 * R);
  barrel(d, 0, 2, body + 6 * R, spec.aim, spec.w > 40 ? 28 : 20, spec.w > 40 ? 5 : 3.4, spec.flash);
}

function sam(d: Draw, R: number, time: number, aim: number, flash: number): void {
  const body = 5 + 10 * R;
  box(d, 0, 1, 26, 26, 5, body);
  roofGrid(d, 0, 1, 22, 22, body);
  barrel(d, -4, 1, body + 2, aim - 0.5, 16, 2.4, flash);
  barrel(d, 4, 1, body + 2, aim - 0.35, 16, 2.4, 0);
  dish(d, 0, -2, body + 4, time);
}

function cannon(d: Draw, spec: StructureSpec, R: number): void {
  const body = 5 + 16 * R;
  box(d, 0, 2, spec.w - 8, spec.d - 8, 5, body);
  roofGrid(d, 0, 2, spec.w - 12, spec.d - 12, body);
  silo(d, 0, 0, 11, body, body + 8 * R);
  windows(d, 0, 2, spec.d - 8, 8, body - 4, [-8, 8], 0.7);
  barrel(d, 0, 0, body + 8 * R, spec.aim, 34, 6, spec.flash);
}

function wall(d: Draw, w: number, R: number): void {
  const body = 5 + 12 * R;
  box(d, 0, 0, w - 2, 12, 5, body);
  band(d, 0, 0, w - 4, -2, 2, body + 0.8, d.pal.accent);
  for (const x of [-w * 0.28, 0, w * 0.28]) box(d, x, 0, 6, 8, body, body + 5 * R);
  glow(d, 0, 0, body + 2, 6, 0.22);
}

function siloYard(d: Draw, w: number, dep: number, R: number, time: number): void {
  const base = 5 + 8 * R;
  box(d, 0, 2, w - 6, dep - 6, 5, base);
  silo(d, -w * 0.2, 0, 11, base, base + 30 * R);
  silo(d, w * 0.2, 2, 9, base, base + 24 * R);
  box(d, 0, 4, 8, 6, base, base + 6 * R);
  glow(d, -w * 0.2, 0, base + 30 * R, 8, 0.3 + 0.15 * Math.sin(time * 2));
}

function generic(d: Draw, w: number, dep: number, R: number): void {
  const body = 5 + 22 * R;
  box(d, 0, 0, w - 8, dep - 8, 5, body);
  roofGrid(d, 0, 0, w - 12, dep - 12, body);
  windows(d, 0, 0, dep - 8, 10, body - 5, [-w * 0.2, 0, w * 0.2], 0.8);
}

export function drawStructure(
  ctx: CanvasRenderingContext2D,
  kind: Kind,
  time: number,
  teamColor: string,
  team: 0 | 1,
  spec: StructureSpec,
): number {
  const R = spec.progress <= 0 ? 0.04 : spec.progress;
  const pal = makePal(team, teamColor, spec.hpRatio);
  const advanced = kind === "spire" || kind === "barracks" || kind === "bay" || kind === "strip";
  const d: Draw = {
    ctx,
    pal: advanced && spec.tier > 1 ? promote(pal, spec.tier, team) : pal,
    crown: 0,
    note: (y) => {
      if (y < d.crown) d.crown = y;
    },
  };
  const { w, d: dep } = spec;
  shadow(ctx, w, dep, (FULL_H[kind] ?? 40) * R);
  pad(d, w, dep);
  let roofZ = 20;
  if (kind === "spire") roofZ = spire(d, w, dep, R, time, spec.tier);
  else if (kind === "relay") {
    relay(d, w, dep, R, time);
    roofZ = 5 + 44 * R;
  } else if (kind === "refinery") {
    refinery(d, w, dep, R, time);
    roofZ = 5 + 28 * R;
  } else if (kind === "barracks") {
    barracks(d, w, dep, R, time, spec.tier);
    roofZ = 5 + 24 * R;
  } else if (kind === "bay") {
    bay(d, w, dep, R, time, spec.tier);
    roofZ = 5 + 26 * R;
  } else if (kind === "turret") turret(d, spec, R);
  else if (kind === "sam") sam(d, R, time, spec.aim, spec.flash);
  else if (kind === "cannon") cannon(d, spec, R);
  else if (kind === "wall") wall(d, w, R);
  else if (kind === "strip") {
    strip(d, w, dep, R, time, spec.tier);
    roofZ = 5 + 8 * R;
  } else if (kind === "silo") siloYard(d, w, dep, R, time);
  else generic(d, w, dep, R);

  if (spec.hpRatio < 0.72 && R > 0.85) scorch(d, w * 0.7, dep * 0.55, roofZ, spec.hpRatio);
  if (spec.flash > 0) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = "#fff";
    const c = project(0, 0, roofZ);
    ctx.beginPath();
    ctx.ellipse(c[0], c[1], w * 0.28, dep * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (R < 0.98) {
    scaffold(ctx, w, dep, FULL_H[kind] ?? 48, pal.accentRgb);
    const scan = project(0, 0, (FULL_H[kind] ?? 48) * R);
    ctx.save();
    ctx.strokeStyle = rgba(pal.accentRgb, 0.9);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(scan[0], scan[1], 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * R);
    ctx.stroke();
    ctx.restore();
  }
  return d.crown;
}
