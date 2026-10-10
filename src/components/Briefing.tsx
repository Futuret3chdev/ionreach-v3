import { useEffect, useRef, useState } from "react";
import type { Chapter } from "@/game/campaign";
import { STORIES } from "@/game/stories";

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
  const story = STORIES[chapter.theater] ?? chapter.beats.filter(Boolean).join(" ");

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
    <div className="absolute inset-0 z-40 flex flex-col bg-black">
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onBack} className="min-h-11 border border-line bg-bg px-4 font-display">
          Back to menu
        </button>
        <button type="button" onClick={toggleSound} className="min-h-11 border border-line bg-bg px-4 font-display">
          {sound ? "Sound on" : "Sound off"}
        </button>
      </div>
      <div className="relative mx-auto mt-2 w-full max-w-3xl shrink-0 px-3">
        <video
          ref={videoRef}
          key={chapter.id}
          className="aspect-video w-full bg-black object-cover"
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
        {blocked && (
          <button type="button" onClick={play} className="absolute inset-0 flex items-center justify-center bg-black/45">
            <span className="min-h-11 bg-ion px-5 font-display text-lg text-bg">Play the film</span>
          </button>
        )}
      </div>
      <article className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <p className="font-display text-xs tracking-[0.22em] text-ion">{chapter.country.toUpperCase()}</p>
        <h2 className="font-display text-3xl font-semibold text-fg">{chapter.theater}</h2>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-fg">{story}</p>
        {chapter.hudson && <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">{chapter.hudson}</p>}
      </article>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-line bg-bg px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button type="button" onClick={onBack} className="min-h-11 border border-line bg-surface px-4 font-display">Back to menu</button>
        <button type="button" onClick={onLoad} className="min-h-11 border border-line px-3 font-display">Load saved game</button>
        <button type="button" disabled={locked} onClick={() => onPlay(watched.current)} className="min-h-11 bg-ion px-4 font-display text-bg disabled:cursor-not-allowed disabled:bg-line disabled:text-muted">
          Play now
        </button>
      </div>
    </div>
  );
}
