import { useEffect, useRef, useState } from "react";
import type { Chapter } from "@/game/campaign";

export function Briefing({
  chapter,
  onPlay,
  onBack,
  onLoad,
}: {
  chapter: Chapter;
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

  function play() {
    const video = videoRef.current;
    if (!video) return;
    setBlocked(false);
    void video.play().catch(() => setBlocked(true));
  }

  function hold(didWatch: boolean) {
    if (didWatch) watched.current = true;
    videoRef.current?.pause();
    setChoice(true);
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-black">
      <video
        ref={videoRef}
        key={chapter.id}
        className="min-h-0 w-full flex-1 bg-black object-contain"
        src={`/media/briefings/${chapter.video}.mp4`}
        poster="/media/poster.jpg"
        playsInline
        autoPlay
        onEnded={() => hold(true)}
      />
      {blocked && !choice && (
        <button type="button" onClick={play} className="absolute inset-0 z-10 flex items-center justify-center bg-black/45">
          <span className="min-h-11 bg-ion px-5 font-display text-lg text-bg">Play the brief</span>
        </button>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-16 bg-gradient-to-t from-black via-black/85 to-transparent px-5 pt-16 pb-4 md:px-12">
        <p className="font-display text-xs tracking-[0.22em] text-ion">INCOMING BRIEF · {chapter.country.toUpperCase()}</p>
        <h2 className="font-display text-4xl font-semibold text-fg md:text-5xl">{chapter.theater}</h2>
        <p className="mt-2 max-w-2xl text-base text-fg">{choice ? "Film complete. The fight does not start until you choose." : chapter.beats[0]}</p>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line bg-bg px-4 py-3">
        <p className="font-display text-sm tracking-[0.16em] text-gold">{choice ? "CHOOSE" : "STORY CUTSCENE"}</p>
        {choice ? (
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => onPlay(watched.current)} className="min-h-11 bg-ion px-4 font-display text-bg">
              Play now
            </button>
            <button type="button" onClick={onBack} className="min-h-11 border border-line px-3 font-display">
              Go back
            </button>
            <button type="button" onClick={onLoad} className="min-h-11 border border-line px-3 font-display">
              Load saved game
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={onBack} className="min-h-11 border border-line px-3 font-display">
              Go back
            </button>
            <button type="button" onClick={() => hold(false)} className="min-h-11 bg-ion px-4 font-display text-bg">
              Skip to choice
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
