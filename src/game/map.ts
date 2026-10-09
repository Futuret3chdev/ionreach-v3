import { chapterById, type Chapter } from "./campaign";
import { COLS, ROWS, TILE, WORLD_H, WORLD_W } from "./content";

export interface BuiltMap {
  tiles: Uint8Array;
  ion: Uint16Array;
  style: Float32Array;
  flora: Uint8Array;
  chapterId: string;
  player: { x: number; y: number };
  enemy: { x: number; y: number };
  mid: { x: number; y: number };
}

function hash(x: number, y: number): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function smooth(c: number, r: number): number {
  const x0 = Math.floor(c);
  const y0 = Math.floor(r);
  const tx = c - x0;
  const ty = r - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash(x0, y0);
  const b = hash(x0 + 1, y0);
  const c0 = hash(x0, y0 + 1);
  const d = hash(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c0 - a) * sy + (a - b - c0 + d) * sx * sy;
}

function idx(c: number, r: number): number {
  return r * COLS + c;
}

function disk(tiles: Uint8Array, ion: Uint16Array, cx: number, cy: number, rad: number, rock: boolean, amount = 0) {
  const r2 = rad * rad;
  for (let r = Math.max(1, Math.floor(cy - rad)); r <= Math.min(ROWS - 2, Math.ceil(cy + rad)); r++) {
    for (let c = Math.max(1, Math.floor(cx - rad)); c <= Math.min(COLS - 2, Math.ceil(cx + rad)); c++) {
      const dx = c + 0.5 - cx;
      const dy = r + 0.5 - cy;
      if (dx * dx + dy * dy > r2) continue;
      const i = idx(c, r);
      if (rock) {
        tiles[i] = 1;
        ion[i] = 0;
      } else if (tiles[i] !== 1) {
        tiles[i] = 2;
        ion[i] = amount;
      }
    }
  }
}

function clearPad(tiles: Uint8Array, ion: Uint16Array, c0: number, r0: number, c1: number, r1: number) {
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (c < 1 || r < 1 || c >= COLS - 1 || r >= ROWS - 1) continue;
      const i = idx(c, r);
      tiles[i] = 0;
      ion[i] = 0;
    }
  }
}

export function buildMap(chapter: Chapter = chapterById("usa-01")): BuiltMap {
  const tiles = new Uint8Array(COLS * ROWS);
  const ion = new Uint16Array(COLS * ROWS);
  const style = new Float32Array(COLS * ROWS);
  const flora = new Uint8Array(COLS * ROWS);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = idx(c, r);
      style[i] = smooth(c * 0.17 + chapter.salt, r * 0.17) * 0.65 + smooth(c * 0.05 + chapter.salt, r * 0.05) * 0.35;
      if (c === 0 || r === 0 || c === COLS - 1 || r === ROWS - 1) tiles[i] = 1;
      else tiles[i] = 0;
    }
  }

  for (let c = 26; c <= 54; c++) {
    const expected = 5 + (c / (COLS - 1)) * (ROWS - 10);
    for (let r = 2; r < ROWS - 2; r++) {
      if (Math.abs(r - expected) > 1.15) continue;
      const gapA = Math.hypot(c - 36, r - (5 + (36 / (COLS - 1)) * (ROWS - 10)));
      const gapB = Math.hypot(c - 48, r - (5 + (48 / (COLS - 1)) * (ROWS - 10)));
      if (gapA < 3.4 || gapB < 3.2) continue;
      tiles[idx(c, r)] = 1;
    }
  }

  disk(tiles, ion, 30, 14, 2.2, true);
  disk(tiles, ion, 24, 44, 2.4, true);
  disk(tiles, ion, 50, 42, 1.8, true);
  disk(tiles, ion, 58, 30, 2.1, true);
  disk(tiles, ion, 18, 18, 1.6, true);

  const extras = Math.round(2 + chapter.peaks * 4);
  for (let n = 0; n < extras; n++) {
    const cx = 16 + ((n * 11 + Math.floor(chapter.salt * 5)) % 46);
    const cy = 12 + ((n * 7 + Math.floor(chapter.salt * 3)) % 28);
    disk(tiles, ion, cx, cy, 1.3 + (n % 3) * 0.35, true);
  }

  carveWater(tiles, chapter);

  clearPad(tiles, ion, 6, 32, 20, 48);
  clearPad(tiles, ion, 56, 4, 72, 18);

  disk(tiles, ion, 23, 30, 2.3, false, 2800);
  disk(tiles, ion, 18, 27, 1.7, false, 2400);
  disk(tiles, ion, 40, 27, 2.5, false, 3200);
  disk(tiles, ion, 54, 20, 2.1, false, 2600);
  disk(tiles, ion, 61, 22, 1.8, false, 2400);

  for (let r = 2; r < ROWS - 2; r++) {
    for (let c = 2; c < COLS - 2; c++) {
      const i = idx(c, r);
      if (tiles[i] !== 0) continue;
      if (c >= 6 && c <= 20 && r >= 32 && r <= 48) continue;
      if (c >= 56 && c <= 72 && r >= 4 && r <= 18) continue;
      const n = smooth(c * 0.23 + chapter.salt, r * 0.23);
      if (n > 1 - chapter.forest * 0.55) flora[i] = n > 0.82 ? 2 : 1;
    }
  }

  const player = { x: 11.5 * TILE, y: 39.5 * TILE };
  const enemy = { x: 64.5 * TILE, y: 10.5 * TILE };
  const mid = { x: 40.5 * TILE, y: 27.5 * TILE };

  return { tiles, ion, style, flora, chapterId: chapter.id, player, enemy, mid };
}

function carveWater(tiles: Uint8Array, chapter: Chapter): void {
  const wet = (c: number, r: number) => {
    if (c < 2 || r < 2 || c >= COLS - 2 || r >= ROWS - 2) return;
    const i = idx(c, r);
    if (tiles[i] === 2) return;
    tiles[i] = 3;
  };
  if (chapter.water === "coast") {
    const depth = 2 + Math.round(chapter.waterAmt * 3);
    for (let r = 1; r < depth; r++) {
      for (let c = 2; c < COLS - 2; c++) wet(c, r);
    }
    return;
  }
  if (chapter.water === "lakes") {
    const lakes = 2 + Math.round(chapter.waterAmt * 3);
    for (let n = 0; n < lakes; n++) {
      const cx = 14 + ((n * 13 + Math.floor(chapter.salt * 4)) % 48);
      const cy = 16 + ((n * 9) % 18);
      const rad = 1.6 + chapter.waterAmt;
      for (let r = Math.floor(cy - rad); r <= cy + rad; r++) {
        for (let c = Math.floor(cx - rad); c <= cx + rad; c++) {
          if ((c - cx) ** 2 + (r - cy) ** 2 <= rad * rad) wet(c, r);
        }
      }
    }
    return;
  }
  for (let c = 4; c < COLS - 4; c++) {
    if (c % 15 < 3) continue;
    const y = 22 + Math.sin(c * 0.2 + chapter.salt) * (2 + chapter.waterAmt * 2);
    const width = 0.7 + chapter.waterAmt * 1.15;
    for (let r = Math.floor(y - width); r <= Math.ceil(y + width); r++) wet(c, r);
  }
}

export function tileCenter(c: number, r: number): { x: number; y: number } {
  return { x: (c + 0.5) * TILE, y: (r + 0.5) * TILE };
}

export function inWorld(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < WORLD_W && y < WORLD_H;
}
