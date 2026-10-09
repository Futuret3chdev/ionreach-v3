import { useEffect, useRef, useState } from "react";
import type { Chapter } from "@/game/campaign";

export function Briefing({ chapter, onDone, onBack }: { chapter: Chapter; onDone: () => void; onBack: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const done = useRef(false);
  const finish = useRef(onDone);
  const [blocked, setBlocked] = useState(false);
  finish.current = onDone;

  useEffect(() => {
    done.current = false;
    setBlocked(false);
    const video = videoRef.current;
    if (!video) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    video.currentTime = 0;
    if (reduce) {
      setBlocked(true);
      return;
    }
    void video.play().catch(() => setBlocked(true));
  }, [chapter.id]);

  function finishOnce() {
    if (done.current) return;
    done.current = true;
    finish.current();
  }

  function play() {
    const video = videoRef.current;
    if (!video) return;
    setBlocked(false);
    void video.play().catch(() => setBlocked(true));
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-black">
      <video
        ref={videoRef}
        key={chapter.id}
        className="min-h-0 w-full flex-1 bg-black object-contain"
        src={`/media/briefings/${chapter.id}.mp4`}
        poster="/media/poster.jpg"
        playsInline
        autoPlay
        onEnded={finishOnce}
      />
      {blocked && (
        <button type="button" onClick={play} className="absolute inset-0 z-10 flex items-center justify-center bg-black/45">
          <span className="min-h-11 bg-ion px-5 font-display text-lg text-bg">Play the brief</span>
        </button>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-16 bg-gradient-to-t from-black via-black/85 to-transparent px-5 pt-16 pb-4 md:px-12">
        <p className="font-display text-xs tracking-[0.22em] text-ion">INCOMING BRIEF · {chapter.country.toUpperCase()}</p>
        <h2 className="font-display text-4xl font-semibold text-fg md:text-5xl">{chapter.theater}</h2>
        <p className="mt-2 max-w-2xl text-base text-fg">{chapter.beats[0]}</p>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line bg-bg px-4 py-3">
        <p className="font-display text-sm tracking-[0.16em] text-gold">STORY CUTSCENE</p>
        <div className="flex gap-2">
          <button type="button" onClick={onBack} className="min-h-11 border border-line px-3 font-display">
            Back
          </button>
          <button type="button" onClick={finishOnce} className="min-h-11 bg-ion px-4 font-display text-bg">
            Drop in
          </button>
        </div>
      </div>
    </div>
  );
}
