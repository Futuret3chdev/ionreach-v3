import { useEffect, useRef, useState } from "react";
import type { Chapter } from "@/game/campaign";

export function Briefing({
  chapter,
  locked = false,
  onPlay,
  onBack,
  onLoad,
}: {
  chapter: Chapter;
  locked?: boolean;
  onPlay: (watched: boolean) => void;
  onBack: () => void;
  onLoad: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const watched = useRef(false);
  const [blocked, setBlocked] = useState(false);
  const [sound, setSound] = useState(false);

  useEffect(() => {
    watched.current = false;
    setBlocked(false);
    setSound(false);
    window.speechSynthesis?.cancel();
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.loop = true;
    const start = () => {
      void video.play().catch(() => setBlocked(true));
    };
    if (video.readyState >= 2) start();
    else video.addEventListener("loadeddata", start, { once: true });
  }, [chapter.id]);

  function play() {
    setBlocked(false);
    const video = videoRef.current;
    if (!video) return;
    video.muted = !sound;
    void video.play().catch(() => setBlocked(true));
  }

  function toggleSound() {
    const video = videoRef.current;
    const next = !sound;
    setSound(next);
    if (video) video.muted = !next;
  }

  return (
    <div className="absolute inset-0 z-40 bg-black">
      <video
        ref={videoRef}
        key={chapter.id}
        className="h-full w-full bg-black object-contain"
        src={`/media/briefings/${chapter.video}.mp4?v=drive`}
        playsInline
        autoPlay
        muted
        loop
        onTimeUpdate={() => {
          const video = videoRef.current;
          if (video && video.currentTime > 1) watched.current = true;
        }}
      />
      <button type="button" onClick={onBack} className="absolute top-3 left-3 z-30 min-h-11 border border-line bg-bg px-4 font-display">
        Back to menu
      </button>
      <button type="button" onClick={toggleSound} className="absolute top-3 right-3 z-30 min-h-11 border border-line bg-bg px-4 font-display">
        {sound ? "Sound on" : "Sound off"}
      </button>
      {blocked && (
        <button type="button" onClick={play} className="absolute inset-x-0 top-16 bottom-24 z-10 flex items-center justify-center bg-black/45">
          <span className="min-h-11 bg-ion px-5 font-display text-lg text-bg">Play the film</span>
        </button>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 bg-gradient-to-t from-black via-black/80 to-transparent px-5 pt-12 pb-3 md:px-12">
        <p className="font-display text-xs tracking-[0.22em] text-ion">{chapter.country.toUpperCase()}</p>
        <h2 className="font-display text-4xl font-semibold text-fg">{chapter.theater}</h2>
        <p className="mt-1 max-w-3xl text-base text-fg">{chapter.beats[0]}</p>
      </div>
      <div className="absolute inset-x-0 bottom-0 z-30 flex flex-wrap items-center gap-2 border-t border-line bg-bg px-3 py-3">
        <button type="button" onClick={onBack} className="min-h-11 border border-line bg-surface px-4 font-display">Back to menu</button>
        <button type="button" onClick={onLoad} className="min-h-11 border border-line px-3 font-display">Load saved game</button>
        <button type="button" disabled={locked} onClick={() => onPlay(watched.current)} className="min-h-11 bg-ion px-4 font-display text-bg disabled:cursor-not-allowed disabled:bg-line disabled:text-muted">
          Play now
        </button>
      </div>
    </div>
  );
}
