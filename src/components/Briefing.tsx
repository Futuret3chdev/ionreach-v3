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
  const [choice, setChoice] = useState(false);

  useEffect(() => {
    watched.current = false;
    setBlocked(false);
    setChoice(false);
    window.speechSynthesis?.cancel();
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    video.currentTime = 0;
    void video.play().catch(() => setBlocked(true));
  }, [chapter.id]);

  function play() {
    setBlocked(false);
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    void video.play().catch(() => setBlocked(true));
  }

  function finish(didWatch: boolean) {
    if (didWatch) watched.current = true;
    videoRef.current?.pause();
    setChoice(true);
  }

  return (
    <div className="absolute inset-0 z-40 bg-black">
      <video
        ref={videoRef}
        key={chapter.id}
        className="h-full w-full bg-black object-contain"
        src={`/media/briefings/${chapter.video}.mp4?v=usbrief`}
        poster="/media/poster.jpg"
        playsInline
        autoPlay
        onEnded={() => finish(true)}
      />
      <button type="button" onClick={onBack} className="absolute top-3 left-3 z-30 min-h-11 border border-line bg-bg px-4 font-display">
        Back to menu
      </button>
      {blocked && !choice && (
        <button type="button" onClick={play} className="absolute inset-x-0 top-16 bottom-24 z-10 flex items-center justify-center bg-black/45">
          <span className="min-h-11 bg-ion px-5 font-display text-lg text-bg">Play the film</span>
        </button>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 bg-gradient-to-t from-black via-black/80 to-transparent px-5 pt-12 pb-3 md:px-12">
        <p className="font-display text-xs tracking-[0.22em] text-ion">{chapter.country.toUpperCase()} · CHAPTER {chapter.index}</p>
        <h2 className="font-display text-4xl font-semibold text-fg">{chapter.theater}</h2>
        <p className="mt-1 max-w-3xl text-base text-fg">{choice ? "This part of the country story is finished. The fight does not start until you choose." : `${chapter.beats[0]} This chapter only: ${chapter.line}`}</p>
      </div>
      <div className="absolute inset-x-0 bottom-0 z-30 flex flex-wrap items-center gap-2 border-t border-line bg-bg px-3 py-3">
        <button type="button" onClick={onBack} className="min-h-11 border border-line bg-surface px-4 font-display">Back to menu</button>
        <button type="button" onClick={onLoad} className="min-h-11 border border-line px-3 font-display">Load saved game</button>
        <button type="button" disabled={locked || !choice} onClick={() => onPlay(watched.current)} className="min-h-11 bg-ion px-4 font-display text-bg disabled:cursor-not-allowed disabled:bg-line disabled:text-muted">
          Play now
        </button>
        {!choice && (
          <button type="button" onClick={() => finish(false)} className="min-h-11 border border-line px-3 font-display">Skip to choice</button>
        )}
      </div>
    </div>
  );
}
