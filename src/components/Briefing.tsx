import { useEffect, useRef, useState } from "react";
import type { Chapter } from "@/game/campaign";

const VOICE: Record<string, string> = {
  usa: "voice-usa",
  australia: "voice-australia",
  uk: "voice-uk",
  france: "voice-france",
  japan: "voice-japan",
  korea: "voice-korea",
  india: "voice-india",
  brazil: "voice-brazil",
  russia: "voice-russia",
  china: "voice-china",
};

const ORDERS = [
  "Hold the crossing and keep the column alive.",
  "Silence the relay before their air arrives.",
  "Mine the ionite vein. Do not wake the slope.",
  "Protect the cargo until it clears the ridge.",
  "Break the enemy spire, then hold the ground.",
  "Raise a relay and keep it standing.",
  "Destroy the warhead building before the clock dies.",
  "Steal the sealed crate and bring it home.",
];

function linesFor(chapter: Chapter): string[] {
  const order = ORDERS[(chapter.index + chapter.country.length) % ORDERS.length];
  return [
    `${chapter.country}. Chapter ${chapter.index}. ${chapter.theater}.`,
    chapter.beats[0],
    chapter.line,
    order,
    chapter.hudson,
  ];
}

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
  const audioRef = useRef<HTMLAudioElement>(null);
  const watched = useRef(false);
  const [blocked, setBlocked] = useState(false);
  const [choice, setChoice] = useState(false);
  const [line, setLine] = useState(0);
  const lines = linesFor(chapter);

  useEffect(() => {
    watched.current = false;
    setBlocked(false);
    setChoice(false);
    setLine(0);
    window.speechSynthesis?.cancel();
    const video = videoRef.current;
    const audio = audioRef.current;
    if (video) {
      video.muted = true;
      video.currentTime = 0;
      void video.play().catch(() => setBlocked(true));
    }
    if (audio) {
      audio.src = `/media/briefings/${VOICE[chapter.countryId] ?? "voice-usa"}.mp3`;
      audio.currentTime = 0;
      void audio.play().catch(() => setBlocked(true));
    }
    const step = window.setInterval(() => setLine((n) => (n + 1) % lines.length), 6500);
    return () => window.clearInterval(step);
  }, [chapter.id]);

  function play() {
    setBlocked(false);
    const video = videoRef.current;
    const audio = audioRef.current;
    if (video) {
      video.muted = true;
      void video.play().catch(() => setBlocked(true));
    }
    void audio?.play().catch(() => setBlocked(true));
  }

  function hold(didWatch: boolean) {
    if (didWatch) watched.current = true;
    videoRef.current?.pause();
    audioRef.current?.pause();
    setChoice(true);
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-black">
      <video
        ref={videoRef}
        key={chapter.id}
        className="min-h-0 w-full flex-1 bg-black object-contain"
        src={`/media/briefings/${chapter.video}.mp4?v=film`}
        poster="/media/poster.jpg"
        playsInline
        autoPlay
        muted
        loop
      />
      <audio ref={audioRef} onEnded={() => hold(true)} />
      {blocked && !choice && (
        <button type="button" onClick={play} className="absolute inset-0 z-10 flex items-center justify-center bg-black/45">
          <span className="min-h-11 bg-ion px-5 font-display text-lg text-bg">Play the brief</span>
        </button>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-16 bg-gradient-to-t from-black via-black/85 to-transparent px-5 pt-16 pb-4 md:px-12">
        <p className="font-display text-xs tracking-[0.22em] text-ion">{chapter.country.toUpperCase()} BRIEF · CHAPTER {chapter.index}</p>
        <h2 className="font-display text-4xl font-semibold text-fg md:text-5xl">{chapter.theater}</h2>
        <p className="mt-2 max-w-3xl text-base text-fg md:text-lg">{choice ? "Brief complete. The fight does not start until you choose." : lines[line]}</p>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line bg-bg px-4 py-3">
        <p className="font-display text-sm tracking-[0.16em] text-gold">{locked ? "SEALED" : choice ? "CHOOSE" : "CHAPTER FILM"}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onBack} className="min-h-11 border border-line px-3 font-display">Go back</button>
          <button type="button" onClick={onLoad} className="min-h-11 border border-line px-3 font-display">Load saved game</button>
          <button type="button" disabled={locked || !choice} onClick={() => onPlay(watched.current)} className="min-h-11 bg-ion px-4 font-display text-bg disabled:cursor-not-allowed disabled:bg-line disabled:text-muted">
            Play now
          </button>
          {!choice && (
            <button type="button" onClick={() => hold(false)} className="min-h-11 border border-line px-3 font-display">Skip to choice</button>
          )}
        </div>
      </div>
    </div>
  );
}
