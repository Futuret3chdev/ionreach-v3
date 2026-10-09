import { useEffect, useRef, useState } from "react";
import type { Chapter } from "@/game/campaign";

const FILM = 45;

export function Briefing({ chapter, onDone, onBack }: { chapter: Chapter; onDone: () => void; onBack: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [left, setLeft] = useState(FILM);
  const done = useRef(false);
  const finish = useRef(onDone);
  finish.current = onDone;

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    done.current = false;
    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const box = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(box.width * dpr));
      const h = Math.max(1, Math.round(box.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const t = reduce ? 30 : Math.min(FILM, (now - start) / 1000);
      paint(ctx, w, h, t, chapter);
      const remain = Math.max(0, Math.ceil(FILM - t));
      setLeft((prev) => (prev === remain ? prev : remain));
      if (!reduce && t >= FILM && !done.current) {
        done.current = true;
        finish.current();
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [chapter]);

  const beat = left > 30 ? 0 : left > 15 ? 1 : 2;

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-bg">
      <canvas ref={canvasRef} className="min-h-0 w-full flex-1" />
      <div className="pointer-events-none absolute inset-x-0 bottom-24 px-5 md:px-12">
        <p className="font-display text-xs tracking-[0.22em] text-ion">CHAPTER FILM · {chapter.country.toUpperCase()}</p>
        <h2 className="font-display text-4xl font-semibold text-fg md:text-5xl">{chapter.theater}</h2>
        <p className="mt-2 max-w-xl text-base text-fg">{chapter.beats[beat]}</p>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
        <p className="font-display text-lg text-gold">{left}s</p>
        <div className="h-1 max-w-xs flex-1 bg-line">
          <div className="h-full bg-ion" style={{ width: `${((FILM - left) / FILM) * 100}%` }} />
        </div>
        <button type="button" onClick={onBack} className="min-h-11 border border-line px-3 font-display">
          Back
        </button>
        <button type="button" onClick={onDone} className="min-h-11 bg-ion px-4 font-display text-bg">
          Drop in
        </button>
      </div>
    </div>
  );
}

function paint(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, chapter: Chapter): void {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, chapter.sky[0]);
  sky.addColorStop(1, chapter.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = chapter.snow ? "rgba(255,255,255,0.55)" : "rgba(20,16,12,0.55)";
  for (let i = 0; i < 5; i++) {
    const x = ((i * 0.22 - t * 0.01) % 1) * w;
    ctx.beginPath();
    ctx.moveTo(x, h * 0.62);
    ctx.lineTo(x + w * 0.16, h * (0.28 + (i % 3) * 0.04));
    ctx.lineTo(x + w * 0.34, h * 0.62);
    ctx.fill();
  }
  ctx.fillStyle = chapter.waterFill;
  ctx.fillRect(0, h * 0.62, w, h * 0.12);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(0, h * 0.66 + Math.sin(t) * 4, w, 3);
  const [gr, gg, gb] = chapter.ground;
  ctx.fillStyle = `rgb(${gr},${gg},${gb})`;
  ctx.fillRect(0, h * 0.74, w, h * 0.26);
  ctx.fillStyle = chapter.canopy;
  for (let i = 0; i < 14; i++) {
    const x = ((i / 14) * w + Math.sin(i) * 20) % w;
    ctx.beginPath();
    ctx.arc(x, h * 0.78, 18 + (i % 3) * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  const convoy = ((t / FILM) * 1.3) % 1;
  ctx.fillStyle = "#141a22";
  for (let i = 0; i < 4; i++) {
    const x = convoy * w + i * 54 - 80;
    ctx.fillRect(x, h * 0.84, 40, 14);
    ctx.fillRect(x + 12, h * 0.8, 16, 8);
  }
  ctx.fillStyle = "#d7e4ea";
  const jet = (t * 40) % (w + 80) - 40;
  ctx.beginPath();
  ctx.moveTo(jet, h * 0.22);
  ctx.lineTo(jet - 36, h * 0.26);
  ctx.lineTo(jet - 18, h * 0.22);
  ctx.lineTo(jet - 36, h * 0.18);
  ctx.closePath();
  ctx.fill();
}
