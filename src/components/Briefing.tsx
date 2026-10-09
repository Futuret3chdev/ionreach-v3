import { useEffect, useRef, useState } from "react";
import type { Chapter } from "@/game/campaign";

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

function storyOf(chapter: Chapter): string[] {
  const order = ORDERS[(chapter.index + chapter.country.length) % ORDERS.length];
  const long = chapter.index % 2 === 0;
  return [
    `Incoming brief. ${chapter.country}. Chapter ${chapter.index}. ${chapter.theater}. This is Major Hudson. Do not drop until you have heard the ground.`,
    chapter.beats[0],
    `${chapter.line} Vesper holds the far ridge. This level is not a charge.`,
    `What happens here: ${order} Infantry takes the cover. Armor waits until the lane is quiet.`,
    long
      ? "Their relief column is already moving. You will hear them before you see them. Count what you build. Count what you lose."
      : "If you bunch the tanks, their guns write the ending. The next chapter stays sealed until this film is heard, or this fight is won.",
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
  const lines = storyOf(chapter);
  const spoken = lines.join(" ");

  useEffect(() => {
    watched.current = false;
    setBlocked(false);
    setChoice(false);
    setLine(0);
    const video = videoRef.current;
    const audio = audioRef.current;
    window.speechSynthesis?.cancel();
    if (!video) return;
    video.currentTime = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) setBlocked(true);
    else void video.play().catch(() => setBlocked(true));
    const opener = !chapter.video.includes("-");
    if (opener && audio) {
      audio.src = `/media/briefings/${chapter.video}.mp3`;
      void audio.play().catch(() => speak());
    } else speak();
    const step = window.setInterval(() => setLine((n) => Math.min(lines.length - 1, n + 1)), 7000 + chapter.index * 400);
    return () => {
      window.clearInterval(step);
      window.speechSynthesis?.cancel();
      audio?.pause();
    };
    function speak() {
      if (!window.speechSynthesis) return;
      const utter = new SpeechSynthesisUtterance(spoken);
      utter.rate = 0.92;
      utter.onend = () => hold(true);
      window.speechSynthesis.speak(utter);
    }
  }, [chapter.id]);

  function play() {
    setBlocked(false);
    void videoRef.current?.play().catch(() => setBlocked(true));
    void audioRef.current?.play().catch(() => undefined);
  }

  function hold(didWatch: boolean) {
    if (didWatch) watched.current = true;
    videoRef.current?.pause();
    audioRef.current?.pause();
    window.speechSynthesis?.cancel();
    setChoice(true);
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-black">
      <video
        ref={videoRef}
        key={chapter.id}
        className="min-h-0 w-full flex-1 bg-black object-contain"
        src={`/media/briefings/${chapter.video}.mp4?v=story`}
        poster="/media/poster.jpg"
        playsInline
        autoPlay
        onEnded={() => {
          if (audioRef.current && !audioRef.current.ended && audioRef.current.src) return;
          if (!window.speechSynthesis?.speaking) hold(true);
        }}
      />
      <audio ref={audioRef} onEnded={() => hold(true)} />
      {blocked && !choice && (
        <button type="button" onClick={play} className="absolute inset-0 z-10 flex items-center justify-center bg-black/45">
          <span className="min-h-11 bg-ion px-5 font-display text-lg text-bg">Play the brief</span>
        </button>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-16 bg-gradient-to-t from-black via-black/85 to-transparent px-5 pt-16 pb-4 md:px-12">
        <p className="font-display text-xs tracking-[0.22em] text-ion">MAJOR HUDSON · {chapter.country.toUpperCase()} · CHAPTER {chapter.index}</p>
        <h2 className="font-display text-4xl font-semibold text-fg md:text-5xl">{chapter.theater}</h2>
        <p className="mt-2 max-w-3xl text-base text-fg md:text-lg">{choice ? "Brief complete. The fight does not start until you choose." : lines[line]}</p>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line bg-bg px-4 py-3">
        <p className="font-display text-sm tracking-[0.16em] text-gold">{locked ? "SEALED" : choice ? "CHOOSE" : "STORY BRIEF"}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" disabled={locked || !choice} onClick={() => onPlay(watched.current)} className="min-h-11 bg-ion px-4 font-display text-bg disabled:cursor-not-allowed disabled:bg-line disabled:text-muted">
            Play now
          </button>
          <button type="button" onClick={onBack} className="min-h-11 border border-line px-3 font-display">Go back</button>
          <button type="button" onClick={onLoad} className="min-h-11 border border-line px-3 font-display">Load saved game</button>
          {!choice && (
            <button type="button" onClick={() => hold(false)} className="min-h-11 border border-line px-3 font-display">Skip to choice</button>
          )}
        </div>
      </div>
    </div>
  );
}
