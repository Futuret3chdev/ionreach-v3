import { useEffect, useRef, useState } from "react";
import type { Chapter } from "@/game/campaign";
import { STORIES } from "@/game/stories";

type Token = { text: string; word: number | null };

function tokensOf(text: string): Token[] {
  const parts = text.split(/(\s+)/);
  let word = 0;
  return parts.filter(Boolean).map((text) => {
    if (!/\S/.test(text)) return { text, word: null };
    const token = { text, word };
    word += 1;
    return token;
  });
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
  const scroller = useRef<HTMLDivElement>(null);
  const wordEls = useRef<(HTMLElement | null)[]>([]);
  const watched = useRef(false);
  const [blocked, setBlocked] = useState(false);
  const [sound, setSound] = useState(false);
  const [active, setActive] = useState(-1);
  const [speaking, setSpeaking] = useState(false);
  const [voiceNote, setVoiceNote] = useState("");
  const story = STORIES[chapter.theater] ?? chapter.beats.filter(Boolean).join(" ");
  const spoken = chapter.hudson ? `${story} ${chapter.hudson}` : story;
  const storyTokens = tokensOf(story);
  const hudsonTokens = tokensOf(chapter.hudson ?? "");
  const hudsonShift = storyTokens.reduce((n, token) => n + (token.word === null ? 0 : 1), 0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const marksRef = useRef<number[]>([]);

  useEffect(() => {
    const box = scroller.current;
    const el = wordEls.current[active];
    if (!box || !el || active < 0) return;
    const delta = el.getBoundingClientRect().top - box.getBoundingClientRect().top - 12;
    box.scrollTo({ top: box.scrollTop + delta, behavior: "smooth" });
  }, [active]);

  useEffect(() => {
    watched.current = false;
    setBlocked(false);
    setSound(false);
    setActive(-1);
    setSpeaking(false);
    wordEls.current = [];
    const video = videoRef.current;
    if (video) {
      video.muted = true;
      video.loop = true;
      const startVideo = () => {
        void video.play().catch(() => setBlocked(true));
      };
      if (video.readyState >= 2) startVideo();
      else video.addEventListener("loadeddata", startVideo, { once: true });
    }
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.src = "";
      }
    };
  }, [chapter.id, spoken]);

  function readAloud() {
    const video = videoRef.current;
    let audio = audioRef.current;
    if (audio && !audio.paused) {
      audio.pause();
      setSpeaking(false);
      if (video) void video.play().catch(() => undefined);
      return;
    }
    if (!audio) {
      audio = new Audio();
      audioRef.current = audio;
      audio.ontimeupdate = () => {
        const marks = marksRef.current;
        if (!marks.length) return;
        const t = audio!.currentTime + 0.08;
        let index = 0;
        for (let i = 0; i < marks.length; i++) if (marks[i] <= t) index = i;
        setActive(index);
      };
      audio.onended = () => {
        setSpeaking(false);
        const film = videoRef.current;
        if (film) void film.play().catch(() => undefined);
      };
    }
    if (video) {
      video.muted = true;
      video.pause();
    }
    setSound(false);
    setVoiceNote("");
    setActive(0);
    setSpeaking(true);
    marksRef.current = [];
    void fetch(`/media/voice/${chapter.id}.json`)
      .then((res) => (res.ok ? res.json() : []))
      .then((marks: number[]) => {
        marksRef.current = marks;
      })
      .catch(() => undefined);
    audio.src = `/media/voice/${chapter.id}.mp3?v=voice1`;
    void audio.play().catch(() => {
      setSpeaking(false);
      setVoiceNote("Tap Read again.");
    });
  }

  function play() {
    setBlocked(false);
    const video = videoRef.current;
    if (!video) return;
    video.muted = !sound;
    void video.play().catch(() => setBlocked(true));
  }

  function toggleSound() {
    const next = !sound;
    setSound(next);
    const video = videoRef.current;
    if (video) video.muted = !next;
  }

  function paint(token: Token, index: number) {
    if (token.word === null) return token.text;
    const state = active < 0 ? "" : token.word === active ? "bg-gold text-bg" : token.word < active ? "text-white/40" : "";
    return (
      <span
        key={`${chapter.id}-${index}-${token.word}`}
        ref={(node) => {
          if (token.word !== null) wordEls.current[token.word] = node;
        }}
        className={state}
      >
        {token.text}
      </span>
    );
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-black">
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onBack} className="min-h-11 border border-line bg-bg px-4 font-display">
          Back to menu
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={readAloud} className="min-h-11 border border-gold bg-bg px-4 font-display text-gold">
            {speaking ? "Reading" : "Read"}
          </button>
          <button type="button" onClick={toggleSound} className="min-h-11 border border-line bg-bg px-4 font-display">
            {sound ? "Sound on" : "Sound off"}
          </button>
        </div>
      </div>
      <div className="relative mx-auto mt-2 w-full max-w-3xl shrink-0 px-3">
        <video
          ref={videoRef}
          key={chapter.id}
          className="aspect-video w-full bg-black object-cover"
          src={`/media/briefings/${chapter.video}.mp4?v=drive2`}
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
      <article ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <p className="font-display text-xs tracking-[0.22em] text-ion">{chapter.country.toUpperCase()}</p>
        <h2 className="font-display text-3xl font-semibold text-fg">{chapter.theater}</h2>
        {voiceNote && <p className="mt-2 text-sm text-gold">{voiceNote}</p>}
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-fg">{storyTokens.map(paint)}</p>
        {chapter.hudson && (
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-fg">
            {hudsonTokens.map((token, index) => paint(token.word === null ? token : { ...token, word: token.word + hudsonShift }, index + 1000))}
          </p>
        )}
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
